/**
 * v25-agent/stt/tools.ts - STT 工具定义
 * 
 * V25: 语音识别
 */

import type { Tool } from "../../v11-agent/tools/types.js";

/** STT 工具定义 */
export function getSTTTools(): Tool[] {
  return [
    {
      name: "stt_transcribe",
      description: "将音频文件转换为文字 (语音识别/ASR)",
      input_schema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "音频源: 本地路径、URL 或 base64 编码",
          },
          source_type: {
            type: "string",
            enum: ["file", "url", "base64"],
            description: "源类型: file(本地文件)、url(网络地址)、base64(Base64编码)",
          },
          language: {
            type: "string",
            description: "语言代码 (可选，默认自动检测)。例如: zh, en, ja",
          },
          provider: {
            type: "string",
            enum: ["openai", "local", "auto"],
            description: "STT 提供商 (可选)。openai: OpenAI Whisper API; local: 本地 Whisper",
          },
          model: {
            type: "string",
            description: "模型名称 (可选)。OpenAI: whisper-1; 本地: tiny/base/small/medium/large",
          },
          enable_timestamps: {
            type: "boolean",
            description: "是否返回时间戳 (可选，默认 false)",
          },
        },
        required: ["source", "source_type"],
      },
    },
    {
      name: "stt_list_models",
      description: "获取可用的 STT 模型列表",
      input_schema: {
        type: "object",
        properties: {
          provider: {
            type: "string",
            enum: ["openai", "local", "all"],
            description: "筛选提供商 (可选，默认 all)",
          },
        },
      },
    },
    {
      name: "stt_history",
      description: "获取 STT 转录历史记录",
      input_schema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "返回记录数 (可选，默认 20)",
          },
        },
      },
    },
    {
      name: "stt_supported_formats",
      description: "获取支持的音频格式列表",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "stt_clear_history",
      description: "清除 STT 历史记录",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
  ];
}
