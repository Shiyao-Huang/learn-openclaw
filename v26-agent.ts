/**
 * v26-agent.ts - OpenClaw V26: Canvas 显示系统
 * 
 * V26 新增功能:
 * - canvas_present: 展示内容 (URL/HTML)
 * - canvas_navigate: 导航到 URL
 * - canvas_eval: 执行 JavaScript
 * - canvas_snapshot: 截取快照
 * - canvas_hide: 隐藏 Canvas
 * - canvas_status: 获取状态
 * - canvas_history: 操作历史
 * - canvas_screenshots: 截图列表
 * - canvas_clear: 清除历史
 * 
 * 完整实现见 v26-agent/ 目录
 */

export {
  CanvasEngine,
  createDefaultConfig,
  getCanvasTools,
  createCanvasHandlers,
  closeCanvasEngine,
  CANVAS_TOOL_COUNT,
  DEFAULT_CANVAS_CONFIG,
  type CanvasConfig,
  type CanvasPresentRequest,
  type CanvasPresentResult,
  type CanvasNavigateRequest,
  type CanvasNavigateResult,
  type CanvasEvalRequest,
  type CanvasEvalResult,
  type CanvasSnapshotRequest,
  type CanvasSnapshotResult,
  type CanvasHideRequest,
  type CanvasHideResult,
  type CanvasStatusResult,
  type CanvasHistory,
  type ScreenshotRecord,
} from "./v26-agent/canvas/index.js";

// 继承 V25 语音识别 (STT)
export {
  STTEngine,
  getSTTTools,
  createSTTHandlers,
  DEFAULT_STT_CONFIG,
  SUPPORTED_AUDIO_FORMATS,
  OPENAI_WHISPER_MODELS,
  LOCAL_WHISPER_MODELS,
  type STTConfig,
  type TranscribeRequest,
  type TranscribeResult,
} from "./v25-agent/stt/index.js";

// 版本信息
export const VERSION = "v26";
export const VERSION_NAME = "Canvas 显示系统";
export const TOOL_COUNT = 143; // V25 的 134 + V26 的 9

console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V26 - Canvas 显示系统               ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (Canvas):                                       ║
║    - canvas_present:     展示内容 (URL/HTML)            ║
║    - canvas_navigate:    导航到 URL                     ║
║    - canvas_eval:        执行 JavaScript                ║
║    - canvas_snapshot:    截取快照                       ║
║    - canvas_hide:        隐藏 Canvas                    ║
║    - canvas_status:      获取状态                       ║
║    - canvas_history:     操作历史                       ║
║    - canvas_screenshots: 截图列表                       ║
║    - canvas_clear:       清除历史                       ║
║                                                           ║
║  特性:                                                    ║
║    ✅ 本地 HTTP 服务器                                  ║
║    ✅ Puppeteer 截图和 JS 执行                          ║
║    ✅ 热重载支持                                        ║
║    ✅ 支持 HTML 和 URL 两种内容类型                     ║
║    ✅ 全页面和元素截图                                  ║
║                                                           ║
║  继承 V25 能力 (STT):                                     ║
║    ✅ OpenAI Whisper API (云端)                         ║
║    ✅ 本地 Whisper CLI (离线)                           ║
║    ✅ 多种音频格式支持                                  ║
║                                                           ║
║  工具总数: 143 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v26-agent/index.ts 启动完整系统");
  process.exit(0);
}
