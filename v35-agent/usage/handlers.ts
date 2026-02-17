/**
 * V35: Usage/成本追踪系统 - 工具处理器
 */

import type { Tool } from "../../v1-agent.js";
import {
  UsageEngine,
  getUsageEngine,
  closeUsageEngine,
  normalizeUsage,
} from "./engine.js";
import type {
  UsageLike,
  UsageRecord,
  UsageSummary,
  SessionUsageSummary,
  UsageTrackerConfig,
  ReportOptions,
  ModelCostConfig,
} from "./types.js";

// ==================== 工具定义 ====================

export const USAGE_TOOLS: Tool[] = [
  // 基础记录
  {
    name: "usage_record",
    description: "记录一次 API 使用",
    inputSchema: {
      type: "object",
      properties: {
        usage: {
          type: "object",
          description: "使用数据 (支持多种格式)",
          properties: {
            input: { type: "number", description: "输入 tokens" },
            output: { type: "number", description: "输出 tokens" },
            cacheRead: { type: "number", description: "缓存读取 tokens" },
            cacheWrite: { type: "number", description: "缓存写入 tokens" },
          },
        },
        provider: { type: "string", description: "提供者 (openai/anthropic/google 等)" },
        model: { type: "string", description: "模型名称" },
        toolName: { type: "string", description: "工具名称 (可选)" },
        durationMs: { type: "number", description: "请求耗时 (毫秒)" },
        sessionId: { type: "string", description: "会话 ID" },
      },
      required: ["usage"],
    },
  },
  {
    name: "usage_get_totals",
    description: "获取使用总计",
    inputSchema: {
      type: "object",
      properties: {
        startMs: { type: "number", description: "开始时间戳 (毫秒)" },
        endMs: { type: "number", description: "结束时间戳 (毫秒)" },
      },
    },
  },
  {
    name: "usage_get_summary",
    description: "获取使用摘要 (包含每日、工具、模型统计)",
    inputSchema: {
      type: "object",
      properties: {
        startMs: { type: "number", description: "开始时间戳 (毫秒)" },
        endMs: { type: "number", description: "结束时间戳 (毫秒)" },
        days: { type: "number", description: "统计天数 (默认 30 天)" },
      },
    },
  },
  {
    name: "usage_get_daily",
    description: "获取每日使用统计",
    inputSchema: {
      type: "object",
      properties: {
        startMs: { type: "number", description: "开始时间戳 (毫秒)" },
        endMs: { type: "number", description: "结束时间戳 (毫秒)" },
      },
    },
  },

  // 工具和模型统计
  {
    name: "usage_get_tools",
    description: "获取工具使用统计",
    inputSchema: {
      type: "object",
      properties: {
        startMs: { type: "number", description: "开始时间戳 (毫秒)" },
        endMs: { type: "number", description: "结束时间戳 (毫秒)" },
        limit: { type: "number", description: "返回数量限制" },
      },
    },
  },
  {
    name: "usage_get_models",
    description: "获取模型使用统计",
    inputSchema: {
      type: "object",
      properties: {
        startMs: { type: "number", description: "开始时间戳 (毫秒)" },
        endMs: { type: "number", description: "结束时间戳 (毫秒)" },
        limit: { type: "number", description: "返回数量限制" },
      },
    },
  },

  // 会话统计
  {
    name: "usage_get_session",
    description: "获取会话使用摘要",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "会话 ID" },
      },
      required: ["sessionId"],
    },
  },

  // 延迟统计
  {
    name: "usage_get_latency",
    description: "获取延迟统计",
    inputSchema: {
      type: "object",
      properties: {
        startMs: { type: "number", description: "开始时间戳 (毫秒)" },
        endMs: { type: "number", description: "结束时间戳 (毫秒)" },
      },
    },
  },
  {
    name: "usage_get_daily_latency",
    description: "获取每日延迟统计",
    inputSchema: {
      type: "object",
      properties: {
        startMs: { type: "number", description: "开始时间戳 (毫秒)" },
        endMs: { type: "number", description: "结束时间戳 (毫秒)" },
      },
    },
  },

  // 报告生成
  {
    name: "usage_report",
    description: "生成使用报告 (支持 text/json/markdown/csv 格式)",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["text", "json", "markdown", "csv"],
          description: "报告格式",
        },
        includeDaily: { type: "boolean", description: "包含每日统计" },
        includeTools: { type: "boolean", description: "包含工具统计" },
        includeModels: { type: "boolean", description: "包含模型统计" },
        includeLatency: { type: "boolean", description: "包含延迟统计" },
        startDate: { type: "string", description: "开始日期 (YYYY-MM-DD)" },
        endDate: { type: "string", description: "结束日期 (YYYY-MM-DD)" },
      },
    },
  },

  // 配置管理
  {
    name: "usage_status",
    description: "获取使用追踪系统状态",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "usage_config",
    description: "获取或更新使用追踪配置",
    inputSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean", description: "是否启用追踪" },
        trackCosts: { type: "boolean", description: "是否追踪成本" },
        trackTools: { type: "boolean", description: "是否追踪工具" },
        trackLatency: { type: "boolean", description: "是否追踪延迟" },
        retentionDays: { type: "number", description: "记录保留天数" },
        samplingRate: { type: "number", description: "采样率 (0-1)" },
      },
    },
  },

  // 模型成本管理
  {
    name: "usage_model_costs",
    description: "列出或添加模型成本配置",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "add"],
          description: "操作类型",
        },
        config: {
          type: "object",
          description: "模型成本配置 (add 时需要)",
          properties: {
            provider: { type: "string", description: "提供者" },
            model: { type: "string", description: "模型名称" },
            inputCostPer1k: { type: "number", description: "每 1k input token 成本" },
            outputCostPer1k: { type: "number", description: "每 1k output token 成本" },
            cacheReadCostPer1k: { type: "number", description: "每 1k cache read token 成本" },
            cacheWriteCostPer1k: { type: "number", description: "每 1k cache write token 成本" },
          },
        },
      },
    },
  },

  // 辅助工具
  {
    name: "usage_normalize",
    description: "标准化使用数据格式",
    inputSchema: {
      type: "object",
      properties: {
        usage: {
          type: "object",
          description: "原始使用数据",
        },
      },
      required: ["usage"],
    },
  },
  {
    name: "usage_clear",
    description: "清除所有使用记录",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export const USAGE_TOOL_COUNT = USAGE_TOOLS.length;

// ==================== 工具处理器 ====================

let engine: UsageEngine | null = null;

function getEngine(): UsageEngine {
  if (!engine) {
    engine = getUsageEngine();
  }
  return engine;
}

export function createUsageHandlers(): Record<string, (args: Record<string, unknown>) => Promise<unknown>> {
  return {
    // 记录使用
    usage_record: async (args) => {
      const e = getEngine();
      const record = e.record({
        usage: args.usage as UsageLike,
        provider: args.provider as string | undefined,
        model: args.model as string | undefined,
        toolName: args.toolName as string | undefined,
        durationMs: args.durationMs as number | undefined,
        sessionId: args.sessionId as string | undefined,
      });
      return { success: true, record };
    },

    // 获取总计
    usage_get_totals: async (args) => {
      const e = getEngine();
      const totals = e.getTotals(
        args.startMs as number | undefined,
        args.endMs as number | undefined
      );
      return totals;
    },

    // 获取摘要
    usage_get_summary: async (args) => {
      const e = getEngine();
      const summary = e.getSummary({
        startMs: args.startMs as number | undefined,
        endMs: args.endMs as number | undefined,
        days: args.days as number | undefined,
      });
      return summary;
    },

    // 获取每日统计
    usage_get_daily: async (args) => {
      const e = getEngine();
      const daily = e.getDailyUsage(
        args.startMs as number | undefined,
        args.endMs as number | undefined
      );
      return daily;
    },

    // 获取工具统计
    usage_get_tools: async (args) => {
      const e = getEngine();
      let tools = e.getToolUsage(
        args.startMs as number | undefined,
        args.endMs as number | undefined
      );
      if (args.limit) {
        tools = tools.slice(0, args.limit as number);
      }
      return tools;
    },

    // 获取模型统计
    usage_get_models: async (args) => {
      const e = getEngine();
      let models = e.getModelUsage(
        args.startMs as number | undefined,
        args.endMs as number | undefined
      );
      if (args.limit) {
        models = models.slice(0, args.limit as number);
      }
      return models;
    },

    // 获取会话摘要
    usage_get_session: async (args) => {
      const e = getEngine();
      const summary = e.getSessionSummary(args.sessionId as string);
      if (!summary) {
        return { error: "Session not found", sessionId: args.sessionId };
      }
      return summary;
    },

    // 获取延迟统计
    usage_get_latency: async (args) => {
      const e = getEngine();
      const latency = e.getLatencyStats(
        args.startMs as number | undefined,
        args.endMs as number | undefined
      );
      return latency ?? { error: "No latency data available" };
    },

    // 获取每日延迟统计
    usage_get_daily_latency: async (args) => {
      const e = getEngine();
      const daily = e.getDailyLatency(
        args.startMs as number | undefined,
        args.endMs as number | undefined
      );
      return daily;
    },

    // 生成报告
    usage_report: async (args) => {
      const e = getEngine();
      const options: ReportOptions = {
        format: (args.format as ReportOptions["format"]) ?? "text",
        includeDaily: args.includeDaily as boolean | undefined,
        includeTools: args.includeTools as boolean | undefined,
        includeModels: args.includeModels as boolean | undefined,
        includeLatency: args.includeLatency as boolean | undefined,
      };

      if (args.startDate) {
        options.startDate = new Date(args.startDate as string);
      }
      if (args.endDate) {
        options.endDate = new Date(args.endDate as string);
      }

      const report = e.generateReport(options);
      return { format: options.format, report };
    },

    // 获取状态
    usage_status: async () => {
      const e = getEngine();
      return e.getStatus();
    },

    // 配置管理
    usage_config: async (args) => {
      const e = getEngine();
      if (Object.keys(args).length === 0) {
        return e.getConfig();
      }

      const updates: Partial<UsageTrackerConfig> = {};
      if (args.enabled !== undefined) updates.enabled = args.enabled as boolean;
      if (args.trackCosts !== undefined) updates.trackCosts = args.trackCosts as boolean;
      if (args.trackTools !== undefined) updates.trackTools = args.trackTools as boolean;
      if (args.trackLatency !== undefined) updates.trackLatency = args.trackLatency as boolean;
      if (args.retentionDays !== undefined) updates.retentionDays = args.retentionDays as number;
      if (args.samplingRate !== undefined) updates.samplingRate = args.samplingRate as number;

      e.updateConfig(updates);
      return { success: true, config: e.getConfig() };
    },

    // 模型成本管理
    usage_model_costs: async (args) => {
      const e = getEngine();
      const action = args.action as string | undefined ?? "list";

      if (action === "add" && args.config) {
        e.addModelCost(args.config as ModelCostConfig);
        return { success: true, added: args.config };
      }

      return { costs: e.listModelCosts() };
    },

    // 标准化使用数据
    usage_normalize: async (args) => {
      const normalized = normalizeUsage(args.usage as UsageLike);
      return { original: args.usage, normalized };
    },

    // 清除记录
    usage_clear: async () => {
      const e = getEngine();
      e.clear();
      return { success: true, message: "All usage records cleared" };
    },
  };
}

export function closeUsageHandlers(): void {
  if (engine) {
    engine = null;
  }
  closeUsageEngine();
}
