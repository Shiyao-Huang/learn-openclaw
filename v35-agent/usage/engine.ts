/**
 * V35: Usage/成本追踪系统 - 核心引擎
 */

import type {
  UsageLike,
  NormalizedUsage,
  CostBreakdown,
  ModelCostConfig,
  UsageRecord,
  UsageTotals,
  DailyUsage,
  ToolUsageStats,
  ModelUsageStats,
  LatencyStats,
  DailyLatency,
  UsageSummary,
  SessionUsageSummary,
  UsageTrackerConfig,
  ReportOptions,
  ReportFormat,
} from "./types.js";
import {
  DEFAULT_USAGE_CONFIG,
  DEFAULT_MODEL_COSTS,
} from "./types.js";

/**
 * 标准化使用数据
 */
export function normalizeUsage(raw?: UsageLike | null): NormalizedUsage | undefined {
  if (!raw) {
    return undefined;
  }

  const asFiniteNumber = (value: unknown): number | undefined => {
    if (typeof value !== "number") return undefined;
    if (!Number.isFinite(value)) return undefined;
    return value;
  };

  const input = asFiniteNumber(
    raw.input ?? raw.inputTokens ?? raw.input_tokens ?? raw.promptTokens ?? raw.prompt_tokens,
  );
  const output = asFiniteNumber(
    raw.output ??
      raw.outputTokens ??
      raw.output_tokens ??
      raw.completionTokens ??
      raw.completion_tokens,
  );
  const cacheRead = asFiniteNumber(raw.cacheRead ?? raw.cache_read ?? raw.cache_read_input_tokens);
  const cacheWrite = asFiniteNumber(
    raw.cacheWrite ?? raw.cache_write ?? raw.cache_creation_input_tokens,
  );
  const total = asFiniteNumber(raw.total ?? raw.totalTokens ?? raw.total_tokens);

  if (
    input === undefined &&
    output === undefined &&
    cacheRead === undefined &&
    cacheWrite === undefined &&
    total === undefined
  ) {
    return undefined;
  }

  return { input, output, cacheRead, cacheWrite, total };
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 计算百分位数
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.max(0, Math.ceil(sortedValues.length * p) - 1);
  return sortedValues[index] ?? 0;
}

/**
 * 使用追踪引擎
 */
export class UsageEngine {
  private config: UsageTrackerConfig;
  private modelCosts: Map<string, ModelCostConfig> = new Map();
  private records: UsageRecord[] = [];
  private firstActivity: number | null = null;
  private lastActivity: number | null = null;

  constructor(config: Partial<UsageTrackerConfig> = {}) {
    this.config = { ...DEFAULT_USAGE_CONFIG, ...config };
    this.loadModelCosts(DEFAULT_MODEL_COSTS);
  }

  /**
   * 加载模型成本配置
   */
  private loadModelCosts(costs: ModelCostConfig[]): void {
    for (const cost of costs) {
      const key = `${cost.provider}::${cost.model}`;
      this.modelCosts.set(key, cost);
    }
  }

  /**
   * 获取模型成本配置
   */
  getModelCost(provider?: string, model?: string): ModelCostConfig | undefined {
    if (provider && model) {
      const key = `${provider}::${model}`;
      const exact = this.modelCosts.get(key);
      if (exact) return exact;

      // 尝试部分匹配
      for (const [k, v] of this.modelCosts) {
        if (k.startsWith(`${provider}::`) && model.includes(v.model)) {
          return v;
        }
      }
    }

    // 返回默认配置
    return this.modelCosts.get("default::default");
  }

  /**
   * 计算使用成本
   */
  calculateCost(usage: NormalizedUsage, provider?: string, model?: string): CostBreakdown {
    const costConfig = this.getModelCost(provider, model);

    if (!costConfig) {
      return { total: 0 };
    }

    const input = (usage.input ?? 0) / 1000 * (costConfig.inputCostPer1k ?? 0);
    const output = (usage.output ?? 0) / 1000 * (costConfig.outputCostPer1k ?? 0);
    const cacheRead = (usage.cacheRead ?? 0) / 1000 * (costConfig.cacheReadCostPer1k ?? 0);
    const cacheWrite = (usage.cacheWrite ?? 0) / 1000 * (costConfig.cacheWriteCostPer1k ?? 0);
    const total = input + output + cacheRead + cacheWrite;

    return { total, input, output, cacheRead, cacheWrite };
  }

