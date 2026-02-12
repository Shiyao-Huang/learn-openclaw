/**
 * v23-agent/vision/index.ts - 图像理解模块入口
 * 
 * V23: 图像理解 (Vision Understanding)
 * 
 * 功能:
 * - 图像分析和描述
 * - OCR 文字识别
 * - 图像对比
 * - 分析历史记录
 */

export { VisionAnalyzer } from "./analyzer.js";
export { 
  validateImageSource, 
  imageToBase64, 
  parseImageSource,
  isLocalPath 
} from "./utils.js";
export { getVisionTools } from "./tools.js";
export { createVisionHandlers, initVisionContext } from "./handlers.js";

export type {
  VisionRequest,
  VisionResult,
  ImageSource,
  VisionConfig,
  VisionHistory,
  ImageCompareRequest,
  ImageCompareResult,
} from "./types.js";

export {
  createDefaultConfig,
  SUPPORTED_IMAGE_FORMATS,
  MAX_IMAGE_SIZE,
} from "./types.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V23 - 图像理解                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - vision_analyze:     分析图像内容                   ║
║    - vision_ocr:         OCR 文字识别                   ║
║    - vision_compare:     图像对比                       ║
║    - vision_history:     分析历史                       ║
║    - vision_status:      系统状态                       ║
║                                                           ║
║  支持图像源:                                              ║
║    ✅ 本地文件路径                                      ║
║    ✅ URL                                               ║
║    ✅ Base64 编码                                       ║
║                                                           ║
║  支持格式:                                                ║
║    ✅ JPEG/JPG                                          ║
║    ✅ PNG                                               ║
║    ✅ GIF                                               ║
║    ✅ WebP                                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
