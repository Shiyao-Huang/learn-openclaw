/**
 * v23-agent/vision/types.ts - 图像理解模块类型定义
 * 
 * V23: 图像理解 (Vision Understanding)
 */

/** 支持的图像源类型 */
export type ImageSource = 
  | { type: "path"; path: string }
  | { type: "url"; url: string }
  | { type: "base64"; data: string; mimeType: string };

/** 图像分析请求 */
export interface VisionRequest {
  image: ImageSource;
  prompt?: string;
  detail?: "low" | "high" | "auto";
}

/** 图像分析结果 */
export interface VisionResult {
  success: boolean;
  description: string;
  objects?: DetectedObject[];
  text?: string; // OCR 结果
  error?: string;
}

/** 检测到的物体 */
export interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: [number, number, number, number]; // x, y, width, height
}

/** 图像对比请求 */
export interface ImageCompareRequest {
  image1: ImageSource;
  image2: ImageSource;
  focus?: string; // 对比关注点
}

/** 图像对比结果 */
export interface ImageCompareResult {
  success: boolean;
  similar: boolean;
  similarityScore?: number;
  differences: string[];
  error?: string;
}

/** 支持的图像格式 */
export const SUPPORTED_IMAGE_FORMATS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

/** 最大图像大小 (10MB) */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** 图像理解配置 */
export interface VisionConfig {
  defaultPrompt: string;
  maxImageSize: number;
  supportedFormats: string[];
  enableOCR: boolean;
  enableObjectDetection: boolean;
}

/** 图像历史记录 */
export interface VisionHistory {
  id: string;
  timestamp: number;
  imagePath?: string;
  prompt: string;
  result: string;
  model: string;
}

/** 创建默认配置 */
export function createDefaultConfig(): VisionConfig {
  return {
    defaultPrompt: "描述这张图片的内容。",
    maxImageSize: MAX_IMAGE_SIZE,
    supportedFormats: SUPPORTED_IMAGE_FORMATS,
    enableOCR: true,
    enableObjectDetection: true,
  };
}
