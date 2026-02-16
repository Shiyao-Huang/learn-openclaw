/**
 * Rate Limit Engine for V32
 *
 * 速率限制和重试策略引擎核心
 *
 * 灵感来源: OpenClaw src/infra/retry-policy.ts
 */

import type {
  RateLimitConfig,
  RateLimitState,
  RateLimitResult,
  RetryConfig,
  RetryState,
  RetryResult,
  RetryHistoryEntry,
  LimiterDefinition,
  LimiterStats,
  RateLimitEngineConfig,
  EngineStatus,
  RateLimitStrategy,
  RetryStrategy,
} from "./types.js";
import { RATE_LIMIT_PRESETS, RETRY_PRESETS } from "./types.js";

// ============ 工具函数 ============

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `limiter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 休眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 格式化错误信息
 */
function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// ============ Token Bucket 限制器 ============

class TokenBucketLimiter {
  private tokens: number;
  private lastUpdate: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(config: RateLimitConfig) {
    this.maxTokens = config.burstSize || config.requestsPerSecond || 10;
    this.tokens = this.maxTokens;
    this.refillRate = (config.requestsPerSecond || 10) / 1000;
    this.lastUpdate = Date.now();
  }

  tryConsume(tokens: number = 1): RateLimitResult {
    this.refill();
    const now = Date.now();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return {
        allowed: true,
        remaining: Math.floor(this.tokens),
        resetTime: now + Math.ceil((this.maxTokens - this.tokens) / this.refillRate),
        limiterId: "token_bucket",
      };
    }

    const needed = tokens - this.tokens;
    const waitTime = Math.ceil(needed / this.refillRate);

    return {
      allowed: false,
      remaining: 0,
      resetTime: now + waitTime,
      retryAfterMs: waitTime,
      limiterId: "token_bucket",
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastUpdate;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastUpdate = now;
  }

  getState(): RateLimitState {
    this.refill();
    return {
      id: "token_bucket",
      tokens: this.tokens,
      lastUpdate: this.lastUpdate,
      requestCount: 0,
      windowStart: this.lastUpdate,
      rejectedCount: 0,
      totalCount: 0,
    };
  }
}

// ============ Sliding Window 限制器 ============

class SlidingWindowLimiter {
  private requests: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private rejectedCount = 0;
  private totalCount = 0;

  constructor(config: RateLimitConfig) {
    // 使用 requestsPerMinute 作为默认
    const rpm = config.requestsPerMinute || config.requestsPerSecond! * 60 || 60;
    this.maxRequests = rpm;
    this.windowMs = 60000; // 1 minute window
  }

  tryConsume(): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 清理过期的请求
    this.requests = this.requests.filter((t) => t > windowStart);
    this.totalCount++;

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return {
        allowed: true,
        remaining: this.maxRequests - this.requests.length,
        resetTime: this.requests.length > 0 ? this.requests[0] + this.windowMs : now,
        limiterId: "sliding_window",
      };
    }

    this.rejectedCount++;
    const oldestRequest = this.requests[0];
    const retryAfter = oldestRequest + this.windowMs - now;

    return {
      allowed: false,
      remaining: 0,
      resetTime: oldestRequest + this.windowMs,
      retryAfterMs: Math.max(0, retryAfter),
      limiterId: "sliding_window",
    };
  }

  getState(): RateLimitState {
    const now = Date.now();
    return {
      id: "sliding_window",
      tokens: this.maxRequests - this.requests.length,
      lastUpdate: now,
      requestCount: this.requests.length,
      windowStart: now - this.windowMs,
      rejectedCount: this.rejectedCount,
      totalCount: this.totalCount,
    };
  }
}

// ============ Fixed Window 限制器 ============

class FixedWindowLimiter {
  private requestCount = 0;
  private windowStart: number;
  private rejectedCount = 0;
  private totalCount = 0;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(config: RateLimitConfig) {
    // 使用 requestsPerHour 作为默认
    if (config.requestsPerHour) {
      this.maxRequests = config.requestsPerHour;
      this.windowMs = 3600000; // 1 hour
    } else if (config.requestsPerMinute) {
      this.maxRequests = config.requestsPerMinute;
      this.windowMs = 60000; // 1 minute
    } else {
      this.maxRequests = config.requestsPerSecond || 10;
      this.windowMs = 1000; // 1 second
    }
    this.windowStart = Date.now();
  }

  tryConsume(): RateLimitResult {
    const now = Date.now();
    this.totalCount++;

    // 检查是否需要重置窗口
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    if (this.requestCount < this.maxRequests) {
      this.requestCount++;
      return {
        allowed: true,
        remaining: this.maxRequests - this.requestCount,
        resetTime: this.windowStart + this.windowMs,
        limiterId: "fixed_window",
      };
    }

    this.rejectedCount++;
    const retryAfter = this.windowStart + this.windowMs - now;

    return {
      allowed: false,
      remaining: 0,
      resetTime: this.windowStart + this.windowMs,
      retryAfterMs: Math.max(0, retryAfter),
      limiterId: "fixed_window",
    };
  }

  getState(): RateLimitState {
    return {
      id: "fixed_window",
      tokens: this.maxRequests - this.requestCount,
      lastUpdate: Date.now(),
      requestCount: this.requestCount,
      windowStart: this.windowStart,
      rejectedCount: this.rejectedCount,
      totalCount: this.totalCount,
    };
  }
}

// ============ 重试策略 ============

class RetryPolicy {
  private config: Required<Omit<RetryConfig, "shouldRetry" | "retryAfterMs">> & Pick<RetryConfig, "shouldRetry" | "retryAfterMs">;

  constructor(config: RetryConfig) {
    this.config = {
      maxAttempts: config.maxAttempts || 3,
      minDelayMs: config.minDelayMs || 100,
      maxDelayMs: config.maxDelayMs || 30000,
      strategy: config.strategy || "exponential",
      jitter: config.jitter || 0.1,
      baseMultiplier: config.baseMultiplier || 2,
      enabled: config.enabled !== false,
      shouldRetry: config.shouldRetry,
      retryAfterMs: config.retryAfterMs,
    };
  }

  /**
   * 计算下一次重试的延迟时间
   */
  calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.strategy) {
      case "fixed":
        delay = this.config.minDelayMs;
        break;

      case "linear":
        delay = this.config.minDelayMs * attempt;
        break;

      case "exponential":
        delay = this.config.minDelayMs * Math.pow(this.config.baseMultiplier, attempt - 1);
        break;

      case "decorrelated_jitter":
        // 装饰性抖动: delay = min(cap, random_between(base, delay * 3))
        const cap = this.config.maxDelayMs;
        const base = this.config.minDelayMs;
        delay = Math.min(cap, Math.random() * Math.max(base, base * 3 * Math.pow(2, attempt - 1)));
        break;

      default:
        delay = this.config.minDelayMs;
    }

    // 添加抖动
    if (this.config.jitter > 0) {
      const jitterRange = delay * this.config.jitter;
      delay = delay + (Math.random() * 2 - 1) * jitterRange;
    }

    // 确保在范围内
    return Math.max(this.config.minDelayMs, Math.min(this.config.maxDelayMs, Math.floor(delay)));
  }

  /**
   * 检查是否应该重试
   */
  shouldRetry(error: unknown, attempt: number): boolean {
    if (!this.config.enabled) return false;
    if (attempt >= this.config.maxAttempts) return false;

    // 如果有自定义检查函数，使用它
    if (this.config.shouldRetry) {
      return this.config.shouldRetry(error);
    }

    // 默认: 重试网络错误和 5xx 错误
    const errMsg = formatError(error).toLowerCase();
    return (
      errMsg.includes("timeout") ||
      errMsg.includes("network") ||
      errMsg.includes("econnreset") ||
      errMsg.includes("econnrefused") ||
      errMsg.includes("429") ||
      errMsg.includes("rate limit") ||
      errMsg.includes("503") ||
      errMsg.includes("502") ||
      errMsg.includes("500") ||
      errMsg.includes("unavailable") ||
      errMsg.includes("temporarily")
    );
  }

  /**
   * 获取从错误中提取的重试间隔
   */
  getRetryAfterMs(error: unknown): number | undefined {
    if (this.config.retryAfterMs) {
      return this.config.retryAfterMs(error);
    }
    return undefined;
  }

  /**
   * 执行带重试的函数
   */
  async execute<T>(fn: () => Promise<T>, label?: string): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const history: RetryHistoryEntry[] = [];
    let lastError: unknown;
    let lastDelayMs = 0;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await fn();
        return {
          success: true,
          result,
          totalAttempts: attempt,
          totalDurationMs: Date.now() - startTime,
          history,
        };
      } catch (err) {
        lastError = err;

        // 检查是否应该重试
        if (!this.shouldRetry(err, attempt)) {
          return {
            success: false,
            error: err,
            totalAttempts: attempt,
            totalDurationMs: Date.now() - startTime,
            history,
          };
        }

        // 计算延迟
        const retryAfter = this.getRetryAfterMs(err);
        lastDelayMs = retryAfter !== undefined ? retryAfter : this.calculateDelay(attempt);

        // 记录历史
        history.push({
          attempt,
          delayMs: lastDelayMs,
          error: formatError(err),
          timestamp: Date.now(),
        });

        // 等待
        if (attempt < this.config.maxAttempts) {
          await sleep(lastDelayMs);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      totalAttempts: this.config.maxAttempts,
      totalDurationMs: Date.now() - startTime,
      history,
    };
  }

  getConfig(): RetryConfig {
    return { ...this.config };
  }
}

// ============ 主引擎 ============

/**
 * 速率限制和重试引擎
 */
export class RateLimitEngine {
  private config: Required<RateLimitEngineConfig>;
  private limiters: Map<string, LimiterDefinition> = new Map();
  private rateLimiters: Map<string, TokenBucketLimiter | SlidingWindowLimiter | FixedWindowLimiter> = new Map();
  private retryPolicies: Map<string, RetryPolicy> = new Map();
  private stats: Map<string, LimiterStats> = new Map();
  private totalRequests = 0;
  private totalRejected = 0;
  private totalRetries = 0;
  private initialized = false;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config?: RateLimitEngineConfig) {
    this.config = {
      defaultRateLimit: config?.defaultRateLimit || RATE_LIMIT_PRESETS.medium,
      defaultRetry: config?.defaultRetry || RETRY_PRESETS.jitter,
      enableRateLimit: config?.enableRateLimit !== false,
      enableRetry: config?.enableRetry !== false,
      statsRetentionMs: config?.statsRetentionMs || 3600000, // 1 hour
      cleanupIntervalMs: config?.cleanupIntervalMs || 300000, // 5 minutes
    };
  }

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 启动清理定时器
    if (this.config.cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupIntervalMs);
    }

    this.initialized = true;
  }

  /**
   * 关闭引擎
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.initialized = false;
  }

  /**
   * 创建限制器
   */
  createLimiter(definition: LimiterDefinition): string {
    const id = definition.id || generateId();

    const limiter: LimiterDefinition = {
      ...definition,
      id,
      priority: definition.priority || 0,
    };

    // 创建速率限制器实例
    const strategy = definition.rateLimit.strategy || "token_bucket";
    let rateLimiter: TokenBucketLimiter | SlidingWindowLimiter | FixedWindowLimiter;

    switch (strategy) {
      case "sliding_window":
        rateLimiter = new SlidingWindowLimiter(definition.rateLimit);
        break;
      case "fixed_window":
        rateLimiter = new FixedWindowLimiter(definition.rateLimit);
        break;
      case "token_bucket":
      default:
        rateLimiter = new TokenBucketLimiter(definition.rateLimit);
        break;
    }

    this.limiters.set(id, limiter);
    this.rateLimiters.set(id, rateLimiter);

    // 创建重试策略
    if (definition.retry) {
      this.retryPolicies.set(id, new RetryPolicy(definition.retry));
    }

    // 初始化统计
    this.stats.set(id, {
      id,
      name: limiter.name,
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0,
      retryCount: 0,
      successfulRetries: 0,
      avgWaitTimeMs: 0,
      state: rateLimiter.getState(),
      lastRequestTime: Date.now(),
    });

    return id;
  }

  /**
   * 检查是否允许请求
   */
  checkLimit(limiterId: string): RateLimitResult {
    const rateLimiter = this.rateLimiters.get(limiterId);
    if (!rateLimiter) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: Date.now(),
        limiterId,
      };
    }

    this.totalRequests++;
    const result = rateLimiter.tryConsume();

    // 更新统计
    const stats = this.stats.get(limiterId);
    if (stats) {
      stats.totalRequests++;
      stats.lastRequestTime = Date.now();
      stats.state = rateLimiter.getState();

      if (result.allowed) {
        stats.allowedRequests++;
      } else {
        stats.rejectedRequests++;
        this.totalRejected++;
      }
    }

    return result;
  }

  /**
   * 使用限制器执行函数
   */
  async executeWithLimit<T>(limiterId: string, fn: () => Promise<T>, label?: string): Promise<T> {
    // 检查速率限制
    const result = this.checkLimit(limiterId);

    if (!result.allowed && this.config.enableRateLimit) {
      // 等待后重试
      if (result.retryAfterMs) {
        await sleep(result.retryAfterMs);
      } else {
        throw new Error(`Rate limit exceeded for ${limiterId}`);
      }
    }

    // 执行带重试的函数
    const retryPolicy = this.retryPolicies.get(limiterId);
    if (retryPolicy && this.config.enableRetry) {
      const retryResult = await retryPolicy.execute(fn, label);

      // 更新统计
      const stats = this.stats.get(limiterId);
      if (stats && retryResult.history.length > 0) {
        stats.retryCount += retryResult.history.length;
        if (retryResult.success) {
          stats.successfulRetries += retryResult.history.length;
        }
        this.totalRetries += retryResult.history.length;
      }

      if (retryResult.success) {
        return retryResult.result!;
      }
      throw retryResult.error;
    }

    // 无重试策略，直接执行
    return fn();
  }

  /**
   * 使用默认配置执行函数
   */
  async execute<T>(fn: () => Promise<T>, label?: string): Promise<T> {
    const defaultLimiterId = "_default";

    // 确保默认限制器存在
    if (!this.limiters.has(defaultLimiterId)) {
      this.createLimiter({
        id: defaultLimiterId,
        name: "Default Limiter",
        rateLimit: this.config.defaultRateLimit,
        retry: this.config.defaultRetry,
      });
    }

    return this.executeWithLimit(defaultLimiterId, fn, label);
  }

  /**
   * 获取限制器统计
   */
  getStats(limiterId: string): LimiterStats | undefined {
    return this.stats.get(limiterId);
  }

  /**
   * 获取所有统计
   */
  getAllStats(): LimiterStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * 获取引擎状态
   */
  getStatus(): EngineStatus {
    return {
      initialized: this.initialized,
      limiterCount: this.limiters.size,
      rateLimitEnabled: this.config.enableRateLimit,
      retryEnabled: this.config.enableRetry,
      totalRequests: this.totalRequests,
      totalRejected: this.totalRejected,
      totalRetries: this.totalRetries,
    };
  }

  /**
   * 删除限制器
   */
  deleteLimiter(limiterId: string): boolean {
    this.limiters.delete(limiterId);
    this.rateLimiters.delete(limiterId);
    this.retryPolicies.delete(limiterId);
    return this.stats.delete(limiterId);
  }

  /**
   * 重置限制器
   */
  resetLimiter(limiterId: string): boolean {
    const definition = this.limiters.get(limiterId);
    if (!definition) return false;

    // 重新创建限制器
    const strategy = definition.rateLimit.strategy || "token_bucket";
    let rateLimiter: TokenBucketLimiter | SlidingWindowLimiter | FixedWindowLimiter;

    switch (strategy) {
      case "sliding_window":
        rateLimiter = new SlidingWindowLimiter(definition.rateLimit);
        break;
      case "fixed_window":
        rateLimiter = new FixedWindowLimiter(definition.rateLimit);
        break;
      case "token_bucket":
      default:
        rateLimiter = new TokenBucketLimiter(definition.rateLimit);
        break;
    }

    this.rateLimiters.set(limiterId, rateLimiter);

    // 重置统计
    const stats = this.stats.get(limiterId);
    if (stats) {
      stats.totalRequests = 0;
      stats.allowedRequests = 0;
      stats.rejectedRequests = 0;
      stats.retryCount = 0;
      stats.successfulRetries = 0;
      stats.avgWaitTimeMs = 0;
      stats.state = rateLimiter.getState();
    }

    return true;
  }

  /**
   * 清理过期统计
   */
  private cleanup(): void {
    const now = Date.now();
    const retention = this.config.statsRetentionMs;

    for (const [id, stats] of this.stats) {
      if (now - stats.lastRequestTime > retention) {
        // 重置过期统计而不是删除
        stats.totalRequests = 0;
        stats.allowedRequests = 0;
        stats.rejectedRequests = 0;
        stats.retryCount = 0;
        stats.successfulRetries = 0;
      }
    }
  }

  /**
   * 获取预设配置
   */
  static getRateLimitPresets(): Record<string, RateLimitConfig> {
    return { ...RATE_LIMIT_PRESETS };
  }

  static getRetryPresets(): Record<string, RetryConfig> {
    return { ...RETRY_PRESETS };
  }
}

// ============ 单例管理 ============

let engineInstance: RateLimitEngine | null = null;

export function getRateLimitEngine(config?: RateLimitEngineConfig): RateLimitEngine {
  if (!engineInstance) {
    engineInstance = new RateLimitEngine(config);
  }
  return engineInstance;
}

export function closeRateLimitEngine(): Promise<void> {
  if (engineInstance) {
    const promise = engineInstance.close();
    engineInstance = null;
    return promise;
  }
  return Promise.resolve();
}
