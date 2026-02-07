# V7 → V8: 从时间感知到主动性

## 📊 版本对比

| 维度 | V7 | V8 |
|------|----|----|
| 代码行数 | ~1176 | ~1369 |
| 工具数量 | 24 | 30 (+6 heartbeat_*) |
| 核心理念 | 时间即维度 | 主动即价值 |
| 行为模式 | ❌ 被动响应 | ✅ 主动检查 |

## 🎯 Motivation: 为什么需要 V8？

### V7 的局限性

```
场景: 用户设置了一个提醒，但忘记了

V7 的做法:
1. 记录到日记或长期记忆
2. 等待用户主动询问
3. 用户不问，Agent 不说
```

**问题：**
1. **被动响应** - 用户不问，Agent 不说
2. **遗忘提醒** - 重要事项容易被遗忘
3. **无主动性** - 不会主动检查待办事项
4. **无周期性** - 没有定期检查机制

### V8 的解决方案

```
project/
├── HEARTBEAT.md              # 心跳检查清单
├── memory/
│   └── heartbeat-state.json  # 心跳状态
└── ...
```

**优势：**
1. **主动检查** - 定期检查是否有需要提醒的事
2. **到期提醒** - 自动提醒即将到期的任务
3. **深夜静默** - 智能判断是否应该打扰用户
4. **状态追踪** - 记录上次检查时间，避免重复

## 🔧 核心变更

### 1. HEARTBEAT_TEMPLATE (新增 ~20行)

```typescript
const HEARTBEAT_TEMPLATE = `# HEARTBEAT.md - 心跳检查清单

当收到心跳信号时，按此清单检查。如果没有需要处理的事项，回复 HEARTBEAT_OK。

## 检查项（按需启用）
# - [ ] 检查 memory/ 是否需要整理
# - [ ] 检查 MEMORY.md 是否需要更新
# - [ ] 检查是否有未完成的承诺
# - [ ] 检查日历是否有即将到来的事件

## 规则
- 深夜 (23:00-08:00) 除非紧急否则不打扰
- 刚检查过 (<30分钟) 不重复检查
- 没有新情况时回复 HEARTBEAT_OK
`;
```

### 2. HeartbeatSystem 类 (新增 ~130行)

```typescript
interface HeartbeatState {
  lastChecks: Record<string, number>;
  lastHeartbeat: number;
}

class HeartbeatSystem {
  private workspaceDir: string;
  private heartbeatFile: string;
  private stateFile: string;
  private state: HeartbeatState;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.heartbeatFile = path.join(workspaceDir, "HEARTBEAT.md");
    this.stateFile = path.join(workspaceDir, "memory", "heartbeat-state.json");
    this.state = this.loadState();
  }

  // 初始化 HEARTBEAT.md
  init(): string {
    if (!fs.existsSync(this.heartbeatFile)) {
      fs.writeFileSync(this.heartbeatFile, HEARTBEAT_TEMPLATE, "utf-8");
      return "已创建 HEARTBEAT.md";
    }
    return "HEARTBEAT.md 已存在";
  }

  // 记录检查时间
  recordCheck(checkName: string): string {
    this.state.lastChecks[checkName] = Date.now();
    this.state.lastHeartbeat = Date.now();
    this.saveState();
    return `已记录检查: ${checkName}`;
  }

  // 判断是否应该打扰用户
  shouldDisturb(): boolean {
    const hour = new Date().getHours();
    // 深夜不打扰
    if (hour >= 23 || hour < 8) return false;
    return true;
  }

  // 判断是否需要检查某项
  needsCheck(checkName: string, intervalMinutes: number = 30): boolean {
    const lastTime = this.state.lastChecks[checkName] || 0;
    const elapsed = (Date.now() - lastTime) / 60000;
    return elapsed >= intervalMinutes;
  }

  // 执行心跳
  runHeartbeat(): string {
    if (!this.shouldDisturb()) {
      return "HEARTBEAT_OK (深夜静默)";
    }

    const checklist = this.getChecklist();
    const enabledChecks = checklist.match(/^- \[ \] .+/gm) || [];

    if (enabledChecks.length === 0) {
      return "HEARTBEAT_OK (无启用的检查项)";
    }

    this.state.lastHeartbeat = Date.now();
    this.saveState();

    return `心跳触发，请检查以下事项:\n${enabledChecks.join("\n")}\n\n如果没有需要处理的，回复 HEARTBEAT_OK`;
  }
}
```

