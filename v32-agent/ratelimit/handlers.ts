/**
 * Rate Limit Handlers for V32
 *
 * 速率限制和重试策略的工具处理器
 */

import type { ToolHandler } from "../../v15-agent/multimodel/types.js";
import {
  RateLimitEngine,
  getRateLimitEngine,
  closeRateLimitEngine,
} from "./engine.js";
import type { RateLimitConfig, RetryConfig, RateLimitStrategy, RetryStrategy } from "./types.js";
import { RATE_LIMIT_PRESETS, RETRY_PRESETS } from "./types.js";
import { RATELIMIT_TOOLS } from "./tools.js";

// ============ 类型定义 ============

interface CreateLimiterParams {
  name: string;
  description?: string;
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  burstSize?: number;
  strategy?: RateLimitStrategy;
  maxRetryAttempts?: number;
  retryStrategy?: RetryStrategy;
  preset?: keyof typeof RATE_LIMIT_PRESETS;
  retryPreset?: keyof typeof RETRY_PRESETS;
}

interface DeleteLimiterParams {
  limiterId: string;
}

interface ResetLimiterParams {
  limiterId: string;
}

interface CheckParams {
  limiterId: string;
}

interface ConsumeParams {
  limiterId: string;
  tokens?: number;
}

interface WaitParams {
  limiterId: string;
  maxWaitMs?: number;
}

interface StatsParams {
  limiterId?: string;
}

interface ConfigParams {
  enableRateLimit?: boolean;
  enableRetry?: boolean;
}

interface PresetsParams {
  type?: "rate" | "retry" | "all";
}

interface RetryParams {
  limiterId?: string;
  maxAttempts?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  strategy?: RetryStrategy;
  preset?: keyof typeof RETRY_PRESETS;
  operation?: string;
}

interface DelayParams {
  attempt: number;
  strategy?: RetryStrategy;
  minDelayMs?: number;
  maxDelayMs?: number;
}

// ============ 辅助函数 ============

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatResult(data: unknown): string {
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 2);
}

// ============ 处理器映射 ============

