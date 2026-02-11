/**
 * browser/controller.ts - V20 浏览器控制器
 * 
 * 基于 CDP (Chrome DevTools Protocol) 的浏览器自动化
 * 简化版实现，支持核心浏览功能
 */

import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import WebSocket from "ws";
import type {
  BrowserConfig,
  BrowserSession,
  PageSnapshot,
  PageElement,
  ScreenshotOptions,
  NavigationOptions,
} from "./types.js";

// Chrome/Chromium 可执行文件路径检测
function findChromeExecutable(): string | null {
  const platform = os.platform();
  
  if (platform === "darwin") {
    const macPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === "linux") {
    const linuxPaths = [
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === "win32") {
    const winPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  
  // 尝试从环境变量获取
  return process.env.CHROME_PATH || process.env.CHROMIUM_PATH || null;
}

// 获取随机可用端口
async function getAvailablePort(): Promise<number> {
  const net = await import("net");
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

// CDP 请求辅助函数
async function cdpRequest(port: number, method: string, params?: any): Promise<any> {
  const response = await fetch(`http://127.0.0.1:${port}/json/${method}`, {
    method: params ? "POST" : "GET",
    headers: params ? { "Content-Type": "application/json" } : undefined,
    body: params ? JSON.stringify(params) : undefined,
  });
  return response.json();
}

// WebSocket CDP 命令
async function cdpCommand(ws: WebSocket, method: string, params?: any, timeout = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), timeout);
    
    ws.once("message", (data) => {
      clearTimeout(timer);
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch (e) {
        reject(e);
      }
    });
    
    ws.send(JSON.stringify({ id, method, params }));
  });
}

