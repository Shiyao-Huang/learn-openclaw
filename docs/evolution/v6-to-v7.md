# V6 -> V7: 从身份配置到分层记忆

## 版本差异（实测）

| 维度 | V6 | V7 |
|---|---|---|
| 代码行数 | 1041 | 1406 |
| 工具数 | 14 | 27 |
| 关键新增 | 身份更新闭环 | 日记层 + 长期层 + 时间上下文 |

---

## 核心改动

### 1. 新增 LayeredMemory

- `memory/YYYY-MM-DD.md`：日记层
- `MEMORY.md`：长期层
- `memory_search_all`：跨层检索

### 2. 新增时间工具

- `time_context` 提供中文时间语义（星期/时段）

### 3. 身份工具扩展

V7 对模型暴露完整身份工具链：

- `identity_init`
- `identity_load`
- `identity_update`
- `identity_get`
- `bootstrap_complete`

### 4. 记忆工具扩展

- `daily_write/read/recent/list`
- `longterm_read/update/append`

---

## 设计价值

1. 记忆从“平面文档”升级为“有时间层次的系统”。
2. 身份与记忆结合，形成更稳定的长期行为一致性。
3. 为 V8 的主动心跳检查提供可观察、可回溯的数据基础。
