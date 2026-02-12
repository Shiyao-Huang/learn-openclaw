/**
 * v25-agent.ts - OpenClaw V25: 语音识别 (STT)
 * 
 * V25 新增功能:
 * - stt_transcribe: 语音转文字
 * - stt_list_models: 获取可用模型列表
 * - stt_history: 转录历史记录
 * - stt_supported_formats: 支持的音频格式
 * - stt_clear_history: 清除历史记录
 * 
 * 完整实现见 v25-agent/ 目录
 */

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

// 继承 V24 语音能力 (TTS)
export {
  TTSEngine,
  AudioPlayer,
  getAudioTools,
  createAudioHandlers,
  createDefaultConfig,
  EDGE_VOICES,
  DEFAULT_AUDIO_FORMAT,
  type TTSRequest,
  type TTSResult,
  type TTSHistory,
  type VoiceOption,
  type AudioConfig,
} from "./v24-agent/audio/index.js";

// 版本信息
export const VERSION = "v25";
export const VERSION_NAME = "语音识别 (STT)";
export const TOOL_COUNT = 134; // V24 的 129 + V25 的 5

console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V25 - 语音识别                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (STT):                                          ║
║    - stt_transcribe:       语音转文字                    ║
║    - stt_list_models:      获取可用模型                  ║
║    - stt_history:          转录历史                      ║
║    - stt_supported_formats: 支持的格式                   ║
║    - stt_clear_history:    清除历史                      ║
║                                                           ║
║  支持的 STT 引擎:                                         ║
║    ✅ OpenAI Whisper API (云端)                         ║
║    ✅ 本地 Whisper CLI (离线)                           ║
║                                                           ║
║  本地模型选项:                                            ║
║    ✅ tiny (39M, ~32x 速度)                             ║
║    ✅ base (74M, ~28x 速度)                             ║
║    ✅ small (244M, ~15x 速度)                           ║
║    ✅ medium (769M, ~7x 速度)                           ║
║    ✅ large (1550M, ~3x 速度, 最高准确率)              ║
║    ✅ turbo (809M, ~8x 速度, 优化版)                    ║
║                                                           ║
║  支持的音频格式:                                          ║
║    ✅ mp3, wav, m4a, webm, ogg, flac, aac               ║
║                                                           ║
║  继承 V24 能力 (TTS):                                     ║
║    ✅ Edge TTS (免费, 多语言)                           ║
║    ✅ macOS Say (本地)                                  ║
║                                                           ║
║  工具总数: 134 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v25-agent/index.ts 启动完整系统");
  process.exit(0);
}
