/**
 * 飞书渠道实现 - OpenClaw V11+ Channel 系统
 * 
 * 使用飞书开放平台 SDK 接入
 * 文档: https://open.feishu.cn/document/home/index
 * 
 * 环境变量:
 * - FEISHU_APP_ID: 飞书应用 App ID
 * - FEISHU_APP_SECRET: 飞书应用 App Secret
 * - FEISHU_ENCRYPT_KEY: (可选) 事件订阅加密密钥
 * - FEISHU_VERIFICATION_TOKEN: (可选) 事件订阅验证 Token
 */

import * as lark from '@larksuiteoapi/node-sdk';
import * as http from 'http';

// ============================================================================
// 类型定义 (从 v11-agent.ts 复制，实际使用时应该导入)
// ============================================================================

interface ChannelCapabilities {
  chatTypes: ('direct' | 'group' | 'channel')[];
  reactions?: boolean;
  polls?: boolean;
  media?: boolean;
  threads?: boolean;
  commands?: boolean;
  markdown?: boolean;
}

interface MessageContext {
  channel: string;
  chatType: 'direct' | 'group' | 'channel';
  chatId: string;
  userId: string;
  userName?: string;
  messageId: string;
  text: string;
  replyTo?: string;
  timestamp: number;
}

type TrustLevel = 'owner' | 'trusted' | 'normal' | 'restricted';

interface Channel {
  id: string;
  name: string;
  capabilities: ChannelCapabilities;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  send(target: string, message: string): Promise<void>;
  onMessage(handler: (ctx: MessageContext) => Promise<void>): void;
  getTrustLevel(userId: string): TrustLevel;
  setTrustLevel(userId: string, level: TrustLevel): void;
}

// ============================================================================
// 飞书渠道实现
// ============================================================================

