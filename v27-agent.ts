/**
 * v27-agent.ts - OpenClaw V27: 向量嵌入增强
 * 
 * V27 新增功能:
 * - embedding_embed: 文本转向量嵌入
 * - embedding_search: 语义搜索
 * - embedding_index: 内容索引
 * - embedding_status: 系统状态
 * - embedding_clear: 清除存储
 * - embedding_similarity: 相似度计算
 * - embedding_batch_embed: 批量嵌入
 * - embedding_get: 获取向量条目
 * - embedding_delete: 删除向量条目
 * - embedding_list_providers: 列出提供者
 * 
 * 完整实现见 v27-agent/ 目录
 */

export {
  EmbeddingEngine,
  getEmbeddingEngine,
  closeEmbeddingEngine,
  OpenAIEmbeddingProvider,
  LocalEmbeddingProvider,
  createEmbeddingProvider,
  InMemoryVectorStore,
  SQLiteVectorStore,
  createVectorStore,
  EMBEDDING_TOOLS,
  EMBEDDING_TOOL_COUNT,
  embeddingHandlers,
  DEFAULT_EMBEDDING_CONFIG,
  OPENAI_EMBEDDING_MODELS,
  type EmbeddingProviderType,
  type EmbeddingProviderConfig,
  type EmbeddingProvider,
  type ProviderStats,
  type VectorEntry,
  type VectorStore,
  type VectorStoreStats,
  type SearchOptions,
  type SearchResult,
  type EmbeddingEngineConfig,
  type VectorStoreConfig,
  type CacheConfig,
  type BatchConfig,
  type EmbedTextRequest,
  type EmbedTextResult,
  type SearchVectorsRequest,
  type SearchVectorsResult,
  type IndexContentRequest,
  type IndexContentResult,
  type EmbeddingStatusResult,
} from "./v27-agent/embedding/index.js";

// 继承 V26 Canvas 显示系统
export {
  CanvasEngine,
  createDefaultConfig as createCanvasConfig,
  getCanvasTools,
  createCanvasHandlers,
  closeCanvasEngine,
  CANVAS_TOOL_COUNT,
  DEFAULT_CANVAS_CONFIG,
  type CanvasConfig,
  type CanvasPresentRequest,
  type CanvasPresentResult,
  type CanvasNavigateRequest,
  type CanvasNavigateResult,
  type CanvasEvalRequest,
  type CanvasEvalResult,
  type CanvasSnapshotRequest,
  type CanvasSnapshotResult,
  type CanvasHideRequest,
  type CanvasHideResult,
  type CanvasStatusResult,
  type CanvasHistory,
  type ScreenshotRecord,
} from "./v26-agent/canvas/index.js";

// 版本信息
export const VERSION = "v27";
export const VERSION_NAME = "向量嵌入增强";
export const TOOL_COUNT = 153; // V26 的 143 + V27 的 10

console.log(`
╔═══════════════════════════════════════════════════════════╗
║            OpenClaw V27 - 向量嵌入增强                    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (Embedding):                                    ║
║    - embedding_embed:          文本转向量嵌入            ║
║    - embedding_search:         语义搜索                  ║
║    - embedding_index:          内容索引                  ║
║    - embedding_status:         系统状态                  ║
║    - embedding_clear:          清除存储                  ║
║    - embedding_similarity:     相似度计算                ║
║    - embedding_batch_embed:    批量嵌入                  ║
║    - embedding_get:            获取向量条目              ║
║    - embedding_delete:         删除向量条目              ║
║    - embedding_list_providers: 列出提供者                ║
║                                                           ║
║  特性:                                                    ║
║    ✅ OpenAI Embeddings API (云端)                      ║
║    ✅ 本地 Jaccard 相似度 (离线 fallback)               ║
║    ✅ 智能缓存机制                                      ║
║    ✅ 批处理优化                                        ║
║    ✅ 内存和 SQLite 存储                                ║
║    ✅ 自动文本分块                                      ║
║                                                           ║
║  继承 V26 能力 (Canvas):                                  ║
║    ✅ 本地 HTTP 服务器                                  ║
║    ✅ Puppeteer 截图和 JS 执行                          ║
║    ✅ 热重载支持                                        ║
║                                                           ║
║  工具总数: 153 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v27-agent/index.ts 启动完整系统");
  process.exit(0);
}
