# V2 → V3: 从被动响应到主动规划

## 📊 版本对比

| 维度 | V2 | V3 |
|------|----|----|
| 代码行数 | ~447 | ~477 |
| 工具数量 | 10 | 11 (+1 TodoWrite) |
| 核心理念 | 记忆即上下文 | 规划即执行 |
| 任务管理 | ❌ 无 | ✅ 状态跟踪 |

## 🎯 Motivation: 为什么需要 V3？

### V2 的局限性

```
用户: "帮我重构这个项目"

V2 Agent 的行为:
1. 读取一个文件
2. 修改它
3. 读取下一个文件
4. 修改它
... (中途迷失方向)
```

**问题：**
1. **无全局视野** - 不知道整体进度
2. **容易迷失** - 复杂任务中丢失方向
3. **无法恢复** - 中断后不知道做到哪了
4. **用户焦虑** - 不知道 Agent 在干什么

### V3 的解决方案

```typescript
// 创建任务计划
TodoWrite({
  items: [
    { content: "分析项目结构", status: "completed", activeForm: "已完成" },
    { content: "重构 utils 模块", status: "in_progress", activeForm: "正在重构..." },
    { content: "更新测试用例", status: "pending", activeForm: "等待执行" },
    { content: "更新文档", status: "pending", activeForm: "等待执行" }
  ]
})
```

**优势：**
1. **全局规划** - 先想后做
2. **进度可见** - 用户知道当前状态
3. **可恢复** - 中断后知道从哪继续
4. **自我约束** - 一次只做一件事

## 🔧 核心变更

### 1. TodoManager 类 (新增 ~50行)

```typescript
interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;  // 进行时描述
}

class TodoManager {
  private todos: Todo[] = [];

  update(items: Todo[]): string {
    // 规则1: 只能有 1 个 in_progress
    const inProgressCount = items.filter(t => t.status === "in_progress").length;
    if (inProgressCount > 1) {
      return `错误: 只能有 1 个 in_progress 任务`;
    }
    
    // 规则2: 最多 20 个任务
    if (items.length > 20) {
      return `错误: 最多 20 个任务`;
    }

    this.todos = items;
    return this.format();
  }

  private format(): string {
    // 1. [✓] 分析项目结构
    // 2. [▶] 重构 utils 模块
    // 3. [○] 更新测试用例
    ...
  }
}
```

### 2. TodoWrite 工具 (新增)

```typescript
{
  name: "TodoWrite",
  description: "更新任务列表。用于多步骤任务规划，最多20个任务，仅1个in_progress",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            content: { type: "string", description: "任务描述" },
            status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            activeForm: { type: "string", description: "进行时的描述" }
          }
        }
      }
    }
  }
}
```

### 3. 系统提示更新

```typescript
const SYSTEM = `你是 OpenClaw V3 - 任务规划型 Agent。

工作循环: plan -> execute -> track -> remember

规划规则:
- 复杂任务先用 TodoWrite 创建任务列表
- 每个任务包含: content(描述), status(状态), activeForm(进行时描述)
- 同一时间只能有一个 in_progress 任务
- 最多 20 个任务`;
```

## 📈 Diff 统计

```diff
 v2-agent.ts → v3-agent.ts
 
 + 新增 ~30 行
   - Todo 接口 (~5行)
   - TodoManager 类 (~50行)
   - TodoWrite 工具定义 (~15行)
   - 工具路由 case (~5行)
 
 ~ 修改 ~10 行
   - 系统提示更新
```

## 💡 设计洞察

> **为什么只有一个 TodoWrite 而不是 CRUD？**
> 
> 奥卡姆剃刀原则：
> - ❌ `todo_create`, `todo_update`, `todo_delete`, `todo_list`
> - ✅ `TodoWrite` (一个工具，批量更新)
> 
> 模型足够聪明，可以在一次调用中完成所有操作。

> **为什么限制只能有 1 个 in_progress？**
> 
> 1. **聚焦** - 强制 Agent 专注当前任务
> 2. **清晰** - 用户一眼知道在做什么
> 3. **简单** - 避免并行任务的复杂性

## 🧪 验证测试

```bash
# 创建任务计划
npx tsx v3-agent.ts "创建一个任务列表：1.读取README 2.分析结构 3.总结要点"

# 执行并跟踪
npx tsx v3-agent.ts "开始执行第一个任务"
```
