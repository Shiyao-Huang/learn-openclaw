/**
 * plug/feishu/channel.ts - 飞书渠道实现
 * 
 * 使用 WebSocket 模式接收消息（无需公网 IP）
 */

import * as lark from '@larksuiteoapi/node-sdk';
import type { 
  Channel, 
  ChannelCapabilities, 
  MessageContext, 
  TrustLevel 
} from '../../v11-agent/channel/types.js';

export interface FeishuChannelOptions {
  appId?: string;
  appSecret?: string;
}

export class FeishuChannel implements Channel {
  id = 'feishu';
  name = '飞书';
  capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group'],
    reactions: true,
    media: true,
    markdown: true,
  };

  private running = false;
  private handler?: (ctx: MessageContext) => Promise<void>;
  private trustLevels: Map<string, TrustLevel> = new Map();
  
  private client?: lark.Client;
  private wsClient?: lark.WSClient;
  
  private appId: string;
  private appSecret: string;

  constructor(options?: FeishuChannelOptions) {
    this.appId = options?.appId || process.env.FEISHU_APP_ID || '';
    this.appSecret = options?.appSecret || process.env.FEISHU_APP_SECRET || '';
  }

  async start(): Promise<void> {
    if (!this.appId || !this.appSecret) {
      throw new Error('未配置 FEISHU_APP_ID 或 FEISHU_APP_SECRET');
    }

    // 创建 HTTP 客户端 (用于发送消息)
    this.client = new lark.Client({
      appId: this.appId,
      appSecret: this.appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });

    // 创建事件分发器
    const eventDispatcher = new lark.EventDispatcher({});

    // 注册消息事件处理
    eventDispatcher.register({
      'im.message.receive_v1': async (data: any) => {
        await this.handleMessageReceive(data);
      },
    });

    // 创建 WebSocket 客户端 (用于接收消息，无需公网IP)
    this.wsClient = new lark.WSClient({
      appId: this.appId,
      appSecret: this.appSecret,
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.warn,  // 减少日志噪音
    });

    // 启动 WebSocket 连接
    this.wsClient.start({ eventDispatcher });

    this.running = true;
    console.log(`\x1b[32m[飞书] 渠道已启动 (WebSocket 模式)\x1b[0m`);
  }

  async stop(): Promise<void> {
    // WSClient 没有 stop 方法，设置为 undefined 让 GC 回收
    this.wsClient = undefined;
    this.client = undefined;
    this.running = false;
    console.log('\x1b[33m[飞书] 渠道已停止\x1b[0m');
  }

  isRunning(): boolean {
    return this.running;
  }

  async send(target: string, message: string): Promise<void> {
    if (!this.running || !this.client) {
      throw new Error('渠道未运行');
    }

    try {
      // 判断目标类型：以 oc_ 开头是群聊，以 ou_ 开头是用户
      const receiveIdType = target.startsWith('oc_') ? 'chat_id' : 'open_id';

      const response = await this.client.im.message.create({
        params: { receive_id_type: receiveIdType },
        data: {
          receive_id: target,
          msg_type: 'text',
          content: JSON.stringify({ text: message }),
        },
      }) as any;

      if (response.code !== 0) {
        throw new Error(`飞书发送失败: ${response.msg}`);
      }

      console.log(`\x1b[35m[飞书 -> ${target}]\x1b[0m ${message.slice(0, 100)}...`);
    } catch (error: any) {
      console.error(`\x1b[31m[飞书] 发送失败: ${error.message}\x1b[0m`);
      throw error;
    }
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

  private async handleMessageReceive(data: any): Promise<void> {
    if (!this.handler) return;

    try {
      const message = data.message;
      const sender = data.sender;

      // 解析消息内容
      let text = '';
      if (message.message_type === 'text') {
        try {
          const content = JSON.parse(message.content);
          text = content.text || '';
        } catch {
          text = message.content;
        }
      } else if (message.message_type === 'post') {
        try {
          const content = JSON.parse(message.content);
          text = this.extractTextFromPost(content);
        } catch {
          text = '[富文本消息]';
        }
      } else {
        text = `[${message.message_type} 消息]`;
      }

      // 检测是否被 @
      let mentioned = false;
      if (message.mentions && message.mentions.length > 0) {
        mentioned = true;
        // 移除 @ 标记
        for (const mention of message.mentions) {
          text = text.replace(new RegExp(`@${mention.name}\\s*`, 'g'), '').trim();
          text = text.replace(new RegExp(mention.key, 'g'), '').trim();
        }
      }

      const chatType = message.chat_type === 'group' ? 'group' : 'direct';

      const ctx: MessageContext = {
        channel: this.id,
        chatType,
        chatId: message.chat_id,
        userId: sender.sender_id?.open_id || sender.sender_id?.user_id || 'unknown',
        userName: sender.sender_id?.user_id,
        messageId: message.message_id,
        text,
        replyTo: message.parent_id,
        timestamp: parseInt(message.create_time) || Date.now(),
        mentioned,
        raw: data,
      };

      console.log(`\x1b[36m[飞书 <- ${ctx.userId}] ${text.slice(0, 100)}\x1b[0m`);
      await this.handler(ctx);
    } catch (error: any) {
      console.error(`\x1b[31m[飞书] 处理消息失败: ${error.message}\x1b[0m`);
    }
  }

  private extractTextFromPost(content: any): string {
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

  // ============================================================================
  // 辅助方法
  // ============================================================================

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

export default FeishuChannel;
