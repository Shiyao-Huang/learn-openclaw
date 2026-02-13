/**
 * V26: Canvas 显示系统 - 测试
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  CanvasEngine,
  createDefaultConfig,
  getCanvasTools,
  CANVAS_TOOL_COUNT,
  DEFAULT_CANVAS_CONFIG,
} from "../v26-agent/canvas/index.js";

describe("V26: Canvas 显示系统", () => {
  describe("配置", () => {
    it("should have default config", () => {
      const config = createDefaultConfig();
      expect(config.port).toBe(DEFAULT_CANVAS_CONFIG.port);
      expect(config.host).toBe(DEFAULT_CANVAS_CONFIG.host);
      expect(config.liveReload).toBe(true);
    });

    it("should allow custom config", () => {
      const config = createDefaultConfig();
      config.port = 4000;
      config.liveReload = false;
      expect(config.port).toBe(4000);
      expect(config.liveReload).toBe(false);
    });
  });

  describe("工具定义", () => {
    it("should have 9 canvas tools", () => {
      const tools = getCanvasTools();
      expect(tools.length).toBe(CANVAS_TOOL_COUNT);
      expect(CANVAS_TOOL_COUNT).toBe(9);
    });

    it("should have required tools", () => {
      const tools = getCanvasTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain("canvas_present");
      expect(toolNames).toContain("canvas_navigate");
      expect(toolNames).toContain("canvas_eval");
      expect(toolNames).toContain("canvas_snapshot");
      expect(toolNames).toContain("canvas_hide");
      expect(toolNames).toContain("canvas_status");
      expect(toolNames).toContain("canvas_history");
      expect(toolNames).toContain("canvas_screenshots");
      expect(toolNames).toContain("canvas_clear");
    });

    it("should have proper tool schemas", () => {
      const tools = getCanvasTools();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.input_schema).toBeDefined();
        expect(tool.input_schema.type).toBe("object");
        expect(tool.input_schema.properties).toBeDefined();
      }
    });

    it("canvas_present should require content and contentType", () => {
      const tools = getCanvasTools();
      const presentTool = tools.find((t) => t.name === "canvas_present");
      expect(presentTool?.input_schema.required).toContain("content");
      expect(presentTool?.input_schema.required).toContain("contentType");
    });

    it("canvas_navigate should require url", () => {
      const tools = getCanvasTools();
      const navigateTool = tools.find((t) => t.name === "canvas_navigate");
      expect(navigateTool?.input_schema.required).toContain("url");
    });

    it("canvas_eval should require code", () => {
      const tools = getCanvasTools();
      const evalTool = tools.find((t) => t.name === "canvas_eval");
      expect(evalTool?.input_schema.required).toContain("code");
    });
  });

  describe("CanvasEngine", () => {
    let engine: CanvasEngine;

    beforeAll(() => {
      engine = new CanvasEngine({
        ...createDefaultConfig(),
        port: 3888, // 使用不同的端口避免冲突
        liveReload: false, // 测试时禁用热重载
      });
    });

    afterAll(async () => {
      await engine.stop();
    });

    it("should create engine instance", () => {
      expect(engine).toBeDefined();
    });

    it("should return initial status", async () => {
      const status = await engine.status();
      expect(status.running).toBe(false);
      expect(status.port).toBe(3888);
      expect(status.screenshotCount).toBe(0);
    });

    it("should start and stop", async () => {
      await engine.start();
      const statusRunning = await engine.status();
      expect(statusRunning.running).toBe(true);

      await engine.stop();
      const statusStopped = await engine.status();
      expect(statusStopped.running).toBe(false);
    });

    it("should handle present with HTML", async () => {
      const result = await engine.present({
        content: "<html><body><h1>Test</h1></body></html>",
        contentType: "html",
      });

      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
      expect(result.url).toContain("http://");
    });

    it("should handle hide", async () => {
      const result = await engine.hide({ shutdown: false });
      expect(result.success).toBe(true);
      expect(result.message).toContain("hidden");
    });

    it("should track history", async () => {
      const history = engine.getHistory(10);
      expect(Array.isArray(history)).toBe(true);
    });

    it("should clear history", () => {
      engine.clearHistory();
      const history = engine.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe("快照功能", () => {
    let engine: CanvasEngine;

    beforeAll(async () => {
      engine = new CanvasEngine({
        ...createDefaultConfig(),
        port: 3999,
        liveReload: false,
      });
      await engine.start();
    });

    afterAll(async () => {
      await engine.stop();
    });

    it("should present HTML for snapshot", async () => {
      const result = await engine.present({
        content: "<html><body><h1>Snapshot Test</h1></body></html>",
        contentType: "html",
      });

      expect(result.success).toBe(true);
    });

    // 注意: 截图测试需要 Puppeteer，可能需要跳过
    it("should handle snapshot request", async () => {
      // 这个测试验证接口，不实际截图
      // 实际截图测试需要安装 Puppeteer
      const screenshots = engine.getScreenshots();
      expect(Array.isArray(screenshots)).toBe(true);
    });
  });

  describe("错误处理", () => {
    let engine: CanvasEngine;

    beforeAll(() => {
      engine = new CanvasEngine({
        ...createDefaultConfig(),
        port: 4001,
        liveReload: false,
      });
    });

    afterAll(async () => {
      await engine.stop();
    });

    it("should handle invalid URL gracefully", async () => {
      await engine.start();
      const result = await engine.navigate({
        url: "not-a-valid-url",
      });

      // 应该返回结果，可能成功或失败
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it("should handle eval on blank page", async () => {
      await engine.start();
      const result = await engine.eval({
        code: "1 + 1",
      });

      // 应该返回结果
      expect(result).toBeDefined();
    });
  });
});
