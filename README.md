# Learn OpenClaw - 从源码学习 AI Agent

> **免责声明**: 这是一个独立的教育项目，用于学习 AI Agent 的架构设计。

**通过构建极简版本，理解现代 AI Agent 的工作原理。**

---

## 为什么创建这个项目？

现代 AI Agent（如 Claude Code、OpenClaw）功能复杂，直接阅读数万行源码是困难的。

本项目采用渐进式教学方法，从最简单的 Agent 开始，逐步增加功能：

| 版本 | 核心概念 | 行数 | 新增能力 |
|------|---------|------|---------|
| V0 | Bash 即一切 | ~150 | 核心 Agent Loop |
| V1 | 专用工具 | ~287 | read/write/edit/grep |
| V2 | 本地记忆 | ~457 | Jaccard 相似度搜索 |
| V3 | 任务规划 | ~527 | TodoManager |
| V4 | 子代理 | ~570 | 进程递归隔离 |
| V5 | 技能系统 | ~554 | SkillLoader |
| V6 | 身份系统 | ~930 | 多人格切换 |
| V7 | 分层记忆 | ~1176 | 日记 + 长期记忆 |
| V8 | 心跳系统 | ~1369 | 主动检查机制 |
| V9 | 会话管理 | ~1516 | 多会话隔离 |

---

## 学习路径

```
Start Here
    │
    ▼
[V0: Bash Agent] ────────► "One tool is enough"
    │                       单一 bash 工具，核心循环
    ▼
[V1: Basic Tools] ───────► "专用工具比通用 bash 更安全"
    │                       +read/write/edit/grep, safePath
    ▼
[V2: Memory] ────────────► "Agent 需要记忆，但不需要外部数据库"
    │                       +LocalMemory, Jaccard 相似度
    ▼
[V3: TodoManager] ───────► "Make Plans Visible"
    │                       +TodoWrite, 任务追踪
    ▼
[V4: Subagent] ──────────► "Agent 需要协作，但不需要复杂编排"
    │                       +subagent 进程递归
    ▼
[V5: Skill] ─────────────► "Agent 需要专业知识，但不需要重新训练"
    │                       +SkillLoader, YAML frontmatter
    ▼
[V6: Identity] ──────────► "Agent 需要身份，但不需要硬编码"
    │                       +IdentitySystem, 多人格切换
    ▼
[V7: LayeredMemory] ─────► "Agent 需要时间感知"
    │                       +日记系统, 长期记忆
    ▼
[V8: Heartbeat] ─────────► "Agent 需要主动性"
    │                       +心跳检查, 主动提醒
    ▼
[V9: Session] ───────────► "Agent 需要多任务隔离"
                            +SessionManager, main/isolated
```

---

## 核心模式

所有 Agent 都遵循这个循环：

```typescript
while (true) {
    const response = await model(messages, tools);
    if (response.stop_reason !== "tool_use") return response.text;
    const results = execute(response.tool_calls);
    messages.push(results);
}
```

---

## 快速开始

```bash
# 进入项目目录
cd learn-openclaw

# 安装依赖
npm install

# 配置 API key
cp .env.example .env
# 编辑 .env 填入 ANTHROPIC_API_KEY

# 运行各版本
npx tsx v0-agent.ts    # 最简 Agent
npx tsx v1-agent.ts    # 基础工具
npx tsx v2-agent.ts    # 本地记忆
npx tsx v3-agent.ts    # 任务规划
npx tsx v4-agent.ts    # 子代理
npx tsx v5-agent.ts    # 技能系统
npx tsx v6-agent.ts    # 身份系统
npx tsx v7-agent.ts    # 分层记忆
npx tsx v8-agent.ts    # 心跳系统
npx tsx v9-agent.ts    # 会话管理
```

---

## 各版本详解

### V0: Bash 即一切 (~150行)

**核心哲学**: "One tool is enough"

只有一个 `bash` 工具，但已经是完整的 Agent：
- 可以读写文件 (`cat`, `echo >`)
- 可以搜索代码 (`grep`, `find`)
- 可以执行任意命令

```typescript
const TOOLS = [{ name: "bash", ... }];
```

### V1: 基础工具系统 (~287行)

**核心哲学**: "专用工具比通用 bash 更安全"

新增 4 个专用工具：
- `read_file`: 安全读取，带路径检查
- `write_file`: 安全写入，自动创建目录
- `edit_file`: 精确编辑（查找替换）
- `grep`: 搜索文件内容

关键函数 `safePath()` 防止路径逃逸。

### V2: 本地向量记忆 (~457行)

**核心哲学**: "Agent 需要记忆，但不需要外部向量数据库"

