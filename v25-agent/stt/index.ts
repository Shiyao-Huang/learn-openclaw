/**
 * v25-agent/stt/index.ts - 语音识别模块入口
 * 
 * V25: 语音识别 (Speech-to-Text/ASR)
 */

// 导出类型
export type {
  STTProvider,
  STTConfig,
  TranscribeRequest,
  TranscribeResult,
  TranscriptSegment,
  STTHistory,
  STTModel,
} from "./types.js";

// 导出常量
export {
  SUPPORTED_AUDIO_FORMATS,
  DEFAULT_STT_CONFIG,
  OPENAI_WHISPER_MODELS,
  LOCAL_WHISPER_MODELS,
  createDefaultConfig,
} from "./types.js";

// 导出 STT 引擎
export { STTEngine, getAudioDuration } from "./stt.js";

// 导出工具
export { getSTTTools } from "./tools.js";

// 导出处理器
export { createSTTHandlers } from "./handlers.js";
