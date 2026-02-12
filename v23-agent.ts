/**
 * v23-agent.ts - OpenClaw V23: 图像理解
 * 
 * V23 新增功能:
 * - vision_analyze: 分析图像内容
 * - vision_ocr: OCR 文字识别
 * - vision_compare: 图像对比
 * - vision_history: 分析历史
 * - vision_status: 系统状态
 * 
 * 完整实现见 v23-agent/ 目录
 */

export {
  VisionAnalyzer,
  validateImageSource,
  imageToBase64,
  parseImageSource,
  getVisionTools,
  createVisionHandlers,
  initVisionContext,
  createDefaultConfig,
  SUPPORTED_IMAGE_FORMATS,
  MAX_IMAGE_SIZE,
  type VisionRequest,
  type VisionResult,
  type ImageSource,
  type VisionConfig,
  type VisionHistory,
} from "./v23-agent/vision/index.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V23 - 图像理解                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - vision_analyze:    分析图像内容                    ║
║    - vision_ocr:        OCR 文字识别                    ║
║    - vision_compare:    图像对比                        ║
║    - vision_history:    分析历史                        ║
║    - vision_status:     系统状态                        ║
║                                                           ║
║  支持图像源:                                              ║
║    ✅ 本地文件路径                                      ║
║    ✅ URL                                               ║
║    ✅ Base64 编码                                       ║
║                                                           ║
║  多模态能力:                                              ║
║    ✅ 图像描述和分析                                    ║
║    ✅ 文字提取 (OCR)                                    ║
║    ✅ 图像对比                                          ║
║    ✅ 历史记录追踪                                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v23-agent/index.ts 启动完整系统");
  process.exit(0);
}
