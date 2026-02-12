/**
 * tests/v23-vision.test.ts - V23 图像理解系统测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { 
  VisionAnalyzer, 
  validateImageSource, 
  parseImageSource,
  isLocalPath,
  createDefaultConfig,
  SUPPORTED_IMAGE_FORMATS,
  MAX_IMAGE_SIZE,
  type ImageSource,
} from "../v23-agent/vision/index.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("V23 Vision System", () => {
  let tempDir: string;
  let testImagePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vision-test-"));
    testImagePath = path.join(tempDir, "test.jpg");
    
    // 创建一个最小的有效 JPEG 文件 (1x1 像素)
    const minimalJpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
      0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
      0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
      0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
      0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
      0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
      0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xB5, 0xF7, 0xFF, 0xD9
    ]);
    
    await fs.writeFile(testImagePath, minimalJpeg);
  });

  describe("Utils", () => {
    it("应该正确解析本地路径", () => {
      const source = parseImageSource("/path/to/image.jpg");
      expect(source.type).toBe("path");
      expect((source as any).path).toBe("/path/to/image.jpg");
    });

    it("应该正确解析 URL", () => {
      const source = parseImageSource("https://example.com/image.png");
      expect(source.type).toBe("url");
      expect((source as any).url).toBe("https://example.com/image.png");
    });

    it("应该正确解析 base64 数据", () => {
      const base64Data = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ";
      const source = parseImageSource(base64Data);
      expect(source.type).toBe("base64");
    });

    it("isLocalPath 应该正确识别本地路径", () => {
      expect(isLocalPath("/path/to/image.jpg")).toBe(true);
      expect(isLocalPath("https://example.com/image.jpg")).toBe(false);
      expect(isLocalPath("data:image/jpeg;base64,abc")).toBe(false);
    });

    it("应该验证有效的本地图像文件", async () => {
      const config = createDefaultConfig();
      const source: ImageSource = { type: "path", path: testImagePath };
      
      const result = await validateImageSource(source, config);
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe("image/jpeg");
    });

    it("应该拒绝不存在的文件", async () => {
      const config = createDefaultConfig();
      const source: ImageSource = { type: "path", path: "/nonexistent/image.jpg" };
      
      const result = await validateImageSource(source, config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("文件不存在");
    });

    it("应该拒绝过大的文件", async () => {
      const config = createDefaultConfig();
      config.maxImageSize = 100; // 100 bytes
      
      const source: ImageSource = { type: "path", path: testImagePath };
      const result = await validateImageSource(source, config);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain("图像过大");
    });
  });

  describe("Types", () => {
    it("应该创建默认配置", () => {
      const config = createDefaultConfig();
      expect(config.defaultPrompt).toBe("描述这张图片的内容。");
      expect(config.maxImageSize).toBe(MAX_IMAGE_SIZE);
      expect(config.supportedFormats).toEqual(SUPPORTED_IMAGE_FORMATS);
      expect(config.enableOCR).toBe(true);
      expect(config.enableObjectDetection).toBe(true);
    });

    it("应该包含正确的图像格式", () => {
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/jpeg");
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/png");
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/gif");
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/webp");
    });

    it("最大图像大小应该是 10MB", () => {
      expect(MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024);
    });
  });

  describe("VisionAnalyzer", () => {
    it("应该初始化分析器", () => {
      const config = createDefaultConfig();
      const analyzer = new VisionAnalyzer(config, {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      });

      expect(analyzer).toBeDefined();
      expect(analyzer.getModelConfig().provider).toBe("anthropic");
      expect(analyzer.getModelConfig().model).toBe("claude-sonnet-4-20250514");
    });

    it("应该能够更新模型配置", () => {
      const config = createDefaultConfig();
      const analyzer = new VisionAnalyzer(config, {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      });

      analyzer.setModelConfig({ model: "gpt-4o" });
      expect(analyzer.getModelConfig().model).toBe("gpt-4o");
    });
  });

  describe("Tools", () => {
    it("应该返回 5 个工具定义", async () => {
      const { getVisionTools } = await import("../v23-agent/vision/tools.js");
      const tools = getVisionTools();
      expect(tools.length).toBe(5);
      expect(tools.map(t => t.name)).toContain("vision_analyze");
      expect(tools.map(t => t.name)).toContain("vision_ocr");
      expect(tools.map(t => t.name)).toContain("vision_compare");
      expect(tools.map(t => t.name)).toContain("vision_history");
      expect(tools.map(t => t.name)).toContain("vision_status");
    });
  });

  describe("Integration", () => {
    it("应该导出所有必要的组件", async () => {
      const module = await import("../v23-agent/vision/index.js");
      
      expect(module.VisionAnalyzer).toBeDefined();
      expect(module.validateImageSource).toBeDefined();
      expect(module.imageToBase64).toBeDefined();
      expect(module.parseImageSource).toBeDefined();
      expect(module.isLocalPath).toBeDefined();
      expect(module.getVisionTools).toBeDefined();
      expect(module.createVisionHandlers).toBeDefined();
      expect(module.initVisionContext).toBeDefined();
      expect(module.createDefaultConfig).toBeDefined();
      expect(module.SUPPORTED_IMAGE_FORMATS).toBeDefined();
      expect(module.MAX_IMAGE_SIZE).toBeDefined();
    });
  });
});
