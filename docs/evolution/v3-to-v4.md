# V3 → V4: 从单体到分布式协作

## 📊 版本对比

| 维度 | V3 | V4 |
|------|----|----|
| 代码行数 | ~477 | ~567 |
| 工具数量 | 11 | 12 (+1 subagent) |
| 核心理念 | 规划即执行 | 委托即协作 |
| 并行能力 | ❌ 串行 | ✅ 子进程并行 |

## 🎯 Motivation: 为什么需要 V4？

### V3 的局限性

```
用户: "分析这个大型项目的所有模块"

V3 Agent 的行为:
1. 分析 module-a (5分钟)
2. 分析 module-b (5分钟)
3. 分析 module-c (5分钟)
... (串行执行，上下文越来越长)
```

**问题：**
1. **上下文膨胀** - 长任务累积大量历史
2. **串行瓶颈** - 独立任务无法并行
3. **单点故障** - 一个错误影响整个会话
4. **Token 爆炸** - 复杂任务消耗巨量 token

### V4 的解决方案

```typescript
// 委托独立子任务
subagent({
  task: "分析 module-a 的代码结构",
  context: "这是一个 React 组件库"
})

// 子代理在隔离进程中运行
// 返回最终结果，不污染主会话上下文
```

**优势：**
1. **上下文隔离** - 子任务不污染主会话
2. **可并行** - 独立任务可同时执行
3. **故障隔离** - 子代理失败不影响主代理
4. **Token 节省** - 只返回最终结果

## 🔧 核心变更

### 1. subagent 工具 (新增)

```typescript
{
  name: "subagent",
  description: "委托子任务给隔离的Agent进程执行。适合独立任务如代码审查、模块分析等",
  input_schema: {
    type: "object",
    properties: {
      task: { type: "string", description: "子任务描述，需明确输入和期望输出" },
      context: { type: "string", description: "可选的上下文信息" }
    },
    required: ["task"]
  }
}
```

### 2. runSubagent 实现 (新增 ~30行)

```typescript
function runSubagent(task: string, context?: string): string {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    const fullPrompt = context
      ? `[任务] ${task}\n\n[上下文]\n${context}`
      : task;

    // 转义引号避免 shell 注入
    const escapedPrompt = fullPrompt.replace(/"/g, '\\"');
    const cmd = `npx tsx "${scriptPath}" "${escapedPrompt}"`;

    console.log(`[子代理启动] ${task.slice(0, 60)}...`);

    // 关键: 调用自身，但在新进程中
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 120000,
      cwd: WORKDIR,
      env: { ...process.env, OPENCLAW_SUBAGENT: "1" }
    });

    return `[子代理完成]\n${output.slice(0, 10000)}`;
  } catch (e: any) {
    return `[子代理错误] ${e.stderr || e.message}`;
  }
}
```

### 3. 系统提示更新

```typescript
const SYSTEM = `你是 OpenClaw V4 - 子代理协调型 Agent。

工作循环: plan -> delegate -> collect -> execute -> track -> remember

委托规则:
- 独立子任务用 subagent 委托执行
- 子任务需明确输入和期望输出
- 子代理在隔离进程中运行，返回最终结果
- 适合: 代码审查、独立模块分析、批量处理`;
```

## 📈 Diff 统计

```diff
 v3-agent.ts → v4-agent.ts
 
 + 新增 ~90 行
   - subagent 工具定义 (~15行)
   - runSubagent 函数 (~30行)
   - 工具路由 case (~5行)
   - 系统提示委托规则 (~10行)
 
 ~ 修改 ~5 行
   - 系统提示更新
```

## 💡 设计洞察

> **为什么用进程递归而不是线程？**
> 
> 1. **完全隔离** - 进程间内存不共享
> 2. **简单实现** - 调用自身，无需复杂编排
> 3. **自然超时** - execSync 自带超时机制
> 4. **可调试** - 子进程输出可独立查看

> **subagent vs 直接执行**
> 
> | 场景 | 推荐方式 |
> |------|----------|
> | 简单文件操作 | 直接执行 |
> | 独立分析任务 | subagent |
> | 需要上下文的任务 | 直接执行 |
> | 可能失败的探索 | subagent |

## 🧪 验证测试

```bash
# 委托子任务
npx tsx v4-agent.ts "用 subagent 分析 v0-agent.ts 的代码结构"

# 观察输出
# [子代理启动] 分析 v0-agent.ts 的代码结构...
# [子代理完成]
# ... (子代理的分析结果)
```

## ⚠️ 注意事项

1. **超时设置** - 默认 120 秒，复杂任务可能需要更长
2. **递归深度** - 子代理可以再调用子代理，但要小心无限递归
3. **资源消耗** - 每个子代理是独立进程，注意内存使用
