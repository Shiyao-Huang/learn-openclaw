/**
 * V35: Usage/成本追踪系统 - 类型定义
 */

/**
 * 使用数据 (标准化)
 */
export interface NormalizedUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
}

/**
 * 使用数据 (原始，支持多种格式)
 */
export interface UsageLike {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  totalTokens?: number;
  total_tokens?: number;
  cache_read?: number;
  cache_write?: number;
}

/**
 * 成本明细
 */
export interface CostBreakdown {
  total?: number;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/**
 * 模型成本配置
 */
export interface ModelCostConfig {
  provider: string;
  model: string;
  inputCostPer1k?: number;  // 每 1k input token 的成本
  outputCostPer1k?: number; // 每 1k output token 的成本
  cacheReadCostPer1k?: number;  // 每 1k cache read token 的成本
  cacheWriteCostPer1k?: number; // 每 1k cache write token 的成本
}

/**
 * 使用记录
 */
export interface UsageRecord {
  id: string;
  timestamp: number;
  provider?: string;
  model?: string;
  usage: NormalizedUsage;
  cost?: number;
  costBreakdown?: CostBreakdown;
  toolName?: string;
  durationMs?: number;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 使用总计
 */
export interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  recordCount: number;
}

/**
 * 每日使用统计
 */
export interface DailyUsage extends UsageTotals {
  date: string; // YYYY-MM-DD
}

/**
 * 工具使用统计
 */
export interface ToolUsageStats {
  name: string;
  callCount: number;
  totalTokens: number;
  totalCost: number;
  avgDurationMs: number;
  errorCount: number;
}

/**
 * 模型使用统计
 */
export interface ModelUsageStats {
  provider?: string;
  model?: string;
  callCount: number;
  totals: UsageTotals;
}

/**
 * 延迟统计
 */
export interface LatencyStats {
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
}

/**
 * 每日延迟统计
 */
export interface DailyLatency extends LatencyStats {
  date: string;
}

/**
 * 使用摘要
 */
export interface UsageSummary {
  updatedAt: number;
  period: {
    startMs: number;
    endMs: number;
    days: number;
  };
  totals: UsageTotals;
  daily: DailyUsage[];
  topTools: ToolUsageStats[];
  topModels: ModelUsageStats[];
  latency?: LatencyStats;
  dailyLatency?: DailyLatency[];
}

/**
 * 会话使用摘要
 */
export interface SessionUsageSummary extends UsageTotals {
  sessionId?: string;
  firstActivity?: number;
  lastActivity?: number;
  durationMs?: number;
  activityDates?: string[];
  dailyBreakdown?: DailyUsage[];
  toolUsage?: ToolUsageStats[];
  modelUsage?: ModelUsageStats[];
  latency?: LatencyStats;
}

/**
 * 使用追踪配置
 */
export interface UsageTrackerConfig {
  /** 是否启用追踪 */
  enabled: boolean;
  /** 是否追踪成本 */
  trackCosts: boolean;
  /** 是否追踪工具调用 */
  trackTools: boolean;
  /** 是否追踪延迟 */
  trackLatency: boolean;
  /** 记录保留天数 */
  retentionDays: number;
  /** 最大记录数 */
  maxRecords: number;
  /** 采样率 (0-1, 1 = 全部记录) */
  samplingRate: number;
}

/**
 * 报告格式
 */
export type ReportFormat = "text" | "json" | "markdown" | "csv";

/**
 * 报告选项
 */
export interface ReportOptions {
  format: ReportFormat;
  includeDaily?: boolean;
  includeTools?: boolean;
  includeModels?: boolean;
  includeLatency?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 默认配置
 */
export const DEFAULT_USAGE_CONFIG: UsageTrackerConfig = {
  enabled: true,
  trackCosts: true,
  trackTools: true,
  trackLatency: true,
  retentionDays: 30,
  maxRecords: 100000,
  samplingRate: 1.0,
};

/**
 * 默认模型成本配置
 */
export const DEFAULT_MODEL_COSTS: ModelCostConfig[] = [
  // OpenAI
  {
    provider: "openai",
    model: "gpt-4o",
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
  },
  {
    provider: "openai",
    model: "gpt-4-turbo",
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
  },
  {
    provider: "openai",
    model: "gpt-3.5-turbo",
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015,
  },
  // Anthropic
  {
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    cacheReadCostPer1k: 0.0003,
    cacheWriteCostPer1k: 0.00375,
  },
  {
    provider: "anthropic",
    model: "claude-3-opus",
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    cacheReadCostPer1k: 0.0015,
    cacheWriteCostPer1k: 0.01875,
  },
  {
    provider: "anthropic",
    model: "claude-3-haiku",
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125,
    cacheReadCostPer1k: 0.00003,
    cacheWriteCostPer1k: 0.0003,
  },
  // Google
  {
    provider: "google",
    model: "gemini-1.5-pro",
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    cacheReadCostPer1k: 0.0003125,
    cacheWriteCostPer1k: 0.003125,
  },
  {
    provider: "google",
    model: "gemini-1.5-flash",
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
  },
  // Zhipu (GLM)
  {
    provider: "zhipu",
    model: "glm-4",
    inputCostPer1k: 0.014,
    outputCostPer1k: 0.014,
  },
  {
    provider: "zhipu",
    model: "glm-4-flash",
    inputCostPer1k: 0.0001,
    outputCostPer1k: 0.0001,
  },
  // Default fallback
  {
    provider: "default",
    model: "default",
    inputCostPer1k: 0.001,
    outputCostPer1k: 0.003,
  },
];