export const ratelimitHandlers: Record<string, ToolHandler> = {
  // ============ 限制器管理 ============

  ratelimit_create: async (params: CreateLimiterParams) => {
    const engine = getRateLimitEngine();
    await engine.initialize();

    // 构建速率限制配置
    let rateLimit: RateLimitConfig;
    if (params.preset && RATE_LIMIT_PRESETS[params.preset]) {
      rateLimit = { ...RATE_LIMIT_PRESETS[params.preset] };
    } else {
      rateLimit = {
        requestsPerSecond: params.requestsPerSecond,
        requestsPerMinute: params.requestsPerMinute,
        requestsPerHour: params.requestsPerHour,
        burstSize: params.burstSize,
        strategy: params.strategy,
      };
    }

    // 构建重试配置
    let retry: RetryConfig | undefined;
    if (params.retryPreset && RETRY_PRESETS[params.retryPreset]) {
      retry = { ...RETRY_PRESETS[params.retryPreset] };
    } else if (params.maxRetryAttempts || params.retryStrategy) {
      retry = {
        maxAttempts: params.maxRetryAttempts || 3,
        strategy: params.retryStrategy || "exponential",
      };
    }

    const id = engine.createLimiter({
      name: params.name,
      description: params.description,
      rateLimit,
      retry,
    });

    return formatResult({
      success: true,
      limiterId: id,
      message: `限制器 "${params.name}" 已创建`,
      config: {
        rateLimit,
        retry,
      },
    });
  },

  ratelimit_delete: async (params: DeleteLimiterParams) => {
    const engine = getRateLimitEngine();
    const deleted = engine.deleteLimiter(params.limiterId);

    return formatResult({
      success: deleted,
      limiterId: params.limiterId,
      message: deleted ? `限制器已删除` : `限制器不存在`,
    });
  },

  ratelimit_reset: async (params: ResetLimiterParams) => {
    const engine = getRateLimitEngine();
    const reset = engine.resetLimiter(params.limiterId);

    return formatResult({
      success: reset,
      limiterId: params.limiterId,
      message: reset ? `限制器已重置` : `限制器不存在`,
    });
  },

  ratelimit_list: async () => {
    const engine = getRateLimitEngine();
    const stats = engine.getAllStats();

    if (stats.length === 0) {
      return "当前没有限制器";
    }

    const list = stats.map((s) => ({
      id: s.id,
      name: s.name,
      totalRequests: s.totalRequests,
      rejectedRequests: s.rejectedRequests,
      remaining: s.state.tokens,
    }));

    return formatResult({
      count: list.length,
      limiters: list,
    });
  },

  ratelimit_get: async (params: CheckParams) => {
    const engine = getRateLimitEngine();
    const stats = engine.getStats(params.limiterId);

    if (!stats) {
      return formatResult({
        error: `限制器 ${params.limiterId} 不存在`,
      });
    }

    return formatResult(stats);
  },

  // ============ 速率限制操作 ============

  ratelimit_check: async (params: CheckParams) => {
    const engine = getRateLimitEngine();
    const result = engine.checkLimit(params.limiterId);

    return formatResult({
      limiterId: params.limiterId,
      allowed: result.allowed,
      remaining: result.remaining,
      resetTime: new Date(result.resetTime).toISOString(),
      retryAfterMs: result.retryAfterMs,
    });
  },

  ratelimit_consume: async (params: ConsumeParams) => {
    const engine = getRateLimitEngine();
    // checkLimit 内部会消耗配额
    const result = engine.checkLimit(params.limiterId);

    if (!result.allowed) {
      return formatResult({
        success: false,
        limiterId: params.limiterId,
        error: "速率限制已超出",
        retryAfterMs: result.retryAfterMs,
        resetTime: new Date(result.resetTime).toISOString(),
      });
    }

    return formatResult({
      success: true,
      limiterId: params.limiterId,
      remaining: result.remaining,
      resetTime: new Date(result.resetTime).toISOString(),
    });
  },

  ratelimit_wait: async (params: WaitParams) => {
    const engine = getRateLimitEngine();
    const result = engine.checkLimit(params.limiterId);

    if (result.allowed) {
      return formatResult({
        success: true,
        message: "可以立即发送请求",
        remaining: result.remaining,
      });
    }

    const waitTime = result.retryAfterMs || 0;

    if (params.maxWaitMs && waitTime > params.maxWaitMs) {
      return formatResult({
        success: false,
        error: `需要等待 ${waitTime}ms, 超过最大等待时间 ${params.maxWaitMs}ms`,
        retryAfterMs: waitTime,
      });
    }

    await sleep(waitTime);

    return formatResult({
      success: true,
      message: `已等待 ${waitTime}ms, 现在可以发送请求`,
      waitedMs: waitTime,
    });
  },

  // ============ 统计与状态 ============

  ratelimit_stats: async (params: StatsParams) => {
    const engine = getRateLimitEngine();

    if (params.limiterId) {
      const stats = engine.getStats(params.limiterId);
      if (!stats) {
        return formatResult({ error: `限制器 ${params.limiterId} 不存在` });
      }
      return formatResult(stats);
    }

    const allStats = engine.getAllStats();
    const summary = {
      totalLimiters: allStats.length,
      totalRequests: allStats.reduce((sum, s) => sum + s.totalRequests, 0),
      totalAllowed: allStats.reduce((sum, s) => sum + s.allowedRequests, 0),
      totalRejected: allStats.reduce((sum, s) => sum + s.rejectedRequests, 0),
      totalRetries: allStats.reduce((sum, s) => sum + s.retryCount, 0),
      limiters: allStats.map((s) => ({
        id: s.id,
        name: s.name,
        requests: s.totalRequests,
        rejected: s.rejectedRequests,
        retries: s.retryCount,
      })),
    };

    return formatResult(summary);
  },

  ratelimit_status: async () => {
    const engine = getRateLimitEngine();
    const status = engine.getStatus();

    return formatResult({
      ...status,
      status: status.initialized ? "运行中" : "未初始化",
    });
  },

  // ============ 预设与配置 ============

  ratelimit_presets: async (params: PresetsParams) => {
    const type = params.type || "all";

    if (type === "rate") {
      return formatResult({
        type: "rate",
        presets: Object.entries(RATE_LIMIT_PRESETS).map(([name, config]) => ({
          name,
          description: getRatePresetDescription(name),
          config,
        })),
      });
    }

    if (type === "retry") {
      return formatResult({
        type: "retry",
        presets: Object.entries(RETRY_PRESETS).map(([name, config]) => ({
          name,
          description: getRetryPresetDescription(name),
          config,
        })),
      });
    }

    return formatResult({
      rateLimitPresets: Object.entries(RATE_LIMIT_PRESETS).map(([name, config]) => ({
        name,
        description: getRatePresetDescription(name),
        config,
      })),
      retryPresets: Object.entries(RETRY_PRESETS).map(([name, config]) => ({
        name,
        description: getRetryPresetDescription(name),
        config,
      })),
    });
  },

  ratelimit_config: async (params: ConfigParams) => {
    const engine = getRateLimitEngine();
    const status = engine.getStatus();

    // 注意: 实际更新配置需要重新创建引擎实例
    // 这里只返回当前状态
    return formatResult({
      current: {
        enableRateLimit: status.rateLimitEnabled,
        enableRetry: status.retryEnabled,
      },
      message: "要更改配置，需要重新创建引擎实例",
    });
  },

  // ============ 重试操作 ============

  ratelimit_retry: async (params: RetryParams) => {
    const engine = getRateLimitEngine();
    await engine.initialize();

    // 模拟一个操作执行
    // 实际使用中，用户会提供要执行的函数
    // 这里我们只演示重试逻辑

    let attempts = 0;
    let success = false;
    let lastDelay = 0;
    const history: Array<{ attempt: number; delayMs: number; timestamp: number }> = [];

    // 使用配置的重试策略
    const retryConfig: RetryConfig = params.preset
      ? RETRY_PRESETS[params.preset]
      : {
          maxAttempts: params.maxAttempts || 3,
          minDelayMs: params.minDelayMs || 100,
          maxDelayMs: params.maxDelayMs || 10000,
          strategy: params.strategy || "exponential",
        };

    // 演示模式: 模拟一个可能会失败的操作
    const maxAttempts = retryConfig.maxAttempts || 3;

    for (let i = 1; i <= maxAttempts; i++) {
      attempts = i;

      // 计算延迟 (第一次不延迟)
      if (i > 1) {
        lastDelay = calculateDelay(i - 1, retryConfig);
        history.push({
          attempt: i - 1,
          delayMs: lastDelay,
          timestamp: Date.now(),
        });
        await sleep(Math.min(lastDelay, 100)); // 演示时限制最大延迟
      }

      // 模拟操作 - 这里总是成功 (第3次尝试)
      if (i === maxAttempts || Math.random() > 0.5) {
        success = true;
        break;
      }
    }

    return formatResult({
      success,
      operation: params.operation || "演示操作",
      totalAttempts: attempts,
      maxAttempts,
      strategy: retryConfig.strategy,
      history,
      message: success
        ? `操作在第 ${attempts} 次尝试后成功`
        : `操作在 ${attempts} 次尝试后失败`,
    });
  },

  // ============ 工具函数 ============

  ratelimit_delay: async (params: DelayParams) => {
    const config: RetryConfig = {
      maxAttempts: 10,
      minDelayMs: params.minDelayMs || 100,
      maxDelayMs: params.maxDelayMs || 30000,
      strategy: params.strategy || "exponential",
    };

    const delay = calculateDelay(params.attempt, config);

    return formatResult({
      attempt: params.attempt,
      strategy: config.strategy,
      delayMs: delay,
      minDelayMs: config.minDelayMs,
      maxDelayMs: config.maxDelayMs,
    });
  },
};

