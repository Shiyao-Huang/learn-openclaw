/**
 * V36: 诊断事件系统 - 核心引擎
 *
 * 提供事件发射、监听、存储和查询功能
 */

import type {
  DiagnosticEventPayload,
  DiagnosticEventInput,
  DiagnosticConfig,
  DiagnosticStatus,
  DiagnosticQueryOptions,
  DiagnosticQueryResult,
  EventTypeStats,
  DiagnosticErrorEvent,
} from "./types.js";
import { DEFAULT_DIAGNOSTIC_CONFIG } from "./types.js";

/**
 * 诊断事件引擎
 */
export class DiagnosticEngine {
  private config: DiagnosticConfig;
  private seq = 0;
  private events: DiagnosticEventPayload[] = [];
  private listeners = new Set<(evt: DiagnosticEventPayload) => void>();
  private startTime = Date.now();
  private eventTypeStats = new Map<string, { count: number; firstTs: number; lastTs: number; durations: number[]; errors: number }>();

  constructor(config: Partial<DiagnosticConfig> = {}) {
    this.config = { ...DEFAULT_DIAGNOSTIC_CONFIG, ...config };
  }

  /**
   * 发射诊断事件
   */
  emit(input: DiagnosticEventInput): DiagnosticEventPayload {
    if (!this.config.enabled) {
      // 即使禁用也返回事件，但不存储
      return {
        ...input,
        seq: 0,
        ts: Date.now(),
      } as DiagnosticEventPayload;
    }

    const event: DiagnosticEventPayload = {
      ...input,
      seq: (this.seq += 1),
      ts: Date.now(),
    } as DiagnosticEventPayload;

    // 更新统计
    this.updateStats(event);

    // 存储事件
    this.events.push(event);
    this.pruneEvents();

    // 通知监听器
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // 忽略监听器错误
      }
    }

    return event;
  }

  /**
   * 更新事件统计
   */
  private updateStats(event: DiagnosticEventPayload): void {
    const type = event.type;
    const existing = this.eventTypeStats.get(type) ?? {
      count: 0,
      firstTs: event.ts,
      lastTs: event.ts,
      durations: [],
      errors: 0,
    };

    existing.count += 1;
    existing.lastTs = event.ts;

    // 提取持续时间
    if ("durationMs" in event && typeof event.durationMs === "number") {
      existing.durations.push(event.durationMs);
      // 只保留最近 100 个用于计算平均值
      if (existing.durations.length > 100) {
        existing.durations = existing.durations.slice(-100);
      }
    }

    // 计数错误
    if (
      event.type === "error" ||
      ("outcome" in event && event.outcome === "error") ||
      ("success" in event && event.success === false)
    ) {
      existing.errors += 1;
    }

    this.eventTypeStats.set(type, existing);
  }

  /**
   * 清理旧事件
   */
  private pruneEvents(): void {
    const now = Date.now();

    // 按时间清理
    if (this.config.retentionMs > 0) {
      const cutoff = now - this.config.retentionMs;
      this.events = this.events.filter((e) => e.ts >= cutoff);
    }

    // 按数量清理 (保留最新)
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents);
    }
  }

  /**
   * 注册事件监听器
   */
  onEvent(listener: (evt: DiagnosticEventPayload) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 查询事件
   */
  query(options: DiagnosticQueryOptions = {}): DiagnosticQueryResult {
    let filtered = [...this.events];

    // 按类型过滤
    if (options.types && options.types.length > 0) {
      const typeSet = new Set(options.types);
      filtered = filtered.filter((e) => typeSet.has(e.type));
    }

    // 按会话过滤
    if (options.sessionKey) {
      filtered = filtered.filter((e) => "sessionKey" in e && e.sessionKey === options.sessionKey);
    }
    if (options.sessionId) {
      filtered = filtered.filter((e) => "sessionId" in e && e.sessionId === options.sessionId);
    }

    // 按 channel 过滤
    if (options.channel) {
      filtered = filtered.filter((e) => "channel" in e && e.channel === options.channel);
    }

    // 按时间过滤
    if (options.startMs !== undefined) {
      filtered = filtered.filter((e) => e.ts >= options.startMs!);
    }
    if (options.endMs !== undefined) {
      filtered = filtered.filter((e) => e.ts <= options.endMs!);
    }

    // 只看错误
    if (options.errorsOnly) {
      filtered = filtered.filter(
        (e) =>
          e.type === "error" ||
          ("outcome" in e && e.outcome === "error") ||
          ("success" in e && e.success === false)
      );
    }

    // 按时间排序 (最新的在前)
    filtered.sort((a, b) => b.ts - a.ts);

    const total = filtered.length;
    const limit = options.limit ?? 100;
    const hasMore = total > limit;
    const events = filtered.slice(0, limit);

    return { events, total, hasMore };
  }

  /**
   * 获取事件类型统计
   */
  getEventTypeStats(): EventTypeStats[] {
    const result: EventTypeStats[] = [];

    for (const [type, stats] of this.eventTypeStats) {
      const avgDurationMs =
        stats.durations.length > 0
          ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
          : undefined;

      result.push({
        type,
        count: stats.count,
        firstTs: stats.firstTs,
        lastTs: stats.lastTs,
        avgDurationMs,
        errorCount: stats.errors > 0 ? stats.errors : undefined,
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }

  /**
   * 获取最近的错误事件
   */
  getRecentErrors(limit = 20): DiagnosticErrorEvent[] {
    return this.events.filter(
      (e): e is DiagnosticErrorEvent => e.type === "error"
    ).slice(-limit);
  }

  /**
   * 获取系统状态
   */
  getStatus(): DiagnosticStatus {
    return {
      enabled: this.config.enabled,
      eventCount: this.events.length,
      listenerCount: this.listeners.size,
      startTime: this.startTime,
      uptimeMs: Date.now() - this.startTime,
      eventTypes: this.getEventTypeStats(),
      recentErrors: this.getRecentErrors(10),
    };
  }

  /**
   * 获取配置
   */
  getConfig(): DiagnosticConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<DiagnosticConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 清除所有事件
   */
  clear(): void {
    this.events = [];
    this.eventTypeStats.clear();
  }

  /**
   * 获取事件计数
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * 获取特定类型的事件计数
   */
  getEventCountByType(type: string): number {
    return this.events.filter((e) => e.type === type).length;
  }

  /**
   * 生成诊断报告
   */
  generateReport(format: "text" | "json" | "markdown" = "text"): string {
    const status = this.getStatus();

    if (format === "json") {
      return JSON.stringify(status, null, 2);
    }

    if (format === "markdown") {
      const lines: string[] = [];
      lines.push("# Diagnostic Report");
      lines.push("");
      lines.push(`**Status:** ${status.enabled ? "Enabled" : "Disabled"}`);
      lines.push(`**Uptime:** ${Math.floor(status.uptimeMs / 1000 / 60)} minutes`);
      lines.push(`**Events:** ${status.eventCount}`);
      lines.push("");

      if (status.eventTypes.length > 0) {
        lines.push("## Event Types");
        lines.push("");
        lines.push("| Type | Count | Avg Duration | Errors |");
        lines.push("|------|-------|--------------|--------|");
        for (const stat of status.eventTypes.slice(0, 20)) {
          lines.push(
            `| ${stat.type} | ${stat.count} | ${stat.avgDurationMs?.toFixed(0) ?? "-"}ms | ${stat.errorCount ?? 0} |`
          );
        }
        lines.push("");
      }

      if (status.recentErrors.length > 0) {
        lines.push("## Recent Errors");
        lines.push("");
        for (const error of status.recentErrors.slice(5)) {
          lines.push(`- **${error.category}:** ${error.message}`);
        }
      }

      return lines.join("\n");
    }

    // Text format
    const lines: string[] = [];
    lines.push("=== Diagnostic Report ===");
    lines.push(`Status: ${status.enabled ? "Enabled" : "Disabled"}`);
    lines.push(`Uptime: ${Math.floor(status.uptimeMs / 1000 / 60)} minutes`);
    lines.push(`Events: ${status.eventCount}`);
    lines.push(`Listeners: ${status.listenerCount}`);
    lines.push("");

    if (status.eventTypes.length > 0) {
      lines.push("--- Event Types ---");
      for (const stat of status.eventTypes.slice(0, 10)) {
        const avgDuration = stat.avgDurationMs ? ` (${stat.avgDurationMs.toFixed(0)}ms avg)` : "";
        const errors = stat.errorCount ? ` [${stat.errorCount} errors]` : "";
        lines.push(`  ${stat.type}: ${stat.count}${avgDuration}${errors}`);
      }
      lines.push("");
    }

    if (status.recentErrors.length > 0) {
      lines.push("--- Recent Errors ---");
      for (const error of status.recentErrors.slice(5)) {
        lines.push(`  [${error.category}] ${error.message}`);
      }
    }

    return lines.join("\n");
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 发射模型使用事件
 */
export function emitModelUsage(
  engine: DiagnosticEngine,
  params: {
    provider?: string;
    model?: string;
    usage: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      total?: number;
    };
    sessionKey?: string;
    channel?: string;
    costUsd?: number;
    durationMs?: number;
  }
): DiagnosticEventPayload {
  return engine.emit({
    type: "model.usage",
    ...params,
  });
}

/**
 * 发射工具调用事件
 */
export function emitToolCall(
  engine: DiagnosticEngine,
  params: {
    toolName: string;
    sessionKey?: string;
    durationMs?: number;
    success: boolean;
    error?: string;
  }
): DiagnosticEventPayload {
  return engine.emit({
    type: "tool.call",
    ...params,
  });
}

/**
 * 发射错误事件
 */
export function emitError(
  engine: DiagnosticEngine,
  params: {
    category: DiagnosticErrorEvent["category"];
    message: string;
    stack?: string;
    sessionKey?: string;
    context?: Record<string, unknown>;
  }
): DiagnosticEventPayload {
  return engine.emit({
    type: "error",
    ...params,
  });
}

/**
 * 发射会话状态变更事件
 */
export function emitSessionState(
  engine: DiagnosticEngine,
  params: {
    sessionKey?: string;
    prevState?: DiagnosticSessionState;
    state: DiagnosticSessionState;
    reason?: string;
    queueDepth?: number;
  }
): DiagnosticEventPayload {
  return engine.emit({
    type: "session.state",
    ...params,
  });
}

/**
 * 发射消息处理事件
 */
export function emitMessageProcessed(
  engine: DiagnosticEngine,
  params: {
    channel: string;
    sessionKey?: string;
    durationMs?: number;
    outcome: "completed" | "skipped" | "error";
    reason?: string;
    error?: string;
  }
): DiagnosticEventPayload {
  return engine.emit({
    type: "message.processed",
    ...params,
  });
}

// ============================================================================
// 全局实例
// ============================================================================

let defaultEngine: DiagnosticEngine | null = null;

/**
 * 获取默认诊断引擎
 */
export function getDiagnosticEngine(): DiagnosticEngine {
  if (!defaultEngine) {
    defaultEngine = new DiagnosticEngine();
  }
  return defaultEngine;
}

/**
 * 关闭默认诊断引擎
 */
export function closeDiagnosticEngine(): void {
  if (defaultEngine) {
    defaultEngine.clear();
    defaultEngine = null;
  }
}

/**
 * 重置诊断引擎 (测试用)
 */
export function resetDiagnosticEngine(): void {
  closeDiagnosticEngine();
}
