/**
 * v25-agent/stt/handlers.ts - STT 工具处理器
 * 
 * V25: 语音识别
 */

import type { ToolHandler } from "../../v11-agent/tools/types.js";
import type { STTEngine } from "./stt.js";
import {
  OPENAI_WHISPER_MODELS,
  LOCAL_WHISPER_MODELS,
  SUPPORTED_AUDIO_FORMATS,
} from "./types.js";

/** 创建 STT 工具处理器 */
export function createSTTHandlers(sttEngine: STTEngine): Record<string, ToolHandler> {
  return {
    /** 语音转文字 */
    stt_transcribe: async (args: any) => {
      const result = await sttEngine.transcribe({
        source: args.source,
        sourceType: args.source_type || "file",
        language: args.language,
        provider: args.provider,
        model: args.model,
        enableTimestamps: args.enable_timestamps,
      });

      if (!result.success) {
        return {
          error: result.error,
          provider: result.provider,
          model: result.model,
        };
      }

      return {
        text: result.text,
        language: result.language,
        duration: result.duration,
        segments: result.segments,
        provider: result.provider,
        model: result.model,
      };
    },

    /** 获取可用模型列表 */
    stt_list_models: async (args: any) => {
      const provider = args.provider || "all";

      let models: any[] = [];

      if (provider === "all" || provider === "openai") {
        models = models.concat(OPENAI_WHISPER_MODELS);
      }

      if (provider === "all" || provider === "local") {
        models = models.concat(LOCAL_WHISPER_MODELS);
      }

      return {
        models,
        total: models.length,
      };
    },

    /** 获取历史记录 */
    stt_history: async (args: any) => {
      const limit = args.limit || 20;
      const history = sttEngine.getHistory(limit);

      return {
        history,
        total: history.length,
      };
    },

    /** 获取支持的音频格式 */
    stt_supported_formats: async () => {
      return {
        formats: SUPPORTED_AUDIO_FORMATS,
        total: SUPPORTED_AUDIO_FORMATS.length,
        note: "OpenAI Whisper API 支持: mp3, mp4, mpeg, mpga, m4a, wav, webm",
      };
    },

    /** 清除历史记录 */
    stt_clear_history: async () => {
      sttEngine.clearHistory();
      return {
        success: true,
        message: "STT 历史记录已清除",
      };
    },
  };
}