### 3. 心跳工具 (新增 6 个)

```typescript
// 初始化
{ name: "heartbeat_init", description: "初始化 HEARTBEAT.md 检查清单" }

// 读写清单
{ name: "heartbeat_get", description: "读取心跳检查清单" }
{ name: "heartbeat_update", description: "更新心跳检查清单" }

// 状态管理
{ name: "heartbeat_record", description: "记录某项检查的完成时间" }
{ name: "heartbeat_status", description: "获取心跳状态" }

// 执行心跳
{ name: "heartbeat_run", description: "执行心跳检查" }
```

### 4. 系统提示更新

```typescript
const BASE_SYSTEM = `你是 OpenClaw V8 - 有主动性的 Agent。

工作循环: heartbeat -> recall -> identify -> plan -> execute -> track -> remember

心跳规则:
- 收到心跳信号时，读取 HEARTBEAT.md 检查清单
- 执行检查但不打扰用户（深夜静默）
- 有重要事项时主动通知，否则回复 HEARTBEAT_OK
- 使用 heartbeat_record 记录检查时间，避免重复检查`;
```

### 5. 主入口变化

```typescript
// V8: 启动时初始化所有系统
console.log(identitySystem.initWorkspace());
console.log(identitySystem.loadIdentity());
console.log(heartbeatSystem.init());  // 新增
console.log(layeredMemory.getTimeContext());

// 交互模式显示心跳状态
console.log(`${memory.stats()} | Skill: ${skillLoader.count} 个 | Heartbeat: 已就绪`);
```

## 📈 Diff 统计

```diff
 v7-agent.ts → v8-agent.ts

 + 新增 ~193 行
   - HEARTBEAT_TEMPLATE (~20行)
   - HeartbeatState 接口 (~5行)
   - HeartbeatSystem 类 (~130行)
   - heartbeat_* 工具定义 (~25行)
   - 工具路由 case (~13行)

 ~ 修改 ~15 行
   - 系统提示增加心跳规则
   - 主入口初始化心跳系统
   - 交互模式显示心跳状态
```

## 💡 设计洞察

> **心跳 vs 定时任务**
>
> | 维度 | 心跳系统 | 定时任务 |
> |------|---------|---------|
> | 触发方式 | 会话开始时 | 固定时间间隔 |
> | 执行环境 | Agent 上下文内 | 独立进程 |
> | 灵活性 | 可动态调整清单 | 需要修改配置 |
> | 适用场景 | 交互式检查 | 后台任务 |

> **深夜静默的设计**
>
> ```typescript
> shouldDisturb(): boolean {
>   const hour = new Date().getHours();
>   if (hour >= 23 || hour < 8) return false;
>   return true;
> }
> ```
>
> - 尊重用户的休息时间
> - 避免不必要的打扰
> - 紧急情况可以绕过

> **检查间隔的设计**
>
> ```typescript
> needsCheck(checkName: string, intervalMinutes: number = 30): boolean {
>   const lastTime = this.state.lastChecks[checkName] || 0;
>   const elapsed = (Date.now() - lastTime) / 60000;
>   return elapsed >= intervalMinutes;
> }
> ```
>
> - 避免重复检查同一项
> - 默认 30 分钟间隔
> - 可按检查项自定义间隔

## 🧪 验证测试

```bash
# 初始化心跳系统
npx tsx v8-agent.ts "初始化心跳系统"

# 查看心跳清单
npx tsx v8-agent.ts "显示心跳检查清单"

# 添加检查项
npx tsx v8-agent.ts "在心跳清单中添加：检查邮件"

# 执行心跳
npx tsx v8-agent.ts "执行心跳检查"

# 查看心跳状态
npx tsx v8-agent.ts "心跳状态如何？"
```

## 🌟 主动性演进

V8 的心跳系统为后续版本奠定基础：

```
V8: 心跳系统
├── HEARTBEAT.md (检查清单)
└── heartbeat-state.json (状态追踪)

V9: 会话管理 (基于心跳的多会话检查)
V10: Channel 适配 (基于心跳的多渠道通知)
```
