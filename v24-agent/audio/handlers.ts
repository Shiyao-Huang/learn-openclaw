/**
 * v24-agent/audio/handlers.ts - 语音能力工具处理器
 */

import * as fs from "fs";
import { TTSEngine } from "./tts.js";
import { AudioPlayer } from "./player.js";
import type { AudioConfig } from "./types.js";
import { EDGE_VOICES } from "./types.js";

/** 创建语音能力工具处理器 */
export function createAudioHandlers(config: AudioConfig) {
  const ttsEngine = new TTSEngine(config);
  const audioPlayer = new AudioPlayer();

  return {
    /** tts_synthesize: 文字转语音 */
    async tts_synthesize(args: {
      text: string;
      voice?: string;
      speed?: number;
      output_path?: string;
    }) {
      const result = await ttsEngine.synthesize({
        text: args.text,
        voice: args.voice,
        speed: args.speed,
        outputPath: args.output_path,
      });

      if (!result.success) {
        return {
          type: "error" as const,
          error: result.error || "TTS 合成失败",
        };
      }

      return {
        type: "result" as const,
        content: [
          {
            type: "text" as const,
            text: `✅ TTS 合成成功!\n\n📁 音频文件: ${result.audioPath}\n⏱️ 预计时长: ${result.duration ? `${result.duration.toFixed(1)}秒` : "未知"}\n📝 文本长度: ${args.text.length} 字符`,
          },
        ],
      };
    },

    /** tts_list_voices: 获取可用语音列表 */
    async tts_list_voices(args: { language?: string }) {
      let voices = ttsEngine.getAvailableVoices();

      if (args.language) {
        voices = voices.filter(v => v.language.startsWith(args.language!));
      }

      const voiceList = voices.map(v => 
        `- ${v.id}: ${v.name} (${v.language}, ${v.gender === "male" ? "男" : v.gender === "female" ? "女" : "中性"})`
      ).join("\n");

      return {
        type: "result" as const,
        content: [
          {
            type: "text" as const,
            text: `🎙️ 可用语音列表 (${voices.length} 个):\n\n${voiceList}\n\n💡 常用推荐:\n- zh-CN-XiaoxiaoNeural: 中文女声 (晓晓)\n- zh-CN-YunxiNeural: 中文男声 (云希)\n- en-US-AriaNeural: 英文女声`,
          },
        ],
      };
    },

    /** tts_history: 查看历史记录 */
    async tts_history(args: { limit?: number }) {
      const history = ttsEngine.getHistory(args.limit || 10);

      if (history.length === 0) {
        return {
          type: "result" as const,
          content: [
            { type: "text" as const, text: "📭 暂无 TTS 历史记录" },
          ],
        };
      }

      const historyText = history.map((h, i) => {
        const date = new Date(h.timestamp).toLocaleString("zh-CN");
        const preview = h.text.slice(0, 50) + (h.text.length > 50 ? "..." : "");
        return `${i + 1}. [${date}]\n   文本: ${preview}\n   文件: ${h.audioPath}\n   时长: ${h.duration ? `${h.duration.toFixed(1)}秒` : "未知"}`;
      }).join("\n\n");

      return {
        type: "result" as const,
        content: [
          {
            type: "text" as const,
            text: `📜 TTS 历史记录 (${history.length} 条):\n\n${historyText}`,
          },
        ],
      };
    },

    /** tts_delete: 删除音频文件 */
    async tts_delete(args: { audio_path: string }) {
      const success = ttsEngine.deleteAudio(args.audio_path);

      if (success) {
        return {
          type: "result" as const,
          content: [
            { type: "text" as const, text: `✅ 已删除音频文件: ${args.audio_path}` },
          ],
        };
      }

      return {
        type: "error" as const,
        error: `删除失败: 文件不存在或无法访问`,
      };
    },

    /** audio_play: 播放音频 */
    async audio_play(args: { audio_path: string; volume?: number }) {
      const result = await audioPlayer.play({
        audioPath: args.audio_path,
        volume: args.volume,
      });

      if (!result.success) {
        return {
          type: "error" as const,
          error: result.error || "播放失败",
        };
      }

      return {
        type: "result" as const,
        content: [
          { type: "text" as const, text: `▶️ 播放完成: ${args.audio_path}` },
        ],
      };
    },

    /** audio_volume: 音量控制 */
    async audio_volume(args: { action: "get" | "set"; volume?: number }) {
      if (args.action === "get") {
        const volume = audioPlayer.getVolume();
        if (volume >= 0) {
          return {
            type: "result" as const,
            content: [
              { type: "text" as const, text: `🔊 当前系统音量: ${volume}%` },
            ],
          };
        }
        return {
          type: "error" as const,
          error: "无法获取音量 (可能不支持当前平台)",
        };
      }

      if (args.action === "set") {
        if (args.volume === undefined) {
          return {
            type: "error" as const,
            error: "设置音量时需要提供 volume 参数",
          };
        }

        const success = audioPlayer.setVolume(args.volume);
        if (success) {
          return {
            type: "result" as const,
            content: [
              { type: "text" as const, text: `🔊 音量已设置为: ${args.volume}%` },
            ],
          };
        }
        return {
          type: "error" as const,
          error: "无法设置音量 (可能不支持当前平台)",
        };
      }

      return {
        type: "error" as const,
        error: "无效的操作",
      };
    },
  };
}
