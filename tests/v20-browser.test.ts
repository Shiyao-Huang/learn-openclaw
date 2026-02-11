/**
 * tests/v20-browser.test.ts - V20 浏览器自动化测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { BrowserController } from "../v20-agent/browser/index.js";

// 检查是否有 Chrome
const hasChrome = !!(
  process.env.CHROME_PATH ||
  fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ||
  fs.existsSync("/usr/bin/google-chrome") ||
  fs.existsSync("/usr/bin/chromium")
);

// 条件测试 - 只有安装了 Chrome 才运行
describe.skipIf(!hasChrome)("V20 Browser Automation", () => {
  let controller: BrowserController;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v20-browser-test-"));
    controller = new BrowserController(tempDir);
  });

  afterEach(async () => {
    await controller.cleanup();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Browser Lifecycle", () => {
    it("should start browser", async () => {
      const session = await controller.start({ headless: true });
      
      expect(session.id).toBeDefined();
      expect(session.status).toBe("ready");
      expect(session.cdpPort).toBeGreaterThan(0);
      expect(session.pid).toBeGreaterThan(0);
    });

    it("should stop browser", async () => {
      const session = await controller.start({ headless: true });
      const stopped = await controller.stop(session.id);
      
      expect(stopped).toBe(true);
      expect(controller.getSession(session.id)).toBeUndefined();
    });

    it("should list active sessions", async () => {
      const session1 = await controller.start({ headless: true });
      const session2 = await controller.start({ headless: true });
      
      const sessions = controller.listSessions();
      expect(sessions.length).toBe(2);
      expect(sessions.some(s => s.id === session1.id)).toBe(true);
      expect(sessions.some(s => s.id === session2.id)).toBe(true);
    });
  });

  describe("Navigation", () => {
    it("should navigate to URL", async () => {
      const session = await controller.start({ headless: true });
      
      await controller.navigate(session.id, "https://example.com");
      const updated = controller.getSession(session.id);
      
      expect(updated?.currentUrl).toBe("https://example.com");
    });

    it("should throw for invalid session", async () => {
      await expect(controller.navigate("invalid-id", "https://example.com"))
        .rejects.toThrow("Session not found");
    });
  });

  describe("Page Snapshot", () => {
    it("should get page snapshot", async () => {
      const session = await controller.start({ headless: true });
      await controller.navigate(session.id, "https://example.com");
      
      const snapshot = await controller.getSnapshot(session.id);
      
      expect(snapshot.url).toContain("example.com");
      expect(snapshot.title).toBeDefined();
      expect(snapshot.text).toBeDefined();
      expect(snapshot.elements).toBeInstanceOf(Array);
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });
  });

  describe("Screenshot", () => {
    it("should capture screenshot", async () => {
      const session = await controller.start({ headless: true });
      await controller.navigate(session.id, "https://example.com");
      
      const buffer = await controller.screenshot(session.id);
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should capture full page screenshot", async () => {
      const session = await controller.start({ headless: true });
      await controller.navigate(session.id, "https://example.com");
      
      const buffer = await controller.screenshot(session.id, { fullPage: true });
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe("Page Interaction", () => {
    it("should execute JavaScript", async () => {
      const session = await controller.start({ headless: true });
      await controller.navigate(session.id, "https://example.com");
      
      const result = await controller.evaluate(session.id, "document.title");
      
      expect(typeof result).toBe("string");
    });

    it("should return complex JS results", async () => {
      const session = await controller.start({ headless: true });
      await controller.navigate(session.id, "https://example.com");
      
      const result = await controller.evaluate(session.id, "({ width: window.innerWidth, height: window.innerHeight })");
      
      expect(result).toHaveProperty("width");
      expect(result).toHaveProperty("height");
    });
  });
});

// 始终运行的基础测试
describe("V20 Browser Types", () => {
  it("should export correct types", () => {
    // 类型检查在编译时完成，这里只是确保模块可以导入
    expect(typeof BrowserController).toBe("function");
  });
});
