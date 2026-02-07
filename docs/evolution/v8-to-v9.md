# V8 → V9: 从主动性到多会话

## 📊 版本对比

| 维度 | V8 | V9 |
|------|----|----|
| 代码行数 | ~1369 | ~1516 |
| 工具数量 | 30 | 30 (session_* 待添加) |
| 核心理念 | 主动即价值 | 隔离即安全 |
| 会话模式 | ❌ 单一会话 | ✅ 多会话管理 |

## 🎯 Motivation: 为什么需要 V9？

### V8 的局限性

```
场景: Agent 需要同时处理多个独立任务

V8 的做法:
1. 所有任务在同一个会话中
2. 上下文混在一起
3. 敏感信息可能泄露给外部请求
```

**问题：**
1. **单一上下文** - 无法同时处理多个独立任务
2. **隐私混淆** - 不同用户/场景的信息可能混在一起
3. **无法隔离** - 敏感操作和普通操作共享同一上下文
4. **无持久化** - 会话结束后历史丢失

### V9 的解决方案

```
project/
├── .sessions/                    # 会话持久化目录
│   ├── session_main_001.json
│   ├── session_1705123456_abc123.json
│   └── ...
└── ...
```

**优势：**
1. **多会话支持** - 同时维护多个独立会话
2. **会话类型** - main（完整记忆）vs isolated（轻量隔离）
3. **会话持久化** - 会话可以保存和恢复
4. **会话路由** - 根据请求来源决定使用哪个会话

## 🔧 核心变更

### 1. Session 接口 (新增 ~15行)

```typescript
type SessionType = "main" | "isolated";

interface Session {
  key: string;                          // 唯一标识
  type: SessionType;                    // 会话类型
  history: Anthropic.MessageParam[];    // 对话历史
  createdAt: number;                    // 创建时间
  lastActiveAt: number;                 // 最后活跃时间
  metadata: Record<string, any>;        // 自定义元数据
}
```

### 2. SessionManager 类 (新增 ~130行)

```typescript
class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private workspaceDir: string;
  private sessionsDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.sessionsDir = path.join(workspaceDir, ".sessions");
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    this.loadSessions();
  }

  // 加载持久化的会话
  private loadSessions() {
    const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.sessionsDir, file), "utf-8"));
        this.sessions.set(data.key, data);
      } catch (e) {
        // 忽略损坏的会话文件
      }
    }
  }

  // 保存会话
  private saveSession(session: Session) {
    const filePath = path.join(this.sessionsDir, `${session.key}.json`);
    // 只保存最近 20 条历史
    const toSave = {
      ...session,
      history: session.history.slice(-20)
    };
    fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2));
  }

  // 生成会话 key
  private generateKey(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // 创建新会话
  createSession(type: SessionType = "main", metadata: Record<string, any> = {}): Session {
    const session: Session = {
      key: this.generateKey(),
      type,
      history: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      metadata
    };
    this.sessions.set(session.key, session);
    this.saveSession(session);
    return session;
  }

  // 获取或创建会话
  getOrCreateSession(key?: string, type: SessionType = "main"): Session {
    if (key) {
      const existing = this.getSession(key);
      if (existing) return existing;
    }
    return this.createSession(type);
  }

  // 判断是否是主会话
  isMainSession(key: string): boolean {
    const session = this.sessions.get(key);
    return session?.type === "main";
  }

  // 清理过期会话（超过 7 天）
  cleanupSessions(): string {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [key, session] of this.sessions) {
      if (session.lastActiveAt < cutoff) {
        this.deleteSession(key);
        cleaned++;
      }
    }

    return `已清理 ${cleaned} 个过期会话`;
  }
}
```

### 3. 系统提示更新

```typescript
const BASE_SYSTEM = `你是 OpenClaw V9 - 多会话 Agent。

工作循环: route -> heartbeat -> recall -> identify -> plan -> execute -> track -> remember

