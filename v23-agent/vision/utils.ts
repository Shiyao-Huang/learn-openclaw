/**
 * v23-agent/vision/utils.ts - 图像处理工具
 */

import * as fs from "fs/promises";
import * as path from "path";
import { 
  ImageSource, 
  SUPPORTED_IMAGE_FORMATS, 
  MAX_IMAGE_SIZE,
  type VisionConfig 
} from "./types.js";

/** 验证图像源 */
export async function validateImageSource(
  source: ImageSource,
  config: VisionConfig
): Promise<{ valid: boolean; error?: string; mimeType?: string }> {
  try {
    let buffer: Buffer;
    let mimeType: string;

    switch (source.type) {
      case "path": {
        const resolvedPath = path.resolve(source.path);
        
        // 检查文件是否存在
        try {
          await fs.access(resolvedPath);
        } catch {
          return { valid: false, error: `文件不存在: ${source.path}` };
        }

        // 读取文件
        buffer = await fs.readFile(resolvedPath);
        
        // 检测 MIME 类型
        mimeType = detectMimeType(buffer, resolvedPath);
        break;
      }

      case "url": {
        // 简单的 URL 验证
        try {
          new URL(source.url);
        } catch {
          return { valid: false, error: `无效的 URL: ${source.url}` };
        }
        
        // 尝试获取图像
        const response = await fetch(source.url, { 
          method: "HEAD",
          signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
          return { valid: false, error: `无法访问 URL: ${response.status}` };
        }
        
        mimeType = response.headers.get("content-type") || "";
        return { valid: true, mimeType };
      }

      case "base64": {
        mimeType = source.mimeType;
        const base64Data = source.data.replace(/^data:image\/\w+;base64,/, "");
        buffer = Buffer.from(base64Data, "base64");
        break;
      }

      default:
        return { valid: false, error: "不支持的图像源类型" };
    }

    // 检查文件大小
    if (buffer.length > config.maxImageSize) {
      return { 
        valid: false, 
        error: `图像过大 (${(buffer.length / 1024 / 1024).toFixed(2)}MB)，最大支持 ${config.maxImageSize / 1024 / 1024}MB` 
      };
    }

    // 验证格式
    if (!config.supportedFormats.includes(mimeType)) {
      return { 
        valid: false, 
        error: `不支持的图像格式: ${mimeType}。支持: ${config.supportedFormats.join(", ")}` 
      };
    }

    return { valid: true, mimeType };
  } catch (error: any) {
    return { valid: false, error: `验证失败: ${error.message}` };
  }
}

/** 检测 MIME 类型 */
function detectMimeType(buffer: Buffer, filepath: string): string {
  // 通过文件扩展名检测
  const ext = path.extname(filepath).toLowerCase();
  const extMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };

  if (extMap[ext]) {
    return extMap[ext];
  }

  // 通过魔数检测
  if (buffer.length >= 4) {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      return "image/jpeg";
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      return "image/png";
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49) {
      return "image/gif";
    }
    if (buffer[0] === 0x52 && buffer[1] === 0x49) {
      return "image/webp";
    }
  }

  return "application/octet-stream";
}

/** 将图像转换为 base64 */
export async function imageToBase64(source: ImageSource): Promise<{ data: string; mimeType: string }> {
  let buffer: Buffer;
  let mimeType: string;

  switch (source.type) {
    case "path": {
      const resolvedPath = path.resolve(source.path);
      buffer = await fs.readFile(resolvedPath);
      mimeType = detectMimeType(buffer, resolvedPath);
      break;
    }

    case "url": {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = response.headers.get("content-type") || "image/jpeg";
      break;
    }

    case "base64": {
      const base64Data = source.data.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
      mimeType = source.mimeType;
      break;
    }

    default:
      throw new Error("不支持的图像源类型");
  }

  const base64 = buffer.toString("base64");
  return { 
    data: `data:${mimeType};base64,${base64}`, 
    mimeType 
  };
}

/** 获取图像信息 */
export async function getImageInfo(source: ImageSource): Promise<{
  size: number;
  mimeType: string;
  path?: string;
}> {
  let size: number;
  let mimeType: string;
  let imgPath: string | undefined;

  switch (source.type) {
    case "path": {
      const resolvedPath = path.resolve(source.path);
      const stats = await fs.stat(resolvedPath);
      size = stats.size;
      const buffer = await fs.readFile(resolvedPath);
      mimeType = detectMimeType(buffer, resolvedPath);
      imgPath = resolvedPath;
      break;
    }

    case "url": {
      const response = await fetch(source.url, { 
        method: "HEAD",
        signal: AbortSignal.timeout(10000)
      });
      size = parseInt(response.headers.get("content-length") || "0");
      mimeType = response.headers.get("content-type") || "image/jpeg";
      break;
    }

    case "base64": {
      const base64Data = source.data.replace(/^data:image\/\w+;base64,/, "");
      size = Math.ceil(base64Data.length * 0.75); // base64 是原大小的 4/3
      mimeType = source.mimeType;
      break;
    }

    default:
      throw new Error("不支持的图像源类型");
  }

  return { size, mimeType, path: imgPath };
}

/** 检查是否为本地图像路径 */
export function isLocalPath(input: string): boolean {
  return !input.startsWith("http://") && 
         !input.startsWith("https://") && 
         !input.startsWith("data:");
}

/** 解析图像源 */
export function parseImageSource(input: string): ImageSource {
  if (input.startsWith("data:image")) {
    // base64 数据
    const match = input.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      return { type: "base64", data: input, mimeType: match[1] };
    }
    throw new Error("无效的 base64 图像数据");
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return { type: "url", url: input };
  }

  return { type: "path", path: input };
}
