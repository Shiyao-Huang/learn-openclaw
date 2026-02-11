/**
 * v13-agent/evolution/types.ts - 自进化系统类型
 * 
 * V13 新增: 从数据中学习，持续优化自身行为
 */

// 行为模式
export interface ToolCallPattern {
  sequence: string[];      // 工具调用序列
  frequency: number;       // 出现频率
  avgDuration: number;     // 平均耗时
  successRate: number;     // 成功率
  context?: string;        // 触发上下文
}

// 行为统计
export interface BehaviorStats {
  totalCalls: number;
  uniqueTools: number;
  avgCallsPerSession: number;
  topPatterns: ToolCallPattern[];
  inefficientPatterns: ToolCallPattern[];
  errorPatterns: ToolCallPattern[];
}

// 策略建议
export interface PolicySuggestion {
  type: 'risk_level' | 'trust_adjustment' | 'deny_list';
  tool?: string;
  currentValue: string;
  suggestedValue: string;
  confidence: number;      // 0-1
  reason: string;
  evidence: string[];      // 支持证据
}

// 学习结果
export interface LearningResult {
  suggestions: PolicySuggestion[];
  appliedCount: number;
  skippedCount: number;
  timestamp: number;
}

// 性能指标
export interface PerformanceMetric {
  tool: string;
  avgDuration: number;
  p95Duration: number;
  callCount: number;
  errorRate: number;
}

// 优化建议
export interface OptimizationSuggestion {
  type: 'cache' | 'batch' | 'parallel' | 'simplify';
  target: string;
  expectedImprovement: string;
  implementation: string;
}

// 错误模式
export interface ErrorPattern {
  pattern: string;
  frequency: number;
  lastOccurrence: number;
  autoFixable: boolean;
  fixStrategy?: string;
}

// 修复动作
export interface HealingAction {
  errorPattern: string;
  action: 'retry' | 'fallback' | 'skip' | 'alert';
  success: boolean;
  timestamp: number;
}
