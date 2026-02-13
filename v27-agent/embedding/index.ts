/**
 * V27: 向量嵌入增强 - 模块入口
 */

export {
  EmbeddingEngine,
  getEmbeddingEngine,
  closeEmbeddingEngine,
} from "./engine.js";

export {
  OpenAIEmbeddingProvider,
  LocalEmbeddingProvider,
  createEmbeddingProvider,
} from "./providers.js";

export {
  InMemoryVectorStore,
  SQLiteVectorStore,
  createVectorStore,
} from "./vector-store.js";

export { EMBEDDING_TOOLS, EMBEDDING_TOOL_COUNT } from "./tools.js";
export { embeddingHandlers } from "./handlers.js";

// 类型导出
export type {
  EmbeddingProviderType,
  EmbeddingProviderConfig,
  EmbeddingProvider,
  ProviderStats,
  VectorEntry,
  VectorStore,
  VectorStoreStats,
  SearchOptions,
  SearchResult,
  EmbeddingEngineConfig,
  VectorStoreConfig,
  CacheConfig,
  BatchConfig,
  EmbedTextRequest,
  EmbedTextResult,
  SearchVectorsRequest,
  SearchVectorsResult,
  IndexContentRequest,
  IndexContentResult,
  EmbeddingStatusResult,
} from "./types.js";

export {
  DEFAULT_EMBEDDING_CONFIG,
  OPENAI_EMBEDDING_MODELS,
} from "./types.js";
