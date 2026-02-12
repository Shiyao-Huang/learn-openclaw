/**
 * v24-agent/audio/tools.ts - 语音能力工具定义
 */

import type { ToolDefinition } from "../../v11-agent/core/types.js";

/** 获取语音能力相关工具定义 */
export function getAudioTools(): ToolDefinition[] {
  return [
    {
      name: "tts_synthesize",
      description: "将文字转换为语音 (TTS)。支持多种语言和声音。",
      input_schema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "要转换为语音的文本内容",
          },
          voice: {
            type: "string",
            description: "语音ID，例如 'zh-CN-XiaoxiaoNeural' (晓晓), 'zh-CN-YunxiNeural' (云希)",
          },
          speed: {
            type: "number",
            description: "语速倍率，默认 1.0 (0.5=慢速, 2.0=快速)",
          },
          output_path: {
            type: "string",
            description: "输出音频文件路径 (可选，默认自动生成)",
          },
        },
        required: ["text"],
      },
    },
    {
      name: "tts_list_voices",
      description: "获取所有可用的 TTS 语音列表。",
      input_schema: {
        type: "object",
        properties: {
          language: {
            type: "string",
            description: "语言过滤，例如 'zh-CN', 'en-US' (可选)",
          },
        },
      },
    },
    {
      name: "tts_history",
      description: "查看 TTS 合成历史记录。",
      input_schema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "返回的最大记录数，默认 10",
          },
        },
      },
    },
    {
      name: "tts_delete",
      description: "删除指定的 TTS 音频文件。",
      input_schema: {
        type: "object",
        properties: {
          audio_path: {
            type: "string",
            description: "要删除的音频文件路径",
          },
        },
        required: ["audio_path"],
      },
    },
    {
      name: "audio_play",
      description: "播放音频文件。",
      input_schema: {
        type: "object",
        properties: {
          audio_path: {
            type: "string",
            description: "音频文件路径",
          },
          volume: {
            type: "number",
            description: "音量 (0-100, 仅 macOS 支持)",
          },
        },
        required: ["audio_path"],
      },
    },
    {
      name: "audio_volume",
      description: "获取或设置系统音量 (仅 macOS)。",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["get", "set"],
            description: "操作: get=获取音量, set=设置音量",
          },
          volume: {
            type: "number",
            description: "要设置的音量值 (0-100)，action=set 时必需",
          },
        },
        required: ["action"],
      },
    },
  ];
}
