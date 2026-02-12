/**
 * v25-agent/index.ts - V25: 语音识别 (STT)
 * 
 * 在 V24 基础上增加语音识别能力
 * 继承: V24(audio) + V23(vision) + V22(sandbox) + V21(cron) + V20(browser) + ... + V11
 */

// ============ V25 新增: 语音识别模块 ============
export * from "./stt/index.js";

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

// ============ V25 版本信息 ============
export const VERSION = "v25";
export const VERSION_NAME = "语音识别 (STT)";
export const VERSION_FEATURES = [
  "stt_transcribe - 语音转文字",
  "stt_list_models - 获取可用模型",
  "stt_history - 转录历史",
  "stt_supported_formats - 支持的格式",
  "stt_clear_history - 清除历史",
  // 继承 V24 的 6 个 TTS 工具
  "tts_synthesize - 文字转语音",
  "tts_list_voices - 可用语音",
  "tts_history - TTS 历史",
  "tts_delete - 删除音频",
  "audio_play - 播放音频",
  "audio_volume - 音量控制",
  // 继承 V23 的 5 个 Vision 工具
  "vision_analyze - 图像分析",
  "vision_ocr - 文字识别",
  "vision_compare - 图像对比",
  "vision_describe - 图像描述",
  "vision_history - 分析历史",
  // ... 更多继承工具
];

/** 获取 V25 的工具总数 */
export function getToolCount(): number {
  // V25 新增: 5 个 STT 工具
  // V24: 6 个 TTS 工具
  // V23: 68 个 Vision 工具
  // V22: 5 个沙箱工具
  // V21: 8 个定时任务工具
  // V20: 9 个浏览器工具
  // V19: 2 个持久化工具
  // V18: 3 个协作工具
  // V17: 2 个外部工具
  // V16: 7 个工作流工具
  // V15: 5 个多模型工具
  // V14: 5 个插件工具
  // V13: 5 个进化工具
  // V12: 4 个安全工具
  // V11: 28 个基础工具
  return 5 + 129; // = 134 (V24 的 129 + V25 的 5)
}
