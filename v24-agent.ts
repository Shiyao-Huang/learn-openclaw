/**
 * v24-agent.ts - OpenClaw V24: 语音能力
 * 
 * V24 新增功能:
 * - tts_synthesize: 文字转语音
 * - tts_list_voices: 获取可用语音列表
 * - tts_history: TTS历史记录
 * - tts_delete: 删除音频文件
 * - audio_play: 播放音频
 * - audio_volume: 音量控制
 * 
 * 完整实现见 v24-agent/ 目录
 */

export {
  TTSEngine,
  AudioPlayer,
  getAudioTools,
  createAudioHandlers,
  createDefaultConfig,
  EDGE_VOICES,
  SUPPORTED_AUDIO_FORMATS,
  DEFAULT_AUDIO_FORMAT,
  type TTSRequest,
  type TTSResult,
  type TTSHistory,
  type VoiceOption,
  type AudioConfig,
} from "./v24-agent/audio/index.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V24 - 语音能力                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - tts_synthesize:    文字转语音 (TTS)                ║
║    - tts_list_voices:   获取可用语音列表                ║
║    - tts_history:       TTS 历史记录                    ║
║    - tts_delete:        删除音频文件                    ║
║    - audio_play:        播放音频                        ║
║    - audio_volume:      音量控制                        ║
║                                                           ║
║  支持的 TTS 引擎:                                         ║
║    ✅ Edge TTS (免费, 质量高)                           ║
║    ✅ macOS Say (本地)                                  ║
║                                                           ║
║  语音选项:                                                ║
║    ✅ 中文 (晓晓、云希、云健)                           ║
║    ✅ 英文 (Aria、Guy)                                  ║
║    ✅ 日语 (七海)                                       ║
║                                                           ║
║  播放支持:                                                ║
║    ✅ macOS (afplay)                                    ║
║    ✅ Linux (paplay/aplay)                              ║
║    ✅ Windows (PowerShell)                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v24-agent/index.ts 启动完整系统");
  process.exit(0);
}