// ============ 辅助函数 ============

function calculateDelay(attempt: number, config: RetryConfig): number {
  const minDelay = config.minDelayMs || 100;
  const maxDelay = config.maxDelayMs || 30000;
  const baseMultiplier = config.baseMultiplier || 2;
  const jitter = config.jitter || 0;

  let delay: number;

  switch (config.strategy) {
    case "fixed":
      delay = minDelay;
      break;

    case "linear":
      delay = minDelay * attempt;
      break;

    case "exponential":
      delay = minDelay * Math.pow(baseMultiplier, attempt - 1);
      break;

    case "decorrelated_jitter":
      delay = Math.min(maxDelay, Math.random() * Math.max(minDelay, minDelay * 3 * Math.pow(2, attempt - 1)));
      break;

    default:
      delay = minDelay;
  }

  // 添加抖动
  if (jitter > 0) {
    const jitterRange = delay * jitter;
    delay = delay + (Math.random() * 2 - 1) * jitterRange;
  }

  return Math.max(minDelay, Math.min(maxDelay, Math.floor(delay)));
}

function getRatePresetDescription(name: string): string {
  const descriptions: Record<string, string> = {
    low: "低限制 (1 req/s, burst 2)",
    medium: "中等限制 (10 req/s, burst 20)",
    high: "高限制 (100 req/s, burst 200)",
    api: "API 限制 (60 req/min, sliding window)",
    strict: "严格限制 (10 req/hour, fixed window)",
  };
  return descriptions[name] || "未知预设";
}

function getRetryPresetDescription(name: string): string {
  const descriptions: Record<string, string> = {
    quick: "快速重试 (3次, 固定延迟 100ms)",
    exponential: "指数退避 (5次, 500ms-30s)",
    linear: "线性退避 (5次, 1s-10s)",
    jitter: "抖动退避 (推荐, 5次, 500ms-30s)",
    discord: "Discord 风格 (3次, 500ms-30s)",
    telegram: "Telegram 风格 (3次, 400ms-30s)",
  };
  return descriptions[name] || "未知预设";
}

// ============ 关闭处理 ============

export async function closeRatelimitHandlers(): Promise<void> {
  await closeRateLimitEngine();
}

// ============ 导出 ============

export { RATELIMIT_TOOLS, RATELIMIT_TOOL_COUNT } from "./tools.js";