`LocalMemory` 类实现：
- **Jaccard 相似度**: 对中文友好的简单算法
- **2-gram 分词**: 中文字符两两组合
- **自动索引**: 追加内容时自动建立索引

工具：`memory_search`, `memory_get`, `memory_append`, `memory_ingest`

### V3: 任务规划系统 (~527行)

**核心哲学**: "Make Plans Visible"

`TodoManager` 实现简单的任务追踪：
- 字段：`content`, `status`, `activeForm`
- 约束：最多 20 个任务，只能 1 个 `in_progress`
- 单一工具：`TodoWrite`（替换式更新）

### V4: 子代理协调 (~570行)

**核心哲学**: "Agent 需要协作，但不需要复杂的编排系统"

通过进程递归实现上下文隔离：
```typescript
const cmd = `npx tsx "${scriptPath}" "${escapedPrompt}"`;
execSync(cmd, { env: { OPENCLAW_SUBAGENT: "1" } });
```

工具：`subagent`

### V5: Skill 系统 (~554行)

**核心哲学**: "Agent 需要专业知识，但不需要重新训练"

`SkillLoader` 实现：
- 解析 YAML frontmatter (`---\nname: ...\n---`)
- 按需加载，不污染系统提示
- Skill 内容作为 `tool_result` 注入

工具：`Skill`

### V6: 身份系统 (~930行)

**核心哲学**: "Agent 需要身份，但不需要硬编码"

`IdentitySystem` 管理：
- `AGENTS.md`: 可用人格列表
- `SOUL.md`: 核心价值观
- `IDENTITY.md`: 当前激活身份
- `USER.md`: 用户偏好

工具：`identity_switch`, `identity_get`, `identity_list`, `identity_update_user`

### V7: 分层记忆 (~1176行)

**核心哲学**: "Agent 需要时间感知"

`LayeredMemory` 实现：
- **日记系统**: `memory/YYYY-MM-DD.md`
- **长期记忆**: `MEMORY.md`
- **时间上下文**: 自动注入日期信息

工具：`daily_append`, `daily_get`, `longterm_append`, `longterm_search`, `time_context`

### V8: 心跳系统 (~1369行)

**核心哲学**: "Agent 需要主动性"

`HeartbeatSystem` 实现：
- `HEARTBEAT.md`: 待办事项和提醒
- 主动检查机制
- 定时任务追踪

工具：`heartbeat_add`, `heartbeat_check`, `heartbeat_complete`, `heartbeat_list`

### V9: 会话管理 (~1516行)

**核心哲学**: "Agent 需要多任务隔离"

`SessionManager` 实现：
- **main**: 主会话，持久化
- **isolated**: 隔离会话，独立上下文
- 会话切换和状态保存

工具：`session_create`, `session_switch`, `session_list`, `session_save`

---

## 文件结构

```
learn-openclaw/
├── v0-agent.ts          # ~150行: 1 tool, 核心循环
├── v1-agent.ts          # ~287行: 5 tools, 基础工具
├── v2-agent.ts          # ~457行: 本地记忆系统
├── v3-agent.ts          # ~527行: 任务规划
├── v4-agent.ts          # ~570行: 子代理
├── v5-agent.ts          # ~554行: Skill 系统
├── v6-agent.ts          # ~930行: 身份系统
├── v7-agent.ts          # ~1176行: 分层记忆
├── v8-agent.ts          # ~1369行: 心跳系统
├── v9-agent.ts          # ~1516行: 会话管理
├── skills/              # 示例 Skills
│   └── example/
│       └── SKILL.md
├── docs/                # 教学文档
│   ├── v0-bash即一切.md
│   ├── v1-专用工具.md
│   └── ...
├── .env.example         # 环境变量示例
├── package.json         # 依赖配置
└── tsconfig.json        # TypeScript 配置
```

---

## 演进依赖关系

```
V0 (核心循环)
 └── V1 (基础工具)
      └── V2 (本地记忆)
           └── V3 (任务规划)
                └── V4 (子代理)
                     └── V5 (Skill)
                          └── V6 (身份)
                               └── V7 (分层记忆)
                                    └── V8 (心跳)
                                         └── V9 (会话)
```

每个版本都是前一版本的超集，严格向前依赖。

---

## 核心洞察

> **模型占 80%，代码占 20%。**

现代 Agent 之所以工作，不是因为巧妙的工程，而是因为模型被训练成 Agent。我们的工作是给它工具，然后不要挡路。

---

## 参考资源

- **learn-claude-code**: https://github.com/shareAI-lab/learn-claude-code
- **Agent Skills Spec**: https://agentskills.io/specification
- **Anthropic SDK**: https://github.com/anthropics/anthropic-sdk-python

---

**Model as Agent. That's the whole secret.**
