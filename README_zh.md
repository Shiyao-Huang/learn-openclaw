# Learn OpenClaw - 从零构建 AI Agent

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> 用渐进式方式学习 Agent：从 1 个工具循环到自进化运行时。

[English](./README.md)

---

## 版本演进（按当前代码实测）

| 版本 | 文件 | 行数 | 工具数 | 重点能力 |
|---|---|---:|---:|---|
| V0 | `v0-agent.ts` | 152 | 1 | 最小循环 |
| V1 | `v1-agent.ts` | 310 | 5 | 安全文件工具 |
| V2 | `v2-agent.ts` | 481 | 10 | 本地语义记忆 |
| V3 | `v3-agent.ts` | 551 | 11 | Todo 任务规划 |
| V4 | `v4-agent.ts` | 599 | 12 | 子代理隔离 |
| V5 | `v5-agent.ts` | 614 | 12 | Skill 加载（`Skill`） |
| V5.5 | `v5.5-agent.ts` | 776 | 12 | Hook 生命周期 |
| V6 | `v6-agent.ts` | 957 | 14 | 身份系统 + 首次引导 |
| V7 | `v7-agent.ts` | 1372 | 27 | 分层记忆 |
| V8 | `v8-agent.ts` | 1671 | 30 | 心跳 + 节流机制 |
| V9 | `v9-agent.ts` | 1527 | 35 | 会话管理 |
| V10 | `v10-agent.ts` | 1782 | 37 | 内省系统 |
| V11 | `v11-agent.ts` | 2324 | 43 | Channel 系统 |
| V12 | `v12-agent.ts` | 2766 | 50 | 安全策略系统 |
| V13 | `v13-agent.ts` | 3237 | 55 | 自进化系统 |
| **合计** | | **19134** | | |

说明：
- V5.5-V9 对模型暴露的技能工具名统一为 `Skill`，参数为 `skill`。

---

## 快速开始

```bash
git clone https://github.com/Shiyao-Huang/learn-openclaw
cd learn-openclaw
npm install
cp .env.example .env
# 在 .env 填写 ANTHROPIC_API_KEY

npx tsx v0-agent.ts
```

---

## 推荐学习顺序

1. V0-V2：循环、工具、记忆
2. V3-V5.5：规划、委托、技能与 Hook
3. V6-V9：身份、时间记忆、心跳、会话
4. V10-V13：内省、渠道、安全、进化

---

## 文档入口

- 英文镜像入口: [docs/en/README.md](./docs/en/README.md)

### 主章节

- [V0: Bash 即一切](./docs/v0-Bash即一切.md)
- [V1: 模型即代理](./docs/v1-模型即代理.md)
- [V2: 本地向量记忆系统](./docs/v2-向量记忆系统.md)
- [V3: 任务规划系统](./docs/v3-任务规划系统.md)
- [V4: 子代理协调](./docs/v4-子代理协调.md)
- [V5: Skill 系统](./docs/v5-Claw系统.md)
- [V5.5: Hook 系统](./docs/v5.5-Hook系统.md)
- [V6: 身份系统](./docs/v6-身份系统.md)
- [V7: 分层记忆](./docs/v7-分层记忆.md)
- [V8: 心跳系统](./docs/v8-心跳系统.md)
- [V9: 会话管理](./docs/v9-会话管理.md)
- [V10: 内省系统](./docs/v10-内省系统.md)
- [V11: Channel 系统](./docs/v11-Channel系统.md)
- [V12: 安全策略系统](./docs/v12-安全策略系统.md)
- [V13: 自进化系统](./docs/v13-自进化系统.md)
- [总览: EVOLUTION](./docs/EVOLUTION.md)

### Diff 演进文档

- [V0 -> V1](./docs/evolution/v0-to-v1.md)
- [V1 -> V2](./docs/evolution/v1-to-v2.md)
- [V2 -> V3](./docs/evolution/v2-to-v3.md)
- [V3 -> V4](./docs/evolution/v3-to-v4.md)
- [V4 -> V5](./docs/evolution/v4-to-v5.md)
- [V5 -> V5.5](./docs/evolution/v5-to-v5.5.md)
- [V5.5 -> V6](./docs/evolution/v5.5-to-v6.md)
- [V6 -> V7](./docs/evolution/v6-to-v7.md)
- [V7 -> V8](./docs/evolution/v7-to-v8.md)
- [V8 -> V9](./docs/evolution/v8-to-v9.md)
- [V9 -> V10](./docs/evolution/v9-to-v10.md)
- [V10 -> V11](./docs/evolution/v10-to-v11.md)
- [V11 -> V12](./docs/evolution/v11-to-v12.md)
- [V12 -> V13](./docs/evolution/v12-to-v13.md)

---

## 核心模式

所有版本本质都是同一个循环：

```typescript
while (true) {
  const response = await model(messages, tools);
  if (response.stop_reason !== "tool_use") return response.text;
  const results = execute(response.tool_calls);
  messages.push(results);
}
```

其他能力都是在这个循环外做分层增强。

---

## License

MIT
