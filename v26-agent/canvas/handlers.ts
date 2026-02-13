/**
 * V26: Canvas 显示系统 - 工具处理器
 */

import type { ToolHandler } from "../../v11-agent/types.js";
import { CanvasEngine, createDefaultConfig } from "./canvas.js";
import type {
  CanvasPresentRequest,
  CanvasNavigateRequest,
  CanvasEvalRequest,
  CanvasSnapshotRequest,
  CanvasHideRequest,
} from "./types.js";

// 全局 Canvas 引擎实例
let canvasEngine: CanvasEngine | null = null;

/** 获取或创建 Canvas 引擎 */
function getEngine(): CanvasEngine {
  if (!canvasEngine) {
    canvasEngine = new CanvasEngine(createDefaultConfig());
  }
  return canvasEngine;
}

/** 创建 Canvas 工具处理器 */
export function createCanvasHandlers(): Record<string, ToolHandler> {
  return {
    canvas_present: async (params: CanvasPresentRequest) => {
      const engine = getEngine();
      return await engine.present(params);
    },

    canvas_navigate: async (params: CanvasNavigateRequest) => {
      const engine = getEngine();
      return await engine.navigate(params);
    },

    canvas_eval: async (params: CanvasEvalRequest) => {
      const engine = getEngine();
      return await engine.eval(params);
    },

    canvas_snapshot: async (params: CanvasSnapshotRequest = {}) => {
      const engine = getEngine();
      return await engine.snapshot(params);
    },

    canvas_hide: async (params: CanvasHideRequest = {}) => {
      const engine = getEngine();
      return await engine.hide(params);
    },

    canvas_status: async () => {
      const engine = getEngine();
      return await engine.status();
    },

    canvas_history: async (params: { limit?: number } = {}) => {
      const engine = getEngine();
      const history = engine.getHistory(params.limit || 100);
      return {
        success: true,
        count: history.length,
        history,
      };
    },

    canvas_screenshots: async () => {
      const engine = getEngine();
      const screenshots = engine.getScreenshots();
      return {
        success: true,
        count: screenshots.length,
        screenshots,
      };
    },

    canvas_clear: async () => {
      const engine = getEngine();
      engine.clearHistory();
      return {
        success: true,
        message: "Canvas history cleared",
      };
    },
  };
}

/** 关闭 Canvas 引擎 */
export async function closeCanvasEngine(): Promise<void> {
  if (canvasEngine) {
    await canvasEngine.stop();
    canvasEngine = null;
  }
}
