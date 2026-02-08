# V1 -> V2: 从无状态执行到本地长期记忆

## 版本差异（实测）

| 维度 | V1 | V2 |
|---|---|---|
| 代码行数 | 310 | 481 |
| 工具数 | 5 | 10 |
| 新增工具 | - | `memory_search/get/append/ingest/stats` |

---

## 核心改动

1. 新增 `LocalMemory`，索引持久化到 `.memory/index.json`。
2. 语义匹配采用 Jaccard，相似度阈值过滤低相关噪音。
3. `memory_append` / `memory_ingest` 支持增量构建记忆库。

---

## 设计价值

- 建立跨会话知识复用能力。
- 保持零外部依赖，便于本地教学与调试。
