/**
 * V30: 混合搜索系统 - 主引擎
 * 
 * 整合向量搜索 (V27 Embedding) + 关键词搜索 (FTS)
 */

import type {
  HybridSearchResult,
  HybridSearchOptions,
  HybridEngineConfig,
  IndexDocument,
  IndexStatus,
  SearchHistoryEntry,
  SearchStats,
  DEFAULT_HYBRID_CONFIG,
} from "./types.js";
import { FTSEngine, getFTSEngine, closeFTSEngine } from "./fts.js";
import {
  mergeHybridResults,
  adjustWeights,
  rerankResults,
  calculateResultDiversity,
  type VectorSearchResult,
  type KeywordSearchResult,
} from "./merger.js";
import { getEmbeddingEngine, closeEmbeddingEngine } from "../../v27-agent/embedding/index.js";

/**
 * 混合搜索引擎
 */
export class HybridSearchEngine {
  private config: Required<HybridEngineConfig>;
  private ftsEngine: FTSEngine;
  private history: SearchHistoryEntry[] = [];
  private initialized = false;

  constructor(config: HybridEngineConfig = {}) {
    this.config = {
      defaultVectorWeight: config.defaultVectorWeight ?? 0.7,
      defaultKeywordWeight: config.defaultKeywordWeight ?? 0.3,
      defaultMaxResults: config.defaultMaxResults ?? 10,
      defaultMinScore: config.defaultMinScore ?? 0.1,
      snippetMaxLength: config.snippetMaxLength ?? 300,
      ftsEnabled: config.ftsEnabled ?? true,
    };
    this.ftsEngine = getFTSEngine();
  }

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ftsEngine.initialize();
    
    // 确保 embedding 引擎也初始化
    try {
      const embeddingEngine = getEmbeddingEngine();
      // embedding 引擎会在首次使用时自动初始化
    } catch {
      // 如果 V27 embedding 不可用，降级为纯 FTS 模式
      console.warn("V27 Embedding engine not available, using FTS-only mode");
    }

