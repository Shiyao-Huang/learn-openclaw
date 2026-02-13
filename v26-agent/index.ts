/**
 * v26-agent/index.ts - V26: Canvas 显示系统
 * 
 * 在 V25 基础上增加 Canvas 显示能力
 * 继承: V25(stt) + V24(audio) + V23(vision) + V22(sandbox) + V21(cron) + ... + V11
 */

// ============ V26 新增: Canvas 显示模块 ============
export * from "./canvas/index.js";

// ============ 继承 V25: 语音识别 (STT) ============
export * from "../v25-agent/stt/index.js";

// ============ 继承 V24: 语音能力 (TTS) ============
export * from "../v24-agent/audio/index.js";

// ============ 继承 V23: 图像理解 (Vision) ============
export * from "../v23-agent/vision/index.js";

// ============ 继承 V22: 代码执行沙箱 ============
export * from "../v22-agent/sandbox/index.js";

// ============ 继承 V21: 定时任务系统 ============
export * from "../v21-agent/cron/index.js";

// ============ 继承 V20: 浏览器自动化 ============
export * from "../v20-agent/browser/index.js";

// ============ 继承 V19: 持久化与恢复 ============
export * from "../v19-agent/persistence/index.js";

// ============ 继承 V18: 团队协作 ============
export * from "../v18-agent/collaboration/index.js";

// ============ 继承 V17: 外部集成 ============
export * from "../v17-agent/external/index.js";

// ============ 继承 V16: 工作流引擎 ============
export * from "../v16-agent/workflow/index.js";

// ============ 继承 V15: 多模型协作 ============
export * from "../v15-agent/multimodel/index.js";

// ============ 继承 V14: 插件系统 ============
export * from "../v14-agent/plugins/index.js";

// ============ 继承 V13: 自进化系统 ============
export * from "../v13-agent/evolution/index.js";

// ============ 继承 V12: 安全策略系统 ============
export * from "../v12-agent/security/index.js";

// ============ 继承 V11: 基础模块化架构 ============
export * from "../v11-agent/index.js";

// ============ V26 版本信息 ============
export const VERSION = "v26";
export const VERSION_NAME = "Canvas 显示系统";
export const VERSION_FEATURES = [
  // V26 新增的 9 个 Canvas 工具
  "canvas_present - 展示内容",
  "canvas_navigate - 导航 URL",
  "canvas_eval - 执行 JavaScript",
  "canvas_snapshot - 截取快照",
  "canvas_hide - 隐藏 Canvas",
  "canvas_status - 获取状态",
  "canvas_history - 操作历史",
  "canvas_screenshots - 截图列表",
  "canvas_clear - 清除历史",
  // 继承 V25 的 5 个 STT 工具
  "stt_transcribe - 语音转文字",
  "stt_list_models - 可用模型",
  "stt_history - 转录历史",
  "stt_supported_formats - 支持格式",
  "stt_clear_history - 清除历史",
  // ... 更多继承工具
];

/** 获取 V26 的工具总数 */
export function getToolCount(): number {
  // V26 新增: 9 个 Canvas 工具
  // V25: 134 个工具
  return 9 + 134; // = 143
}