  /**
   * 记录使用
   */
  record(params: {
    usage: UsageLike;
    provider?: string;
    model?: string;
    toolName?: string;
    durationMs?: number;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): UsageRecord {
    // 采样检查
    if (this.config.samplingRate < 1 && Math.random() > this.config.samplingRate) {
      // 仍返回记录，但不存储
      return {
        id: generateId(),
        timestamp: Date.now(),
        provider: params.provider,
        model: params.model,
        usage: normalizeUsage(params.usage) ?? {},
        sessionId: params.sessionId,
      };
    }

    const normalized = normalizeUsage(params.usage);
    const timestamp = Date.now();

    let costBreakdown: CostBreakdown | undefined;
    if (this.config.trackCosts && normalized) {
      costBreakdown = this.calculateCost(normalized, params.provider, params.model);
    }

    const record: UsageRecord = {
      id: generateId(),
      timestamp,
      provider: params.provider,
      model: params.model,
      usage: normalized ?? {},
      cost: costBreakdown?.total,
      costBreakdown,
      toolName: params.toolName,
      durationMs: params.durationMs,
      sessionId: params.sessionId,
      metadata: params.metadata,
    };

    // 更新活动时间
    if (!this.firstActivity || timestamp < this.firstActivity) {
      this.firstActivity = timestamp;
    }
    if (!this.lastActivity || timestamp > this.lastActivity) {
      this.lastActivity = timestamp;
    }

    // 存储记录
    this.records.push(record);

    // 清理旧记录
    this.pruneRecords();

    return record;
  }

  /**
   * 清理旧记录
   */
  private pruneRecords(): void {
    const now = Date.now();
    const cutoff = now - this.config.retentionDays * 24 * 60 * 60 * 1000;

    // 按时间清理
    this.records = this.records.filter((r) => r.timestamp >= cutoff);

    // 按数量清理
    if (this.records.length > this.config.maxRecords) {
      this.records = this.records.slice(-this.config.maxRecords);
    }
  }

  /**
   * 获取空总计
   */
  private emptyTotals(): UsageTotals {
    return {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      totalCost: 0,
      inputCost: 0,
      outputCost: 0,
      cacheReadCost: 0,
      cacheWriteCost: 0,
      recordCount: 0,
    };
  }

  /**
   * 应用使用到总计
   */
  private applyToTotals(totals: UsageTotals, record: UsageRecord): void {
    totals.input += record.usage.input ?? 0;
    totals.output += record.usage.output ?? 0;
    totals.cacheRead += record.usage.cacheRead ?? 0;
    totals.cacheWrite += record.usage.cacheWrite ?? 0;
    const tokenTotal =
      record.usage.total ??
      (record.usage.input ?? 0) +
        (record.usage.output ?? 0) +
        (record.usage.cacheRead ?? 0) +
        (record.usage.cacheWrite ?? 0);
    totals.totalTokens += tokenTotal;

    if (record.costBreakdown) {
      totals.totalCost += record.costBreakdown.total ?? 0;
      totals.inputCost += record.costBreakdown.input ?? 0;
      totals.outputCost += record.costBreakdown.output ?? 0;
      totals.cacheReadCost += record.costBreakdown.cacheRead ?? 0;
      totals.cacheWriteCost += record.costBreakdown.cacheWrite ?? 0;
    }

    totals.recordCount += 1;
  }

  /**
   * 获取总计
   */
  getTotals(startMs?: number, endMs?: number): UsageTotals {
    const totals = this.emptyTotals();
    const now = Date.now();
    const start = startMs ?? 0;
    const end = endMs ?? now;

    for (const record of this.records) {
      if (record.timestamp >= start && record.timestamp <= end) {
        this.applyToTotals(totals, record);
      }
    }

    return totals;
  }

  /**
   * 获取每日使用
   */
  getDailyUsage(startMs?: number, endMs?: number): DailyUsage[] {
    const dailyMap = new Map<string, UsageTotals>();
    const now = Date.now();
    const start = startMs ?? now - 30 * 24 * 60 * 60 * 1000;
    const end = endMs ?? now;

    for (const record of this.records) {
      if (record.timestamp >= start && record.timestamp <= end) {
        const date = formatDate(new Date(record.timestamp));
        const daily = dailyMap.get(date) ?? this.emptyTotals();
        this.applyToTotals(daily, record);
        dailyMap.set(date, daily);
      }
    }

    return Array.from(dailyMap.entries())
      .map(([date, totals]) => ({ date, ...totals }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 获取工具使用统计
   */
  getToolUsage(startMs?: number, endMs?: number): ToolUsageStats[] {
    const toolMap = new Map<
      string,
      { count: number; tokens: number; cost: number; durations: number[]; errors: number }
    >();
    const now = Date.now();
    const start = startMs ?? 0;
    const end = endMs ?? now;

    for (const record of this.records) {
      if (!record.toolName) continue;
      if (record.timestamp < start || record.timestamp > end) continue;

      const existing = toolMap.get(record.toolName) ?? {
        count: 0,
        tokens: 0,
        cost: 0,
        durations: [],
        errors: 0,
      };

      existing.count += 1;
      existing.tokens +=
        record.usage.total ??
        (record.usage.input ?? 0) +
          (record.usage.output ?? 0) +
          (record.usage.cacheRead ?? 0) +
          (record.usage.cacheWrite ?? 0);
      existing.cost += record.cost ?? 0;

      if (record.durationMs !== undefined) {
        existing.durations.push(record.durationMs);
      }

      // 检查错误标记
      if (record.metadata?.error) {
        existing.errors += 1;
      }

      toolMap.set(record.toolName, existing);
    }

    return Array.from(toolMap.entries())
      .map(([name, data]) => ({
        name,
        callCount: data.count,
        totalTokens: data.tokens,
        totalCost: data.cost,
        avgDurationMs:
          data.durations.length > 0
            ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
            : 0,
        errorCount: data.errors,
      }))
      .sort((a, b) => b.callCount - a.callCount);
  }

  /**
   * 获取模型使用统计
   */
  getModelUsage(startMs?: number, endMs?: number): ModelUsageStats[] {
    const modelMap = new Map<string, { count: number; totals: UsageTotals }>();
    const now = Date.now();
    const start = startMs ?? 0;
    const end = endMs ?? now;

    for (const record of this.records) {
      if (record.timestamp < start || record.timestamp > end) continue;

      const key = `${record.provider ?? "unknown"}::${record.model ?? "unknown"}`;
      const existing = modelMap.get(key) ?? {
        count: 0,
        totals: this.emptyTotals(),
      };

      existing.count += 1;
      this.applyToTotals(existing.totals, record);
      modelMap.set(key, existing);
    }

    return Array.from(modelMap.entries())
      .map(([key, data]) => {
        const [provider, model] = key.split("::");
        return {
          provider,
          model,
          callCount: data.count,
          totals: data.totals,
        };
      })
      .sort((a, b) => b.totals.totalCost - a.totals.totalCost);
  }

  /**
   * 获取延迟统计
   */
  getLatencyStats(startMs?: number, endMs?: number): LatencyStats | undefined {
    const durations: number[] = [];
    const now = Date.now();
    const start = startMs ?? 0;
    const end = endMs ?? now;

    for (const record of this.records) {
      if (record.durationMs === undefined) continue;
      if (record.timestamp < start || record.timestamp > end) continue;
      durations.push(record.durationMs);
    }

    if (durations.length === 0) return undefined;

    const sorted = durations.toSorted((a, b) => a - b);
    const total = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      avgMs: total / sorted.length,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
      minMs: sorted[0] ?? 0,
      maxMs: sorted[sorted.length - 1] ?? 0,
    };
  }

  /**
   * 获取每日延迟统计
   */
  getDailyLatency(startMs?: number, endMs?: number): DailyLatency[] {
    const dailyMap = new Map<string, number[]>();
    const now = Date.now();
    const start = startMs ?? now - 30 * 24 * 60 * 60 * 1000;
    const end = endMs ?? now;

    for (const record of this.records) {
      if (record.durationMs === undefined) continue;
      if (record.timestamp < start || record.timestamp > end) continue;

      const date = formatDate(new Date(record.timestamp));
      const durations = dailyMap.get(date) ?? [];
      durations.push(record.durationMs);
      dailyMap.set(date, durations);
    }

    return Array.from(dailyMap.entries())
      .map(([date, durations]) => {
        const sorted = durations.toSorted((a, b) => a - b);
        const total = sorted.reduce((a, b) => a + b, 0);

        return {
          date,
          count: sorted.length,
          avgMs: total / sorted.length,
          p50Ms: percentile(sorted, 0.5),
          p95Ms: percentile(sorted, 0.95),
          p99Ms: percentile(sorted, 0.99),
          minMs: sorted[0] ?? 0,
          maxMs: sorted[sorted.length - 1] ?? 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 获取摘要
   */
  getSummary(params?: { startMs?: number; endMs?: number; days?: number }): UsageSummary {
    const now = Date.now();
    let startMs: number;
    let endMs: number;

    if (params?.startMs !== undefined && params?.endMs !== undefined) {
      startMs = params.startMs;
      endMs = params.endMs;
    } else {
      const days = params?.days ?? 30;
      startMs = now - days * 24 * 60 * 60 * 1000;
      endMs = now;
    }

    const daily = this.getDailyUsage(startMs, endMs);
    const topTools = this.getToolUsage(startMs, endMs).slice(0, 20);
    const topModels = this.getModelUsage(startMs, endMs).slice(0, 10);
    const latency = this.getLatencyStats(startMs, endMs);
    const dailyLatency = this.getDailyLatency(startMs, endMs);
    const totals = this.getTotals(startMs, endMs);

    return {
      updatedAt: now,
      period: {
        startMs,
        endMs,
        days: Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000)),
      },
      totals,
      daily,
      topTools,
      topModels,
      latency,
      dailyLatency: dailyLatency.length > 0 ? dailyLatency : undefined,
    };
  }

  /**
   * 获取会话摘要
   */
  getSessionSummary(sessionId: string): SessionUsageSummary | undefined {
    const sessionRecords = this.records.filter((r) => r.sessionId === sessionId);

    if (sessionRecords.length === 0) return undefined;

    const totals = this.emptyTotals();
    const activityDates = new Set<string>();
    const dailyMap = new Map<string, UsageTotals>();
    const toolMap = new Map<string, ToolUsageStats>();
    const modelMap = new Map<string, ModelUsageStats>();
    const durations: number[] = [];

    let firstActivity: number | undefined;
    let lastActivity: number | undefined;

    for (const record of sessionRecords) {
      // 更新时间范围
      if (!firstActivity || record.timestamp < firstActivity) {
        firstActivity = record.timestamp;
      }
      if (!lastActivity || record.timestamp > lastActivity) {
        lastActivity = record.timestamp;
      }

      // 应用到总计
      this.applyToTotals(totals, record);

      // 活动日期
      const date = formatDate(new Date(record.timestamp));
      activityDates.add(date);

      // 每日统计
      const daily = dailyMap.get(date) ?? this.emptyTotals();
      this.applyToTotals(daily, record);
      dailyMap.set(date, daily);

      // 工具统计
      if (record.toolName) {
        const existing = toolMap.get(record.toolName) ?? {
          name: record.toolName,
          callCount: 0,
          totalTokens: 0,
          totalCost: 0,
          avgDurationMs: 0,
          errorCount: 0,
        };
        existing.callCount += 1;
        existing.totalTokens +=
          record.usage.total ??
          (record.usage.input ?? 0) +
            (record.usage.output ?? 0) +
            (record.usage.cacheRead ?? 0) +
            (record.usage.cacheWrite ?? 0);
        existing.totalCost += record.cost ?? 0;
        if (record.durationMs !== undefined) {
          existing.avgDurationMs =
            (existing.avgDurationMs * (existing.callCount - 1) + record.durationMs) /
            existing.callCount;
        }
        toolMap.set(record.toolName, existing);
      }

      // 模型统计
      if (record.provider || record.model) {
        const key = `${record.provider ?? "unknown"}::${record.model ?? "unknown"}`;
        const existing = modelMap.get(key) ?? {
          provider: record.provider,
          model: record.model,
          callCount: 0,
          totals: this.emptyTotals(),
        };
        existing.callCount += 1;
        this.applyToTotals(existing.totals, record);
        modelMap.set(key, existing);
      }

      // 延迟
      if (record.durationMs !== undefined) {
        durations.push(record.durationMs);
      }
    }

    // 计算延迟统计
    let latency: LatencyStats | undefined;
    if (durations.length > 0) {
      const sorted = durations.toSorted((a, b) => a - b);
      const total = sorted.reduce((a, b) => a + b, 0);
      latency = {
        count: sorted.length,
        avgMs: total / sorted.length,
        p50Ms: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
        p99Ms: percentile(sorted, 0.99),
        minMs: sorted[0] ?? 0,
        maxMs: sorted[sorted.length - 1] ?? 0,
      };
    }

    return {
      sessionId,
      firstActivity,
      lastActivity,
      durationMs:
        firstActivity && lastActivity ? lastActivity - firstActivity : undefined,
      activityDates: Array.from(activityDates).sort(),
      dailyBreakdown: Array.from(dailyMap.entries())
        .map(([date, t]) => ({ date, ...t }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      toolUsage: Array.from(toolMap.values()).sort((a, b) => b.callCount - a.callCount),
      modelUsage: Array.from(modelMap.values()).sort(
        (a, b) => b.totals.totalCost - a.totals.totalCost
      ),
      latency,
      ...totals,
    };
  }

  /**
   * 生成报告
   */
  generateReport(options: ReportOptions): string {
    const summary = this.getSummary({
      startMs: options.startDate?.getTime(),
      endMs: options.endDate?.getTime(),
    });

    switch (options.format) {
      case "json":
        return JSON.stringify(summary, null, 2);

      case "markdown":
        return this.formatMarkdownReport(summary, options);

      case "csv":
        return this.formatCsvReport(summary, options);

      case "text":
      default:
        return this.formatTextReport(summary, options);
    }
  }

  /**
   * 格式化文本报告
   */
  private formatTextReport(summary: UsageSummary, options: ReportOptions): string {
    const lines: string[] = [];
    const { totals, daily, topTools, topModels, latency } = summary;

    lines.push("=== Usage Report ===");
    lines.push(`Period: ${new Date(summary.period.startMs).toISOString()} to ${new Date(summary.period.endMs).toISOString()}`);
    lines.push(`Days: ${summary.period.days}`);
    lines.push("");

    lines.push("--- Totals ---");
    lines.push(`Records: ${totals.recordCount}`);
    lines.push(`Tokens: ${totals.totalTokens.toLocaleString()} (in: ${totals.input.toLocaleString()}, out: ${totals.output.toLocaleString()})`);
    lines.push(`Cost: $${totals.totalCost.toFixed(4)}`);

    if (options.includeLatency && latency) {
      lines.push("");
      lines.push("--- Latency ---");
      lines.push(`Count: ${latency.count}`);
      lines.push(`Avg: ${latency.avgMs.toFixed(0)}ms`);
      lines.push(`P95: ${latency.p95Ms.toFixed(0)}ms`);
    }

    if (options.includeModels && topModels.length > 0) {
      lines.push("");
      lines.push("--- Top Models ---");
      for (const model of topModels.slice(0, 5)) {
        lines.push(
          `  ${model.provider}/${model.model}: ${model.callCount} calls, $${model.totals.totalCost.toFixed(4)}`
        );
      }
    }

    if (options.includeTools && topTools.length > 0) {
      lines.push("");
      lines.push("--- Top Tools ---");
      for (const tool of topTools.slice(0, 10)) {
        lines.push(
          `  ${tool.name}: ${tool.callCount} calls, ${tool.totalTokens.toLocaleString()} tokens`
        );
      }
    }

    if (options.includeDaily && daily.length > 0) {
      lines.push("");
      lines.push("--- Daily Usage ---");
      for (const day of daily.slice(-7)) {
        lines.push(`  ${day.date}: ${day.totalTokens.toLocaleString()} tokens, $${day.totalCost.toFixed(4)}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * 格式化 Markdown 报告
   */
  private formatMarkdownReport(summary: UsageSummary, options: ReportOptions): string {
    const lines: string[] = [];
    const { totals, daily, topTools, topModels, latency } = summary;

    lines.push("# Usage Report");
    lines.push("");
    lines.push(`**Period:** ${new Date(summary.period.startMs).toISOString().slice(0, 10)} to ${new Date(summary.period.endMs).toISOString().slice(0, 10)}`);
    lines.push(`**Days:** ${summary.period.days}`);
    lines.push("");

    lines.push("## Totals");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Records | ${totals.recordCount.toLocaleString()} |`);
    lines.push(`| Total Tokens | ${totals.totalTokens.toLocaleString()} |`);
    lines.push(`| Input Tokens | ${totals.input.toLocaleString()} |`);
    lines.push(`| Output Tokens | ${totals.output.toLocaleString()} |`);
    lines.push(`| Total Cost | $${totals.totalCost.toFixed(4)} |`);
    lines.push("");

    if (options.includeLatency && latency) {
      lines.push("## Latency");
      lines.push("");
      lines.push("| Stat | Value |");
      lines.push("|------|-------|");
      lines.push(`| Count | ${latency.count} |`);
      lines.push(`| Avg | ${latency.avgMs.toFixed(0)}ms |`);
      lines.push(`| P95 | ${latency.p95Ms.toFixed(0)}ms |`);
      lines.push(`| P99 | ${latency.p99Ms.toFixed(0)}ms |`);
      lines.push("");
    }

    if (options.includeModels && topModels.length > 0) {
      lines.push("## Top Models");
      lines.push("");
      lines.push("| Provider | Model | Calls | Cost |");
      lines.push("|----------|-------|-------|------|");
      for (const model of topModels.slice(0, 10)) {
        lines.push(
          `| ${model.provider ?? "unknown"} | ${model.model ?? "unknown"} | ${model.callCount} | $${model.totals.totalCost.toFixed(4)} |`
        );
      }
      lines.push("");
    }

    if (options.includeTools && topTools.length > 0) {
      lines.push("## Top Tools");
      lines.push("");
      lines.push("| Tool | Calls | Tokens |");
      lines.push("|------|-------|--------|");
      for (const tool of topTools.slice(0, 10)) {
        lines.push(`| ${tool.name} | ${tool.callCount} | ${tool.totalTokens.toLocaleString()} |`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 格式化 CSV 报告
   */
  private formatCsvReport(summary: UsageSummary, options: ReportOptions): string {
    if (options.includeDaily && summary.daily.length > 0) {
      const lines = ["date,tokens,cost"];
      for (const day of summary.daily) {
        lines.push(`${day.date},${day.totalTokens},${day.totalCost.toFixed(6)}`);
      }
      return lines.join("\n");
    }

    // 返回摘要
    return `metric,value
records,${summary.totals.recordCount}
tokens,${summary.totals.totalTokens}
cost,${summary.totals.totalCost.toFixed(6)}`;
  }

  /**
   * 获取配置
   */
  getConfig(): UsageTrackerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<UsageTrackerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 获取记录数
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /**
   * 清除所有记录
   */
  clear(): void {
    this.records = [];
    this.firstActivity = null;
    this.lastActivity = null;
  }

  /**
   * 获取状态
   */
  getStatus(): {
    enabled: boolean;
    recordCount: number;
    firstActivity: number | null;
    lastActivity: number | null;
    config: UsageTrackerConfig;
  } {
    return {
      enabled: this.config.enabled,
      recordCount: this.records.length,
      firstActivity: this.firstActivity,
      lastActivity: this.lastActivity,
      config: this.getConfig(),
    };
  }

  /**
   * 添加模型成本配置
   */
  addModelCost(config: ModelCostConfig): void {
    const key = `${config.provider}::${config.model}`;
    this.modelCosts.set(key, config);
  }

  /**
   * 列出模型成本配置
   */
  listModelCosts(): ModelCostConfig[] {
    return Array.from(this.modelCosts.values());
  }
}

// 全局默认引擎
let defaultEngine: UsageEngine | null = null;

/**
 * 获取默认引擎
 */
export function getUsageEngine(): UsageEngine {
  if (!defaultEngine) {
    defaultEngine = new UsageEngine();
  }
  return defaultEngine;
}

/**
 * 关闭默认引擎
 */
export function closeUsageEngine(): void {
  if (defaultEngine) {
    defaultEngine.clear();
    defaultEngine = null;
  }
}
