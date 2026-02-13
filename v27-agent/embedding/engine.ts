/**
 * V27: 向量嵌入增强 - 嵌入引擎
 * 
 * 统一管理:
 * - 嵌入提供者 (OpenAI, Local)
 * - 向量存储 (Memory, SQLite)
 * - 缓存和批处理
 */

import type {
  EmbeddingEngineConfig,
  EmbeddingProvider,
  VectorStore,
  VectorEntry,
  EmbedTextRequest,
  EmbedTextResult,
  SearchVectorsRequest,
  SearchVectorsResult,
  IndexContentRequest,
  IndexContentResult,
  EmbeddingStatusResult,
} from "./types.js";
import {
  createEmbeddingProvider,
  type CreateProviderOptions,
} from "./providers.js";
import { createVectorStore } from "./vector-store.js";

// ============================================================================
// 缓存管理
// ============================================================================

interface CacheEntry {
  vector: number[];
  timestamp: number;
}

class EmbeddingCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 1000, ttlMs: number = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  private hash(text: string): string {
    // 简单的文本 hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  get(text: string): number[] | null {
    const key = this.hash(text);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    return entry.vector;
  }

  set(text: string, vector: number[]): void {
    const key = this.hash(text);
    
    // 如果超过最大大小，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      vector,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): { entries: number; hitRate: string } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) : "0.0";
    return {
      entries: this.cache.size,
      hitRate: `${hitRate}%`,
    };
  }
}

// ============================================================================
// 批处理管理
// ============================================================================

interface BatchItem {
  text: string;
  resolve: (vector: number[]) => void;
  reject: (error: Error) => void;
}

class BatchProcessor {
  private queue: BatchItem[] = [];
  private maxSize: number;
  private timeoutMs: number;
  private timer: NodeJS.Timeout | null = null;
  private provider: EmbeddingProvider | null = null;
  private completed: number = 0;

  constructor(maxSize: number = 100, timeoutMs: number = 100) {
    this.maxSize = maxSize;
    this.timeoutMs = timeoutMs;
  }

  setProvider(provider: EmbeddingProvider): void {
    this.provider = provider;
  }

