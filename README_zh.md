# Learn OpenClaw - 从零构建 AI Agent

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> **声明**: 这是一个独立的教育项目，用于学习 AI Agent 架构设计，与任何商业产品无关。

**最全面的 AI Agent 教程：10 个渐进版本，从 150 行到生产级系统。**

[English](./README.md)

---

## 为什么创建这个仓库？

现代 AI Agent（Claude Code、Cursor 等）是数万行代码的复杂系统，直接阅读令人望而却步。

**本项目采用不同的方法**：从最简单的 Agent（150 行）开始，每次只增加一个能力，直到构建出生产级系统。

```
V0 (150 行) → V9 (1500+ 行)
   │
   └── 每个版本只增加一个新概念
```

---

## 演进路线

| 版本 | 核心概念 | 行数 | 你将学到 |
|------|---------|------|---------|
| **V0** | Bash 即一切 | ~150 | Agent Loop - 一切的基础 |
| **V1** | 专用工具 | ~287 | 为什么专用工具优于通用 bash |
| **V2** | 本地记忆 | ~457 | 无需外部数据库的向量搜索 |
| **V3** | 任务规划 | ~527 | 用 TodoManager 让 AI 行为可预测 |
| **V4** | 子代理 | ~570 | 通过进程递归实现上下文隔离 |
| **V5** | 技能系统 | ~554 | 无需重训练的领域专业知识 |
| **V6** | 身份系统 | ~930 | 多人格切换与个性化 |
| **V7** | 分层记忆 | ~1176 | 时间感知记忆：日记 + 长期记忆 |
| **V8** | 心跳系统 | ~1369 | 主动行为与定时任务 |
| **V9** | 会话管理 | ~1516 | 多任务隔离与上下文切换 |

---

## 学习路径

```
从这里开始
    │
    ▼
[V0: Bash Agent] ────────► "一个工具就够了"
    │                       驱动所有 Agent 的核心循环
    ▼
[V1: 基础工具] ──────────► "专用 > 通用"
    │                       +read/write/edit/grep 带 safePath
    ▼
[V2: 记忆系统] ──────────► "不需要外部数据库"
    │                       +LocalMemory 使用 Jaccard 相似度
    ▼
[V3: 任务规划] ──────────► "让计划可见"
    │                       +TodoWrite 显式规划
    ▼
[V4: 子代理] ────────────► "分而治之"
    │                       +进程递归实现隔离
    ▼
[V5: 技能系统] ──────────► "专业无需重训"
    │                       +SkillLoader 解析 YAML frontmatter
    ▼
[V6: 身份系统] ──────────► "人格即配置"
    │                       +多人格切换
    ▼
[V7: 分层记忆] ──────────► "时间感知"
    │                       +日记 + 长期记忆
    ▼
[V8: 心跳系统] ──────────► "主动而非被动"
    │                       +定时检查与提醒
    ▼
[V9: 会话管理] ──────────► "多任务隔离"
                            +SessionManager 上下文切换
```

---

## 核心模式

**每个 AI Agent 都只是这个循环：**

```typescript
while (true) {
    const response = await model(messages, tools);
    if (response.stop_reason !== "tool_use") {
        return response.text;
    }
    const results = execute(response.tool_calls);
    messages.push(results);
}
```

就这样。模型持续调用工具直到完成。**其他一切都是精化。**

---

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/Shiyao-Huang/learn-openclaw
cd learn-openclaw

# 安装依赖
npm install

# 配置 API key
cp .env.example .env
# 编辑 .env 填入你的 ANTHROPIC_API_KEY

# 运行任意版本（从 v0 开始！）
npx tsx v0-agent.ts    # 极简 Agent
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

## 各版本核心洞察

### V0: Bash 即一切 (~150 行)

> "一个工具就够了"

单一 `bash` 工具就能创建完整的 Agent。它可以读文件（`cat`）、写文件（`echo >`）、搜索代码（`grep`）、执行任何命令。

**核心洞察**：模型本身就是 Agent，代码只是提供工具。

### V1: 专用工具 (~287 行)

> "专用工具比通用 bash 更安全"

用安全的专用工具替代危险的 bash：
- `read_file`: 路径验证防止逃逸
- `write_file`: 自动创建目录
- `edit_file`: 精确查找替换
- `grep`: 内容搜索

**核心洞察**：约束赋能复杂性。

### V2: 本地记忆 (~457 行)

> "不需要外部向量数据库"

`LocalMemory` 实现：
- **Jaccard 相似度**: 简单，对中日韩语言友好
- **2-gram 分词**: 中文友好的字符对
- **自动索引**: 追加时自动建立索引

**核心洞察**：简单算法往往胜过复杂算法。

### V3: 任务规划 (~527 行)

> "让计划可见"

`TodoManager` 强制结构化：
- 最多 20 个任务
- 同时只能 1 个 `in_progress`
- 单一 `TodoWrite` 工具（替换而非补丁）

**核心洞察**：显式规划让 AI 可预测。

### V4: 子代理 (~570 行)

> "通过进程递归实现上下文隔离"