export class FeishuChannel implements Channel {
  id = 'feishu';
  name = '飞书';
  capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group'],
    reactions: true,
    media: true,
    markdown: true,  // 飞书支持富文本，但格式与 Markdown 略有不同
  };

  private running = false;
  private handler?: (ctx: MessageContext) => Promise<void>;
  private trustLevels: Map<string, TrustLevel> = new Map();
  
  // 飞书 SDK 客户端
  private client?: lark.Client;
  private eventDispatcher?: lark.EventDispatcher;
  private server?: http.Server;
  
  // 配置
  private appId: string;
  private appSecret: string;
  private encryptKey?: string;
  private verificationToken?: string;
  private webhookPort: number;

  constructor(options?: {
    appId?: string;
    appSecret?: string;
    encryptKey?: string;
    verificationToken?: string;
    webhookPort?: number;
  }) {
    this.appId = options?.appId || process.env.FEISHU_APP_ID || '';
    this.appSecret = options?.appSecret || process.env.FEISHU_APP_SECRET || '';
    this.encryptKey = options?.encryptKey || process.env.FEISHU_ENCRYPT_KEY;
    this.verificationToken = options?.verificationToken || process.env.FEISHU_VERIFICATION_TOKEN;
    this.webhookPort = options?.webhookPort || parseInt(process.env.FEISHU_WEBHOOK_PORT || '3000');
  }

  async start(): Promise<void> {
    if (!this.appId || !this.appSecret) {
      throw new Error('未配置 FEISHU_APP_ID 或 FEISHU_APP_SECRET');
    }

    // 初始化飞书客户端
    this.client = new lark.Client({
      appId: this.appId,
      appSecret: this.appSecret,
      disableTokenCache: false,
    });

    // 初始化事件分发器
    this.eventDispatcher = new lark.EventDispatcher({
      encryptKey: this.encryptKey,
      verificationToken: this.verificationToken,
    });

    // 注册消息事件处理
    this.setupEventHandlers();

    // 启动 HTTP 服务器接收 Webhook
    await this.startWebhookServer();

    this.running = true;
    console.log(`\x1b[32m[飞书] 渠道已启动，Webhook 端口: ${this.webhookPort}\x1b[0m`);
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }
    this.running = false;
    console.log('\x1b[33m[飞书] 渠道已停止\x1b[0m');
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * 发送消息到飞书
   * @param target - chat_id (群聊ID) 或 open_id/user_id (用户ID)
   * @param message - 消息内容
   */
  async send(target: string, message: string): Promise<void> {
    if (!this.running || !this.client) {
      throw new Error('渠道未运行');
    }

    try {
      // 判断目标类型：以 oc_ 开头是群聊，以 ou_ 开头是用户
      const receiveIdType = target.startsWith('oc_') ? 'chat_id' : 'open_id';

      await this.client.im.message.create({
        params: {
          receive_id_type: receiveIdType,
        },
        data: {
          receive_id: target,
          msg_type: 'text',
          content: JSON.stringify({ text: message }),
        },
      });

      console.log(`\x1b[35m[飞书 -> ${target}]\x1b[0m ${message.slice(0, 100)}...`);
    } catch (error: any) {
      console.error(`\x1b[31m[飞书] 发送失败: ${error.message}\x1b[0m`);
      throw error;
    }
  }

  /**
   * 发送富文本消息（支持 @ 提及、链接等）
   */
  async sendRichText(target: string, content: any): Promise<void> {
    if (!this.running || !this.client) {
      throw new Error('渠道未运行');
    }

    const receiveIdType = target.startsWith('oc_') ? 'chat_id' : 'open_id';

    await this.client.im.message.create({
      params: {
        receive_id_type: receiveIdType,
      },
      data: {
        receive_id: target,
        msg_type: 'post',
        content: JSON.stringify(content),
      },
    });
  }

  /**
   * 发送卡片消息（交互式消息）
   */
  async sendCard(target: string, card: any): Promise<void> {
    if (!this.running || !this.client) {
      throw new Error('渠道未运行');
    }

    const receiveIdType = target.startsWith('oc_') ? 'chat_id' : 'open_id';

    await this.client.im.message.create({
      params: {
        receive_id_type: receiveIdType,
      },
      data: {
        receive_id: target,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    });
  }

  onMessage(handler: (ctx: MessageContext) => Promise<void>): void {
    this.handler = handler;
  }

  getTrustLevel(userId: string): TrustLevel {
    return this.trustLevels.get(userId) || 'normal';
  }

  setTrustLevel(userId: string, level: TrustLevel): void {
    this.trustLevels.set(userId, level);
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private setupEventHandlers(): void {
    if (!this.eventDispatcher) return;

    // 处理接收消息事件
    this.eventDispatcher.register({
      'im.message.receive_v1': async (data: any) => {
        await this.handleMessageReceive(data);
      },
    });

    // 处理消息已读事件（可选）
    this.eventDispatcher.register({
      'im.message.message_read_v1': async (data: any) => {
        // 可以用于追踪消息是否被阅读
        console.log(`\x1b[36m[飞书] 消息已读: ${data.message_id}\x1b[0m`);
      },
    });

    // 处理机器人被 @ 事件
    this.eventDispatcher.register({
      'im.message.receive_v1': async (data: any) => {
        // 检查是否被 @
        if (data.message?.mentions) {
          const botMentioned = data.message.mentions.some(
            (m: any) => m.key === '@_all' || m.id?.user_id === 'bot'
          );
          if (botMentioned) {
            console.log(`\x1b[36m[飞书] 机器人被 @\x1b[0m`);
          }
        }
      },
    });
  }

  private async handleMessageReceive(data: any): Promise<void> {
    if (!this.handler) return;

    try {
      const message = data.message;
      const sender = data.sender;

      // 解析消息内容
      let text = '';
      if (message.message_type === 'text') {
        const content = JSON.parse(message.content);
        text = content.text || '';
      } else if (message.message_type === 'post') {
        // 富文本消息，提取纯文本
        const content = JSON.parse(message.content);
        text = this.extractTextFromPost(content);
      } else {
        // 其他类型消息（图片、文件等）暂时忽略或返回类型提示
        text = `[${message.message_type} 消息]`;
      }

      // 判断聊天类型
      let chatType: 'direct' | 'group' | 'channel' = 'direct';
      if (message.chat_type === 'group') {
        chatType = 'group';
      } else if (message.chat_type === 'p2p') {
        chatType = 'direct';
      }

      // 构建消息上下文
      const ctx: MessageContext = {
        channel: this.id,
        chatType,
        chatId: message.chat_id,
        userId: sender.sender_id?.open_id || sender.sender_id?.user_id || 'unknown',
        userName: sender.sender_id?.user_id,  // 可以通过 API 获取用户名
        messageId: message.message_id,
        text,
        replyTo: message.parent_id,  // 回复的消息 ID
        timestamp: parseInt(message.create_time) || Date.now(),
      };

      // 调用消息处理器
      await this.handler(ctx);
    } catch (error: any) {
      console.error(`\x1b[31m[飞书] 处理消息失败: ${error.message}\x1b[0m`);
    }
  }

  private extractTextFromPost(content: any): string {
    // 从富文本消息中提取纯文本
    const texts: string[] = [];
    
    if (content.post) {
      const post = content.post.zh_cn || content.post.en_us || Object.values(content.post)[0];
      if (post?.content) {
        for (const line of post.content) {
          for (const element of line) {
            if (element.tag === 'text') {
              texts.push(element.text);
            } else if (element.tag === 'at') {
              texts.push(`@${element.user_name || element.user_id}`);
            } else if (element.tag === 'a') {
              texts.push(element.text || element.href);
            }
          }
        }
      }
    }
    
    return texts.join(' ');
  }

  private async startWebhookServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        if (req.method === 'POST' && req.url === '/webhook/feishu') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);

              // 处理 URL 验证请求
              if (data.type === 'url_verification') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ challenge: data.challenge }));
                return;
              }

              // 处理事件
              if (this.eventDispatcher) {
                await this.eventDispatcher.invoke(data);
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } catch (error: any) {
              console.error(`\x1b[31m[飞书] Webhook 处理错误: ${error.message}\x1b[0m`);
              res.writeHead(500);
              res.end('Internal Server Error');
            }
          });
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.server.listen(this.webhookPort, () => {
        console.log(`\x1b[36m[飞书] Webhook 服务器启动在端口 ${this.webhookPort}\x1b[0m`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 获取用户信息
   */
  async getUserInfo(userId: string): Promise<any> {
    if (!this.client) throw new Error('客户端未初始化');
    
    const response = await this.client.contact.user.get({
      path: { user_id: userId },
      params: { user_id_type: 'open_id' },
    });
    
    return response.data?.user;
  }

  /**
   * 获取群聊信息
   */
  async getChatInfo(chatId: string): Promise<any> {
    if (!this.client) throw new Error('客户端未初始化');
    
    const response = await this.client.im.chat.get({
      path: { chat_id: chatId },
    });
    
    return response.data;
  }

  /**
   * 回复消息
   */
  async reply(messageId: string, text: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    
    await this.client.im.message.reply({
      path: { message_id: messageId },
      data: {
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
  }

  /**
   * 添加表情回应
   */
  async addReaction(messageId: string, emojiType: string): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');
    
    await this.client.im.messageReaction.create({
      path: { message_id: messageId },
      data: {
        reaction_type: { emoji_type: emojiType },
      },
    });
  }
}

// ============================================================================
// 使用示例
// ============================================================================

/*
// 在 v11-agent.ts 中注册飞书渠道:

import { FeishuChannel } from './channels/feishu-channel';

// 初始化渠道管理器
const channelManager = new ChannelManager(WORKDIR);

// 注册飞书渠道
channelManager.register(new FeishuChannel({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
  webhookPort: 3000,
}));

// 配置飞书渠道
channelManager.configure('feishu', {
  enabled: true,
  groupPolicy: 'mention-only',  // 群聊只响应 @ 消息
  dmPolicy: 'all',              // 私聊全部响应
  trustedUsers: ['ou_xxx'],     // 信任用户列表
});

// 启动渠道
await channelManager.startAll();
*/

export default FeishuChannel;