  async add(text: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ text, resolve, reject });
      
      // 如果达到批处理大小，立即处理
      if (this.queue.length >= this.maxSize) {
        this.flush();
      } else if (!this.timer) {
        // 否则设置定时器
        this.timer = setTimeout(() => this.flush(), this.timeoutMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.queue.length === 0 || !this.provider) {
      return;
    }
    
    const batch = this.queue.splice(0, this.queue.length);
    
    try {
      const texts = batch.map(item => item.text);
      const vectors = await this.provider.embedBatch(texts);
      
      for (let i = 0; i < batch.length; i++) {
        batch[i].resolve(vectors[i]);
      }
      
      this.completed += batch.length;
    } catch (error) {
      for (const item of batch) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  getPending(): number {
    return this.queue.length;
  }

  getCompleted(): number {
    return this.completed;
  }
}

// ============================================================================
// 嵌入引擎
// ============================================================================

export class EmbeddingEngine {
  private config: EmbeddingEngineConfig;
  private provider: EmbeddingProvider | null = null;
  private store: VectorStore;
  private cache: EmbeddingCache;
  private batch: BatchProcessor;
  private initialized: boolean = false;

  constructor(config: EmbeddingEngineConfig) {
    this.config = config;
    this.store = createVectorStore(config.store);
    this.cache = new EmbeddingCache(
      config.cache?.maxSize || 1000,
      config.cache?.ttlMs || 3600000
    );
    this.batch = new BatchProcessor(
      config.batch?.maxSize || 100,
      100 // 批处理超时
    );
  }

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 创建提供者
    const providerOptions: CreateProviderOptions = {
      type: this.config.provider.type,
      apiKey: this.config.provider.apiKey,
      baseUrl: this.config.provider.baseUrl,
      model: this.config.provider.model,
      fallback: this.config.provider.fallback,
    };
    
    this.provider = await createEmbeddingProvider(providerOptions);
    this.batch.setProvider(this.provider);
    this.initialized = true;
  }

  /**
   * 嵌入单个文本
   */
  async embedText(request: EmbedTextRequest): Promise<EmbedTextResult> {
    await this.ensureInitialized();
    
    const { text, useCache = true } = request;
    
    // 检查缓存
    if (useCache) {
      const cached = this.cache.get(text);
      if (cached) {
        return {
          vector: cached,
          dimensions: cached.length,
          provider: this.provider!.id,
          model: this.provider!.model,
          cached: true,
        };
      }
    }
    
    // 获取嵌入
    let vector: number[];
    
    if (this.config.batch?.enabled) {
      vector = await this.batch.add(text);
    } else {
      vector = await this.provider!.embedQuery(text);
    }
    
    // 更新缓存
    if (useCache) {
      this.cache.set(text, vector);
    }
    
    return {
      vector,
      dimensions: vector.length,
      provider: this.provider!.id,
      model: this.provider!.model,
      cached: false,
    };
  }

  /**
   * 搜索向量
   */
  async searchVectors(request: SearchVectorsRequest): Promise<SearchVectorsResult> {
    await this.ensureInitialized();
    
    const { query, topK = 5, minScore = 0, source } = request;
    
    // 嵌入查询
    const { vector } = await this.embedText({ text: query });
    
    // 搜索存储
    const results = await this.store.search(vector, {
      topK,
      minScore,
      filter: source ? (entry) => entry.source === source : undefined,
    });
    
    return {
      results: results.map(r => ({
        id: r.entry.id,
        content: r.entry.content,
        source: r.entry.source,
        score: r.score,
        metadata: r.entry.metadata,
      })),
      query,
      provider: this.provider!.id,
      model: this.provider!.model,
    };
  }

  /**
   * 索引内容
   */
  async indexContent(request: IndexContentRequest): Promise<IndexContentResult> {
    await this.ensureInitialized();
    
    const {
      content,
      source,
      chunkSize = 500,
      chunkOverlap = 50,
      metadata,
    } = request;
    
    // 分块
    const chunks = this.chunkText(content, chunkSize, chunkOverlap);
    const entries: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const { vector } = await this.embedText({ text: chunk });
      
      const id = `${source}-${i}-${Date.now()}`;
      const entry: VectorEntry = {
        id,
        vector,
        content: chunk,
        source,
        metadata: {
          ...metadata,
          chunkIndex: i,
          totalChunks: chunks.length,
        },
        createdAt: new Date(),
      };
      
      await this.store.add(entry);
      entries.push(id);
    }
    
    return {
      chunks: chunks.length,
      entries,
      provider: this.provider!.id,
      model: this.provider!.model,
    };
  }

  /**
   * 获取状态
   */
  async getStatus(): Promise<EmbeddingStatusResult> {
    await this.ensureInitialized();
    
    const storeStats = await this.store.stats();
    const cacheStats = this.cache.stats();
    
    return {
      provider: {
        type: this.provider!.type,
        model: this.provider!.model,
        available: await this.provider!.isAvailable(),
        dimensions: this.provider!.dimensions,
      },
      store: {
        type: this.config.store.type,
        vectors: storeStats.totalVectors,
        size: this.formatSize(storeStats.totalSize),
      },
      cache: {
        enabled: this.config.cache?.enabled || false,
        entries: cacheStats.entries,
        hitRate: cacheStats.hitRate,
      },
      batch: {
        enabled: this.config.batch?.enabled || false,
        pending: this.batch.getPending(),
        completed: this.batch.getCompleted(),
      },
    };
  }

  /**
   * 清除存储
   */
  async clearStore(): Promise<void> {
    await this.store.clear();
    this.cache.clear();
  }

  /**
   * 关闭引擎
   */
  async close(): Promise<void> {
    // 清理资源
    this.cache.clear();
    await this.store.clear();
    this.initialized = false;
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 分块文本
   */
  private chunkText(
    text: string,
    chunkSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + chunkSize;
      
      // 尝试在句子边界切分
      if (end < text.length) {
        const searchStart = Math.max(start + chunkSize - 100, start);
        const searchEnd = Math.min(start + chunkSize + 100, text.length);
        const searchArea = text.slice(searchStart, searchEnd);
        
        // 寻找句子结束符
        const match = searchArea.match(/[。！？.!?]/g);
        if (match) {
          const lastMatch = match[match.length - 1];
          const lastMatchIndex = searchArea.lastIndexOf(lastMatch);
          if (lastMatchIndex !== -1) {
            end = searchStart + lastMatchIndex + 1;
          }
        }
      }
      
      chunks.push(text.slice(start, end).trim());
      start = end - overlap;
    }
    
    return chunks.filter(c => c.length > 0);
  }

  /**
   * 格式化大小
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// ============================================================================
// 导出
// ============================================================================

export { createEmbeddingProvider } from "./providers.js";
export { createVectorStore, InMemoryVectorStore, SQLiteVectorStore } from "./vector-store.js";
