/**
 * V27: 向量嵌入增强 - 向量存储实现
 * 
 * 支持:
 * - 内存存储 (快速, 易测试)
 * - SQLite 存储 (持久化)
 */

import type {
  VectorEntry,
  VectorStore,
  VectorStoreStats,
  SearchOptions,
  SearchResult,
} from "./types.js";

// ============================================================================
// 内存向量存储
// ============================================================================

export class InMemoryVectorStore implements VectorStore {
  private entries: Map<string, VectorEntry> = new Map();
  private totalSize: number = 0;

  async add(entry: VectorEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    this.totalSize += JSON.stringify(entry).length;
  }

  async addBatch(entries: VectorEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.add(entry);
    }
  }

  async get(id: string): Promise<VectorEntry | null> {
    return this.entries.get(id) || null;
  }

  async delete(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (entry) {
      this.totalSize -= JSON.stringify(entry).length;
      this.entries.delete(id);
      return true;
    }
    return false;
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.totalSize = 0;
  }

  async search(
    query: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, minScore = 0, filter } = options;
    
    const results: SearchResult[] = [];
    
    for (const entry of this.entries.values()) {
      if (filter && !filter(entry)) {
        continue;
      }
      
      const score = this.cosineSimilarity(query, entry.vector);
      
      if (score >= minScore) {
        results.push({ entry, score });
      }
    }
    
    // 按分数降序排序
    results.sort((a, b) => b.score - a.score);
    
    // 返回 topK
    return results.slice(0, topK);
  }

  async count(): Promise<number> {
    return this.entries.size;
  }

  async stats(): Promise<VectorStoreStats> {
    const vectors = this.entries.size;
    return {
      totalVectors: vectors,
      totalSize: this.totalSize,
      avgVectorLength: vectors > 0 ? this.totalSize / vectors : 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ============================================================================
// SQLite 向量存储 (简化实现)
// ============================================================================

/**
 * 简化的 SQLite 向量存储
 * 注意: 这是一个基础实现，没有使用 sqlite-vec 扩展
 * 对于大量向量，建议使用内存存储或专门的向量数据库
 */
export class SQLiteVectorStore implements VectorStore {
  private db: Map<string, VectorEntry> = new Map(); // 模拟 SQLite
  private path: string;
  private totalSize: number = 0;

  constructor(path: string = ":memory:") {
    this.path = path;
    // 实际实现会使用 better-sqlite3 或类似库
    // 这里使用 Map 模拟
  }

  async add(entry: VectorEntry): Promise<void> {
    this.db.set(entry.id, entry);
    this.totalSize += JSON.stringify(entry).length;
    // 实际实现: INSERT INTO vectors (id, vector, content, source, metadata) VALUES (?, ?, ?, ?, ?)
  }

  async addBatch(entries: VectorEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.add(entry);
    }
  }

  async get(id: string): Promise<VectorEntry | null> {
    return this.db.get(id) || null;
  }

  async delete(id: string): Promise<boolean> {
    const existed = this.db.has(id);
    if (existed) {
      const entry = this.db.get(id)!;
      this.totalSize -= JSON.stringify(entry).length;
      this.db.delete(id);
    }
    return existed;
  }

  async clear(): Promise<void> {
    this.db.clear();
    this.totalSize = 0;
  }

  async search(
    query: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, minScore = 0, filter } = options;
    
    const results: SearchResult[] = [];
    
    for (const entry of this.db.values()) {
      if (filter && !filter(entry)) {
        continue;
      }
      
      const score = this.cosineSimilarity(query, entry.vector);
      
      if (score >= minScore) {
        results.push({ entry, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async count(): Promise<number> {
    return this.db.size;
  }

  async stats(): Promise<VectorStoreStats> {
    return {
      totalVectors: this.db.size,
      totalSize: this.totalSize,
      avgVectorLength: this.db.size > 0 ? this.totalSize / this.db.size : 0,
      lastUpdated: new Date(),
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 获取数据库路径
   */
  getPath(): string {
    return this.path;
  }
}

// ============================================================================
// 向量存储工厂
// ============================================================================

export interface CreateVectorStoreOptions {
  type: "memory" | "sqlite";
  path?: string;
}

export function createVectorStore(options: CreateVectorStoreOptions): VectorStore {
  if (options.type === "sqlite") {
    return new SQLiteVectorStore(options.path);
  }
  return new InMemoryVectorStore();
}
