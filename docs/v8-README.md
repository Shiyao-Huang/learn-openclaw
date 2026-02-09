# V8-Agent: 心跳与主动性

> **核心哲学**: Agent 不只是被动响应，还能主动维护

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

---

## 为什么需要 V8？

V0-V7 的 Agent 都是**被动的**——你问它才答，你不问它就睡着了。

但真正有用的 Agent 应该能：
- 定时检查邮件、日历、任务
- 主动提醒你重要事项
- 在后台整理记忆、更新状态

V8 引入 **Heartbeat 系统**，让 Agent 有了"心跳"——即使你不说话，它也在运行。

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    ResidentAgent                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  IPC Server  │    │   Heartbeat  │    │  Interactive │  │
│  │  (Unix Sock) │    │    Timer     │    │     Mode     │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │          │
│         ▼                   ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              executeHeartbeat()                      │   │
│  │  → shouldDisturb() 深夜静默检查                       │   │
│  │  → 读取 HEARTBEAT.md 任务清单                         │   │
│  │  → 调用 Claude API 执行检查                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 三个核心组件

| 组件 | 作用 | 触发方式 |
|------|------|----------|
| **IPC Server** | 接收外部命令 | Unix Socket (`HEARTBEAT`/`STATUS`/`STOP`) |
| **Heartbeat Timer** | 定时心跳 | `setInterval` (默认 30 分钟) |
| **Interactive Mode** | 交互对话 | stdin/stdout |

---

## 快速开始

### 1. 安装依赖

```bash
cd learn-openclaw
npm install
cp .env.example .env
# 填写 ANTHROPIC_API_KEY
```

### 2. 运行模式

```bash
# 交互模式（默认）- 能聊天 + 后台心跳
npx tsx v8-agent.ts

# 后台常驻模式 - 无交互，只跑心跳
npx tsx v8-agent.ts --daemon

# 单次心跳后退出
npx tsx v8-agent.ts --once

# 查看运行状态
npx tsx v8-agent.ts --status

# 停止 daemon
npx tsx v8-agent.ts --stop

# 自定义心跳间隔（分钟）
npx tsx v8-agent.ts --interval 15
```

### 3. 交互命令

进入交互模式后：

```
>> heartbeat    # 手动触发心跳
>> status       # 查看状态
>> q            # 退出
>> 你的问题     # 正常对话
```

---

## Heartbeat 系统���解

### 文件结构

```
workspace/
├── HEARTBEAT.md                    # 检查清单（用户编辑）
├── memory/
│   └── heartbeat-state.json        # 检查状态（自动维护）
├── .openclaw.pid                   # 进程 PID
└── .openclaw.ipc                   # Unix Socket
```

### HEARTBEAT.md 示例

```markdown
# 心跳检查清单

- [ ] 检查未读邮件
- [ ] 查看今日日历
- [ ] 跟进未完成任务
- [ ] 整理 memory 文件
```

Agent 会读取这个文件，决定每次心跳要做什么。

### 三层节流保护

防止心跳被滥用：

```typescript
// 1. 深夜静默 (23:00-08:00)
shouldDisturb(): boolean {
  const hour = new Date().getHours();
  return hour >= 8 && hour < 23;
}

// 2. 定时间隔
const DEFAULT_HEARTBEAT_INTERVAL = 30 * 60 * 1000;  // 30 分钟

// 3. IPC 节流
const MIN_HEARTBEAT_GAP = 60 * 1000;  // 最小 1 分钟
if (now - this.lastHeartbeatTime < MIN_HEARTBEAT_GAP) {
  socket.write("THROTTLED");
  return;
}
```

---

## 5 个 Heartbeat 工具

| 工具 | 作用 |
|------|------|
| `heartbeat_get` | 读取 HEARTBEAT.md 清单 |
| `heartbeat_update` | 更新清单内容 |
| `heartbeat_record` | 记录某项检查完成时间 |
| `heartbeat_status` | 查看心跳状态 |
| `heartbeat_run` | 手动触发心跳 |

### 使用示例

```typescript
// 写入检查清单
heartbeat_update({ content: "# HEARTBEAT\n- [ ] 检查邮件\n- [ ] 整理笔记" })

// 触发心跳
heartbeat_run({})

// 标记完成
heartbeat_record({ check_name: "检查邮件" })

// 查看状态
heartbeat_status({})
// 输出: 上次心跳: 2024-01-15 14:30:00
//       检查邮件: 5 分钟前
```

---

## IPC 通信

外部进程可以通过 Unix Socket 控制 Agent：

```bash
# 触发心跳
echo "HEARTBEAT" | nc -U .openclaw.ipc

# 查看状态
echo "STATUS" | nc -U .openclaw.ipc

# 停止 Agent
echo "STOP" | nc -U .openclaw.ipc
```

### IPC 协议

| 命令 | 响应 |
|------|------|
| `HEARTBEAT` | `OK` 或 `THROTTLED` |
| `STATUS` | `OK\|PID:xxx\|Heartbeat:...` |
| `STOP` | `OK\|Stopping` |

---

## 与 V7 的对比

| 维度 | V7 | V8 |
|------|-----|-----|
| 代码行数 | 1372 | 1671 |
| 工具数 | 27 | 30 |
| 运行模式 | 单次对话 | 常驻 daemon |
| 主动性 | 无 | 定时心跳 |
| IPC | 无 | Unix Socket |
| 新文件 | - | `HEARTBEAT.md`, `heartbeat-state.json` |

---

## 完整循环

```
heartbeat → recall → identify → plan → execute → track → remember
    ↑                                                      │
    └──────────────────────────────────────────────────────┘
```

心跳是循环的起点，让 Agent 能自己"醒来"开始工作。

---

## 常见问题

### Q: Daemon 模式下怎么看日志？

```bash
# 日志输出到 stdout，可以重定向
npx tsx v8-agent.ts --daemon > agent.log 2>&1 &
tail -f agent.log
```

### Q: 怎么让心跳更频繁？

```bash
npx tsx v8-agent.ts --interval 5  # 5 分钟一次
```

### Q: 深夜也想收通知？

修改 `shouldDisturb()` 函数，或者直接返回 `true`。

### Q: 怎么知道 Agent 还活着？

```bash
npx tsx v8-agent.ts --status
# 或
cat .openclaw.pid && echo "STATUS" | nc -U .openclaw.ipc
```

---

## 下一步

V8 让 Agent 有了主动性，但它还是单会话的。

→ [V9: 会话管理](./v9-会话管理.md) - 多会话路由、子 Agent 协调

---

## License

MIT
