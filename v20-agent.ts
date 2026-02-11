/**
 * v20-agent.ts - OpenClaw V20: 浏览器自动化
 * 
 * V20 新增功能:
 * - browser_start/stop: 浏览器生命周期管理
 * - browser_navigate: 页面导航
 * - browser_snapshot: 页面内容快照
 * - browser_screenshot: 截图
 * - browser_click/type: 用户交互
 * - browser_evaluate: JavaScript 执行
 * - browser_list: 会话管理
 * 
 * 完整实现见 v20-agent/ 目录
 */

export { 
  BrowserController,
  getBrowserTools,
  createBrowserHandlers,
  type BrowserSession,
  type PageSnapshot,
  type ScreenshotOptions,
} from "./v20-agent/browser/index.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║           OpenClaw V20 - 浏览器自动化                     ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - browser_start:      启动浏览器实例                 ║
║    - browser_stop:       停止浏览器实例                 ║
║    - browser_navigate:   导航到指定URL                  ║
║    - browser_snapshot:   获取页面快照                   ║
║    - browser_screenshot: 截取页面截图                   ║
║    - browser_click:      点击页面元素                   ║
║    - browser_type:       在输入框中输入文本             ║
║    - browser_evaluate:   执行 JavaScript 代码           ║
║    - browser_list:       列出活动会话                   ║
║                                                           ║
║  核心能力:                                                ║
║    ✅ 基于 CDP (Chrome DevTools Protocol)               ║
║    ✅ 支持 Chrome/Chromium/Edge                         ║
║    ✅ 无头和有头模式                                    ║
║    ✅ 页面交互自动化                                    ║
║    ✅ 截图和快照功能                                    ║
║                                                           ║
║  环境变量:                                                ║
║    - CHROME_PATH: 指定 Chrome 可执行文件路径            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v20-agent/index.ts 启动完整系统");
  process.exit(0);
}
