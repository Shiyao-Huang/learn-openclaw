/**
 * V26: Canvas 显示系统 - 核心引擎
 * 
 * 轻量级 Canvas 实现，提供 UI 展示和截图能力
 * 
 * 功能:
 * - 本地 HTTP 服务器 (用于展示 HTML)
 * - Puppeteer 截图和 JavaScript 执行
 * - 热重载支持
 */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Socket } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import chokidar from "chokidar";
import type {
  CanvasConfig,
  CanvasPresentRequest,
  CanvasPresentResult,
  CanvasNavigateRequest,
  CanvasNavigateResult,
  CanvasEvalRequest,
  CanvasEvalResult,
  CanvasSnapshotRequest,
  CanvasSnapshotResult,
  CanvasHideRequest,
  CanvasHideResult,
  CanvasStatusResult,
  CanvasHistory,
  ScreenshotRecord,
  DEFAULT_CANVAS_CONFIG as DEFAULT_CONFIG,
} from "./types.js";

// 重新导出 DEFAULT_CANVAS_CONFIG
const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  port: 3777,
  host: "127.0.0.1",
  rootDir: "./canvas",
  liveReload: true,
  screenshotDir: "./screenshots",
  viewportWidth: 1280,
  viewportHeight: 720,
};

export { DEFAULT_CANVAS_CONFIG };

// ============ 常量 ============

const CANVAS_WS_PATH = "/__canvas__/ws";
const CANVAS_RELOAD_SCRIPT = `
<script>
(function() {
  const ws = new WebSocket('ws://' + location.host + '${CANVAS_WS_PATH}');
  ws.onmessage = function(e) {
    if (e.data === 'reload') {
      location.reload();
    }
  };
})();
</script>
`;

// ============ CanvasEngine 类 ============

export class CanvasEngine {
  private config: CanvasConfig;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private sockets = new Set<WebSocket>();
  private watcher: chokidar.FSWatcher | null = null;
  private browser: import("puppeteer").Browser | null = null;
  private page: import("puppeteer").Page | null = null;
  private history: CanvasHistory[] = [];
  private screenshots: ScreenshotRecord[] = [];
  private currentUrl: string = "";
  private currentTitle: string = "";
  private isRunning = false;

  constructor(config: Partial<CanvasConfig> = {}) {
    this.config = { ...DEFAULT_CANVAS_CONFIG, ...config };
  }

  // ============ 生命周期 ============

  /** 启动 Canvas 服务器 */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    // 确保目录存在
    await fs.mkdir(this.config.rootDir, { recursive: true });
    await fs.mkdir(this.config.screenshotDir, { recursive: true });

    // 创建 HTTP 服务器
    this.server = http.createServer(async (req, res) => {
      await this.handleHttpRequest(req, res);
    });

    // 创建 WebSocket 服务器 (用于热重载)
    if (this.config.liveReload) {
      this.wss = new WebSocketServer({ noServer: true });
      this.wss.on("connection", (ws) => {
        this.sockets.add(ws);
        ws.on("close", () => this.sockets.delete(ws));
      });

      this.server.on("upgrade", (req, socket: Socket, head) => {
        if (req.url === CANVAS_WS_PATH) {
          this.wss!.handleUpgrade(req, socket, head, (ws) => {
            this.wss!.emit("connection", ws, req);
          });
        }
      });
    }

