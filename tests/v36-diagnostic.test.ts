/**
 * V36: 诊断事件系统 - 测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DiagnosticEngine,
  getDiagnosticEngine,
  closeDiagnosticEngine,
  resetDiagnosticEngine,
  emitModelUsage,
  emitToolCall,
  emitError,
  emitSessionState,
  emitMessageProcessed,
} from "./v36-agent/diagnostic/index.js";

describe("V36 Diagnostic Events System", () => {
  let engine: DiagnosticEngine;

  beforeEach(() => {
    resetDiagnosticEngine();
    engine = new DiagnosticEngine();
  });

  afterEach(() => {
    engine.clear();
  });

  describe("DiagnosticEngine", () => {
    it("should create engine with default config", () => {
      const config = engine.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.maxEvents).toBe(10000);
      expect(config.retentionMs).toBe(24 * 60 * 60 * 1000);
    });

    it("should accept custom config", () => {
      const customEngine = new DiagnosticEngine({
        enabled: true,
        maxEvents: 1000,
        retentionMs: 3600000,
      });
      const config = customEngine.getConfig();
      expect(config.maxEvents).toBe(1000);
      expect(config.retentionMs).toBe(3600000);
    });
  });

  describe("Event Emission", () => {
    it("should emit model usage event", () => {
      const event = engine.emit({
        type: "model.usage",
        provider: "openai",
        model: "gpt-4o",
        usage: { input: 100, output: 50, total: 150 },
        costUsd: 0.005,
        durationMs: 1234,
      });

      expect(event.type).toBe("model.usage");
      expect(event.seq).toBe(1);
      expect(event.ts).toBeDefined();
      expect((event as any).provider).toBe("openai");
      expect((event as any).model).toBe("gpt-4o");
    });

    it("should emit tool call event", () => {
      const event = engine.emit({
        type: "tool.call",
        toolName: "read_file",
        success: true,
        durationMs: 50,
      });

      expect(event.type).toBe("tool.call");
      expect((event as any).toolName).toBe("read_file");
      expect((event as any).success).toBe(true);
    });

    it("should emit error event", () => {
      const event = engine.emit({
        type: "error",
        category: "network",
        message: "Connection timeout",
      });

      expect(event.type).toBe("error");
      expect((event as any).category).toBe("network");
      expect((event as any).message).toBe("Connection timeout");
    });

    it("should emit session state event", () => {
      const event = engine.emit({
        type: "session.state",
        sessionKey: "test-session",
        prevState: "idle",
        state: "processing",
      });

      expect(event.type).toBe("session.state");
      expect((event as any).state).toBe("processing");
    });

    it("should emit message processed event", () => {
      const event = engine.emit({
        type: "message.processed",
        channel: "telegram",
        outcome: "completed",
        durationMs: 500,
      });

      expect(event.type).toBe("message.processed");
      expect((event as any).outcome).toBe("completed");
    });

    it("should increment sequence numbers", () => {
      engine.emit({ type: "model.usage", usage: {} });
      engine.emit({ type: "model.usage", usage: {} });
      const event = engine.emit({ type: "model.usage", usage: {} });

      expect(event.seq).toBe(3);
    });
  });

  describe("Event Storage", () => {
    it("should store events", () => {
      engine.emit({ type: "model.usage", usage: {} });
      engine.emit({ type: "tool.call", toolName: "test", success: true });

      expect(engine.getEventCount()).toBe(2);
    });

    it("should respect maxEvents limit", () => {
      const smallEngine = new DiagnosticEngine({ maxEvents: 5 });
      for (let i = 0; i < 10; i++) {
        smallEngine.emit({ type: "model.usage", usage: {} });
      }

      expect(smallEngine.getEventCount()).toBe(5);
    });

    it("should clear events", () => {
      engine.emit({ type: "model.usage", usage: {} });
      engine.emit({ type: "tool.call", toolName: "test", success: true });

      engine.clear();
      expect(engine.getEventCount()).toBe(0);
    });
  });

  describe("Event Listeners", () => {
    it("should notify listeners", () => {
      const received: any[] = [];
      engine.onEvent((evt) => received.push(evt));

      engine.emit({ type: "model.usage", usage: {} });
      engine.emit({ type: "error", category: "internal", message: "test" });

      expect(received.length).toBe(2);
      expect(received[0].type).toBe("model.usage");
      expect(received[1].type).toBe("error");
    });

    it("should allow unsubscribing", () => {
      const received: any[] = [];
      const unsubscribe = engine.onEvent((evt) => received.push(evt));

      engine.emit({ type: "model.usage", usage: {} });
      unsubscribe();
      engine.emit({ type: "model.usage", usage: {} });

      expect(received.length).toBe(1);
    });
  });

  describe("Event Query", () => {
    beforeEach(() => {
      engine.emit({ type: "model.usage", provider: "openai", usage: {} });
      engine.emit({ type: "model.usage", provider: "anthropic", usage: {} });
      engine.emit({ type: "tool.call", toolName: "read", success: true });
      engine.emit({ type: "error", category: "network", message: "timeout" });
    });

    it("should query all events", () => {
      const result = engine.query({});
      expect(result.total).toBe(4);
      expect(result.events.length).toBe(4);
    });

    it("should filter by type", () => {
      const result = engine.query({ types: ["model.usage"] });
      expect(result.total).toBe(2);
    });

    it("should filter by multiple types", () => {
      const result = engine.query({ types: ["model.usage", "error"] });
      expect(result.total).toBe(3);
    });

    it("should limit results", () => {
      const result = engine.query({ limit: 2 });
      expect(result.events.length).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it("should filter errors only", () => {
      const result = engine.query({ errorsOnly: true });
      expect(result.total).toBe(1);
      expect(result.events[0].type).toBe("error");
    });
  });

  describe("Statistics", () => {
    beforeEach(() => {
      engine.emit({ type: "model.usage", usage: {}, durationMs: 100 });
      engine.emit({ type: "model.usage", usage: {}, durationMs: 200 });
      engine.emit({ type: "tool.call", toolName: "test", success: true, durationMs: 50 });
      engine.emit({ type: "tool.call", toolName: "fail", success: false, durationMs: 10 });
      engine.emit({ type: "error", category: "network", message: "test" });
    });

    it("should get event type stats", () => {
      const stats = engine.getEventTypeStats();

      expect(stats.length).toBe(3);
      expect(stats.find((s) => s.type === "model.usage")?.count).toBe(2);
      expect(stats.find((s) => s.type === "tool.call")?.count).toBe(2);
    });

    it("should calculate average duration", () => {
      const stats = engine.getEventTypeStats();
      const usageStats = stats.find((s) => s.type === "model.usage");

      expect(usageStats?.avgDurationMs).toBe(150);
    });

    it("should count errors", () => {
      const stats = engine.getEventTypeStats();
      const toolStats = stats.find((s) => s.type === "tool.call");

      expect(toolStats?.errorCount).toBe(1);
    });
  });

  describe("Status", () => {
    it("should get status", () => {
      engine.emit({ type: "model.usage", usage: {} });

      const status = engine.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.eventCount).toBe(1);
      expect(status.listenerCount).toBe(0);
      expect(status.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should get recent errors", () => {
      engine.emit({ type: "error", category: "network", message: "error1" });
      engine.emit({ type: "error", category: "auth", message: "error2" });
      engine.emit({ type: "model.usage", usage: {} });

      const errors = engine.getRecentErrors();

      expect(errors.length).toBe(2);
      expect(errors[0].category).toBe("network");
    });
  });

  describe("Report Generation", () => {
    beforeEach(() => {
      engine.emit({ type: "model.usage", usage: {}, durationMs: 100 });
      engine.emit({ type: "error", category: "network", message: "test error" });
    });

    it("should generate text report", () => {
      const report = engine.generateReport("text");

      expect(report).toContain("Diagnostic Report");
      expect(report).toContain("model.usage");
    });

    it("should generate json report", () => {
      const report = engine.generateReport("json");
      const parsed = JSON.parse(report);

      expect(parsed.enabled).toBe(true);
      expect(parsed.eventCount).toBe(2);
    });

    it("should generate markdown report", () => {
      const report = engine.generateReport("markdown");

      expect(report).toContain("# Diagnostic Report");
      expect(report).toContain("| Type |");
    });
  });

  describe("Configuration", () => {
    it("should update config", () => {
      engine.updateConfig({ maxEvents: 5000 });

      const config = engine.getConfig();
      expect(config.maxEvents).toBe(5000);
    });

    it("should disable engine", () => {
      engine.updateConfig({ enabled: false });

      // Events should not be stored when disabled
      engine.emit({ type: "model.usage", usage: {} });

      const config = engine.getConfig();
      expect(config.enabled).toBe(false);
    });
  });

  describe("Convenience Functions", () => {
    it("should emit model usage via helper", () => {
      const event = emitModelUsage(engine, {
        provider: "openai",
        model: "gpt-4",
        usage: { input: 100, output: 50 },
        costUsd: 0.01,
      });

      expect(event.type).toBe("model.usage");
    });

    it("should emit tool call via helper", () => {
      const event = emitToolCall(engine, {
        toolName: "test",
        success: true,
      });

      expect(event.type).toBe("tool.call");
    });

    it("should emit error via helper", () => {
      const event = emitError(engine, {
        category: "timeout",
        message: "Request timed out",
      });

      expect(event.type).toBe("error");
    });

    it("should emit session state via helper", () => {
      const event = emitSessionState(engine, {
        state: "processing",
        sessionKey: "test",
      });

      expect(event.type).toBe("session.state");
    });

    it("should emit message processed via helper", () => {
      const event = emitMessageProcessed(engine, {
        channel: "telegram",
        outcome: "completed",
      });

      expect(event.type).toBe("message.processed");
    });
  });

  describe("Global Instance", () => {
    it("should get default engine", () => {
      resetDiagnosticEngine();
      const defaultEngine = getDiagnosticEngine();

      expect(defaultEngine).toBeInstanceOf(DiagnosticEngine);
    });

    it("should close default engine", () => {
      const defaultEngine = getDiagnosticEngine();
      defaultEngine.emit({ type: "model.usage", usage: {} });

      closeDiagnosticEngine();

      // After close, a new engine should be created
      const newEngine = getDiagnosticEngine();
      expect(newEngine.getEventCount()).toBe(0);
    });
  });
});
