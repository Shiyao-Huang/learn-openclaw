/**
 * v24-agent/audio/types.ts - 语音能力模块类型定义
 * 
 * V24: 语音能力 (Audio/Voice Capabilities)
 * - TTS (文字转语音)
 * - 语音文件管理
 * - 播放控制
 */

/** 支持的 TTS 提供商 */
export type TTSProvider = "edge" | "openai" | "elevenlabs" | "local";

/** 语音配置 */
export interface TTSConfig {
  provider: TTSProvider;
  voice: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}

/** TTS 请求 */
export interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
  outputPath?: string;
  provider?: TTSProvider;
}

/** TTS 结果 */
export interface TTSResult {
  success: boolean;
  audioPath: string;
  duration?: number;
  format: string;
  text: string;
  error?: string;
}

/** 音频文件信息 */
export interface AudioFile {
  id: string;
  path: string;
  text: string;
  createdAt: number;
  duration?: number;
  format: string;
  size: number;
}

/** 语音播放请求 */
export interface PlaybackRequest {
  audioPath: string;
  device?: string;
  volume?: number;
}

/** 语音播放结果 */
export interface PlaybackResult {
  success: boolean;
  error?: string;
}

/** 支持的音频格式 */
export const SUPPORTED_AUDIO_FORMATS = [
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/m4a",
  "audio/aac",
];

/** 默认音频格式 */
export const DEFAULT_AUDIO_FORMAT = "mp3";

/** TTS 历史记录 */
export interface TTSHistory {
  id: string;
  timestamp: number;
  text: string;
  audioPath: string;
  duration?: number;
  provider: TTSProvider;
  voice: string;
}

/** 可用的语音列表 */
export interface VoiceOption {
  id: string;
  name: string;
  language: string;
  gender?: "male" | "female" | "neutral";
  provider: TTSProvider;
}

/** 音频分析结果 */
export interface AudioAnalysis {
  duration: number;
  sampleRate: number;
  channels: number;
  bitRate: number;
  format: string;
}

/** 音频配置 */
export interface AudioConfig {
  defaultProvider: TTSProvider;
  defaultVoice: string;
  defaultSpeed: number;
  outputDir: string;
  maxTextLength: number;
  supportedFormats: string[];
  enableCache: boolean;
}

/** 创建默认配置 */
export function createDefaultConfig(outputDir: string): AudioConfig {
  return {
    defaultProvider: "edge",
    defaultVoice: "zh-CN-XiaoxiaoNeural",
    defaultSpeed: 1.0,
    outputDir,
    maxTextLength: 5000,
    supportedFormats: SUPPORTED_AUDIO_FORMATS,
    enableCache: true,
  };
}

/** Edge TTS 语音选项 */
export const EDGE_VOICES: VoiceOption[] = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓", language: "zh-CN", gender: "female", provider: "edge" },
  { id: "zh-CN-YunxiNeural", name: "云希", language: "zh-CN", gender: "male", provider: "edge" },
  { id: "zh-CN-YunjianNeural", name: "云健", language: "zh-CN", gender: "male", provider: "edge" },
  { id: "en-US-AriaNeural", name: "Aria", language: "en-US", gender: "female", provider: "edge" },
  { id: "en-US-GuyNeural", name: "Guy", language: "en-US", gender: "male", provider: "edge" },
  { id: "ja-JP-NanamiNeural", name: "七海", language: "ja-JP", gender: "female", provider: "edge" },
];
