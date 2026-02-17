/**
 * V36: 诊断事件系统 - 工具处理器
 *
 * 将诊断引擎暴露为 Agent 工具
 */

import type { Tool } from "../types.js";
import { DiagnosticEngine, getDiagnosticEngine, closeDiagnosticEngine } from "./engine.js";
import type {
  DiagnosticEventPayload,
  DiagnosticQueryOptions,
  DiagnosticConfig,
  DiagnosticErrorEvent,
} from "./types.js";

// ============================================================================
// 工具定义
// ============================================================================

/**
 * 诊断工具列表
 */
export const DIAGNOSTIC_TOOLS: Tool[] = [
  // 事件发射工具
  {
    name: "diagnostic_emit_usage",
    description: "发射模型使用事件",
    parameters: {
      type: "object",
      properties: {
        provider: { type: "string", description: "提供者名称" },
        model: { type: "string", description: "模型名称" },
        inputTokens: { type: "number", description: "输入 tokens" },
        outputTokens: { type: "number", description: "输出 tokens" },
        cacheRead: { type: "number", description: "缓存读取 tokens" },
        cacheWrite: { type: "number", description: "缓存写入 tokens" },
        totalTokens: { type: "number", description: "总 tokens" },
        costUsd: { type: "number", description: "成本 (美元)" },
        durationMs: { type: "number", description: "持续时间 (毫秒)" },
        sessionKey: { type: "string", description: "会话键" },
        channel: { type: "string", description: "渠道" },
      },
    },
  },
  {
    name: "diagnostic_emit_tool_call",
    description: "发射工具调用事件",
    parameters: {
      type: "object",
      properties: {
        toolName: { type: "string", description: "工具名称" },
        durationMs: { type: "number", description: "持续时间 (毫秒)" },
        success: { type: "boolean", description: "是否成功" },
        error: { type: "string", description: "错误信息" },
        sessionKey: { type: "string", description: "会话键" },
      },
      required: ["toolName", "success"],
    },
  },
  {
    name: "diagnostic_emit_error",
    description: "发射错误事件",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["network", "auth", "rate_limit", "timeout", "internal", "unknown"],
          description: "错误类别",
        },
        message: { type: "string", description: "错误消息" },
        stack: { type: "string", description: "堆栈跟踪" },
        sessionKey: { type: "string", description: "会话键" },
        context: { type: "object", description: "额外上下文" },
      },
      required: ["category", "message"],
    },
  },
  {
    name: "diagnostic_emit_session_state",
    description: "发射会话状态变更事件",
    parameters: {
      type: "object",
      properties: {
        sessionKey: { type: "string", description: "会话键" },
        prevState: { type: "string", enum: ["idle", "processing", "waiting"], description: "之前状态" },
        state: { type: "string", enum: ["idle", "processing", "waiting"], description: "当前状态" },
        reason: { type: "string", description: "变更原因" },
        queueDepth: { type: "number", description: "队列深度" },
      },
      required: ["state"],
    },
  },
  {
    name: "diagnostic_emit_message",
    description: "发射消息处理事件",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "渠道" },
        sessionKey: { type: "string", description: "会话键" },
        durationMs: { type: "number", description: "持续时间 (毫秒)" },
        outcome: { type: "string", enum: ["completed", "skipped", "error"], description: "结果" },
        reason: { type: "string", description: "原因" },
        error: { type: "string", description: "错误信息" },
      },
      required: ["channel", "outcome"],
    },
  },

  // 查询工具
  {
    name: "diagnostic_query",
    description: "查询诊断事件",
    parameters: {
      type: "object",
      properties: {
        types: { type: "array", items: { type: "string" }, description: "事件类型列表" },
        sessionKey: { type: "string", description: "会话键" },
        channel: { type: "string", description: "渠道" },
        startMs: { type: "number", description: "开始时间 (毫秒时间戳)" },
        endMs: { type: "number", description: "结束时间 (毫秒时间戳)" },
        limit: { type: "number", description: "最大返回数量" },
        errorsOnly: { type: "boolean", description: "只返回错误事件" },
      },
    },
  },
  {
    name: "diagnostic_get_events",
    description: "获取最近的诊断事件",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "事件类型" },
        limit: { type: "number", description: "最大返回数量 (默认 50)" },
      },
    },
  },

  // 统计工具
  {
    name: "diagnostic_stats",
    description: "获取事件类型统计",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "diagnostic_errors",
    description: "获取最近的错误事件",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "最大返回数量 (默认 20)" },
      },
    },
  },

  // 状态和配置工具
  {
    name: "diagnostic_status",
    description: "获取诊断系统状态",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "diagnostic_config",
    description: "获取或更新诊断配置",
    parameters: {
      type: "object",
      properties: {
        enabled: { type: "boolean", description: "是否启用" },
        maxEvents: { type: "number", description: "最大事件数" },
        retentionMs: { type: "number", description: "保留时间 (毫秒)" },
        captureStacks: { type: "boolean", description: "是否捕获堆栈" },
      },
    },
  },

  // 报告工具
  {
    name: "diagnostic_report",
    description: "生成诊断报告",
    parameters: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["text", "json", "markdown"],
          description: "报告格式",
        },
      },
    },
  },

  // 管理工具
  {
    name: "diagnostic_clear",
    description: "清除所有诊断事件",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "diagnostic_subscribe",
    description: "订阅诊断事件 (返回订阅信息)",
    parameters: {
      type: "object",
      properties: {
        types: { type: "array", items: { type: "string" }, description: "要订阅的事件类型" },
      },
    },
  },
];

export const DIAGNOSTIC_TOOL_COUNT = DIAGNOSTIC_TOOLS.length;

// ============================================================================
// 工具处理器
// ============================================================================

