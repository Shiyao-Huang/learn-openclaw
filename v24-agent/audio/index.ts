/**
 * v24-agent/audio/index.ts - 语音能力模块入口
 * 
 * V24: 语音能力 (Audio/Voice Capabilities)
 */

// 导出类型
export type {
  TTSProvider,
  TTSConfig,
  TTSRequest,
  TTSResult,
  AudioFile,
  PlaybackRequest,
  PlaybackResult,
  TTSHistory,
  VoiceOption,
  AudioAnalysis,
  AudioConfig,
} from "./types.js";

// 导出常量
export {
  SUPPORTED_AUDIO_FORMATS,
  DEFAULT_AUDIO_FORMAT,
  createDefaultConfig,
  EDGE_VOICES,
} from "./types.js";

// 导出 TTS 引擎
export { TTSEngine } from "./tts.js";

// 导出音频播放器
export { AudioPlayer } from "./player.js";

// 导出工具
export { getAudioTools } from "./tools.js";

// 导出处理器
export { createAudioHandlers } from "./handlers.js";