```typescript
const cmd = `npx tsx "${scriptPath}" "${escapedPrompt}"`;
execSync(cmd, { env: { OPENCLAW_SUBAGENT: "1" } });
```

**核心洞察**：干净上下文 = 更好结果。

### V5: 技能系统 (~554 行)

> "领域专业无需重训练"

`SkillLoader` 解析 YAML frontmatter，按需注入知识。

**核心洞察**：知识注入胜过微调。

### V6: 身份系统 (~930 行)

> "人格只是配置"

定义 Agent 的文件：
- `AGENTS.md`: 可用人格列表
- `SOUL.md`: 核心价值观
- `IDENTITY.md`: 当前激活身份
- `USER.md`: 用户偏好

**核心洞察**：身份是数据，不是代码。

### V7: 分层记忆 (~1176 行)

> "Agent 需要时间感知"

- **日记系统**: `memory/YYYY-MM-DD.md`
- **长期记忆**: `MEMORY.md`
- **时间上下文**: 自动注入日期信息

**核心洞察**：记忆需要时间结构。

### V8: 心跳系统 (~1369 行)

> "主动而非被动"

`HeartbeatSystem` 实现：
- 定时提醒
- 主动检查
- 任务追踪

**核心洞察**：优秀的 Agent 能预见需求。

### V9: 会话管理 (~1516 行)

> "多任务隔离"

- **main**: 持久化主会话
- **isolated**: 每个任务独立上下文
- 会话切换与状态保存

**核心洞察**：隔离防止上下文污染。

---

## 文件结构

```
learn-openclaw/
├── v0-agent.ts          # ~150 行: 1 个工具，核心循环
├── v1-agent.ts          # ~287 行: 5 个工具，安全操作
├── v2-agent.ts          # ~457 行: 本地记忆系统
├── v3-agent.ts          # ~527 行: 任务规划
├── v4-agent.ts          # ~570 行: 子代理协调
├── v5-agent.ts          # ~554 行: 技能系统
├── v6-agent.ts          # ~930 行: 身份系统
├── v7-agent.ts          # ~1176 行: 分层记忆
├── v8-agent.ts          # ~1369 行: 心跳系统
├── v9-agent.ts          # ~1516 行: 会话管理
├── skills/              # 示例技能
├── docs/                # 技术文档
│   ├── v0-Bash即一切.md
│   ├── v1-模型即代理.md
│   └── ...
├── .ID.sample/          # 示例身份文件
├── .env.example         # 环境变量模板
└── package.json         # 依赖配置
```

---

## 演进依赖关系

```
V0 (核心循环)
 └── V1 (基础工具)
      └── V2 (本地记忆)
           └── V3 (任务规划)
                └── V4 (子代理)
                     └── V5 (技能)
                          └── V6 (身份)
                               └── V7 (分层记忆)
                                    └── V8 (心跳)
                                         └── V9 (会话)
```

每个版本都是前一版本的严格超集，不能跳过。

---

## 设计哲学

> **模型占 80%，代码占 20%。**

现代 Agent 之所以工作，不是因为巧妙的工程，而是因为模型被训练成了 Agent。我们的工作是给它工具，然后不要挡路。

---

## 深入阅读

### 技术文档 (docs/)

| 文档 | 主题 |
|------|------|
| [v0-Bash即一切](./docs/v0-Bash即一切.md) | 核心 Agent 循环 |
| [v1-模型即代理](./docs/v1-模型即代理.md) | 模型即代理 |
| [v2-向量记忆系统](./docs/v2-向量记忆系统.md) | 本地向量记忆 |
| [v3-任务规划系统](./docs/v3-任务规划系统.md) | 任务规划 |
| [v4-子代理协调](./docs/v4-子代理协调.md) | 子代理协调 |
| [v5-Skill系统](./docs/v5-Skill系统.md) | 技能机制 |
| [v6-身份系统](./docs/v6-身份系统.md) | 身份系统 |
| [v7-分层记忆](./docs/v7-分层记忆.md) | 分层记忆 |
| [v8-心跳系统](./docs/v8-心跳系统.md) | 心跳系统 |
| [v9-会话管理](./docs/v9-会话管理.md) | 会话管理 |

### 演进指南 (docs/evolution/)

版本间的逐步差异对比，展示每次改动的内容和原因。

---

## 相关资源

| 资源 | 说明 |
|------|------|
| [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) | Python 版本，5 个阶段 |
| [Agent Skills Spec](https://agentskills.io/specification) | 官方技能规范 |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python) | 官方 Python SDK |

---

## 贡献

欢迎贡献！请随时提交 issues 和 pull requests。

- 在 `skills/` 中添加新技能
- 在 `docs/` 中改进文档
- 通过 [Issues](https://github.com/Shiyao-Huang/learn-openclaw/issues) 报告 bug

---

## License

MIT

---

<p align="center">
  <strong>模型即代理。这就是全部秘密。</strong>
</p>

<p align="center">
  <a href="https://github.com/Shiyao-Huang">@Shiyao-Huang</a>
</p>
