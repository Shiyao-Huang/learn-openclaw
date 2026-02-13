/**
 * V26: Canvas 显示系统 - 模块入口
 */

// 核心引擎
export { CanvasEngine, createDefaultConfig } from "./canvas.js";

// 工具定义
export { getCanvasTools, CANVAS_TOOL_COUNT } from "./tools.js";

// 工具处理器
export { createCanvasHandlers, closeCanvasEngine } from "./handlers.js";

// 类型
export {
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
} from "./types.js";