export class BrowserController {
  private sessions: Map<string, BrowserSession> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(os.tmpdir(), "v20-browser");
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * 启动浏览器
   */
  async start(config: BrowserConfig = {}): Promise<BrowserSession> {
    const chromePath = findChromeExecutable();
    if (!chromePath) {
      throw new Error("Chrome/Chromium not found. Set CHROME_PATH environment variable.");
    }

    const sessionId = `browser-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const port = await getAvailablePort();
    const userDataDir = config.userDataDir || path.join(this.dataDir, sessionId);

    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-features=TranslateUI",
      ...(config.headless !== false ? ["--headless=new"] : []),
      ...(config.viewport ? [
        `--window-size=${config.viewport.width},${config.viewport.height}`,
      ] : ["--window-size=1280,720"]),
      ...(config.args || []),
      "about:blank",
    ];

    const proc = spawn(chromePath, args, {
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const session: BrowserSession = {
      id: sessionId,
      pid: proc.pid,
      cdpPort: port,
      status: "starting",
      startedAt: Date.now(),
      lastActivity: Date.now(),
      config,
    };

    this.sessions.set(sessionId, session);
    this.processes.set(sessionId, proc);

    // 等待 CDP 就绪
    await this.waitForCdp(port, 30000);
    session.status = "ready";
    session.wsUrl = await this.getWebSocketUrl(port);

    return session;
  }

  /**
   * 等待 CDP 就绪
   */
  private async waitForCdp(port: number, timeout: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error("CDP failed to start within timeout");
  }

  /**
   * 获取 WebSocket URL
   */
  private async getWebSocketUrl(port: number): Promise<string> {
    const pages = await cdpRequest(port, "list");
    const page = pages.find((p: any) => p.type === "page");
    return page?.webSocketDebuggerUrl || "";
  }

  /**
   * 停止浏览器
   */
  async stop(sessionId: string): Promise<boolean> {
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1000));
      if (!proc.killed) proc.kill("SIGKILL");
    }
    this.processes.delete(sessionId);
    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * 导航到 URL
   */
  async navigate(sessionId: string, url: string, options: NavigationOptions = {}): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (!session.wsUrl) throw new Error("WebSocket not connected");

    session.status = "navigating";
    session.lastActivity = Date.now();

    const ws = new WebSocket(session.wsUrl);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    try {
      // 启用 Page 域
      await cdpCommand(ws, "Page.enable");
      
      // 导航
      const timeout = options.timeout || 30000;
      await cdpCommand(ws, "Page.navigate", { url }, timeout);
      
      // 等待加载完成
      const waitUntil = options.waitUntil || "load";
      if (waitUntil === "load" || waitUntil === "networkidle") {
        await new Promise((resolve) => {
          ws.once("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.method === "Page.loadEventFired") resolve(undefined);
          });
        });
      }
      
      session.currentUrl = url;
      session.status = "ready";
    } finally {
      ws.close();
    }
  }

  /**
   * 获取页面快照
   */
  async getSnapshot(sessionId: string): Promise<PageSnapshot> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (!session.wsUrl) throw new Error("WebSocket not connected");

    session.lastActivity = Date.now();

    const ws = new WebSocket(session.wsUrl);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    try {
      // 获取页面信息
      const { result: { value: title } } = await cdpCommand(ws, "Runtime.evaluate", {
        expression: "document.title",
        returnByValue: true,
      });

      // 获取页面文本内容
      const { result: { value: text } } = await cdpCommand(ws, "Runtime.evaluate", {
        expression: "document.body?.innerText || ''",
        returnByValue: true,
      });

      // 获取页面结构
      const { result: { value: elements } } = await cdpCommand(ws, "Runtime.evaluate", {
        expression: `
          (function() {
            function getElementInfo(el) {
              const info = {
                tag: el.tagName.toLowerCase(),
                text: el.innerText?.substring(0, 200),
                attributes: {},
                rect: el.getBoundingClientRect ? {
                  x: el.getBoundingClientRect().x,
                  y: el.getBoundingClientRect().y,
                  width: el.getBoundingClientRect().width,
                  height: el.getBoundingClientRect().height,
                } : undefined,
              };
              for (const attr of el.attributes || []) {
                info.attributes[attr.name] = attr.value;
              }
              return info;
            }
            
            const interactive = Array.from(document.querySelectorAll('a, button, input, textarea, select'));
            return interactive.map(getElementInfo).slice(0, 50);
          })()
        `,
        returnByValue: true,
      });

      return {
        url: session.currentUrl || "",
        title: title || "",
        text: text || "",
        elements: elements || [],
        timestamp: Date.now(),
      };
    } finally {
      ws.close();
    }
  }

  /**
   * 截图
   */
  async screenshot(sessionId: string, options: ScreenshotOptions = {}): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (!session.wsUrl) throw new Error("WebSocket not connected");

    session.lastActivity = Date.now();

    const ws = new WebSocket(session.wsUrl);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    try {
      const format = options.format || "png";
      const quality = format === "jpeg" ? (options.quality || 80) : undefined;

      let clip;
      if (options.fullPage) {
        const { result: { value: metrics } } = await cdpCommand(ws, "Runtime.evaluate", {
          expression: `({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })`,
          returnByValue: true,
        });
        clip = { x: 0, y: 0, width: metrics.width, height: metrics.height, scale: 1 };
      }

      const result = await cdpCommand(ws, "Page.captureScreenshot", {
        format,
        ...(quality !== undefined ? { quality } : {}),
        ...(clip ? { clip } : {}),
      });

      return Buffer.from(result.data, "base64");
    } finally {
      ws.close();
    }
  }

  /**
   * 点击元素
   */
  async click(sessionId: string, selector: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (!session.wsUrl) throw new Error("WebSocket not connected");

    session.lastActivity = Date.now();

    const ws = new WebSocket(session.wsUrl);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    try {
      // 先滚动到元素位置
      await cdpCommand(ws, "Runtime.evaluate", {
        expression: `
          (function() {
            const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
            if (el) {
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
              const rect = el.getBoundingClientRect();
              return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }
            return null;
          })()
        `,
        returnByValue: true,
      });

      // 执行点击
      await cdpCommand(ws, "Runtime.evaluate", {
        expression: `
          (function() {
            const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
            if (el) {
              el.click();
              return true;
            }
            return false;
          })()
        `,
        returnByValue: true,
      });
    } finally {
      ws.close();
    }
  }

  /**
   * 输入文本
   */
  async type(sessionId: string, selector: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (!session.wsUrl) throw new Error("WebSocket not connected");

    session.lastActivity = Date.now();

    const ws = new WebSocket(session.wsUrl);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    try {
      // 聚焦元素并输入
      await cdpCommand(ws, "Runtime.evaluate", {
        expression: `
          (function() {
            const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
            if (el) {
              el.focus();
              if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = '${text.replace(/'/g, "\\'")}';
              } else {
                el.innerText = '${text.replace(/'/g, "\\'")}';
              }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          })()
        `,
        returnByValue: true,
      });
    } finally {
      ws.close();
    }
  }

  /**
   * 执行 JavaScript
   */
  async evaluate(sessionId: string, script: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (!session.wsUrl) throw new Error("WebSocket not connected");

    session.lastActivity = Date.now();

    const ws = new WebSocket(session.wsUrl);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    try {
      const result = await cdpCommand(ws, "Runtime.evaluate", {
        expression: script,
        returnByValue: true,
        awaitPromise: true,
      });
      return result.result.value;
    } finally {
      ws.close();
    }
  }

  /**
   * 列出所有会话
   */
  listSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 清理所有会话
   */
  async cleanup(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.stop(id);
    }
    this.sessions.clear();
    this.processes.clear();
  }
}
