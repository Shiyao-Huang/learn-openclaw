/**
 * v28-agent.ts - OpenClaw V28: 链接理解系统
 * 
 * V28 新增功能:
 * - link_extract: 从消息中提取 HTTP/HTTPS 链接
 * - link_fetch: 获取单个链接的内容
 * - link_batch_fetch: 批量获取多个链接的内容
 * - link_status: 获取链接理解系统的状态
 * - link_clear_cache: 清除链接内容缓存
 * - link_validate: 验证 URL 是否有效和安全
 * 
 * 完整实现见 v28-agent/ 目录
 */

export {
  LinkUnderstandingEngine,
  getLinkEngine,
  closeLinkEngine,
  LinkContentCache,
  getLinkCache,
  clearLinkCache,
  extractLinksFromMessage,
  validateUrl,
  fetchLinkContent,
  batchFetchLinks,
  LINK_TOOLS,
  LINK_TOOL_COUNT,
  linkHandlers,
  closeLinkHandlers,
  DEFAULT_LINK_CONFIG,
  DEFAULT_MAX_LINKS,
  DEFAULT_TIMEOUT_SECONDS,
  type LinkProviderConfig,
  type LinkEngineConfig,
  type ExtractLinksOptions,
  type LinkContentResult,
  type BatchExtractResult,
  type LinkUnderstandingStats,
  type LinkCacheEntry,
  type ExtractLinksRequest,
  type ExtractLinksResult,
  type FetchLinkRequest,
  type FetchLinkResult,
  type BatchFetchLinksRequest,
  type BatchFetchLinksResult,
  type LinkStatusResult,
  type ClearLinkCacheRequest,
  type ClearLinkCacheResult,
} from "./v28-agent/link/index.js";

// 继承 V27 向量嵌入增强
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

// 版本信息
export const VERSION = "v28";
export const VERSION_NAME = "链接理解系统";
export const TOOL_COUNT = 159; // V27 的 153 + V28 的 6

console.log(`
╔═══════════════════════════════════════════════════════════╗
║            OpenClaw V28 - 链接理解系统                    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (Link Understanding):                           ║
║    - link_extract:       从消息中提取 HTTP/HTTPS 链接    ║
║    - link_fetch:         获取单个链接的内容              ║
║    - link_batch_fetch:   批量获取多个链接的内容          ║
║    - link_status:        获取链接理解系统的状态          ║
║    - link_clear_cache:   清除链接内容缓存                ║
║    - link_validate:      验证 URL 是否有效和安全         ║
║                                                           ║
║  特性:                                                    ║
║    ✅ 智能链接提取 (支持 Markdown 语法)                 ║
║    ✅ URL 安全验证 (过滤私有 IP 和 localhost)           ║
║    ✅ 内容获取 (fetch API)                              ║
║    ✅ 智能缓存 (1 小时 TTL)                             ║
║    ✅ 批量处理 (可配置并发数)                           ║
║    ✅ HTML 转文本 (简化处理)                            ║
║                                                           ║
║  继承 V27 能力 (Embedding):                               ║
║    ✅ OpenAI Embeddings API                             ║
║    ✅ 本地 Jaccard 相似度                               ║
║    ✅ 向量存储和语义搜索                                ║
║                                                           ║
║  工具总数: 159 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v28-agent/index.ts 启动完整系统");
  process.exit(0);
}
