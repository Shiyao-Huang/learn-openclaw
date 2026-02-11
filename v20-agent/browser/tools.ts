/**
 * browser/tools.ts - V20 浏览器工具定义
 */

import { BrowserController } from "./controller.js";

export function getBrowserTools(): any[] {
  return [
    {
      name: "browser_start",
      description: "启动浏览器实例。返回浏览器会话ID和状态。如未安装Chrome/Chromium，设置CHROME_PATH环境变量。",
      input_schema: {
        type: "object",
        properties: {
          headless: {
            type: "boolean",
            description: "是否无头模式（默认true）",
          },
          viewport: {
            type: "object",
            description: "视口大小",
            properties: {
              width: { type: "number" },
              height: { type: "number" },
            },
          },
        },
      },
    },
    {
      name: "browser_stop",
      description: "停止浏览器实例",
      input_schema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "浏览器会话ID",
          },
        },
        required: ["sessionId"],
      },
    },
    {
      name: "browser_navigate",
      description: "导航到指定URL",
      input_schema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "浏览器会话ID",
          },
          url: {
            type: "string",
            description: "目标URL",
          },
          waitUntil: {
            type: "string",
            enum: ["load", "domcontentloaded", "networkidle"],
            description: "等待条件",
          },
        },
        required: ["sessionId", "url"],
      },
    },
    {
      name: "browser_snapshot",
      description: "获取页面快照，包括标题、文本内容和可交互元素列表",
      input_schema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "浏览器会话ID",
          },
        },
        required: ["sessionId"],
      },
    },
    {
      name: "browser_screenshot",
      description: "截取页面截图",
      input_schema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "浏览器会话ID",
          },
          fullPage: {
            type: "boolean",
            description: "是否截取完整页面",
          },
          format: {
            type: "string",
            enum: ["png", "jpeg"],
            description: "图片格式",
          },
        },
        required: ["sessionId"],
      },
    },
    {
      name: "browser_click",
      description: "点击页面元素",
      input_schema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "浏览器会话ID",
          },
          selector: {
            type: "string",
            description: "CSS选择器",
          },
        },
        required: ["sessionId", "selector"],
      },
    },
    {
      name: "browser_type",
      description: "在输入框中输入文本",
      input_schema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "浏览器会话ID",
          },
          selector: {
            type: "string",
            description: "输入框CSS选择器",
          },
          text: {
            type: "string",
            description: "要输入的文本",
          },
        },
        required: ["sessionId", "selector", "text"],
      },
    },
    {
      name: "browser_evaluate",
      description: "在页面中执行JavaScript代码",
      input_schema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "浏览器会话ID",
          },
          script: {
            type: "string",
            description: "JavaScript代码",
          },
        },
        required: ["sessionId", "script"],
      },
    },
    {
      name: "browser_list",
      description: "列出所有活动的浏览器会话",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
  ];
}

export function createBrowserHandlers(controller: BrowserController) {
  return {
    browser_start: async (args: any) => {
      try {
        const session = await controller.start({
          headless: args.headless,
          viewport: args.viewport,
        });
        return `✅ Browser started\nSession ID: ${session.id}\nStatus: ${session.status}\nCDP Port: ${session.cdpPort}`;
      } catch (error: any) {
        return `❌ Failed to start browser: ${error.message}`;
      }
    },

    browser_stop: async (args: any) => {
      try {
        await controller.stop(args.sessionId);
        return `✅ Browser stopped: ${args.sessionId}`;
      } catch (error: any) {
        return `❌ Failed to stop browser: ${error.message}`;
      }
    },

    browser_navigate: async (args: any) => {
      try {
        await controller.navigate(args.sessionId, args.url, {
          waitUntil: args.waitUntil,
        });
        return `✅ Navigated to: ${args.url}`;
      } catch (error: any) {
        return `❌ Navigation failed: ${error.message}`;
      }
    },

    browser_snapshot: async (args: any) => {
      try {
        const snapshot = await controller.getSnapshot(args.sessionId);
        let output = `📸 Page Snapshot\n`;
        output += `URL: ${snapshot.url}\n`;
        output += `Title: ${snapshot.title}\n\n`;
        output += `Content Preview:\n${snapshot.text.substring(0, 500)}...\n\n`;
        output += `Interactive Elements (${snapshot.elements.length}):\n`;
        snapshot.elements.forEach((el, i) => {
          const text = el.text ? ` "${el.text.substring(0, 30)}"` : "";
          output += `  [${i}] <${el.tag}>${text}\n`;
        });
        return output;
      } catch (error: any) {
        return `❌ Failed to get snapshot: ${error.message}`;
      }
    },

    browser_screenshot: async (args: any) => {
      try {
        const buffer = await controller.screenshot(args.sessionId, {
          fullPage: args.fullPage,
          format: args.format,
        });
        // 保存到文件
        const fs = await import("fs");
        const path = await import("path");
        const os = await import("os");
        const filename = `screenshot-${Date.now()}.${args.format || "png"}`;
        const filepath = path.join(os.tmpdir(), filename);
        fs.writeFileSync(filepath, buffer);
        return `✅ Screenshot saved: ${filepath} (${buffer.length} bytes)`;
      } catch (error: any) {
        return `❌ Screenshot failed: ${error.message}`;
      }
    },

    browser_click: async (args: any) => {
      try {
        await controller.click(args.sessionId, args.selector);
        return `✅ Clicked: ${args.selector}`;
      } catch (error: any) {
        return `❌ Click failed: ${error.message}`;
      }
    },

    browser_type: async (args: any) => {
      try {
        await controller.type(args.sessionId, args.selector, args.text);
        return `✅ Typed into: ${args.selector}`;
      } catch (error: any) {
        return `❌ Type failed: ${error.message}`;
      }
    },

    browser_evaluate: async (args: any) => {
      try {
        const result = await controller.evaluate(args.sessionId, args.script);
        return `✅ Script executed\nResult: ${JSON.stringify(result, null, 2)}`;
      } catch (error: any) {
        return `❌ Script execution failed: ${error.message}`;
      }
    },

    browser_list: () => {
      const sessions = controller.listSessions();
      if (sessions.length === 0) return "No active browser sessions";
      
      let output = `🌐 Active Browser Sessions (${sessions.length}):\n\n`;
      sessions.forEach((s) => {
        output += `ID: ${s.id}\n`;
        output += `  Status: ${s.status}\n`;
        output += `  URL: ${s.currentUrl || "N/A"}\n`;
        output += `  Port: ${s.cdpPort}\n`;
        output += `  Started: ${new Date(s.startedAt).toLocaleString()}\n\n`;
      });
      return output;
    },
  };
}
