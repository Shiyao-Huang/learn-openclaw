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
  id: string;                    // telegram | discord | console
  name: string;                  // 显示名称
  capabilities: ChannelCapabilities;
  
  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  
  // 消息处理
  send(target: string, message: string): Promise<void>;
  onMessage(handler: MessageHandler): void;
  
  // 用户管理
  getTrustLevel(userId: string): TrustLevel;
  setTrustLevel(userId: string, level: TrustLevel): void;
}

interface ChannelCapabilities {
  chatTypes: ('direct' | 'group' | 'channel')[];
  reactions?: boolean;
  polls?: boolean;
  media?: boolean;
  threads?: boolean;
  commands?: boolean;
  markdown?: boolean;
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
  private configs: Map<string, ChannelConfig> = new Map();
  
  register(channel: Channel): void;
  unregister(channelId: string): void;
  
  startAll(): Promise<string>;
  stopAll(): Promise<void>;
  
  send(channelId: string, target: string, message: string): Promise<string>;
  broadcast(message: string): Promise<string>;
  
  list(): string;
  status(channelId?: string): string;
  configure(channelId: string, updates: Partial<ChannelConfig>): string;
  
  onMessage(handler: (ctx: MessageContext) => Promise<void>): void;
}
```

### 用户信任等级

```typescript
type TrustLevel = 'owner' | 'trusted' | 'normal' | 'restricted';

// owner: 完全访问，可执行任何操作
// trusted: 大部分操作，但不能修改系统配置
// normal: 基本交互，受限的工具访问
// restricted: 只读，��能执行任何工具
```

## 工具列表

| 工具 | 描述 |
|------|------|
| `channel_list` | 列出所有已注册渠道及其状态 |
| `channel_send` | 向指定渠道发送消息 |
| `channel_status` | 查看渠道状态 |
| `channel_config` | 配置渠道参数 |
| `channel_start` | 启动所有已启用的渠道 |
| `channel_stop` | 停止所有渠道 |

## 内置渠道

### Console Channel (测试用)
- ID: `console`
- 用于本地测试和开发
- 支持模拟消息接收

### Telegram Channel (骨架)
- ID: `telegram`
- 能力: reactions, polls, media, commands, markdown
- 需要配置 `TELEGRAM_BOT_TOKEN`

### Discord Channel (骨架)
- ID: `discord`
- 能力: reactions, threads, media, commands, markdown
- 需要配置 `DISCORD_BOT_TOKEN`

## 配置示例

```typescript
// .channels.json
{
  "telegram": {
    "enabled": true,
    "groupPolicy": "mention-only",
    "dmPolicy": "all",
    "trustedUsers": ["user123"]
  },
  "discord": {
    "enabled": false
  }
}
```

## 安全策略

### 渠道隔离
- 每个渠道独立的权限配置
- 群聊 vs 私聊的不同策略
- 敏感信息不跨渠道泄露

### 群组策略 (groupPolicy)
- `all`: 响应所有消息
- `mention-only`: 只响应 @提及
- `disabled`: 不响应群组消息

### 私聊策略 (dmPolicy)
- `all`: 响应所有私聊
- `allowlist`: 只响应白名单用户
- `disabled`: 不响应私聊

## 与现有系统集成

### V10 内省系统
- 记录每个渠道的消息统计
- 分析跨渠道行为模式

### V9 会话管理
- 每个渠道+用户组合一个会话
- 支持跨渠道会话关联

### V8 心跳系统
- 渠道健康检查
- 自动重连机制

## 扩展新渠道

实现 `Channel` 接口即可添加新渠道：

```typescript
class MyChannel implements Channel {
  id = 'my-channel';
  name = 'My Channel';
  capabilities = { chatTypes: ['direct'] };
  
  async start() { /* 连接逻辑 */ }
  async stop() { /* 断开逻辑 */ }
  isRunning() { return this.running; }
  
  async send(target, message) { /* 发送逻辑 */ }
  onMessage(handler) { this.handler = handler; }
  
  getTrustLevel(userId) { return 'normal'; }
  setTrustLevel(userId, level) { /* 存储逻辑 */ }
}

// 注册
channelManager.register(new MyChannel());
```

## 参考

- OpenClaw Channel 架构: `src/channels/`
- Telegram Bot API: grammy.dev
- Discord.js: discord.js.org

---

*Created: 2026-02-10*
*Lines: ~2324*
