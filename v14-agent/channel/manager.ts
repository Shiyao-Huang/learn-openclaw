/**
 * v11-agent/channel/manager.ts - 渠道管理器
 * 
 * 管理多个渠道的注册、启动、消息路由
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type {
  Channel,
  ChannelConfig,
  MessageContext,
  GroupPolicy,
  DmPolicy,
} from "./types.js";

export class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private configs: Map<string, ChannelConfig> = new Map();
  private configFile: string;
  private messageHandler?: (ctx: MessageContext) => Promise<void>;

  constructor(workDir: string) {
    this.configFile = path.join(workDir, ".channels.json");
    this.loadConfigsSync();
  }

  // 同步加载渠道配置（仅用于构造函数）
  private loadConfigsSync(): void {
    if (fs.existsSync(this.configFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.configFile, "utf-8"));
        for (const [id, config] of Object.entries(data)) {
          this.configs.set(id, config as ChannelConfig);
        }
      } catch (e) {
        console.log("\x1b[33m警告: 渠道配置文件损坏\x1b[0m");
      }
    }
  }

  // 异步加载渠道配置
  async loadConfigs(): Promise<void> {
    if (fs.existsSync(this.configFile)) {
      try {
        const data = JSON.parse(await fsp.readFile(this.configFile, "utf-8"));
        for (const [id, config] of Object.entries(data)) {
          this.configs.set(id, config as ChannelConfig);
        }
      } catch (e) {
        console.log("\x1b[33m警告: 渠道配置文件损坏\x1b[0m");
      }
    }
  }

  // 保存渠道配置
  private async saveConfigs(): Promise<void> {
    const data: Record<string, ChannelConfig> = {};
    for (const [id, config] of this.configs) {
      data[id] = config;
    }
    await fsp.writeFile(this.configFile, JSON.stringify(data, null, 2));
  }

  // 注册渠道
  register(channel: Channel): void {
    this.channels.set(channel.id, channel);

    // 初始化默认配置
    if (!this.configs.has(channel.id)) {
      this.configs.set(channel.id, {
        enabled: false,
        groupPolicy: 'mention-only',
        dmPolicy: 'all',
        trustedUsers: [],
      });
      this.saveConfigs().catch(e => console.error(`保存配置失败: ${e.message}`));
    }
    
    // 绑定消息处理器
    channel.onMessage(async (ctx) => {
      // 检查策略
      if (!this.shouldRespond(ctx)) {
        console.log(`\x1b[33m[${channel.id}] 跳过消息 (策略限制)\x1b[0m`);
        return;
      }
      
      if (this.messageHandler) {
        await this.messageHandler(ctx);
      }
    });
    
    console.log(`\x1b[36m[Channel] 注册: ${channel.name} (${channel.id})\x1b[0m`);
  }

  // 检查是否应该响应消息
  private shouldRespond(ctx: MessageContext): boolean {
    const config = this.configs.get(ctx.channel);
    console.log(`\x1b[90m[shouldRespond] channel=${ctx.channel}, chatType=${ctx.chatType}, config=${JSON.stringify(config)}\x1b[0m`);
    
    if (!config) {
      console.log(`\x1b[33m[shouldRespond] 无配置，默认响应\x1b[0m`);
      return true; // 无配置时默认响应
    }

    if (ctx.chatType === 'group') {
      // 群聊策略
      const policy = config.groupPolicy || 'all';
      switch (policy) {
        case 'disabled':
          return false;
        case 'mention-only':
          return ctx.mentioned === true;
        case 'all':
        default:
          return true;
      }
    } else {
      // 私聊策略（direct 或其他）
      const policy = config.dmPolicy || 'all';
      switch (policy) {
        case 'disabled':
          return false;
        case 'allowlist':
          return config.trustedUsers?.includes(ctx.userId) ||
                 (config.allowFrom?.includes(ctx.userId) ?? false);
        case 'all':
        default:
          return true;
      }
    }
  }

  // 注销渠道
  unregister(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.stop();
      this.channels.delete(channelId);
      console.log(`\x1b[36m[Channel] 注销: ${channelId}\x1b[0m`);
    }
  }

  // 启动所有已启用的渠道
  async startAll(): Promise<string> {
    const results: string[] = [];
    for (const [id, channel] of this.channels) {
      const config = this.configs.get(id);
      if (config?.enabled) {
        try {
          await channel.start();
          results.push(`✓ ${channel.name}`);
        } catch (e: any) {
          results.push(`✗ ${channel.name}: ${e.message}`);
        }
      }
    }
    return results.length > 0 ? results.join('\n') : '没有已启用的渠道';
  }

  // 停止所有渠道
  async stopAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      if (channel.isRunning()) {
        await channel.stop();
      }
    }
  }

  // 发送消息到指定渠道
  async send(channelId: string, target: string, message: string): Promise<string> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return `错误: 未知渠道 ${channelId}`;
    }
    if (!channel.isRunning()) {
      return `错误: 渠道 ${channelId} 未运行`;
    }
    try {
      await channel.send(target, message);
      return `已发送到 ${channelId}:${target}`;
    } catch (e: any) {
      return `发送失败: ${e.message}`;
    }
  }

  // 设置消息处理器
  onMessage(handler: (ctx: MessageContext) => Promise<void>): void {
    this.messageHandler = handler;
  }

  // 配置渠道
  async configure(channelId: string, options: Partial<ChannelConfig>): Promise<string> {
    let config = this.configs.get(channelId);
    if (!config) {
      config = {
        enabled: false,
        groupPolicy: 'mention-only',
        dmPolicy: 'all',
        trustedUsers: [],
      };
    }

    this.configs.set(channelId, { ...config, ...options });
    await this.saveConfigs();
    return `已更新 ${channelId} 配置`;
  }

  // 获取渠道配置
  getConfig(channelId: string): ChannelConfig | undefined {
    return this.configs.get(channelId);
  }

  // 列出所有渠道
  list(): string {
    if (this.channels.size === 0) {
      return '暂无注册的渠道';
    }
    
    const lines: string[] = ['## 已注册渠道\n'];
    for (const [id, channel] of this.channels) {
      const config = this.configs.get(id);
      const status = channel.isRunning() 
        ? '🟢 运行中' 
        : config?.enabled 
          ? '🟡 已启用' 
          : '⚪ 未启用';
      
      const caps: string[] = [];
      if (channel.capabilities.reactions) caps.push('reactions');
      if (channel.capabilities.polls) caps.push('polls');
      if (channel.capabilities.media) caps.push('media');
      if (channel.capabilities.threads) caps.push('threads');
      
      lines.push(`### ${channel.name} (${id})`);
      lines.push(`状态: ${status}`);
      lines.push(`类型: ${channel.capabilities.chatTypes.join(', ')}`);
      if (caps.length > 0) lines.push(`能力: ${caps.join(', ')}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }

  // 获取渠道状态
  status(channelId?: string): string {
    if (channelId) {
      const channel = this.channels.get(channelId);
      const config = this.configs.get(channelId);
      if (!channel) return `未知渠道: ${channelId}`;
      
      return [
        `渠道: ${channel.name}`,
        `状态: ${channel.isRunning() ? '运行中' : '已停止'}`,
        `启用: ${config?.enabled ? '是' : '否'}`,
        `群组策略: ${config?.groupPolicy || 'mention-only'}`,
        `私聊策略: ${config?.dmPolicy || 'all'}`,
        `信任用户: ${config?.trustedUsers?.join(', ') || '(无)'}`,
      ].join('\n');
    }
    
    // 总体状态
    const total = this.channels.size;
    const enabled = Array.from(this.configs.values()).filter(c => c.enabled).length;
    const running = Array.from(this.channels.values()).filter(c => c.isRunning()).length;
    
    return `渠道总数: ${total}\n已启用: ${enabled}\n运行中: ${running}`;
  }

  // 获取渠道实例
  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  // 获取所有渠道
  getAllChannels(): Map<string, Channel> {
    return this.channels;
  }
}

export default ChannelManager;
