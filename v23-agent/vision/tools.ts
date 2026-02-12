/**
 * v23-agent/vision/tools.ts - 图像理解工具定义
 */

import type { ToolDefinition } from "../../v11-agent/core/types.js";

/** 获取图像理解相关工具定义 */
export function getVisionTools(): ToolDefinition[] {
  return [
    {
      name: "vision_analyze",
      description: "分析图像内容。支持本地路径、URL或base64编码的图像。",
      input_schema: {
        type: "object",
        properties: {
          image: {
            type: "string",
            description: "图像路径、URL 或 base64 数据",
          },
          prompt: {
            type: "string",
            description: "分析提示词，例如'描述这张图片'、'提取文字'等",
          },
          detail: {
            type: "string",
            enum: ["low", "high", "auto"],
            description: "分析详细程度 (low=快速, high=详细, auto=自动)",
          },
        },
        required: ["image"],
      },
    },
    {
      name: "vision_ocr",
      description: "从图像中提取文字 (OCR)。支持本地路径、URL或base64编码的图像。",
      input_schema: {
        type: "object",
        properties: {
          image: {
            type: "string",
            description: "图像路径、URL 或 base64 数据",
          },
        },
        required: ["image"],
      },
    },
    {
      name: "vision_compare",
      description: "对比两张图像，找出差异。",
      input_schema: {
        type: "object",
        properties: {
          image1: {
            type: "string",
            description: "第一张图像的路径或 URL",
          },
          image2: {
            type: "string",
            description: "第二张图像的路径或 URL",
          },
          focus: {
            type: "string",
            description: "对比关注点，例如'找出文字差异'、'比较颜色'等",
          },
        },
        required: ["image1", "image2"],
      },
    },
    {
      name: "vision_history",
      description: "查看图像分析历史记录。",
      input_schema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "返回的最大记录数",
          },
        },
      },
    },
    {
      name: "vision_status",
      description: "获取图像理解系统状态。",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
  ];
}