export type DiagnosticHandler = (
  engine: DiagnosticEngine,
  params: Record<string, unknown>
) => Promise<unknown>;

const handlers: Record<string, DiagnosticHandler> = {
  // 事件发射
  diagnostic_emit_usage: async (engine, params) => {
    const usage: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; total?: number } = {};
    if (params.inputTokens !== undefined) usage.input = params.inputTokens as number;
    if (params.outputTokens !== undefined) usage.output = params.outputTokens as number;
    if (params.cacheRead !== undefined) usage.cacheRead = params.cacheRead as number;
    if (params.cacheWrite !== undefined) usage.cacheWrite = params.cacheWrite as number;
    if (params.totalTokens !== undefined) usage.total = params.totalTokens as number;

    const event = engine.emit({
      type: "model.usage",
      provider: params.provider as string,
      model: params.model as string,
      usage,
      sessionKey: params.sessionKey as string,
      channel: params.channel as string,
      costUsd: params.costUsd as number,
      durationMs: params.durationMs as number,
    });

    return { emitted: true, seq: event.seq };
  },

  diagnostic_emit_tool_call: async (engine, params) => {
    const event = engine.emit({
      type: "tool.call",
      toolName: params.toolName as string,
      sessionKey: params.sessionKey as string,
      durationMs: params.durationMs as number,
      success: params.success as boolean,
      error: params.error as string,
    });

    return { emitted: true, seq: event.seq };
  },

  diagnostic_emit_error: async (engine, params) => {
    const event = engine.emit({
      type: "error",
      category: params.category as DiagnosticErrorEvent["category"],
      message: params.message as string,
      stack: params.stack as string,
      sessionKey: params.sessionKey as string,
      context: params.context as Record<string, unknown>,
    });

    return { emitted: true, seq: event.seq };
  },

  diagnostic_emit_session_state: async (engine, params) => {
    const event = engine.emit({
      type: "session.state",
      sessionKey: params.sessionKey as string,
      prevState: params.prevState as "idle" | "processing" | "waiting" | undefined,
      state: params.state as "idle" | "processing" | "waiting",
      reason: params.reason as string,
      queueDepth: params.queueDepth as number,
    });

    return { emitted: true, seq: event.seq };
  },

  diagnostic_emit_message: async (engine, params) => {
    const event = engine.emit({
      type: "message.processed",
      channel: params.channel as string,
      sessionKey: params.sessionKey as string,
      durationMs: params.durationMs as number,
      outcome: params.outcome as "completed" | "skipped" | "error",
      reason: params.reason as string,
      error: params.error as string,
    });

    return { emitted: true, seq: event.seq };
  },

  // 查询
  diagnostic_query: async (engine, params) => {
    const options: DiagnosticQueryOptions = {
      types: params.types as string[] | undefined,
      sessionKey: params.sessionKey as string | undefined,
      channel: params.channel as string | undefined,
      startMs: params.startMs as number | undefined,
      endMs: params.endMs as number | undefined,
      limit: (params.limit as number) ?? 100,
      errorsOnly: params.errorsOnly as boolean | undefined,
    };

    return engine.query(options);
  },

  diagnostic_get_events: async (engine, params) => {
    const type = params.type as string | undefined;
    const limit = (params.limit as number) ?? 50;
    const result = engine.query({ types: type ? [type] : undefined, limit });
    return result.events;
  },

  // 统计
  diagnostic_stats: async (engine) => {
    return engine.getEventTypeStats();
  },

  diagnostic_errors: async (engine, params) => {
    const limit = (params.limit as number) ?? 20;
    return engine.getRecentErrors(limit);
  },

  // 状态和配置
  diagnostic_status: async (engine) => {
    return engine.getStatus();
  },

  diagnostic_config: async (engine, params) => {
    if (Object.keys(params).length === 0) {
      return engine.getConfig();
    }

    const updates: Partial<DiagnosticConfig> = {};
    if (params.enabled !== undefined) updates.enabled = params.enabled as boolean;
    if (params.maxEvents !== undefined) updates.maxEvents = params.maxEvents as number;
    if (params.retentionMs !== undefined) updates.retentionMs = params.retentionMs as number;
    if (params.captureStacks !== undefined) updates.captureStacks = params.captureStacks as boolean;

    engine.updateConfig(updates);
    return engine.getConfig();
  },

  // 报告
  diagnostic_report: async (engine, params) => {
    const format = (params.format as "text" | "json" | "markdown") ?? "text";
    const report = engine.generateReport(format);
    return { format, report };
  },

  // 管理
  diagnostic_clear: async (engine) => {
    const count = engine.getEventCount();
    engine.clear();
    return { cleared: count };
  },

  diagnostic_subscribe: async (engine, params) => {
    const types = params.types as string[] | undefined;
    let eventCount = 0;

    const unsubscribe = engine.onEvent((event) => {
      if (!types || types.includes(event.type)) {
        eventCount++;
      }
    });

    return {
      subscribed: true,
      types: types ?? "all",
      note: "Subscription active until engine is closed",
      unsubscribe: "Call engine.onEvent to manage subscriptions programmatically",
    };
  },
};

/**
 * 创建诊断处理器
 */
export function createDiagnosticHandlers(
  engine: DiagnosticEngine = getDiagnosticEngine()
): Map<string, (params: Record<string, unknown>) => Promise<unknown>> {
  const map = new Map<string, (params: Record<string, unknown>) => Promise<unknown>>();

  for (const [name, handler] of Object.entries(handlers)) {
    map.set(name, (params) => handler(engine, params));
  }

  return map;
}

/**
 * 关闭诊断处理器
 */
export function closeDiagnosticHandlers(): void {
  closeDiagnosticEngine();
}
