/**
 * v23-agent/vision/analyzer.ts - 图像分析器
 * 
 * 使用多模态模型进行图像理解
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { 
  VisionRequest, 
  VisionResult, 
  ImageSource,
  type VisionConfig 
} from "./types.js";
import { validateImageSource, imageToBase64 } from "./utils.js";

/** 模型提供商配置 */
interface ModelConfig {
  provider: "anthropic" | "openai" | "kimi";
  model: string;
  apiKey?: string;
  baseURL?: string;
}

/** 图像分析器 */
export class VisionAnalyzer {
  private config: VisionConfig;
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private modelConfig: ModelConfig;

  constructor(
    config: VisionConfig,
    modelConfig?: Partial<ModelConfig>
  ) {
    this.config = config;
    this.modelConfig = {
      provider: modelConfig?.provider || "anthropic",
      model: modelConfig?.model || "claude-sonnet-4-20250514",
      apiKey: modelConfig?.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: modelConfig?.baseURL,
    };

    this.initClients();
  }

  /** 初始化 API 客户端 */
  private initClients(): void {
    if (this.modelConfig.provider === "anthropic" || !this.modelConfig.provider) {
      this.anthropic = new Anthropic({
        apiKey: this.modelConfig.apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: this.modelConfig.baseURL || process.env.ANTHROPIC_BASE_URL,
      });
    }

    if (this.modelConfig.provider === "openai") {
      this.openai = new OpenAI({
        apiKey: this.modelConfig.apiKey || process.env.OPENAI_API_KEY,
        baseURL: this.modelConfig.baseURL,
      });
    }
  }

  /** 分析图像 */
  async analyze(request: VisionRequest): Promise<VisionResult> {
    try {
      // 验证图像
      const validation = await validateImageSource(request.image, this.config);
      if (!validation.valid) {
        return {
          success: false,
          description: "",
          error: validation.error,
        };
      }

      // 转换为 base64
      const { data: base64Data } = await imageToBase64(request.image);

      // 构建提示
      const prompt = request.prompt || this.config.defaultPrompt;
      const detail = request.detail || "auto";

      // 根据提供商调用相应模型
      let description: string;
      
      switch (this.modelConfig.provider) {
        case "anthropic":
          description = await this.analyzeWithAnthropic(base64Data, prompt);
          break;
        case "openai":
          description = await this.analyzeWithOpenAI(base64Data, prompt, detail);
          break;
        default:
          // 默认使用 anthropic
          description = await this.analyzeWithAnthropic(base64Data, prompt);
      }

      return {
        success: true,
        description,
      };
    } catch (error: any) {
      return {
        success: false,
        description: "",
        error: `分析失败: ${error.message}`,
      };
    }
  }

  /** 使用 Anthropic Claude 分析图像 */
  private async analyzeWithAnthropic(base64Data: string, prompt: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error("Anthropic 客户端未初始化");
    }

    // 提取 mime 类型和 base64 数据
    const match = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      throw new Error("无效的 base64 数据格式");
    }

    const mimeType = match[1];
    const base64 = match[2];

    const response = await this.anthropic.messages.create({
      model: this.modelConfig.model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as any,
                data: base64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    // 提取文本响应
    const textBlocks = response.content.filter((b) => b.type === "text");
    return textBlocks.map((b) => (b as any).text).join("\n");
  }

  /** 使用 OpenAI GPT-4V 分析图像 */
  private async analyzeWithOpenAI(
    base64Data: string, 
    prompt: string,
    detail: string
  ): Promise<string> {
    if (!this.openai) {
      throw new Error("OpenAI 客户端未初始化");
    }

    const response = await this.openai.chat.completions.create({
      model: this.modelConfig.model || "gpt-4o",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: base64Data,
                detail: detail as any,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    return response.choices[0]?.message?.content || "";
  }

  /** OCR - 提取图像中的文字 */
  async ocr(image: ImageSource): Promise<{ success: boolean; text: string; error?: string }> {
    const result = await this.analyze({
      image,
      prompt: "提取这张图片中的所有文字内容，保持原有格式。如果没有文字，回复\"无文字\"。",
    });

    if (!result.success) {
      return { success: false, text: "", error: result.error };
    }

    return {
      success: true,
      text: result.description,
    };
  }

  /** 设置模型配置 */
  setModelConfig(config: Partial<ModelConfig>): void {
    this.modelConfig = { ...this.modelConfig, ...config };
    this.initClients();
  }

  /** 获取当前模型配置 */
  getModelConfig(): ModelConfig {
    return { ...this.modelConfig };
  }
}

/** 创建默认分析器 */
export async function createDefaultAnalyzer(): Promise<VisionAnalyzer> {
  const { createDefaultConfig } = await import("./types.js");
  return new VisionAnalyzer(createDefaultConfig());
}
