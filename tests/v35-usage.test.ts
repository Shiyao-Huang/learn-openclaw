/**
 * V35: Usage/成本追踪系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  UsageEngine,
  normalizeUsage,
  DEFAULT_USAGE_CONFIG,
  DEFAULT_MODEL_COSTS,
} from "../v35-agent/usage/index.js";
import { createUsageHandlers, closeUsageHandlers } from "../v35-agent/usage/handlers.js";

describe("V35: Usage/成本追踪系统", () => {
  let engine: UsageEngine;

  beforeEach(() => {
    engine = new UsageEngine();
  });

  afterEach(() => {
    engine.clear();
    closeUsageHandlers();
  });

  describe("normalizeUsage", () => {
    it("应该处理空输入", () => {
      expect(normalizeUsage(null)).toBeUndefined();
      expect(normalizeUsage(undefined)).toBeUndefined();
      expect(normalizeUsage({})).toBeUndefined();
    });

    it("应该标准化 camelCase 格式", () => {
      const result = normalizeUsage({
        inputTokens: 100,
        outputTokens: 50,
      });
      expect(result).toEqual({
        input: 100,
        output: 50,
        cacheRead: undefined,
        cacheWrite: undefined,
        total: undefined,
      });
    });

    it("应该标准化 snake_case 格式", () => {
      const result = normalizeUsage({
        input_tokens: 200,
        output_tokens: 100,
        cache_read_input_tokens: 50,
        cache_creation_input_tokens: 25,
      });
      expect(result).toEqual({
        input: 200,
        output: 100,
        cacheRead: 50,
        cacheWrite: 25,
        total: undefined,
      });
    });

    it("应该标准化 Anthropic 格式", () => {
      const result = normalizeUsage({
        promptTokens: 300,
        completionTokens: 150,
        cacheRead: 100,
        cacheWrite: 50,
      });
      expect(result).toEqual({
        input: 300,
        output: 150,
        cacheRead: 100,
        cacheWrite: 50,
        total: undefined,
      });
    });

    it("应该处理简写格式", () => {
      const result = normalizeUsage({
        input: 100,
        output: 50,
        cacheRead: 20,
        cacheWrite: 10,
        total: 180,
      });
      expect(result).toEqual({
        input: 100,
        output: 50,
        cacheRead: 20,
        cacheWrite: 10,
        total: 180,
      });
    });
  });

  describe("UsageEngine", () => {
    describe("record", () => {
      it("应该记录使用数据", () => {
        const record = engine.record({
          usage: { input: 100, output: 50 },
          provider: "openai",
          model: "gpt-4o",
        });

        expect(record.id).toBeDefined();
        expect(record.timestamp).toBeDefined();
        expect(record.provider).toBe("openai");
        expect(record.model).toBe("gpt-4o");
        expect(record.usage.input).toBe(100);
        expect(record.usage.output).toBe(50);
      });

      it("应该计算成本", () => {
        const record = engine.record({
          usage: { input: 1000, output: 500 },
          provider: "openai",
          model: "gpt-4o",
        });

        // GPT-4o: input=$0.005/1k, output=$0.015/1k
        // 1000 input * 0.005/1k = $0.005
        // 500 output * 0.015/1k = $0.0075
        // Total = $0.0125
        expect(record.cost).toBeCloseTo(0.0125, 4);
        expect(record.costBreakdown?.input).toBeCloseTo(0.005, 4);
        expect(record.costBreakdown?.output).toBeCloseTo(0.0075, 4);
      });

      it("应该计算缓存成本", () => {
        const record = engine.record({
          usage: { input: 1000, output: 500, cacheRead: 2000, cacheWrite: 500 },
          provider: "anthropic",
          model: "claude-3-5-sonnet",
        });

        // Claude 3.5 Sonnet: input=$0.003/1k, output=$0.015/1k
        // cacheRead=$0.0003/1k, cacheWrite=$0.00375/1k
        expect(record.cost).toBeDefined();
        expect(record.costBreakdown?.cacheRead).toBeCloseTo(0.0006, 4); // 2000 * 0.0003/1k
        expect(record.costBreakdown?.cacheWrite).toBeCloseTo(0.001875, 4); // 500 * 0.00375/1k
      });

      it("应该记录工具名称和耗时", () => {
        const record = engine.record({
          usage: { input: 100, output: 50 },
          toolName: "bash",
          durationMs: 1234,
        });

        expect(record.toolName).toBe("bash");
        expect(record.durationMs).toBe(1234);
      });

      it("应该记录会话 ID", () => {
        const record = engine.record({
          usage: { input: 100, output: 50 },
          sessionId: "session-123",
        });

        expect(record.sessionId).toBe("session-123");
      });
    });

    describe("getTotals", () => {
      it("应该返回空总计", () => {
        const totals = engine.getTotals();
        expect(totals.recordCount).toBe(0);
        expect(totals.totalTokens).toBe(0);
        expect(totals.totalCost).toBe(0);
      });

      it("应该汇总所有记录", () => {
        engine.record({ usage: { input: 100, output: 50 } });
        engine.record({ usage: { input: 200, output: 100 } });
        engine.record({ usage: { input: 50, output: 25 } });

        const totals = engine.getTotals();
        expect(totals.recordCount).toBe(3);
        expect(totals.input).toBe(350);
        expect(totals.output).toBe(175);
        expect(totals.totalTokens).toBe(525);
      });

      it("应该按时间范围过滤", async () => {
        // 记录第一条
        engine.record({ usage: { input: 100, output: 50 } });

        // 等待确保时间戳不同
        await new Promise(r => setTimeout(r, 5));

        // 记录时间范围开始
        const start = Date.now();

        // 等待确保时间戳不同
        await new Promise(r => setTimeout(r, 5));

        // 在时间范围内记录第二条
        engine.record({ usage: { input: 200, output: 100 } });

        // 等待确保时间戳不同
        await new Promise(r => setTimeout(r, 5));

        // 记录时间范围结束
        const end = Date.now();

        const totals = engine.getTotals(start, end);
        expect(totals.recordCount).toBe(1);
        expect(totals.input).toBe(200);
      });
    });

    describe("getDailyUsage", () => {
      it("应该返回每日统计", () => {
        engine.record({ usage: { input: 100, output: 50 } });
        engine.record({ usage: { input: 200, output: 100 } });
        engine.record({ usage: { input: 50, output: 25 } });

        const daily = engine.getDailyUsage();
        expect(daily.length).toBe(1);
        expect(daily[0].input).toBe(350);
        expect(daily[0].output).toBe(175);
      });
    });

    describe("getToolUsage", () => {
      it("应该返回工具统计", () => {
        engine.record({ usage: { input: 100, output: 50 }, toolName: "bash", durationMs: 100 });
        engine.record({ usage: { input: 200, output: 100 }, toolName: "bash", durationMs: 200 });
        engine.record({ usage: { input: 50, output: 25 }, toolName: "read_file", durationMs: 50 });

        const tools = engine.getToolUsage();
        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe("bash");
        expect(tools[0].callCount).toBe(2);
        expect(tools[0].avgDurationMs).toBe(150);
        expect(tools[1].name).toBe("read_file");
        expect(tools[1].callCount).toBe(1);
      });
    });

    describe("getModelUsage", () => {
      it("应该返回模型统计", () => {
        engine.record({ usage: { input: 1000, output: 500 }, provider: "openai", model: "gpt-4o" });
        engine.record({ usage: { input: 2000, output: 1000 }, provider: "openai", model: "gpt-4o" });
        engine.record({ usage: { input: 500, output: 250 }, provider: "anthropic", model: "claude-3-5-sonnet" });

        const models = engine.getModelUsage();
        expect(models.length).toBe(2);
        // 按成本排序，GPT-4o 应该更高
        expect(models[0].provider).toBe("openai");
        expect(models[0].model).toBe("gpt-4o");
        expect(models[0].callCount).toBe(2);
      });
    });

    describe("getLatencyStats", () => {
      it("应该返回延迟统计", () => {
        for (let i = 1; i <= 100; i++) {
          engine.record({
            usage: { input: 10, output: 5 },
            durationMs: i * 10, // 10, 20, 30, ..., 1000
          });
        }

        const latency = engine.getLatencyStats();
        expect(latency).toBeDefined();
        expect(latency!.count).toBe(100);
        expect(latency!.avgMs).toBe(505); // (10 + 1000) / 2
        expect(latency!.minMs).toBe(10);
        expect(latency!.maxMs).toBe(1000);
        expect(latency!.p50Ms).toBeGreaterThan(400);
        expect(latency!.p95Ms).toBeGreaterThan(900);
      });

      it("没有数据时应该返回 undefined", () => {
        engine.record({ usage: { input: 100, output: 50 } });
        const latency = engine.getLatencyStats();
        expect(latency).toBeUndefined();
      });
    });

    describe("getSessionSummary", () => {
      it("应该返回会话摘要", () => {
        engine.record({ usage: { input: 100, output: 50 }, sessionId: "session-1", toolName: "bash" });
        engine.record({ usage: { input: 200, output: 100 }, sessionId: "session-1", toolName: "read_file" });
        engine.record({ usage: { input: 50, output: 25 }, sessionId: "session-2" });

        const summary = engine.getSessionSummary("session-1");
        expect(summary).toBeDefined();
        expect(summary!.sessionId).toBe("session-1");
        expect(summary!.input).toBe(300);
        expect(summary!.output).toBe(150);
        expect(summary!.toolUsage!.length).toBe(2);
      });

      it("会话不存在时应该返回 undefined", () => {
        const summary = engine.getSessionSummary("non-existent");
        expect(summary).toBeUndefined();
      });
    });

    describe("getSummary", () => {
      it("应该返回完整摘要", () => {
        engine.record({ usage: { input: 100, output: 50 }, provider: "openai", model: "gpt-4o", toolName: "bash", durationMs: 100 });
        engine.record({ usage: { input: 200, output: 100 }, provider: "openai", model: "gpt-4o", toolName: "bash", durationMs: 200 });

        const summary = engine.getSummary({ days: 7 });
        expect(summary.totals.recordCount).toBe(2);
        expect(summary.daily.length).toBeGreaterThanOrEqual(1);
        expect(summary.topTools.length).toBe(1);
        expect(summary.topModels.length).toBe(1);
        expect(summary.latency).toBeDefined();
      });
    });

    describe("generateReport", () => {
      it("应该生成文本报告", () => {
        engine.record({ usage: { input: 1000, output: 500 }, provider: "openai", model: "gpt-4o" });

        const report = engine.generateReport({ format: "text" });
        expect(report).toContain("Usage Report");
        expect(report).toContain("Tokens:");
        expect(report).toContain("Cost:");
      });

      it("应该生成 JSON 报告", () => {
        engine.record({ usage: { input: 100, output: 50 }, provider: "openai", model: "gpt-4o" });

        const report = engine.generateReport({ format: "json" });
        const parsed = JSON.parse(report);
        expect(parsed.totals).toBeDefined();
        expect(parsed.period).toBeDefined();
      });

      it("应该生成 Markdown 报告", () => {
        engine.record({ usage: { input: 100, output: 50 }, provider: "openai", model: "gpt-4o" });

        const report = engine.generateReport({ format: "markdown", includeModels: true });
        expect(report).toContain("# Usage Report");
        expect(report).toContain("| Metric | Value |");
      });

      it("应该生成 CSV 报告", () => {
        engine.record({ usage: { input: 100, output: 50 } });
        engine.record({ usage: { input: 200, output: 100 } });

        const report = engine.generateReport({ format: "csv", includeDaily: true });
        expect(report).toContain("date,tokens,cost");
      });
    });

    describe("config", () => {
      it("应该获取默认配置", () => {
        const config = engine.getConfig();
        expect(config.enabled).toBe(true);
        expect(config.trackCosts).toBe(true);
        expect(config.retentionDays).toBe(30);
      });

      it("应该更新配置", () => {
        engine.updateConfig({ retentionDays: 7, samplingRate: 0.5 });
        const config = engine.getConfig();
        expect(config.retentionDays).toBe(7);
        expect(config.samplingRate).toBe(0.5);
      });
    });

    describe("model costs", () => {
      it("应该列出模型成本配置", () => {
        const costs = engine.listModelCosts();
        expect(costs.length).toBeGreaterThan(0);
        expect(costs.find((c) => c.provider === "openai" && c.model === "gpt-4o")).toBeDefined();
      });

      it("应该添加自定义模型成本配置", () => {
        engine.addModelCost({
          provider: "custom",
          model: "custom-model",
          inputCostPer1k: 0.01,
          outputCostPer1k: 0.02,
        });

        const costs = engine.listModelCosts();
        expect(costs.find((c) => c.provider === "custom" && c.model === "custom-model")).toBeDefined();
      });
    });
  });

  describe("工具处理器", () => {
    const handlers = createUsageHandlers();

    afterEach(() => {
      handlers.usage_clear({});
    });

    it("usage_record 应该记录使用", async () => {
      const result = await handlers.usage_record({
        usage: { input: 100, output: 50 },
        provider: "openai",
        model: "gpt-4o",
      });
      expect((result as any).success).toBe(true);
      expect((result as any).record.usage.input).toBe(100);
    });

    it("usage_get_totals 应该返回总计", async () => {
      await handlers.usage_record({
        usage: { input: 100, output: 50 },
      });
      const result = await handlers.usage_get_totals({});
      expect((result as any).recordCount).toBe(1);
      expect((result as any).input).toBe(100);
    });

    it("usage_get_summary 应该返回摘要", async () => {
      await handlers.usage_record({
        usage: { input: 100, output: 50 },
        provider: "openai",
        model: "gpt-4o",
      });
      const result = await handlers.usage_get_summary({ days: 7 });
      expect((result as any).totals.recordCount).toBe(1);
    });

    it("usage_report 应该生成报告", async () => {
      await handlers.usage_record({
        usage: { input: 100, output: 50 },
      });
      const result = await handlers.usage_report({ format: "text" });
      expect((result as any).format).toBe("text");
      expect((result as any).report).toContain("Usage Report");
    });

    it("usage_status 应该返回状态", async () => {
      const result = await handlers.usage_status({});
      expect((result as any).enabled).toBe(true);
      expect((result as any).recordCount).toBe(0);
    });

    it("usage_config 应该更新配置", async () => {
      const result = await handlers.usage_config({ retentionDays: 14 });
      expect((result as any).success).toBe(true);
      expect((result as any).config.retentionDays).toBe(14);
    });

    it("usage_normalize 应该标准化数据", async () => {
      const result = await handlers.usage_normalize({
        usage: { inputTokens: 100, outputTokens: 50 },
      });
      expect((result as any).normalized.input).toBe(100);
      expect((result as any).normalized.output).toBe(50);
    });

    it("usage_clear 应该清除记录", async () => {
      await handlers.usage_record({ usage: { input: 100, output: 50 } });
      const result = await handlers.usage_clear({});
      expect((result as any).success).toBe(true);
    });
  });
});