    this.initialized = true;
  }

  /**
   * 混合搜索
   */
  async search(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    await this.initialize();

    const maxResults = options.maxResults ?? this.config.defaultMaxResults;
    const minScore = options.minScore ?? this.config.defaultMinScore;

    // 确定权重
    let vectorWeight = options.vectorWeight ?? this.config.defaultVectorWeight;
    let keywordWeight = options.keywordWeight ?? this.config.defaultKeywordWeight;

    // 如果没有显式指定权重，自动调整
    if (!options.vectorWeight && !options.keywordWeight) {
      const adjusted = adjustWeights(query);
      vectorWeight = adjusted.vectorWeight;
      keywordWeight = adjusted.keywordWeight;
    }

    let vectorResults: VectorSearchResult[] = [];
    let keywordResults: KeywordSearchResult[] = [];

    // 执行向量搜索
    if (!options.keywordOnly) {
      vectorResults = await this.executeVectorSearch(query, maxResults * 2);
    }

    // 执行关键词搜索
    if (!options.vectorOnly && this.config.ftsEnabled) {
      keywordResults = await this.executeKeywordSearch(query, maxResults * 2);
    }

    // 合并结果
    let results = mergeHybridResults({
      vectorResults,
      keywordResults,
      vectorWeight,
      keywordWeight,
    });

    // 过滤低分结果
    results = results.filter((r) => r.hybridScore >= minScore);

    // 重排序 (增加多样性)
    results = rerankResults(results, { diversityBoost: 0.05 });

    // 限制结果数
    results = results.slice(0, maxResults);

    // 记录历史
    this.recordSearch(query, results.length, vectorResults.length > 0 && keywordResults.length > 0 ? "hybrid" : vectorResults.length > 0 ? "vector" : "keyword");

    return results;
  }

  /**
   * 仅向量搜索
   */
  async vectorSearch(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    return this.search(query, { ...options, vectorOnly: true });
  }

  /**
   * 仅关键词搜索
   */
  async keywordSearch(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    return this.search(query, { ...options, keywordOnly: true });
  }

  /**
   * 索引文档
   */
  async indexDocument(doc: IndexDocument): Promise<void> {
    await this.initialize();

    // 索引到 FTS
    await this.ftsEngine.indexDocument(doc);

    // 索引到向量存储 (如果 embedding 可用)
    try {
      const embeddingEngine = getEmbeddingEngine();
      await embeddingEngine.index(doc.content, {
        id: doc.id,
        path: doc.path,
        metadata: doc.metadata,
      });
    } catch {
      // 忽略 embedding 错误
    }
  }

  /**
   * 批量索引
   */
  async indexDocuments(docs: IndexDocument[]): Promise<number> {
    let count = 0;
    for (const doc of docs) {
      await this.indexDocument(doc);
      count++;
    }
    return count;
  }

  /**
   * 删除文档
   */
  async deleteDocument(id: string): Promise<boolean> {
    await this.initialize();

    // 从 FTS 删除
    const ftsDeleted = await this.ftsEngine.deleteDocument(id);

    // 从向量存储删除 (如果 embedding 可用)
    try {
      const embeddingEngine = getEmbeddingEngine();
      await embeddingEngine.delete(id);
    } catch {
      // 忽略错误
    }

    return ftsDeleted;
  }

  /**
   * 清空所有索引
   */
  async clear(): Promise<void> {
    await this.initialize();

    await this.ftsEngine.clear();

    try {
      const embeddingEngine = getEmbeddingEngine();
      await embeddingEngine.clear();
    } catch {
      // 忽略错误
    }

    this.history = [];
  }

  /**
   * 获取索引状态
   */
  async getStatus(): Promise<IndexStatus & { engine: string; config: HybridEngineConfig }> {
    await this.initialize();

    const ftsStatus = await this.ftsEngine.getStatus();

    let vectorReady = false;
    try {
      const embeddingEngine = getEmbeddingEngine();
      const embeddingStatus = embeddingEngine.getStatus();
      vectorReady = embeddingStatus.totalEntries > 0;
    } catch {
      // 忽略
    }

    return {
      ...ftsStatus,
      vectorReady,
      engine: "hybrid",
      config: this.config,
    };
  }

  /**
   * 获取搜索历史
   */
  getHistory(limit = 100): SearchHistoryEntry[] {
    return this.history.slice(-limit);
  }

  /**
   * 获取搜索统计
   */
  getStats(): SearchStats {
    const totalSearches = this.history.length;
    let vectorSearches = 0;
    let keywordSearches = 0;
    let hybridSearches = 0;
    let totalResults = 0;
    const queryCounts = new Map<string, number>();

    for (const entry of this.history) {
      totalResults += entry.resultCount;
      queryCounts.set(entry.query, (queryCounts.get(entry.query) || 0) + 1);

      if (entry.mode === "vector") vectorSearches++;
      else if (entry.mode === "keyword") keywordSearches++;
      else hybridSearches++;
    }

    // 排序获取 top 查询
    const topQueries = Array.from(queryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSearches,
      vectorSearches,
      keywordSearches,
      hybridSearches,
      avgResultCount: totalSearches > 0 ? totalResults / totalSearches : 0,
      topQueries,
    };
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * 关闭引擎
   */
  async close(): Promise<void> {
    await closeFTSEngine();
    await closeEmbeddingEngine();
    this.initialized = false;
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 执行向量搜索
   */
  private async executeVectorSearch(
    query: string,
    maxResults: number
  ): Promise<VectorSearchResult[]> {
    try {
      const embeddingEngine = getEmbeddingEngine();
      const results = await embeddingEngine.search(query, { maxResults });

      return results.map((r) => ({
        id: r.id,
        path: r.metadata?.path || "",
        snippet: r.content.slice(0, this.config.snippetMaxLength),
        score: r.score,
        startLine: r.metadata?.startLine || 0,
        endLine: r.metadata?.endLine || 0,
        source: r.metadata?.source || "vector",
      }));
    } catch {
      return [];
    }
  }

  /**
   * 执行关键词搜索
   */
  private async executeKeywordSearch(
    query: string,
    maxResults: number
  ): Promise<KeywordSearchResult[]> {
    const results = await this.ftsEngine.search(query, { maxResults });

    return results.map((r) => ({
      id: r.id,
      path: r.path,
      snippet: r.snippet,
      score: r.score,
      startLine: r.startLine,
      endLine: r.endLine,
      source: r.source,
    }));
  }

  /**
   * 记录搜索
   */
  private recordSearch(
    query: string,
    resultCount: number,
    mode: "vector" | "keyword" | "hybrid"
  ): void {
    this.history.push({
      query,
      timestamp: Date.now(),
      resultCount,
      mode,
    });

    // 限制历史长度
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }
  }
}

// 单例实例
let hybridInstance: HybridSearchEngine | null = null;

/**
 * 获取混合搜索引擎实例
 */
export function getHybridEngine(config?: HybridEngineConfig): HybridSearchEngine {
  if (!hybridInstance) {
    hybridInstance = new HybridSearchEngine(config);
  }
  return hybridInstance;
}

/**
 * 关闭混合搜索引擎
 */
export async function closeHybridEngine(): Promise<void> {
  if (hybridInstance) {
    await hybridInstance.close();
    hybridInstance = null;
  }
}
