/**
 * v23-agent/vision/handlers.ts - 图像理解工具处理器
 */

import { VisionAnalyzer } from "./analyzer.js";
import { 
  createDefaultConfig, 
  type VisionHistory,
  type VisionConfig 
} from "./types.js";
import { parseImageSource, isLocalPath } from "./utils.js";
import * as path from "path";
import * as fs from "fs/promises";

/** 处理器上下文 */
export interface VisionContext {
  workDir: string;
  analyzer?: VisionAnalyzer;
  config?: VisionConfig;
}

/** 历史记录存储 */
const history: VisionHistory[] = [];
let context: VisionContext | null = null;

/** 初始化上下文 */
export function initVisionContext(ctx: VisionContext): void {
  context = {
    ...ctx,
    config: ctx.config || createDefaultConfig(),
  };
  
  if (!context.analyzer) {
    context.analyzer = new VisionAnalyzer(context.config);
  }
}

/** 获取分析器 */
function getAnalyzer(): VisionAnalyzer {
  if (!context?.analyzer) {
    throw new Error("Vision 系统未初始化");
  }
  return context.analyzer;
}

/** 添加历史记录 */
function addHistory(entry: Omit<VisionHistory, "id">): void {
  const record: VisionHistory = {
    ...entry,
    id: `vision_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  history.push(record);
  
  // 限制历史记录数量
  if (history.length > 100) {
    history.shift();
  }
}

/** 创建工具处理器 */
export function createVisionHandlers(ctx: VisionContext) {
  initVisionContext(ctx);

  return {
    /** 分析图像 */
    async vision_analyze(args: { 
      image: string; 
      prompt?: string; 
      detail?: "low" | "high" | "auto" 
    }): Promise<string> {
      try {
        const imageSource = parseImageSource(args.image);
        const analyzer = getAnalyzer();
        
        const startTime = Date.now();
        const result = await analyzer.analyze({
          image: imageSource,
          prompt: args.prompt,
          detail: args.detail,
        });
        
        const duration = Date.now() - startTime;

        if (!result.success) {
          return `❌ 分析失败: ${result.error}`;
        }

        // 记录历史
        addHistory({
          timestamp: Date.now(),
          imagePath: isLocalPath(args.image) ? args.image : undefined,
          prompt: args.prompt || "默认分析",
          result: result.description,
          model: analyzer.getModelConfig().model,
        });

        return `✅ 图像分析完成 (${duration}ms)\n\n${result.description}`;
      } catch (error: any) {
        return `❌ 错误: ${error.message}`;
      }
    },

    /** OCR 提取文字 */
    async vision_ocr(args: { image: string }): Promise<string> {
      try {
        const imageSource = parseImageSource(args.image);
        const analyzer = getAnalyzer();
        
        const result = await analyzer.ocr(imageSource);

        if (!result.success) {
          return `❌ OCR 失败: ${result.error}`;
        }

        if (!result.text || result.text.trim() === "" || result.text === "无文字") {
          return "📷 图像中未检测到文字";
        }

        return `📝 OCR 结果:\n\n${result.text}`;
      } catch (error: any) {
        return `❌ 错误: ${error.message}`;
      }
    },

    /** 对比两张图像 */
    async vision_compare(args: { 
      image1: string; 
      image2: string; 
      focus?: string 
    }): Promise<string> {
      try {
        const img1 = parseImageSource(args.image1);
        const img2 = parseImageSource(args.image2);
        const analyzer = getAnalyzer();

        const focusPrompt = args.focus 
          ? `重点关注: ${args.focus}\n\n`
          : "";

        // 先分别分析两张图
        const [result1, result2] = await Promise.all([
          analyzer.analyze({ 
            image: img1, 
            prompt: "详细描述这张图片的所有内容" 
          }),
          analyzer.analyze({ 
            image: img2, 
            prompt: "详细描述这张图片的所有内容" 
          }),
        ]);

        if (!result1.success || !result2.success) {
          return `❌ 分析失败: ${result1.error || result2.error}`;
        }

        // 然后对比分析
        const comparePrompt = `${focusPrompt}以下是两张图片的描述:\n\n【图片1】\n${result1.description}\n\n【图片2】\n${result2.description}\n\n请对比这两张图片，找出它们的相似之处和差异。`;

        // 使用文本模型进行对比分析（简化版，实际可以调用主模型）
        return `🔍 图像对比结果:\n\n📷 图片1:\n${result1.description.slice(0, 200)}...\n\n📷 图片2:\n${result2.description.slice(0, 200)}...\n\n💡 注意: 详细对比分析需要调用主模型进行进一步处理。`;
      } catch (error: any) {
        return `❌ 错误: ${error.message}`;
      }
    },

    /** 查看历史记录 */
    async vision_history(args: { limit?: number }): Promise<string> {
      const limit = args.limit || 10;
      
      if (history.length === 0) {
        return "📭 暂无图像分析历史";
      }

      const recent = history.slice(-limit).reverse();
      const lines = recent.map((h, i) => {
        const time = new Date(h.timestamp).toLocaleString("zh-CN");
        const preview = h.result.slice(0, 50).replace(/\n/g, " ");
        return `${i + 1}. ${time} - ${h.prompt}\n   ${preview}...`;
      });

      return `📚 图像分析历史 (最近 ${recent.length} 条):\n\n${lines.join("\n\n")}`;
    },

    /** 获取系统状态 */
    async vision_status(): Promise<string> {
      const analyzer = getAnalyzer();
      const config = analyzer.getModelConfig();
      
      return `📊 Vision 系统状态\n\n` +
             `🤖 模型: ${config.provider}/${config.model}\n` +
             `📈 历史记录: ${history.length} 条\n` +
             `💾 工作目录: ${context?.workDir || "未设置"}`;
    },
  };
}
