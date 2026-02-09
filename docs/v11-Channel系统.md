# V11: Channel 系统 - 多渠道接入

> 让 Agent 能通过多个社交平台与用户交互

## 设计理念

V11 引入 Channel 抽象层，让 Agent 能够：
1. 接收来自不同平台的消息
2. 根据平台特性调整行为
3. 安全地处理跨渠道交互

## 核心架构

### Channel 接口

```typescript
interface Channel {
  id: string;                    // telegram | discord | feishu
  name: string;                  // 显示名称
  capabilities: ChannelCapabilities;
  
  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // 消息处理
  send(target: string, message: string): Promise<void>;
  onMessage(handler: MessageHandler): void;
}

interface ChannelCapabilities {
  chatTypes: ('direct' | 'group' | 'channel')[];
  reactions?: boolean;
  polls?: boolean;
  media?: boolean;
  threads?: boolean;
  commands?: boolean;
}
```

### 消息上下文

```typescript
interface MessageContext {
  channel: string;           // 来源渠道
  chatType: 'direct' | 'group';
  chatId: string;
  userId: string;
  userName?: string;
  messageId: string;
  text: string;
  replyTo?: string;
  timestamp: number;
}
```

### Channel 管理器

```typescript
class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private messageHandler?: (ctx: MessageContext) => Promise<void>;
  
  register(channel: Channel): void;
  unregister(channelId: string): void;
  
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
  
  send(channelId: string, target: string, message: string): Promise<void>;
  broadcast(message: string): Promise<void>;
  
  onMessage(handler: (ctx: MessageContext) => Promise<void>): void;
}
```

## 实现计划

### Phase 1: 基础框架
- [ ] Channel 接口定义
- [ ] ChannelManager 实现
- [ ] 消息路由逻辑

### Phase 2: Telegram 集成
- [ ] TelegramChannel 实现
- [ ] Bot Token 配置
- [ ] 消息收发测试

### Phase 3: Discord 集成
- [ ] DiscordChannel 实现
- [ ] Bot 权限配置
- [ ] 群组/私聊支持

### Phase 4: 飞书集成
- [ ] FeishuChannel 实现
- [ ] 企业应用配置
- [ ] 消息卡片支持

## 安全考虑

### 渠道隔离
- 每个渠道独立的权限配置
- 群聊 vs 私聊的不同策略
- 敏感信息不跨渠道泄露

### 用户认证
```typescript
interface ChannelUser {
  channelId: string;
  userId: string;
  trustLevel: 'owner' | 'trusted' | 'normal' | 'restricted';
}
```

### 命令权限
```typescript
interface CommandPolicy {
  command: string;
  allowedChannels: string[];
  allowedChatTypes: ('direct' | 'group')[];
  minTrustLevel: string;
}
```

## 与现有系统集成

### V10 内省系统
- 记录每个渠道的消息统计
- 分析跨渠道行为模式

### V9 会话管理
- 每个渠道+用户组合一个会话
- 支持跨渠道会话关联

### V8 心跳系统
- 渠道健康��查
- 自动重连机制

## 配置示例

```typescript
const config = {
  channels: {
    telegram: {
      enabled: true,
      token: process.env.TELEGRAM_BOT_TOKEN,
      allowFrom: ['user123', 'group456'],
      groupPolicy: 'mention-only'
    },
    discord: {
      enabled: true,
      token: process.env.DISCORD_BOT_TOKEN,
      guilds: ['guild123'],
      dmPolicy: 'allowlist'
    }
  }
};
```

## 参考

- OpenClaw Channel 架构: `src/channels/`
- Telegram Bot API: grammy.dev
- Discord.js: discord.js.org

---

*Created: 2026-02-09*