Session 规则 (V9 新增):
- 每个会话有独立的上下文和历史
- main 会话: 加载完整记忆和人格
- isolated 会话: 轻量运行，不加载敏感信息
- 使用 session_* 工具管理会话`;
```

## 📈 Diff 统计

```diff
 v8-agent.ts → v9-agent.ts

 + 新增 ~147 行
   - SessionType 类型 (~1行)
   - Session 接口 (~10行)
   - SessionManager 类 (~130行)
   - sessionManager 实例 (~1行)
   - 系统提示 Session 规则 (~5行)

 ~ 修改 ~5 行
   - 系统提示增加 route 步骤
   - 工作循环更新
```

## 💡 设计洞察

> **main vs isolated 会话**
>
> | 维度 | main | isolated |
> |------|------|----------|
> | 记忆加载 | 完整 | 最小化 |
> | 敏感信息 | 可访问 | 不可访问 |
> | 适用场景 | 主用户交互 | 外部请求、临时任务 |
> | 持久化 | 长期保存 | 可快速清理 |

> **会话持久化的设计**
>
> ```typescript
> private saveSession(session: Session) {
>   // 只保存最近 20 条历史
>   const toSave = {
>     ...session,
>     history: session.history.slice(-20)
>   };
>   fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2));
> }
> ```
>
> - 限制历史长度，避免文件过大
> - JSON 格式，便于调试和迁移
> - 按会话 key 命名，便于管理

> **会话路由的作用**
>
> ```
> 请求 → 路由 → 选择/创建会话 → 加载上下文 → 处理 → 保存
> ```
>
> - 根据请求来源决定会话类型
> - 外部 API 请求使用 isolated 会话
> - 主用户交互使用 main 会话

> **7 天过期清理**
>
> ```typescript
> cleanupSessions(): string {
>   const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
>   // ...
> }
> ```
>
> - 自动清理过期会话
> - 避免会话文件无限增长
> - 可手动触发或定期执行

## 🧪 验证测试

```bash
# 创建隔离会话
npx tsx v9-agent.ts "创建一个隔离会话处理临时任务"

# 列出所有会话
npx tsx v9-agent.ts "列出所有会话"

# 清理过期会话
npx tsx v9-agent.ts "清理过期会话"

# 查看会话目录
ls -la .sessions/
```

## 🌟 演进路线总结

V9 完成了 OpenClaw 的核心演进：

```
V0-V5: 技术能力
├── V0: Bash 即一切 (~150行)
├── V1: 5 工具 + 安全边界 (~287行)
├── V2: 本地记忆 (~457行)
├── V3: 任务规划 (~527行)
├── V4: 子代理协调 (~570行)
└── V5: Skill 系统 (~554行)

V6-V8: 人格能力
├── V6: 身份系统 (~930行)
├── V7: 分层记忆 (~1176行)
└── V8: 心跳系统 (~1369行)

V9: Session 路由 (~1516行)
└── 多会话管理

V10: Channel 适配 (下一步)
└── 多渠道接入
```

## 🔮 下一步: V10 Channel 适配

V9 的 Agent 能管理多个会话了，但所有请求都来自同一个入口。V10 将引入 Channel 适配：

```typescript
// V10 预览
interface Channel {
  name: string;           // cli, api, webhook, slack, telegram
  receive(): Message;     // 接收消息
  send(msg: Message): void; // 发送消息
}

class ChannelRouter {
  private channels: Map<string, Channel> = new Map();

  // 注册渠道
  register(channel: Channel) {
    this.channels.set(channel.name, channel);
  }

  // 路由消息到对应会话
  route(channelName: string, message: Message) {
    const session = sessionManager.getOrCreateSession(
      message.sessionKey,
      channelName === "api" ? "isolated" : "main"
    );
    // 处理消息...
  }
}
```

这将让 Agent 能够：
- 同时接入多个渠道（CLI、API、Webhook、消息平台）
- 根据渠道类型自动选择会话类型
- 统一的消息处理和响应
