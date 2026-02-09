# Learn OpenClaw: V0 → V9 演进总览

> 目标：按“每版只解决一个核心问题”的方式，从最小 Agent 循序构建完整系统。

---

## 版本矩阵（按代码实测）

| 版本 | 文件 | 行数 | 工具数 | 这一版解决的问题 |
|---|---|---:|---:|---|
| V0 | `v0-agent.ts` | 152 | 1 | 先跑通最小 tool-call 循环 |
| V1 | `v1-agent.ts` | 310 | 5 | 用专用工具替代纯 bash |
| V2 | `v2-agent.ts` | 481 | 10 | 本地长期记忆（零外部 DB） |
| V3 | `v3-agent.ts` | 551 | 11 | 任务显式规划（TodoWrite） |
| V4 | `v4-agent.ts` | 599 | 12 | 子代理隔离执行 |
| V5 | `v5-agent.ts` | 614 | 12 | Skill 文档按需加载 |
| V5.5 | `v5.5-agent.ts` | 776 | 12 | Hook 生命周期扩展 |
| V6 | `v6-agent.ts` | 957 | 14 | 身份文件化与首次引导 |
| V7 | `v7-agent.ts` | 1372 | 25 | 分层记忆（daily + longterm） |
| V8 | `v8-agent.ts` | 1671 | 30 | 心跳主动检查 |
| V9 | `v9-agent.ts` | 1527 | 33 | 多会话管理与持久化 |
| V10 | `v10-agent.ts` | 1782 | 37 | 内省与自我观察 |

---

## 关键演进链

```text
V0  Agent Loop
 -> V1  安全工具边界
 -> V2  本地语义记忆
 -> V3  显式任务状态
 -> V4  子代理隔离
 -> V5  Skill 知识加载
 -> V5.5 Hook 扩展点
 -> V6  身份系统
 -> V7  时间分层记忆
 -> V8  心跳主动性
 -> V9  多会话路由
 -> V10 内省系统
```

---

## 工具系统演进（只列新增）

- V1: `read_file/write_file/edit_file/grep`
- V2: `memory_search/get/append/ingest/stats`
- V3: `TodoWrite`
- V4: `subagent`
- V5: `Skill`
- V5.5: Hook 基础设施（工具不新增，继续使用 `Skill`）
- V6: `identity_update`, `bootstrap_complete`
- V7: `identity_init/load/get`, `daily_*`, `longterm_*`, `memory_search_all`, `time_context`
- V8: `heartbeat_get/update/record/status/run`
- V9: `session_create/list/delete/cleanup`
- V10: `introspect_stats/patterns/reflect/logs`

注：V5.5-V9 代码中使用 `SkillLoader`，暴露给模型的工具名为 `Skill`（参数 `skill`）。

---

## 推荐学习顺序

1. 先读代码：`v0` -> `v4`
2. 再读机制：`v5` -> `v6`
3. 最后读运行时系统：`v7` -> `v9`

---

## 文档入口

### 章节文档

- [V0: Bash 即一切](./v0-Bash即一切.md)
- [V1: 模型即代理](./v1-模型即代理.md)
- [V2: 本地向量记忆系统](./v2-向量记忆系统.md)
- [V3: 任务规划系统](./v3-任务规划系统.md)
- [V4: 子代理协调](./v4-子代理协调.md)
- [V5: Skill 系统](./v5-Claw系统.md)
- [V5.5: Hook 系统](./v5.5-Hook系统.md)
- [V6: 身份系统](./v6-身份系统.md)
- [V7: 分层记忆](./v7-分层记忆.md)
- [V8: 心跳系统](./v8-心跳系统.md)
- [V9: 会话管理](./v9-会话管理.md)
- [V10: 内省系统](./v10-内省系统.md)

### Diff 演进文档

- [V0 -> V1](./evolution/v0-to-v1.md)
- [V1 -> V2](./evolution/v1-to-v2.md)
- [V2 -> V3](./evolution/v2-to-v3.md)
- [V3 -> V4](./evolution/v3-to-v4.md)
- [V4 -> V5](./evolution/v4-to-v5.md)
- [V5 -> V5.5](./evolution/v5-to-v5.5.md)
- [V5.5 -> V6](./evolution/v5.5-to-v6.md)
- [V6 -> V7](./evolution/v6-to-v7.md)
- [V7 -> V8](./evolution/v7-to-v8.md)
- [V8 -> V9](./evolution/v8-to-v9.md)
- [V9 -> V10](./evolution/v9-to-v10.md)
