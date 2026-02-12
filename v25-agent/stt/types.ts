/**
 * v25-agent/stt/types.ts - STT 类型定义
 * 
 * V25: 语音识别 (Speech-to-Text)
 */

/** STT 提供商 */
export type STTProvider = "openai" | "local" | "auto";

/** STT 配置 */
export interface STTConfig {
  /** 默认提供商 */
  defaultProvider: STTProvider;
  /** OpenAI API Key */
  openaiApiKey?: string;
  /** 本地 Whisper 模型路径 */
  localModelPath?: string;
  /** 默认语言 (auto = 自动检测) */
  defaultLanguage: string;
  /** 最大音频文件大小 (bytes) */
  maxFileSize: number;
  /** 最大音频时长 (秒) */
  maxDuration: number;
  /** 临时文件目录 */
  tempDir: string;
  /** 是否启用缓存 */
  enableCache: boolean;
}

/** 转录请求 */
export interface TranscribeRequest {
  /** 音频源: 本地路径、URL 或 base64 */
  source: string;
  /** 源类型 */
  sourceType: "file" | "url" | "base64";
  /** 语言 (可选，默认自动检测) */
  language?: string;
  /** 提供商 (可选) */
  provider?: STTProvider;
  /** 模型 (可选) */
  model?: string;
  /** 输出格式 */
  outputFormat?: "text" | "json" | "srt" | "vtt";
  /** 是否返回时间戳 */
  enableTimestamps?: boolean;
}

/** 转录结果 */
export interface TranscribeResult {
  /** 是否成功 */
  success: boolean;
  /** 转录文本 */
  text: string;
  /** 检测到的语言 */
  language?: string;
  /** 语言置信度 */
  languageProbability?: number;
  /** 时间戳 (如果启用) */
  segments?: TranscriptSegment[];
  /** 音频时长 (秒) */
  duration?: number;
  /** 错误信息 */
  error?: string;
  /** 使用的提供商 */
  provider: STTProvider;
  /** 使用的模型 */
  model: string;
}

/** 转录片段 (带时间戳) */
export interface TranscriptSegment {
  id: number;
  start: number;  // 秒
  end: number;    // 秒
  text: string;
}

/** STT 历史记录 */
export interface STTHistory {
  id: string;
  timestamp: string;
  source: string;
  sourceType: "file" | "url" | "base64";
  text: string;
  language?: string;
  duration?: number;
  provider: STTProvider;
  model: string;
}

/** 可用模型 */
export interface STTModel {
  id: string;
  name: string;
  provider: STTProvider;
  description: string;
  languages: string[];
}

/** 支持的音频格式 */
export const SUPPORTED_AUDIO_FORMATS = [
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".m4a",
  ".wav",
  ".webm",
  ".flac",
  ".ogg",
  ".oga",
];

/** 默认配置 */
export const DEFAULT_STT_CONFIG: STTConfig = {
  defaultProvider: "auto",
  defaultLanguage: "auto",
  maxFileSize: 25 * 1024 * 1024,  // 25 MB (OpenAI 限制)
  maxDuration: 600,  // 10 分钟
  tempDir: "./temp/stt",
  enableCache: true,
};

/** 可用的 OpenAI Whisper 模型 */
export const OPENAI_WHISPER_MODELS: STTModel[] = [
  {
    id: "whisper-1",
    name: "Whisper V3",
    provider: "openai",
    description: "OpenAI Whisper API，高质量转录",
    languages: ["auto", "zh", "en", "ja", "ko", "fr", "de", "es", "it", "pt", "ru"],
  },
];

/** 可用的本地模型 */
export const LOCAL_WHISPER_MODELS: STTModel[] = [
  {
    id: "tiny",
    name: "Whisper Tiny",
    provider: "local",
    description: "最快的模型，较低精度",
    languages: ["auto", "zh", "en"],
  },
  {
    id: "base",
    name: "Whisper Base",
    provider: "local",
    description: "快速模型，基础精度",
    languages: ["auto", "zh", "en"],
  },
  {
    id: "small",
    name: "Whisper Small",
    provider: "local",
    description: "平衡速度和精度",
    languages: ["auto", "zh", "en", "ja"],
  },
  {
    id: "medium",
    name: "Whisper Medium",
    provider: "local",
    description: "高精度，较慢",
    languages: ["auto", "zh", "en", "ja", "ko"],
  },
  {
    id: "large",
    name: "Whisper Large",
    provider: "local",
    description: "最高精度，最慢",
    languages: ["auto", "zh", "en", "ja", "ko", "fr", "de", "es"],
  },
];

/** 创建默认配置 */
export function createDefaultConfig(): STTConfig {
  return {
    ...DEFAULT_STT_CONFIG,
    openaiApiKey: process.env.OPENAI_API_KEY,
  };
}
