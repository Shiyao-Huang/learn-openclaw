# V7 -> V8: 从时间感知到心跳主动性

## 版本差异（实测）

| 维度 | V7 | V8 |
|---|---|---|
| 代码行数 | 1406 | 1364 |
| 工具数 | 27 | 32 |
| 关键新增 | 分层记忆 | 心跳系统 |

说明：V8 新增 5 个 heartbeat 工具，同时移除了 `bootstrap_complete`，净增 4 个工具。

---

## 核心改动

### 1. 新增 HeartbeatSystem

- 清单文件：`HEARTBEAT.md`
- 状态文件：`memory/heartbeat-state.json`
- 维护 `lastChecks` 与 `lastHeartbeat`

### 2. 新增 heartbeat 工具

- `heartbeat_get`
- `heartbeat_update`
- `heartbeat_record`
- `heartbeat_status`
- `heartbeat_run`

### 3. 主动性策略

- 深夜时段（23:00-08:00）默认静默
- 无清单或无需提醒时返回 `HEARTBEAT_OK`

---

## 设计价值

1. Agent 从“只会响应”进化到“具备运行节律”。
2. 主动检查由独立子系统承载，不污染主循环。
3. 为 V9 会话路由提供统一的前置检查入口。
