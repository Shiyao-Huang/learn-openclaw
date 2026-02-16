/**
 * Rate Limit Types for V32
 *
 * 速率限制和重试策略的类型定义
 */

// ============ 速率限制类型 ============

/**
 * 速率限制策略
 */
export type RateLimitStrategy = "token_bucket" | "sliding_window" | "fixed_window" | "leaky_bucket";

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  /** 每秒允许的请求数 */
  requestsPerSecond?: number;
  /** 每分钟允许的请求数 */
  requestsPerMinute?: number;
  /** 每小时允许的请求数 */
  requestsPerHour?: number;
  /** 突发请求数 (token bucket) */
  burstSize?: number;
  /** 策略类型 */
  strategy?: RateLimitStrategy;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 速率限制状态
 */
export interface RateLimitState {
  /** 限制器 ID */
  id: string;
  /** 当前令牌数 (token bucket) */
  tokens: number;
  /** 上次更新时间 */
  lastUpdate: number;
  /** 请求计数 (window-based) */
  requestCount: number;
  /** 窗口开始时间 */
  windowStart: number;
  /** 被拒绝的请求数 */
  rejectedCount: number;
  /** 总请求数 */
  totalCount: number;
}

/**
 * 速率限制结果
 */
export interface RateLimitResult {
  /** 是否允许 */
  allowed: boolean;
  /** 剩余令牌/请求数 */
  remaining: number;
  /** 重置时间 (ms) */
  resetTime: number;
  /** 需要等待的时间 (ms) */
  retryAfterMs?: number;
  /** 限制器 ID */
  limiterId: string;
}

// ============ 重试策略类型 ============

/**
 * 重试策略
 */
export type RetryStrategy = "fixed" | "exponential" | "linear" | "decorrelated_jitter";

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxAttempts: number;
  /** 初始延迟 (ms) */
  minDelayMs: number;
  /** 最大延迟 (ms) */
  maxDelayMs: number;
  /** 重试策略 */
  strategy?: RetryStrategy;
  /** 抖动因子 (0-1) */
  jitter?: number;
  /** 指数退避的基数 (exponential 策略) */
  baseMultiplier?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 可重试的错误匹配函数 */
  shouldRetry?: (error: unknown) => boolean;
  /** 获取重试间隔的函数 (从错误中提取) */
  retryAfterMs?: (error: unknown) => number | undefined;
}

/**
 * 重试状态
 */
export interface RetryState {
  /** 当前尝试次数 */
  attempt: number;
  /** 最大尝试次数 */
  maxAttempts: number;
  /** 上次延迟时间 (ms) */
  lastDelayMs: number;
  /** 上次错误 */
  lastError?: unknown;
  /** 重试历史 */
  history: RetryHistoryEntry[];
}

/**
 * 重试历史条目
 */
export interface RetryHistoryEntry {
  /** 尝试次数 */
  attempt: number;
  /** 延迟时间 (ms) */
  delayMs: number;
  /** 错误信息 */
  error: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 重试执行结果
 */
export interface RetryResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 结果 */
  result?: T;
  /** 最终错误 */
  error?: unknown;
  /** 总尝试次数 */
  totalAttempts: number;
  /** 总耗时 (ms) */
  totalDurationMs: number;
  /** 重试历史 */
  history: RetryHistoryEntry[];
}

// ============ 限制器管理类型 ============

/**
 * 限制器定义
 */
export interface LimiterDefinition {
  /** 限制器 ID */
  id: string;
  /** 名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 速率限制配置 */
  rateLimit: RateLimitConfig;
  /** 重试配置 */
  retry?: RetryConfig;
  /** 应用到哪些工具 (通配符支持) */
  tools?: string[];
  /** 优先级 (越高越优先) */
  priority?: number;
}

/**
 * 限制器统计
 */
export interface LimiterStats {
  /** 限制器 ID */
  id: string;
  /** 名称 */
  name: string;
  /** 总请求数 */
  totalRequests: number;
  /** 允许的请求数 */
  allowedRequests: number;
  /** 拒绝的请求数 */
  rejectedRequests: number;
  /** 重试次数 */
  retryCount: number;
  /** 成功重试次数 */
  successfulRetries: number;
  /** 平均等待时间 (ms) */
  avgWaitTimeMs: number;
  /** 当前状态 */
  state: RateLimitState;
  /** 最后请求时间 */
  lastRequestTime: number;
}

/**
 * 引擎配置
 */
export interface RateLimitEngineConfig {
  /** 默认速率限制配置 */
  defaultRateLimit?: RateLimitConfig;
  /** 默认重试配置 */
  defaultRetry?: RetryConfig;
  /** 是否启用速率限制 */
  enableRateLimit?: boolean;
  /** 是否启用重试 */
  enableRetry?: boolean;
  /** 统计保留时间 (ms) */
  statsRetentionMs?: number;
  /** 清理间隔 (ms) */
  cleanupIntervalMs?: number;
}

/**
 * 引擎状态
 */
export interface EngineStatus {
  /** 是否初始化 */
  initialized: boolean;
  /** 限制器数量 */
  limiterCount: number;
  /** 速率限制是否启用 */
  rateLimitEnabled: boolean;
  /** 重试是否启用 */
  retryEnabled: boolean;
  /** 总请求数 */
  totalRequests: number;
  /** 总拒绝数 */
  totalRejected: number;
  /** 总重试数 */
  totalRetries: number;
}

// ============ 预设配置 ============

/**
 * 预设的速率限制配置
 */
export const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
  /** 低限制 (1 req/s) */
  low: {
    requestsPerSecond: 1,
    burstSize: 2,
    strategy: "token_bucket",
  },
  /** 中等限制 (10 req/s) */
  medium: {
    requestsPerSecond: 10,
    burstSize: 20,
    strategy: "token_bucket",
  },
  /** 高限制 (100 req/s) */
  high: {
    requestsPerSecond: 100,
    burstSize: 200,
    strategy: "token_bucket",
  },
  /** API 限制 (60 req/min) */
  api: {
    requestsPerMinute: 60,
    strategy: "sliding_window",
  },
  /** 严格限制 (10 req/hour) */
  strict: {
    requestsPerHour: 10,
    strategy: "fixed_window",
  },
};

/**
 * 预设的重试配置
 */
export const RETRY_PRESETS: Record<string, RetryConfig> = {
  /** 快速重试 */
  quick: {
    maxAttempts: 3,
    minDelayMs: 100,
    maxDelayMs: 1000,
    strategy: "fixed",
    jitter: 0,
  },
  /** 指数退避 */
  exponential: {
    maxAttempts: 5,
    minDelayMs: 500,
    maxDelayMs: 30000,
    strategy: "exponential",
    baseMultiplier: 2,
    jitter: 0.1,
  },
  /** 线性退避 */
  linear: {
    maxAttempts: 5,
    minDelayMs: 1000,
    maxDelayMs: 10000,
    strategy: "linear",
    jitter: 0.1,
  },
  /** 抖动退避 (推荐) */
  jitter: {
    maxAttempts: 5,
    minDelayMs: 500,
    maxDelayMs: 30000,
    strategy: "decorrelated_jitter",
    jitter: 0.3,
  },
  /** API 调用 (从 OpenClaw Discord 配置借鉴) */
  discord: {
    maxAttempts: 3,
    minDelayMs: 500,
    maxDelayMs: 30000,
    strategy: "exponential",
    jitter: 0.1,
  },
  /** Telegram 调用 */
  telegram: {
    maxAttempts: 3,
    minDelayMs: 400,
    maxDelayMs: 30000,
    strategy: "exponential",
    jitter: 0.1,
  },
};
