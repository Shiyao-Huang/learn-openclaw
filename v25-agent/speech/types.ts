/**
 * V25: 语音识别 (STT) - 类型定义
 * 
 * 支持两种引擎:
 * - local: 本地 Whisper CLI (免费、离线)
 * - api: OpenAI Whisper API (高质量、云端)
 */

// ============ 引擎类型 ============

export type STTEngineType = 'local' | 'api';

export interface STTEngine {
  readonly type: STTEngineType;
  readonly name: string;
  
  // 检查引擎是否可用
  isAvailable(): Promise<boolean>;
  
  // 转录音频
  transcribe(request: STTRequest): Promise<STTResult>;
  
  // 获取支持的语言列表
  getSupportedLanguages(): Promise<string[]>;
}

// ============ 转录请求 ============

export interface STTRequest {
  // 音频源 (必填)
  source: AudioSource;
  
  // 模型选择
  model?: STTModel;
  
  // 输出格式
  outputFormat?: OutputFormat;
  
  // 输出目录 (可选，默认当前目录)
  outputDir?: string;
  
  // 语言提示 (可选，提高准确率)
  language?: string;
  
  // 初始提示词 (可选，提供上下文)
  prompt?: string;
  
  // 任务类型
  task?: 'transcribe' | 'translate';
  
  // 温度 (0-1，用于 API)
  temperature?: number;
}

export type AudioSource = 
  | { type: 'file'; path: string }
  | { type: 'url'; url: string }
  | { type: 'base64'; data: string; format: string };

// ============ 转录结果 ============

export interface STTResult {
  success: boolean;
  
  // 转录文本
  text?: string;
  
  // 输出文件路径
  outputPath?: string;
  
  // 检测到的语言
  detectedLanguage?: string;
  
  // 处理时长 (毫秒)
  duration?: number;
  
  // 使用的引擎
  engine: STTEngineType;
  
  // 错误信息
  error?: string;
  
  // 时间戳 (可选，用于字幕)
  timestamps?: TranscriptSegment[];
}

export interface TranscriptSegment {
  start: number; // 秒
  end: number;
  text: string;
}

// ============ 模型定义 ============

export type STTModel = 
  | 'tiny'      // 最快，准确率较低
  | 'base'      // 快速
  | 'small'     // 平衡
  | 'medium'    // 较准确
  | 'large'     // 最准确
  | 'turbo'     // V3 优化版
  | 'whisper-1' // API 版本
  ;

export type OutputFormat = 
  | 'txt'   // 纯文本
  | 'srt'   // 字幕格式
  | 'vtt'   // WebVTT 字幕
  | 'json'  // JSON 格式
  | 'tsv'   // TSV 格式
  ;

// ============ 引擎配置 ============

export interface LocalWhisperConfig {
  // Whisper CLI 命令路径
  whisperPath?: string;
  
  // 默认模型
  defaultModel?: STTModel;
  
  // 模型缓存目录
  cacheDir?: string;
  
  // 并发任务数
  concurrency?: number;
}

export interface APIWhisperConfig {
  // OpenAI API Key
  apiKey?: string;
  
  // API 基础 URL (可选，用于代理)
  baseUrl?: string;
  
  // 默认模型
  defaultModel?: 'whisper-1';
  
  // 超时时间 (毫秒)
  timeout?: number;
}

export interface STTConfig {
  // 优先使用的引擎
  preferredEngine: STTEngineType;
  
  // 本地引擎配置
  local: LocalWhisperConfig;
  
  // API 引擎配置
  api: APIWhisperConfig;
  
  // 转录历史保存路径
  historyPath?: string;
  
  // 最大历史记录数
  maxHistory?: number;
}

// ============ 历史记录 ============

export interface STTHistoryEntry {
  id: string;
  timestamp: string;
  request: STTRequest;
  result: STTResult;
}

// ============ 支持的格式 ============

export const SUPPORTED_AUDIO_FORMATS = [
  'mp3', 'mp4', 'mpeg', 'mpga',
  'm4a', 'wav', 'webm', 'ogg',
  'flac', 'aac'
] as const;

export const WHISPER_MODELS: Record<STTModel, { size: string; speed: string; accuracy: string }> = {
  tiny: { size: '39M', speed: '~32x', accuracy: '较低' },
  base: { size: '74M', speed: '~28x', accuracy: '一般' },
  small: { size: '244M', speed: '~15x', accuracy: '较好' },
  medium: { size: '769M', speed: '~7x', accuracy: '高' },
  large: { size: '1550M', speed: '~3x', accuracy: '最高' },
  turbo: { size: '809M', speed: '~8x', accuracy: '高 (优化版)' },
  'whisper-1': { size: 'API', speed: '~实时', accuracy: '最高 (云端)' },
};

// ============ 工具类型 ============

export interface TranscribeParams {
  source: string;
  model?: STTModel;
  format?: OutputFormat;
  language?: string;
  prompt?: string;
  task?: 'transcribe' | 'translate';
  engine?: STTEngineType;
}

export interface RecordParams {
  duration?: number;
  output?: string;
  device?: string;
}

export interface ConvertParams {
  input: string;
  output: string;
  format: string;
}
