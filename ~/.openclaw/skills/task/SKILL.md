# Task Planning Skill

基于 Claude Code Team 模式的任务规划系统。

## 核心概念

**Task** 不是简单的 todo item，而是可执行的子 agent 任务：

```
Task {
  id: string           # 唯一标识
  prompt: string       # 任务描述
  type: explore|code|review|research|general
  status: pending|running|done|failed
  depends_on: string[] # 依赖的任务 ID
  result: string       # 执行结果
  background: bool     # 是否后台执行
}
```

## 任务类型

| Type | Agent | 用途 | 工具权限 |
|------|-------|------|----------|
| `explore` | explorer | 探索代码/文件 | 只读 |
| `research` | researcher | 搜索信息 | 只读 |
| `code` | coder | 写代码 | 读写 |
| `review` | reviewer | 审查代码/方案 | 只读 |
| `general` | - | 通用任务 | 全部 |

## 工作流

### 1. 规划阶段 (Plan)

收到复杂任务时，先拆解：

```bash
# 用 planner agent 拆解任务
./plan.sh "实现一个用户认证系统"
```

输出任务图：
```
T1: [explore] 查看现有代码结构 
T2: [research] 调研 JWT vs Session 方案 (并行 T1)
T3: [code] 实现认证模块 (依赖 T1, T2)
T4: [code] 写测试 (依赖 T3)
T5: [review] 审查代码 (依赖 T3, T4)
```

### 2. 执行阶段 (Execute)

```bash
# 执行单个任务
./exec.sh T1

# 并行执行无依赖的任务
./exec.sh T1 T2 --parallel

# 执行整个计划
./run_plan.sh plan.json
```

### 3. 汇总阶段 (Synthesize)

所有子任务完成后，汇总结果：

```bash
./synthesize.sh plan.json
```

## 使用示例

### 简单任务 - 直接执行

```bash
# 不需要规划，直接 spawn
~/.openclaw/skills/subagent/spawn.sh researcher "gRPC 和 REST 的区别"
```

### 复杂任务 - 先规划后执行

```bash
# 1. 规划
./plan.sh "给项目添加 CI/CD"

# 2. 查看计划
cat ~/.openclaw/tasks/current.json

# 3. 执行
./run_plan.sh

# 4. 汇总
./synthesize.sh
```

## 任务状态文件

存储在 `~/.openclaw/tasks/`:

```
tasks/
├── current.json      # 当前任务计划
├── history/          # 历史任务
└── results/          # 子任务结果
```

## 何时用 Task vs 直接做

**直接做：**
- 简单明确的任务
- 不需要多步骤
- 上下文已经足够

**用 Task：**
- 复杂任务需要拆解
- 多个独立子任务可并行
- 需要不同专长（研究 + 编码 + 审查）
- 想要清晰的执行记录
