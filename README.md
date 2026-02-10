# Learn OpenClaw - Build AI Agents from Scratch

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> Incremental tutorial repo: from one-tool agent loop to self-evolving runtime.

[中文文档](./README_zh.md)

---

## Evolution (Measured From Current Code)

| Version | File | Lines | Tools | Focus |
|---|---|---:|---:|---|
| V0 | `v0-agent.ts` | 152 | 1 | Minimal loop |
| V1 | `v1-agent.ts` | 310 | 5 | Safe file tools |
| V2 | `v2-agent.ts` | 481 | 10 | Local semantic memory |
| V3 | `v3-agent.ts` | 551 | 11 | Todo-based planning |
| V4 | `v4-agent.ts` | 599 | 12 | Subagent isolation |
| V5 | `v5-agent.ts` | 614 | 12 | Skill loading (`Skill`) |
| V5.5 | `v5.5-agent.ts` | 776 | 12 | Hook lifecycle |
| V6 | `v6-agent.ts` | 957 | 14 | Identity + bootstrap |
| V7 | `v7-agent.ts` | 1372 | 27 | Layered memory |
| V8 | `v8-agent.ts` | 1671 | 30 | Heartbeat + throttle |
| V9 | `v9-agent.ts` | 1527 | 35 | Session management |
| V10 | `v10-agent.ts` | 1782 | 37 | Introspection system |
| V11 | `v11-agent.ts` | 2324 | 43 | Channel system |
| V12 | `v12-agent.ts` | 2766 | 50 | Security system |
| V13 | `v13-agent.ts` | 3237 | 55 | Self-evolution system |
| V13.5 | `v13.5-agent.ts` | 3619 | 59 | Context compression |
| V14 | `v14-agent.ts` | 4311 | 64 | Plugin system |
| V15 | `v15-agent.ts` | 4945 | 64 | Multi-model routing |
| V16 | `v16-agent/` | 1153 | 70 | DAG workflow engine |
| **Total** | | **33162** | | |

Notes:
- V5.5-V9 all expose the `Skill` tool with `skill` input.

---

## Quick Start

```bash
git clone https://github.com/Shiyao-Huang/learn-openclaw
cd learn-openclaw
npm install
cp .env.example .env
# fill ANTHROPIC_API_KEY in .env

npx tsx v0-agent.ts
```

---

## Learning Order

1. V0-V2: loop + tools + memory
2. V3-V5.5: planning + delegation + skill/hook architecture
3. V6-V9: identity + time memory + heartbeat + sessions
4. V10-V13: introspection + channels + security + evolution

---

## Documentation

- English mirror index: [docs/en/README.md](./docs/en/README.md)

### Main chapters

- [V0 Bash](./docs/v0-Bash即一切.md)
- [V1 Model as Agent](./docs/v1-模型即代理.md)
- [V2 Local Memory](./docs/v2-向量记忆系统.md)
- [V3 Task Planning](./docs/v3-任务规划系统.md)
- [V4 Subagent](./docs/v4-子代理协调.md)
- [V5 Skill](./docs/v5-Claw系统.md)
- [V5.5 Hook](./docs/v5.5-Hook系统.md)
- [V6 Identity](./docs/v6-身份系统.md)
- [V7 Layered Memory](./docs/v7-分层记忆.md)
- [V8 Heartbeat](./docs/v8-心跳系统.md)
- [V9 Session](./docs/v9-会话管理.md)
- [V10 Introspection](./docs/v10-内省系统.md)
- [V11 Channel](./docs/v11-Channel系统.md)
- [V12 Security](./docs/v12-安全策略系统.md)
- [V13 Evolution](./docs/v13-自进化系统.md)
- [V13.5 Compression](./docs/v13.5-上下文压缩.md)
- [V14 Plugin](./docs/v14-插件系统.md)
- [V15 Multi-model](./docs/v15-多模型协作.md)
- [V16 Workflow](./docs/v16-工作流引擎.md)
- [Evolution Overview](./docs/EVOLUTION.md)

### Diff guides

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
- [V13 -> V13.5](./docs/evolution/v13-to-v13.5.md)
- [V13.5 -> V14](./docs/evolution/v13.5-to-v14.md)
- [V14 -> V15](./docs/evolution/v14-to-v15.md)
- [V15 -> V16](./docs/evolution/v15-to-v16.md)

---

## Core idea

Every version is still the same engine:

```typescript
while (true) {
  const response = await model(messages, tools);
  if (response.stop_reason !== "tool_use") return response.text;
  const results = execute(response.tool_calls);
  messages.push(results);
}
```

The rest is controlled layering.

---

## License

MIT