    // 监听端口
    await new Promise<void>((resolve) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        resolve();
      });
    });

    // 启动文件监听器 (用于热重载)
    if (this.config.liveReload) {
      this.watcher = chokidar.watch(this.config.rootDir, {
        ignoreInitial: true,
        ignored: [/(^|[/\\])\../, /node_modules/],
      });
      this.watcher.on("all", () => this.broadcastReload());
    }

    this.isRunning = true;
  }

  /** 停止 Canvas 服务器 */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // 关闭浏览器
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }

    // 关闭文件监听器
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // 关闭 WebSocket 服务器
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
      this.wss = null;
    }

    // 关闭 HTTP 服务器
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    this.isRunning = false;
  }

  // ============ 核心 API ============

  /** 展示内容 (URL 或 HTML) */
  async present(request: CanvasPresentRequest): Promise<CanvasPresentResult> {
    await this.ensureStarted();

    let url: string;
    if (request.contentType === "url") {
      url = request.content;
    } else {
      // 将 HTML 内容写入临时文件
      const fileName = `canvas-${Date.now()}.html`;
      const filePath = path.join(this.config.rootDir, fileName);
      await fs.writeFile(filePath, this.injectReloadScript(request.content), "utf8");
      url = `http://${this.config.host}:${this.config.port}/${fileName}`;
    }

    this.currentUrl = url;
    
    // 使用 Puppeteer 获取页面标题
    try {
      const page = await this.getPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      this.currentTitle = await page.title();
    } catch (error) {
      // 即使 Puppeteer 失败，仍然返回 URL (HTTP 服务器可用)
    }

    this.addHistory("present", true, { url, title: this.currentTitle });

    return {
      success: true,
      url,
      title: this.currentTitle,
    };
  }

  /** 导航到 URL */
  async navigate(request: CanvasNavigateRequest): Promise<CanvasNavigateResult> {
    await this.ensureStarted();
    const page = await this.getPage();

    try {
      await page.goto(request.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      if (request.waitMs) {
        await new Promise((resolve) => setTimeout(resolve, request.waitMs));
      }

      this.currentUrl = request.url;
      this.currentTitle = await page.title();

      this.addHistory("navigate", true, { url: request.url, title: this.currentTitle });

      return {
        success: true,
        url: request.url,
        title: this.currentTitle,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addHistory("navigate", false, { url: request.url, error: errorMessage });
      return {
        success: false,
        url: request.url,
        error: errorMessage,
      };
    }
  }

  /** 执行 JavaScript */
  async eval(request: CanvasEvalRequest): Promise<CanvasEvalResult> {
    await this.ensureStarted();
    const page = await this.getPage();

    try {
      const result = await page.evaluate(request.code, {
        timeout: request.timeout || 5000,
      });

      this.addHistory("eval", true, { code: request.code.substring(0, 100) });

      return {
        success: true,
        result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addHistory("eval", false, { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /** 截取快照 */
  async snapshot(request: CanvasSnapshotRequest = {}): Promise<CanvasSnapshotResult> {
    await this.ensureStarted();
    const page = await this.getPage();

    try {
      const format = request.format || "png";
      const screenshotId = crypto.randomUUID();
      const fileName = `screenshot-${screenshotId}.${format}`;
      const outputPath = request.outputPath || path.join(this.config.screenshotDir, fileName);

      let screenshot: Buffer;
      if (request.selector) {
        const element = await page.$(request.selector);
        if (!element) {
          return {
            success: false,
            error: `Element not found: ${request.selector}`,
          };
        }
        screenshot = await element.screenshot({
          type: format,
          quality: format === "jpeg" ? (request.quality || 80) : undefined,
        });
      } else {
        screenshot = await page.screenshot({
          type: format,
          quality: format === "jpeg" ? (request.quality || 80) : undefined,
          fullPage: request.fullPage || false,
        });
      }

      // 如果指定了 maxWidth，调整大小
      if (request.maxWidth && screenshot.length > 0) {
        // 简化处理：直接保存原始截图
        // 实际应用中可以使用 sharp 等库进行缩放
      }

      await fs.writeFile(outputPath, screenshot);

      const record: ScreenshotRecord = {
        id: screenshotId,
        path: outputPath,
        createdAt: Date.now(),
        width: this.config.viewportWidth,
        height: this.config.viewportHeight,
        format,
        size: screenshot.length,
      };
      this.screenshots.push(record);

      this.addHistory("snapshot", true, { path: outputPath, format });

      return {
        success: true,
        path: outputPath,
        data: screenshot.toString("base64"),
        width: record.width,
        height: record.height,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addHistory("snapshot", false, { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /** 隐藏 Canvas */
  async hide(request: CanvasHideRequest = {}): Promise<CanvasHideResult> {
    if (request.shutdown) {
      await this.stop();
      this.addHistory("hide", true, { shutdown: true });
      return {
        success: true,
        message: "Canvas server shutdown complete",
      };
    }

    // 只是清除当前页面，不关闭服务器
    this.currentUrl = "";
    this.currentTitle = "";
    if (this.page) {
      await this.page.goto("about:blank");
    }

    this.addHistory("hide", true, { shutdown: false });
    return {
      success: true,
      message: "Canvas hidden (server still running)",
    };
  }

  /** 获取状态 */
  async status(): Promise<CanvasStatusResult> {
    return {
      running: this.isRunning,
      currentUrl: this.currentUrl,
      title: this.currentTitle,
      port: this.config.port,
      connections: this.sockets.size,
      screenshotCount: this.screenshots.length,
    };
  }

  /** 获取历史记录 */
  getHistory(limit = 100): CanvasHistory[] {
    return this.history.slice(-limit);
  }

  /** 获取截图历史 */
  getScreenshots(): ScreenshotRecord[] {
    return [...this.screenshots];
  }

  /** 清除历史记录 */
  clearHistory(): void {
    this.history = [];
    this.screenshots = [];
  }

  // ============ 私有方法 ============

  private async ensureStarted(): Promise<void> {
    if (!this.isRunning) {
      await this.start();
    }
  }

  private async getBrowser(): Promise<import("puppeteer").Browser> {
    if (!this.browser) {
      const puppeteer = await import("puppeteer");
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
    }
    return this.browser;
  }

  private async getPage(): Promise<import("puppeteer").Page> {
    if (!this.page) {
      const browser = await this.getBrowser();
      this.page = await browser.newPage();
      await this.page.setViewport({
        width: this.config.viewportWidth,
        height: this.config.viewportHeight,
      });
    }
    return this.page;
  }

  private async handleHttpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://localhost`);
    let filePath = path.join(this.config.rootDir, url.pathname);

    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
    } catch {
      // 文件不存在，尝试 index.html
      filePath = path.join(this.config.rootDir, "index.html");
    }

    try {
      let content = await fs.readFile(filePath, "utf8");

      // 如果是 HTML，注入热重载脚本
      if (filePath.endsWith(".html") && this.config.liveReload) {
        content = this.injectReloadScript(content);
      }

      const mime = this.getMimeType(filePath);
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "no-store");
      res.end(content);
    } catch (error) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("Not Found");
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimes: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
    };
    return mimes[ext] || "application/octet-stream";
  }

  private injectReloadScript(html: string): string {
    if (!this.config.liveReload) return html;
    // 在 </body> 前插入
    if (html.includes("</body>")) {
      return html.replace("</body>", `${CANVAS_RELOAD_SCRIPT}</body>`);
    }
    // 如果没有 </body>，追加到末尾
    return html + CANVAS_RELOAD_SCRIPT;
  }

  private broadcastReload(): void {
    for (const ws of this.sockets) {
      try {
        ws.send("reload");
      } catch {
        // 忽略错误
      }
    }
  }

  private addHistory(
    action: CanvasHistory["action"],
    success: boolean,
    details?: Record<string, unknown>
  ): void {
    this.history.push({
      id: crypto.randomUUID(),
      action,
      timestamp: Date.now(),
      success,
      details,
    });

    // 限制历史记录数量
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }
  }
}

// ============ 工具函数 ============

export function createDefaultConfig(): CanvasConfig {
  return { ...DEFAULT_CANVAS_CONFIG };
}
