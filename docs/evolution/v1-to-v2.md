# V1 → V2: 从无状态到长期记忆

## 📊 版本对比

| 维度 | V1 | V2 |
|------|----|----|
| 代码行数 | ~363 | ~447 |
| 工具数量 | 5 | 10 (+5 记忆工具) |
| 核心理念 | 模型即代理 | 记忆即上下文 |
| 状态持久化 | ❌ 无 | ✅ 本地索引 |

## 🎯 Motivation: 为什么需要 V2？

### V1 的局限性

```
会话 1: "我的项目用 React + TypeScript"
会话 2: "帮我写个组件" → Agent 不知道技术栈！
```

**问题：**
1. **上下文丢失** - 每次会话从零开始
2. **重复劳动** - 相同问题反复解释
3. **知识孤岛** - 学到的东西无法复用
4. **Token 浪费** - 长对话消耗大量 token

### V2 的解决方案

```typescript
// 摄入知识
memory_ingest({ path: "docs/" })

// 语义搜索
memory_search({ query: "技术栈" })
// → [project.md:1] React + TypeScript...

// 持久记录
memory_append({ path: "decisions.md", content: "选择 Tailwind CSS" })
```

**优势：**
1. **跨会话记忆** - 知识持久化到文件
2. **语义检索** - 不需要精确匹配
3. **零外部依赖** - 不需要向量数据库
4. **中文友好** - Jaccard 相似度对中文有效

## 🔧 核心变更

### 1. LocalMemory 类 (新增 ~120行)

```typescript
class LocalMemory {
  private docs: Map<string, MemoryDoc> = new Map();
  
  // Jaccard 相似度 - 字符级别匹配
  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase());
    const setB = new Set(b.toLowerCase());
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }
  
  // 摄入文件 - 按段落分块
  ingestFile(filePath: string): string { ... }
  
  // 语义搜索 - 返回最相似的片段
  search(query: string, maxResults: number): string { ... }
  
  // 追加记忆 - 带时间戳
  append(filePath: string, content: string): string { ... }
}
```

### 2. 记忆工具定义 (新增 5个)

```typescript
const MEMORY_TOOLS = [
  { name: "memory_search", description: "语义搜索长期记忆" },
  { name: "memory_get", description: "读取记忆文件原始内容" },
  { name: "memory_append", description: "追加内容到记忆文件" },
  { name: "memory_ingest", description: "摄入文件到记忆库" },
  { name: "memory_stats", description: "查看记忆库统计" }
];
```

### 3. 系统提示更新

```typescript
// V1
const SYSTEM = `你是 OpenClaw V1 - 基础工具型 Agent。`;

// V2
const SYSTEM = `你是 OpenClaw V2 - 记忆型 Agent。

工作循环: recall -> think -> act -> remember

记忆规则:
- 回答前先用 memory_search 查找相关知识
- 重要决策和发现用 memory_append 记录
- 新文档用 memory_ingest 摄入到记忆库`;
```

### 4. 索引持久化

```typescript
// memory/.index.json
{
  "docs": [
    {
      "id": "a1b2c3...",
      "content": "React + TypeScript 技术栈",
      "source": "project.md",
      "chunk": 0,
      "timestamp": 1707321600000
    }
  ],
  "updated": 1707321600000
}
```

## 📈 Diff 统计

```diff
 v1-agent.ts → v2-agent.ts
 
 + 新增 ~84 行
   - LocalMemory 类 (~120行)
   - 5个记忆工具定义 (~30行)
   - 记忆工具路由 (~20行)
   - MemoryDoc 接口 (~10行)
 
 ~ 修改 ~10 行
   - 系统提示更新
   - 导入 createHash
```

## 💡 设计洞察

> **为什么不用向量数据库？**
> 
> 1. **简单性** - 零配置，零依赖
> 2. **可移植** - 纯文件，可 git 同步
> 3. **够用** - 小规模知识库 Jaccard 足够
> 4. **教学** - 理解原理比用库更重要

> **Jaccard vs Embedding**
> 
> | 方法 | 优点 | 缺点 |
> |------|------|------|
> | Jaccard | 简单、快速、中文友好 | 语义理解弱 |
> | Embedding | 语义理解强 | 需要模型、慢 |

## 🧪 验证测试

```bash
# 摄入知识
npx tsx v2-agent.ts "摄入 README.md 到记忆库"

# 语义搜索
npx tsx v2-agent.ts "搜索关于 Agent 循环的记忆"

# 记录决策
npx tsx v2-agent.ts "记录：今天决定使用 Tailwind CSS"
```
