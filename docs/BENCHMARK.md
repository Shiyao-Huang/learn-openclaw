# OpenClaw Benchmark 框架

> V0-V24 跨版本能力评估系统

---

## 快速开始

```bash
# 运行所有 Benchmark 测试
npx vitest run tests/benchmark-*.test.ts

# 只运行 BL Benchmark (行为学习)
npx vitest run tests/benchmark-bl.test.ts

# 只运行 V11-V24 版本测试
npx vitest run tests/benchmark-v11-v24.test.ts
```

---

## 1. BL Benchmark (行为学习基准) ⭐ NEW

**基于论文**: [arxiv.org/abs/2602.03587](https://arxiv.org/abs/2602.03587)

BL Benchmark 评估 AI 系统的行为学习和自适应能力。

### 1.1 评估维度

| 维度 | 对应版本 | 测试数 | 说明 |
|------|----------|--------|------|
| **Behavior Consistency** | V6 Identity | 6 | 行为一致性，人格保持 |
| **Adaptive Learning** | V13 Evolution | 6 | 自适应学习，模式识别 |
| **Long-term Memory** | V7 Memory | 9 | 长期记忆，语义搜索 |
| **Task Planning** | V3 TodoWrite | 4 | 任务规划，分解执行 |
| **Error Recovery** | 跨版本 | 3 | 错误恢复，优雅降级 |
| **Context Understanding** | V9+V11 | 4 | 上下文理解，会话管理 |
| **SWE-Bench Style** | V22 Sandbox | 6 | 代码执行，安全沙箱 |
| **ToolBench Style** | V11-V18 | 6 | 工具调用，技能加载 |
| **TOTAL** | - | **44** | - |

### 1.2 与行业 Benchmark 对齐

| 行业 Benchmark | OpenClaw 对应 | 测试覆盖 |
|----------------|---------------|----------|
| **SWE-Bench** | V22 Sandbox | 代码执行、安全扫描 |
| **MemGPT Benchmark** | V7 Memory | 长期记忆、语义搜索 |
| **ToolBench** | V0-V18 Tools | 工具 schema、调用能力 |
| **BL Benchmark** | V13 Evolution | 行为学习、自我反思 |

### 1.3 运行结果示例

```
=== BL Benchmark Score Summary ===
┌───────────────────────────┬────────┐
│ (index)                   │ Values │
├───────────────────────────┼────────┤
│ Behavior Consistency (V6) │ 6      │
│ Adaptive Learning (V13)   │ 6      │
│ Long-term Memory (V7)     │ 9      │
│ Task Planning (V3)        │ 4      │
│ Error Recovery            │ 3      │
│ Context Understanding     │ 4      │
│ SWE-Bench Style (V22)     │ 6      │
│ ToolBench Style           │ 6      │
│ TOTAL                     │ 44     │
└───────────────────────────┴────────┘

=== Tool Count by Version (V11-V18) ===
┌─────────┬────────┐
│ (index) │ Values │
├─────────┼────────┤
│ v11     │ 28     │
│ v12     │ 28     │
│ v13     │ 28     │
│ v14     │ 28     │
│ v15     │ 28     │
│ v16     │ 28     │
│ v17     │ 28     │
│ v18     │ 28     │
└─────────┴────────┘
Total tools: 224
```

---

## 2. 版本演进测试 (V11-V24)

### 2.1 测试范围

| 版本 | 模块 | 核心能力 |
|------|------|----------|
| **V11** | Channel | 多平台通讯 (Discord/Slack/WhatsApp) |
| **V12** | Security | 安全策略、审计日志 |
| **V13** | Evolution | 自进化、行为分析 |
| **V14** | Plugin | 插件系统、动态加载 |
| **V15** | Multi-Model | 多模型协作、智能路由 |
| **V16** | Workflow | DAG 工作流引擎 |
| **V17** | Web | 网络搜索、页面抓取 |
| **V18** | Collaboration | 团队协作、任务分发 |
| **V19** | Persistence | 状态持久化 |
| **V20** | Browser | 浏览器自动化 |
| **V21** | Scheduling | 定时任务调度 |
| **V22** | Sandbox | 代码执行沙箱 |
| **V23** | Vision | 图像理解 |
| **V24** | Voice | 语音能力 |

### 2.2 评分标准

| 维度 | 版本 | 测试数 | 权重 |
|------|------|--------|------|
| 工具完整性 | V11-V24 | 42 | 50% |
| 工具继承性 | 跨版本 | 2 | 10% |
| 核心能力 | 基础 | 3 | 15% |
| 版本特性 | V12-V24 | 13 | 15% |
| 性能基准 | 执行时间 | 2 | 10% |

---

## 3. 核心能力矩阵

### 3.1 完整能力评估

| 维度 | 测试项 | 适用版本 |
|------|--------|----------|
| **工具准确性** | 工具调用成功率、参数校验、错误处理 | V0+ |
| **记忆能力** | 召回准确率、相关性、时间衰减 | V2+, V7+ |
| **任务完成** | 规划质量、执行效率、错误恢复 | V3+ |
| **角色一致性** | 身份保持、风格匹配、上下文连贯 | V6+ |
| **自主性** | 心跳触发、主动建议、周期检查 | V8+ |
| **安全性** | 权限控制、危险操作拦截、审计日志 | V12+ |
| **进化能力** | 模式识别、建议生成、自我优化 | V13+ |
| **多模型协作** | 任务分类、路由决策、成本优化 | V15+ |
| **工作流执行** | DAG解析、并行调度、错误处理 | V16+ |
| **外部集成** | Web搜索、页面抓取、结果解析 | V17+ |
| **团队协作** | 任务分发、进度同步、结果合并 | V18+ |
| **持久化** | 状态保存、恢复准确性、版本管理 | V19+ |
| **浏览器自动化** | 页面操作、元素定位、交互可靠性 | V20+ |
| **定时任务** | 调度准确性、执行准时性、错误恢复 | V21+ |
| **代码沙箱** | 安全扫描、资源限制、执行隔离 | V22+ |
| **图像理解** | OCR准确率、内容理解、格式支持 | V23+ |
| **语音能力** | TTS质量、语音合成、播放控制 | V24+ |

---

## 4. Benchmark 测试类型

### 4.1 单元测试 (Unit Tests)
- 测试单个工具/模块功能
- 文件: `tests/v{N}-{module}.test.ts`

### 4.2 集成测试 (Integration Tests)
- 测试模块间协作
- 文件: `tests/benchmark-evolution.test.ts`

### 4.3 端到端测试 (E2E Tests)
- 模拟真实任务场景
- 文件: `tests/benchmark-bl.test.ts`

### 4.4 性能基准 (Performance Benchmarks)
- 响应时间、Token消耗、内存占用
- 内置于各 benchmark 测试

---

## 5. V11+ 版本 Benchmark 规范

每个版本 (V11-V24) 需要通过以下测试:

### 5.1 基础能力测试
```typescript
describe(`${version} Base Capabilities`, () => {
  // 1. 工具可用性
  it('should have all inherited tools')
  it('should have new version-specific tools')
  
  // 2. 向后兼容
  it('should pass V11 base tests')
  
  // 3. 模块初始化
  it('should initialize new modules correctly')
});
```

### 5.2 版本特性测试
```typescript
describe(`${version} Specific Features`, () => {
  // 根据版本特性定制
  // V12: 安全策略
  // V13: 自进化
  // V22: 代码沙箱
  // ...
});
```

### 5.3 性能基准
```typescript
describe(`${version} Performance`, () => {
  it('should respond within X ms')
  it('should handle Y concurrent operations')
  it('should maintain memory below Z MB')
});
```

---

## 6. 执行与报告

### 6.1 运行全部 Benchmark
```bash
npm run benchmark
# 或
npx vitest run tests/benchmark-*.test.ts
```

### 6.2 运行特定测试
```bash
# BL Benchmark
npx vitest run tests/benchmark-bl.test.ts

# V11-V24 版本
npx vitest run tests/benchmark-v11-v24.test.ts
```

### 6.3 报告格式
```json
{
  "benchmark": "BL-Benchmark",
  "timestamp": "2026-02-12T13:00:00Z",
  "scores": {
    "behaviorConsistency": 100,
    "adaptiveLearning": 100,
    "longTermMemory": 100,
    "taskPlanning": 100,
    "errorRecovery": 100,
    "contextUnderstanding": 100,
    "sweBenchStyle": 100,
    "toolBenchStyle": 100
  },
  "totalTests": 44,
  "passed": 46,
  "failed": 0
}
```

---

## 7. 测试文件索引

| 文件 | 类型 | 测试数 |
|------|------|--------|
| `benchmark-bl.test.ts` | BL Benchmark | 46 |
| `benchmark-v11-v24.test.ts` | 版本演进 | 51 |
| `benchmark-v11-v18.test.ts` | 版本演进 (精简) | 51 |
| `benchmark-evolution.test.ts` | 自进化 | - |

---

*Created: 2026-02-12*
*Updated: 2026-02-12 - Added BL Benchmark based on arxiv.org/abs/2602.03587*
