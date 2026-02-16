/**
 * V30: 混合搜索系统 - 全文搜索 (FTS) 引擎
 * 
 * 基于 SQLite FTS5 实现全文搜索
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { Database } from "better-sqlite3";
import type {
  FTSResult,
  FTSSearchOptions,
  IndexDocument,
  IndexStatus,
} from "./types.js";

/**
 * FTS 引擎
 */
export class FTSEngine {
  private db: Database;
  private initialized = false;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
  }

  /**
   * 初始化 FTS 索引
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 创建 FTS5 虚拟表
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        id,
        path,
        content,
        source,
        tokenize = 'porter unicode61'
      );
    `);

    // 创建文档元数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS document_meta (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        source TEXT,
        start_line INTEGER,
        end_line INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );
    `);

    this.initialized = true;
  }

  /**
   * 索引文档
   */
  async indexDocument(doc: IndexDocument): Promise<void> {
    await this.initialize();

    const id = doc.id || this.generateId(doc.path);
    const now = Date.now();

    // 删除旧文档
    this.db.prepare("DELETE FROM documents_fts WHERE id = ?").run(id);
    this.db.prepare("DELETE FROM document_meta WHERE id = ?").run(id);

    // 插入 FTS 索引
    this.db
      .prepare(
        `INSERT INTO documents_fts (id, path, content, source) VALUES (?, ?, ?, ?)`
      )
      .run(id, doc.path, doc.content, doc.metadata?.source || "unknown");

    // 插入元数据
    this.db
      .prepare(
        `INSERT INTO document_meta (id, path, source, start_line, end_line, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        doc.path,
        doc.metadata?.source || "unknown",
        doc.metadata?.startLine || 0,
        doc.metadata?.endLine || 0,
        doc.createdAt || now,
        doc.updatedAt || now
      );
  }

  /**
   * 批量索引文档
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
   * 搜索文档
   */
  async search(
    query: string,
    options: FTSSearchOptions = {}
  ): Promise<FTSResult[]> {
    await this.initialize();

    const maxResults = options.maxResults || 10;
    const minScore = options.minScore || 0;
    const ftsQuery = this.buildFTSQuery(query);

    if (!ftsQuery) {
      return [];
    }

    // 执行 FTS 搜索
    const rows = this.db
      .prepare(
        `SELECT 
          f.id, 
          f.path, 
          f.content, 
          f.source,
          m.start_line,
          m.end_line,
          bm25(documents_fts) as bm25_score
         FROM documents_fts f
         LEFT JOIN document_meta m ON f.id = m.id
         WHERE documents_fts MATCH ?
         ORDER BY bm25_score ASC
         LIMIT ?`
      )
      .all(ftsQuery, maxResults * 2) as any[];

    // 处理结果
    const results: FTSResult[] = [];
    for (const row of rows) {
      const score = this.bm25ToScore(row.bm25_score);
      if (score >= minScore) {
        results.push({
          id: row.id,
          path: row.path,
          snippet: this.extractSnippet(row.content, query, options),
          bm25Score: row.bm25_score,
          score,
          startLine: row.start_line || 0,
          endLine: row.end_line || 0,
          source: row.source || "unknown",
        });
      }
      if (results.length >= maxResults) break;
    }

    return results;
  }

  /**
   * 删除文档
   */
  async deleteDocument(id: string): Promise<boolean> {
    await this.initialize();

    const result = this.db.prepare("DELETE FROM documents_fts WHERE id = ?").run(id);
    this.db.prepare("DELETE FROM document_meta WHERE id = ?").run(id);
    return result.changes > 0;
  }

  /**
   * 清空索引
   */
  async clear(): Promise<void> {
    await this.initialize();
    this.db.exec("DELETE FROM documents_fts");
    this.db.exec("DELETE FROM document_meta");
  }

  /**
   * 获取索引状态
   */
  async getStatus(): Promise<IndexStatus> {
    await this.initialize();

    const countRow = this.db.prepare("SELECT COUNT(*) as count FROM document_meta").get() as any;
    const totalDocuments = countRow?.count || 0;

    let indexSize = 0;
    try {
      const dbPath = (this.db as any).name;
      if (dbPath && dbPath !== ":memory:") {
        const stats = fs.statSync(dbPath);
        indexSize = stats.size;
      }
    } catch {
      // 忽略错误
    }

    return {
      totalDocuments,
      ftsReady: true,
      vectorReady: false,
      indexSize,
    };
  }

  /**
   * 关闭引擎
   */
  async close(): Promise<void> {
    this.db.close();
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 构建 FTS 查询
   */
  private buildFTSQuery(raw: string): string | null {
    const tokens =
      raw
        .match(/[A-Za-z0-9_\u4e00-\u9fff]+/g)
        ?.map((t) => t.trim())
        .filter(Boolean) ?? [];

    if (tokens.length === 0) {
      return null;
    }

    // 对每个 token 进行模糊匹配
    const quoted = tokens.map((t) => `"${t.replaceAll('"', "")}"*`);
    return quoted.join(" OR ");
  }

  /**
   * BM25 分数转换为 0-1 分数
   */
  private bm25ToScore(bm25: number): number {
    // BM25 返回负数，越接近 0 越相关
    const normalized = Number.isFinite(bm25) ? Math.max(0, -bm25) : 999;
    return 1 / (1 + normalized);
  }

  /**
   * 提取片段
   */
  private extractSnippet(
    content: string,
    query: string,
    options: FTSSearchOptions
  ): string {
    const maxLength = 300;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

    if (!content) return "";

    // 查找第一个匹配位置
    let matchIndex = -1;
    for (const token of tokens) {
      const index = content.toLowerCase().indexOf(token);
      if (index >= 0) {
        matchIndex = index;
        break;
      }
    }

    let snippet: string;
    if (matchIndex >= 0) {
      // 从匹配位置前后提取
      const start = Math.max(0, matchIndex - 50);
      const end = Math.min(content.length, matchIndex + maxLength - 50);
      snippet = content.slice(start, end);
      if (start > 0) snippet = "..." + snippet;
      if (end < content.length) snippet = snippet + "...";
    } else {
      // 从开头提取
      snippet = content.slice(0, maxLength);
      if (content.length > maxLength) snippet = snippet + "...";
    }

    // 高亮匹配
    if (options.highlight) {
      const prefix = options.highlightPrefix || "**";
      const suffix = options.highlightSuffix || "**";
      for (const token of tokens) {
        const regex = new RegExp(`(${this.escapeRegex(token)})`, "gi");
        snippet = snippet.replace(regex, `${prefix}$1${suffix}`);
      }
    }

    return snippet;
  }

  /**
   * 转义正则特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 生成文档 ID
   */
  private generateId(path: string): string {
    return crypto.createHash("md5").update(path).digest("hex").slice(0, 12);
  }
}

// 单例实例
let ftsInstance: FTSEngine | null = null;

/**
 * 获取 FTS 引擎实例
 */
export function getFTSEngine(dbPath?: string): FTSEngine {
  if (!ftsInstance) {
    ftsInstance = new FTSEngine(dbPath);
  }
  return ftsInstance;
}

/**
 * 关闭 FTS 引擎
 */
export async function closeFTSEngine(): Promise<void> {
  if (ftsInstance) {
    await ftsInstance.close();
    ftsInstance = null;
  }
}
