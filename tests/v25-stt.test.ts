/**
 * tests/v25-stt.test.ts - V25 语音识别 (STT) 测试
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { STTEngine } from "../v25-agent/stt/stt.js";
import { getSTTTools } from "../v25-agent/stt/tools.js";
import { createSTTHandlers } from "../v25-agent/stt/handlers.js";
import {
  DEFAULT_STT_CONFIG,
  SUPPORTED_AUDIO_FORMATS,
  OPENAI_WHISPER_MODELS,
  LOCAL_WHISPER_MODELS,
} from "../v25-agent/stt/types.js";
import type { STTConfig, TranscribeRequest } from "../v25-agent/stt/types.js";
import * as fs from "fs";
import * as path from "path";

// 测试配置
const TEST_TEMP_DIR = path.join(process.cwd(), ".test-stt-temp");

describe("V25: 语音识别 (STT)", () => {
  beforeAll(() => {
    // 创建测试临时目录
    if (!fs.existsSync(TEST_TEMP_DIR)) {
      fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试临时目录
    try {
      fs.rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // ============ 类型定义测试 ============

  describe("类型定义", () => {
    it("应该定义支持的音频格式", () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain("mp3");
      expect(SUPPORTED_AUDIO_FORMATS).toContain("wav");
      expect(SUPPORTED_AUDIO_FORMATS).toContain("m4a");
      expect(SUPPORTED_AUDIO_FORMATS).toContain("webm");
      expect(SUPPORTED_AUDIO_FORMATS.length).toBeGreaterThanOrEqual(8);
    });

    it("应该定义 OpenAI Whisper 模型", () => {
      expect(OPENAI_WHISPER_MODELS).toContain("whisper-1");
    });

    it("应该定义本地 Whisper 模型", () => {
      expect(LOCAL_WHISPER_MODELS).toContain("tiny");
      expect(LOCAL_WHISPER_MODELS).toContain("base");
      expect(LOCAL_WHISPER_MODELS).toContain("small");
      expect(LOCAL_WHISPER_MODELS).toContain("medium");
      expect(LOCAL_WHISPER_MODELS).toContain("large");
    });

    it("应该定义默认配置", () => {
      expect(DEFAULT_STT_CONFIG).toBeDefined();
      expect(DEFAULT_STT_CONFIG.provider).toBeDefined();
      expect(DEFAULT_STT_CONFIG.tempDir).toBeDefined();
      expect(DEFAULT_STT_CONFIG.maxFileSize).toBeGreaterThan(0);
    });
  });

  // ============ 工具定义测试 ============

  describe("工具定义", () => {
    const tools = getSTTTools();

    it("应该返回 5 个 STT 工具", () => {
      expect(tools).toHaveLength(5);
    });

    it("应该包含 stt_transcribe 工具", () => {
      const tool = tools.find((t) => t.name === "stt_transcribe");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("语音识别");
      expect(tool?.input_schema.properties?.source).toBeDefined();
      expect(tool?.input_schema.properties?.source_type).toBeDefined();
    });

    it("应该包含 stt_list_models 工具", () => {
      const tool = tools.find((t) => t.name === "stt_list_models");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("模型列表");
    });

    it("应该包含 stt_history 工具", () => {
      const tool = tools.find((t) => t.name === "stt_history");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("历史");
    });

    it("应该包含 stt_supported_formats 工具", () => {
      const tool = tools.find((t) => t.name === "stt_supported_formats");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("格式");
    });

    it("应该包含 stt_clear_history 工具", () => {
      const tool = tools.find((t) => t.name === "stt_clear_history");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("清除");
    });
  });

  // ============ 处理器测试 ============

  describe("处理器", () => {
    const handlers = createSTTHandlers();

    it("应该创建处理器映射", () => {
      expect(handlers).toBeDefined();
      expect(handlers.size).toBe(5);
    });

    it("应该包含 stt_transcribe 处理器", () => {
      expect(handlers.has("stt_transcribe")).toBe(true);
    });

    it("应该包含 stt_list_models 处理器", () => {
      expect(handlers.has("stt_list_models")).toBe(true);
    });

    it("应该包含 stt_history 处理器", () => {
      expect(handlers.has("stt_history")).toBe(true);
    });

    it("应该包含 stt_supported_formats 处理器", () => {
      expect(handlers.has("stt_supported_formats")).toBe(true);
    });

    it("应该包含 stt_clear_history 处理器", () => {
      expect(handlers.has("stt_clear_history")).toBe(true);
    });
  });

  // ============ STT 引擎测试 ============

  describe("STT 引擎", () => {
    let engine: STTEngine;
    const config: STTConfig = {
      ...DEFAULT_STT_CONFIG,
      tempDir: TEST_TEMP_DIR,
      provider: "auto",
    };

    beforeAll(() => {
      engine = new STTEngine(config);
    });

    it("应该成功创建引擎实例", () => {
      expect(engine).toBeDefined();
    });

    it("getAudioDuration 应该返回函数", () => {
      expect(engine.getAudioDuration).toBeDefined();
      expect(typeof engine.getAudioDuration).toBe("function");
    });

    it("transcribe 应该是函数", () => {
      expect(engine.transcribe).toBeDefined();
      expect(typeof engine.transcribe).toBe("function");
    });

    it("listModels 应该返回可用模型", async () => {
      const models = await engine.listModels();
      expect(models).toBeDefined();
      expect(models.openai).toBeDefined();
      expect(models.local).toBeDefined();
      expect(models.openai).toContain("whisper-1");
    });

    it("getHistory 应该返回历史记录", () => {
      const history = engine.getHistory();
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it("clearHistory 应该清除历史记录", () => {
      engine.clearHistory();
      const history = engine.getHistory();
      expect(history).toHaveLength(0);
    });

    it("getSupportedFormats 应该返回支持的格式", () => {
      const formats = engine.getSupportedFormats();
      expect(formats).toBeDefined();
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain("mp3");
      expect(formats).toContain("wav");
    });
  });

  // ============ 转录请求验证测试 ============

  describe("转录请求验证", () => {
    it("应该接受有效的文件请求", () => {
      const request: TranscribeRequest = {
        source: "/path/to/audio.mp3",
        source_type: "file",
      };
      expect(request.source).toBeDefined();
      expect(request.source_type).toBe("file");
    });

    it("应该接受有效的 URL 请求", () => {
      const request: TranscribeRequest = {
        source: "https://example.com/audio.mp3",
        source_type: "url",
      };
      expect(request.source_type).toBe("url");
    });

    it("应该接受有效的 base64 请求", () => {
      const request: TranscribeRequest = {
        source: "base64data...",
        source_type: "base64",
      };
      expect(request.source_type).toBe("base64");
    });

    it("应该接受可选参数", () => {
      const request: TranscribeRequest = {
        source: "/path/to/audio.mp3",
        source_type: "file",
        language: "zh",
        provider: "openai",
        model: "whisper-1",
        enable_timestamps: true,
      };
      expect(request.language).toBe("zh");
      expect(request.provider).toBe("openai");
      expect(request.model).toBe("whisper-1");
      expect(request.enable_timestamps).toBe(true);
    });
  });

  // ============ 错误处理测试 ============

  describe("错误处理", () => {
    let engine: STTEngine;
    const config: STTConfig = {
      ...DEFAULT_STT_CONFIG,
      tempDir: TEST_TEMP_DIR,
      provider: "auto",
    };

    beforeAll(() => {
      engine = new STTEngine(config);
    });

    it("应该处理不存在的文件", async () => {
      const result = await engine.transcribe({
        source: "/nonexistent/file.mp3",
        source_type: "file",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("应该处理无效的 URL", async () => {
      const result = await engine.transcribe({
        source: "not-a-valid-url",
        source_type: "url",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("应该处理无效的 base64 数据", async () => {
      const result = await engine.transcribe({
        source: "invalid-base64",
        source_type: "base64",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============ 历史记录测试 ============

  describe("历史记录", () => {
    let engine: STTEngine;
    const config: STTConfig = {
      ...DEFAULT_STT_CONFIG,
      tempDir: TEST_TEMP_DIR,
      provider: "auto",
    };

    beforeAll(() => {
      engine = new STTEngine(config);
      engine.clearHistory();
    });

    it("初始历史应该为空", () => {
      const history = engine.getHistory();
      expect(history).toHaveLength(0);
    });

    it("清除历史应该成功", () => {
      engine.clearHistory();
      const history = engine.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  // ============ 模型配置测试 ============

  describe("模型配置", () => {
    it("OpenAI 模型应该有正确的属性", () => {
      expect(OPENAI_WHISPER_MODELS).toBeDefined();
      expect(OPENAI_WHISPER_MODELS.length).toBeGreaterThan(0);
    });

    it("本地模型应该有不同的尺寸", () => {
      const modelSizes = ["tiny", "base", "small", "medium", "large"];
      for (const model of modelSizes) {
        expect(LOCAL_WHISPER_MODELS).toContain(model);
      }
    });
  });

  // ============ 版本信息测试 ============

  describe("版本信息", () => {
    it("V25 应该导出版本信息", async () => {
      const { VERSION, VERSION_NAME, getToolCount } = await import(
        "../v25-agent/index.js"
      );
      expect(VERSION).toBe("v25");
      expect(VERSION_NAME).toContain("语音识别");
      expect(getToolCount()).toBeGreaterThan(129);
    });

    it("V25 应该继承 V24 的所有能力", async () => {
      const v25 = await import("../v25-agent/index.js");
      // V25 应该有 STT
      expect(v25.STTEngine).toBeDefined();
      // V25 应该有 V24 的 TTS
      expect(v25.TTSEngine).toBeDefined();
      // V25 应该有 V23 的 Vision
      expect(v25.VisionAnalyzer).toBeDefined();
    });
  });
});
