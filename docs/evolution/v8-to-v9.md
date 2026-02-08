# V8 -> V9: 从主动检查到多会话管理

## 版本差异（实测）

| 维度 | V8 | V9 |
|---|---|---|
| 代码行数 | 1364 | 1531 |
| 工具数 | 31 | 35 |
| 关键新增 | 心跳主动性 | SessionManager 多会话 |
| 新目录 | - | `.sessions/` |

---

## 核心改动

### 1. 新增 Session 模型与 SessionManager

- 会话类型: `main` / `isolated`
- 启动自动加载 `.sessions/*.json`
- 保存时截断历史为最近 20 条
- 7 天过期清理

### 2. 新增 4 个 session 工具

```text
session_create
session_list
session_delete
session_cleanup
```

说明：V9 当前未暴露 `session_get`。

### 3. 工作循环增加 route 概念

```text
route -> heartbeat -> recall -> ... -> remember
```

先路由到会话，再执行原有能力链条。

---

## 价值

1. 多任务并行时上下文不再互相污染。
2. 可以把“主会话”和“临时会话”分层治理。
3. 会话持久化后可追溯、可清理、可运营。

---

## 最小验证

```bash
npx tsx v9-agent.ts
```

```text
>> [session_create] {"type":"isolated"}
>> [session_list] {}
>> [session_cleanup] {}
```

