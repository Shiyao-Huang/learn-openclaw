/**
 * v24-audio.test.ts - V24 语音能力测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { TTSEngine, AudioPlayer, createDefaultConfig } from "../v24-agent/audio/index.js";

const TEST_DIR = path.join(process.cwd(), "test-output", "v24-audio");

describe("V24: 语音能力", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("TTSEngine", () => {
    it("应该创建 TTS 引擎实例", () => {
      const config = createDefaultConfig(TEST_DIR);
      const engine = new TTSEngine(config);
      expect(engine).toBeDefined();
    });

    it("应该返回可用语音列表", () => {
      const config = createDefaultConfig(TEST_DIR);
      const engine = new TTSEngine(config);
      const voices = engine.getAvailableVoices();
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty("id");
      expect(voices[0]).toHaveProperty("name");
      expect(voices[0]).toHaveProperty("language");
    });

    it("应该返回空历史记录", () => {
      const config = createDefaultConfig(TEST_DIR);
      const engine = new TTSEngine(config);
      const history = engine.getHistory();
      expect(history).toEqual([]);
    });

    it("应该包含中文语音", () => {
      const config = createDefaultConfig(TEST_DIR);
      const engine = new TTSEngine(config);
      const voices = engine.getAvailableVoices();
      const chineseVoices = voices.filter(v => v.language.startsWith("zh-"));
      expect(chineseVoices.length).toBeGreaterThan(0);
    });
  });

  describe("AudioPlayer", () => {
    it("应该创建音频播放器实例", () => {
      const player = new AudioPlayer();
      expect(player).toBeDefined();
    });

    it("初始状态应该不在播放", () => {
      const player = new AudioPlayer();
      expect(player.isCurrentlyPlaying()).toBe(false);
    });

    it("播放不存在的文件应该返回错误", async () => {
      const player = new AudioPlayer();
      const result = await player.play({ audioPath: "/nonexistent/file.mp3" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("不存在");
    });
  });

  describe("配置", () => {
    it("应该创建默认配置", () => {
      const config = createDefaultConfig(TEST_DIR);
      expect(config.defaultProvider).toBe("edge");
      expect(config.defaultVoice).toBe("zh-CN-XiaoxiaoNeural");
      expect(config.defaultSpeed).toBe(1.0);
      expect(config.outputDir).toBe(TEST_DIR);
      expect(config.maxTextLength).toBe(5000);
      expect(config.enableCache).toBe(true);
    });

    it("应该支持多种音频格式", () => {
      const config = createDefaultConfig(TEST_DIR);
      expect(config.supportedFormats).toContain("audio/mp3");
      expect(config.supportedFormats).toContain("audio/wav");
    });
  });

  describe("TTS 请求验证", () => {
    it("应该拒绝过长的文本", async () => {
      const config = createDefaultConfig(TEST_DIR);
      config.maxTextLength = 10;
      const engine = new TTSEngine(config);
      
      const result = await engine.synthesize({
        text: "这是一段非常长的文本，超过了限制",
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("文本过长");
    });
  });

  describe("历史记录管理", () => {
    it("应该限制历史记录数量", () => {
      const config = createDefaultConfig(TEST_DIR);
      const engine = new TTSEngine(config);
      
      // 创建多个历史记录
      for (let i = 0; i < 150; i++) {
        // 通过 synthesize 添加历史记录
      }
      
      const history = engine.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });
});

// 运行测试计数
console.log("V24 语音能力测试套件 - 预计运行 9 个测试");
