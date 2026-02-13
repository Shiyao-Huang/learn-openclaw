/**
 * V27: 向量嵌入增强 - 类型定义
 */

// ============================================================================
// 嵌入提供者配置
// ============================================================================

export type EmbeddingProviderType = "openai" | "local" | "auto";

export interface EmbeddingProviderConfig {
  type: EmbeddingProviderType;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  fallback?: EmbeddingProviderType;
}

// ============================================================================
// 嵌入提供者接口
// ============================================================================

export interface EmbeddingProvider {
  id: string;
  name: string;
  type: EmbeddingProviderType;
  model: string;
  dimensions: number;
  
  // 核心方法
  embedQuery(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  
  // 可选方法
  isAvailable(): Promise<boolean>;
  getStats?(): Promise<ProviderStats>;
}

export interface ProviderStats {
  requestCount: number;
  tokenCount: number;
  lastRequest?: Date;
  avgLatency?: number;
}

// ============================================================================
// 向量存储
// ============================================================================

export interface VectorEntry {
  id: string;
  vector: number[];
  content: string;
  source: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface VectorStore {
  // 基础操作
  add(entry: VectorEntry): Promise<void>;
  addBatch(entries: VectorEntry[]): Promise<void>;
  get(id: string): Promise<VectorEntry | null>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
  
  // 搜索
  search(query: number[], options?: SearchOptions): Promise<SearchResult[]>;
  
  // 状态
  count(): Promise<number>;
  stats(): Promise<VectorStoreStats>;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  filter?: (entry: VectorEntry) => boolean;
}

export interface SearchResult {
  entry: VectorEntry;
  score: number;
}

export interface VectorStoreStats {
  totalVectors: number;
  totalSize: number;
  avgVectorLength: number;
  lastUpdated?: Date;
}

// ============================================================================
// 嵌入引擎配置
// ============================================================================

export interface EmbeddingEngineConfig {
  provider: EmbeddingProviderConfig;
  store: VectorStoreConfig;
  cache?: CacheConfig;
  batch?: BatchConfig;
}

export interface VectorStoreConfig {
  type: "memory" | "sqlite";
  path?: string; // sqlite 文件路径
}

export interface CacheConfig {
  enabled: boolean;
  maxSize?: number; // 最大缓存条目数
  ttlMs?: number; // 缓存过期时间
}

export interface BatchConfig {
  enabled: boolean;
  maxSize?: number; // 批量大小
  concurrency?: number; // 并发数
  timeoutMs?: number; // 超时时间
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingEngineConfig = {
  provider: {
    type: "auto",
    fallback: "local",
  },
  store: {
    type: "memory",
  },
  cache: {
    enabled: true,
    maxSize: 1000,
    ttlMs: 3600000, // 1 hour
  },
  batch: {
    enabled: true,
    maxSize: 100,
    concurrency: 5,
    timeoutMs: 30000,
  },
};

// OpenAI 模型配置
export const OPENAI_EMBEDDING_MODELS = {
  "text-embedding-3-small": { dimensions: 1536, maxTokens: 8191 },
  "text-embedding-3-large": { dimensions: 3072, maxTokens: 8191 },
  "text-embedding-ada-002": { dimensions: 1536, maxTokens: 8191 },
} as const;

// 工具请求/响应类型
export interface EmbedTextRequest {
  text: string;
  useCache?: boolean;
}

export interface EmbedTextResult {
  vector: number[];
  dimensions: number;
  provider: string;
  model: string;
  cached: boolean;
}

export interface SearchVectorsRequest {
  query: string;
  topK?: number;
  minScore?: number;
  source?: string;
}

export interface SearchVectorsResult {
  results: Array<{
    id: string;
    content: string;
    source: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  query: string;
  provider: string;
  model: string;
}

export interface IndexContentRequest {
  content: string;
  source: string;
  chunkSize?: number;
  chunkOverlap?: number;
  metadata?: Record<string, unknown>;
}

export interface IndexContentResult {
  chunks: number;
  entries: string[];
  provider: string;
  model: string;
}

export interface EmbeddingStatusResult {
  provider: {
    type: string;
    model: string;
    available: boolean;
    dimensions: number;
  };
  store: {
    type: string;
    vectors: number;
    size: string;
  };
  cache: {
    enabled: boolean;
    entries: number;
    hitRate: string;
  };
  batch: {
    enabled: boolean;
    pending: number;
    completed: number;
  };
}
