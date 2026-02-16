/**
 * Rate Limit Tools for V32
 *
 * 速率限制和重试策略的工具定义
 */

import type { Tool } from "../../v15-agent/multimodel/types.js";

export const RATELIMIT_TOOLS: Tool[] = [
  // ============ 限制器管理 ============
  {
    name: "ratelimit_create",
    description: "创建一个新的速率限制器。支持多种策略: token_bucket (令牌桶), sliding_window (滑动窗口), fixed_window (固定窗口)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "限制器名称",
        },
        description: {
          type: "string",
          description: "限制器描述",
        },
        requestsPerSecond: {
          type: "number",
          description: "每秒允许的请求数",
        },
        requestsPerMinute: {
          type: "number",
          description: "每分钟允许的请求数",
        },
        requestsPerHour: {
          type: "number",
          description: "每小时允许的请求数",
        },
        burstSize: {
          type: "number",
          description: "突发请求数 (token bucket)",
        },
        strategy: {
          type: "string",
          enum: ["token_bucket", "sliding_window", "fixed_window"],
          description: "速率限制策略",
        },
        maxRetryAttempts: {
          type: "number",
          description: "最大重试次数",
        },
        retryStrategy: {
          type: "string",
          enum: ["fixed", "exponential", "linear", "decorrelated_jitter"],
          description: "重试策略",
        },
        preset: {
          type: "string",
          enum: ["low", "medium", "high", "api", "strict"],
          description: "使用预设配置 (会覆盖其他参数)",
        },
        retryPreset: {
          type: "string",
          enum: ["quick", "exponential", "linear", "jitter", "discord", "telegram"],
          description: "使用重试预设配置",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "ratelimit_delete",
    description: "删除一个速率限制器",
    inputSchema: {
      type: "object",
      properties: {
        limiterId: {
          type: "string",
          description: "限制器 ID",
        },
      },
      required: ["limiterId"],
    },
  },
  {
    name: "ratelimit_reset",
    description: "重置一个速率限制器的状态",
    inputSchema: {
      type: "object",
      properties: {
        limiterId: {
          type: "string",
          description: "限制器 ID",
        },
      },
      required: ["limiterId"],
    },
  },
  {
    name: "ratelimit_list",
    description: "列出所有速率限制器",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "ratelimit_get",
    description: "获取限制器的详细信息和状态",
    inputSchema: {
      type: "object",
      properties: {
        limiterId: {
          type: "string",
          description: "限制器 ID",
        },
      },
      required: ["limiterId"],
    },
  },

  // ============ 速率限制操作 ============
  {
    name: "ratelimit_check",
    description: "检查是否允许请求 (不消耗配额)",
    inputSchema: {
      type: "object",
      properties: {
        limiterId: {
          type: "string",
          description: "限制器 ID",
        },
      },
      required: ["limiterId"],
    },
  },
  {
    name: "ratelimit_consume",
    description: "消耗一个请求配额",
    inputSchema: {
      type: "object",
      properties: {
        limiterId: {
          type: "string",
          description: "限制器 ID",
        },
        tokens: {
          type: "number",
          description: "消耗的令牌数 (默认 1)",
        },
      },
      required: ["limiterId"],
    },
  },
  {
    name: "ratelimit_wait",
    description: "等待直到可以发送请求",
    inputSchema: {
      type: "object",
      properties: {
        limiterId: {
          type: "string",
          description: "限制器 ID",
        },
        maxWaitMs: {
          type: "number",
          description: "最大等待时间 (ms), 超过则抛出错误",
        },
      },
      required: ["limiterId"],
    },
  },

  // ============ 统计与状态 ============
  {
    name: "ratelimit_stats",
    description: "获取限制器的统计信息",
    inputSchema: {
      type: "object",
      properties: {
        limiterId: {
          type: "string",
          description: "限制器 ID (不指定则返回所有)",
        },
      },
    },
  },
  {
    name: "ratelimit_status",
    description: "获取引擎的整体状态",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ============ 预设与配置 ============
  {
    name: "ratelimit_presets",
    description: "获取可用的预设配置列表",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["rate", "retry", "all"],
          description: "预设类型: rate (速率限制), retry (重试策略), all (全部)",
        },
      },
    },
  },
  {
    name: "ratelimit_config",
    description: "获取或更新引擎配置",
    inputSchema: {
      type: "object",
      properties: {
        enableRateLimit: {
          type: "boolean",
          description: "是否启用速率限制",
        },
        enableRetry: {
          type: "boolean",
          description: "是否启用重试",
        },
      },
    },
  },

  // ============ 重试操作 ============
  {
    name: "ratelimit_retry",
    description: "使用重试策略执行一个操作。适合包装不稳定的 API 调用。",
    inputSchema: {
      type: "object",
      properties: {
        limiterId: {
          type: "string",
          description: "限制器 ID (可选, 使用默认配置)",
        },
        maxAttempts: {
          type: "number",
          description: "最大尝试次数",
        },
        minDelayMs: {
          type: "number",
          description: "最小延迟 (ms)",
        },
        maxDelayMs: {
          type: "number",
          description: "最大延迟 (ms)",
        },
        strategy: {
          type: "string",
          enum: ["fixed", "exponential", "linear", "decorrelated_jitter"],
          description: "重试策略",
        },
        preset: {
          type: "string",
          enum: ["quick", "exponential", "linear", "jitter", "discord", "telegram"],
          description: "使用重试预设",
        },
        operation: {
          type: "string",
          description: "要执行的操作描述 (用于日志)",
        },
      },
    },
  },

  // ============ 工具函数 ============
  {
    name: "ratelimit_delay",
    description: "计算重试延迟时间 (不执行)",
    inputSchema: {
      type: "object",
      properties: {
        attempt: {
          type: "number",
          description: "当前尝试次数",
        },
        strategy: {
          type: "string",
          enum: ["fixed", "exponential", "linear", "decorrelated_jitter"],
          description: "重试策略",
        },
        minDelayMs: {
          type: "number",
          description: "最小延迟 (ms)",
        },
        maxDelayMs: {
          type: "number",
          description: "最大延迟 (ms)",
        },
      },
      required: ["attempt"],
    },
  },
];

export const RATELIMIT_TOOL_COUNT = RATELIMIT_TOOLS.length;
