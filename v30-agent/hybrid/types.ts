/**
 * V30: 混合搜索系统 - 类型定义
 * 
 * 结合向量搜索 + 关键词搜索 (FTS)，实现更好的搜索体验
 */

// ============================================================================
// 全文搜索 (FTS) 类型
// ============================================================================

/**
 * 全文搜索结果
 */
export interface FTSResult {
  /** 文档 ID */
  id: string;
  /** 文件路径 */
  path: string;
  /** 内容片段 */
  snippet: string;
  /** BM25 分数 */
  bm25Score: number;
  /** 归一化分数 (0-1) */
  score: number;
  /** 起始行 */
  startLine: number;
  /** 结束行 */
  endLine: number;
  /** 来源 */
  source: string;
}

/**
 * FTS 搜索选项
 */
export interface FTSSearchOptions {
  /** 最大结果数 */
  maxResults?: number;
  /** 最小分数 */
  minScore?: number;
  /** 是否高亮匹配 */
  highlight?: boolean;
  /** 高亮前缀 */
  highlightPrefix?: string;
  /** 高亮后缀 */
  highlightSuffix?: string;
}

// ============================================================================
// 混合搜索类型
// ============================================================================

/**
 * 混合搜索结果
 */
export interface HybridSearchResult {
  /** 文档 ID */
  id: string;
  /** 文件路径 */
  path: string;
  /** 内容片段 */
  snippet: string;
  /** 向量分数 */
  vectorScore: number;
  /** 关键词分数 */
  keywordScore: number;
  /** 混合分数 (加权组合) */
  hybridScore: number;
  /** 起始行 */
  startLine: number;
  /** 结束行 */
  endLine: number;
  /** 来源 */
  source: string;
  /** 匹配来源 */
  matchedBy: ("vector" | "keyword")[];
}

/**
 * 混合搜索选项
 */
export interface HybridSearchOptions {
  /** 最大结果数 */
  maxResults?: number;
  /** 最小分数 */
  minScore?: number;
  /** 向量权重 (默认 0.7) */
  vectorWeight?: number;
  /** 关键词权重 (默认 0.3) */
  keywordWeight?: number;
  /** 是否仅使用向量搜索 */
  vectorOnly?: boolean;
  /** 是否仅使用关键词搜索 */
  keywordOnly?: boolean;
  /** 是否高亮关键词匹配 */
  highlightKeywords?: boolean;
}

/**
 * 混合搜索配置
 */
export interface HybridEngineConfig {
  /** 默认向量权重 */
  defaultVectorWeight?: number;
  /** 默认关键词权重 */
  defaultKeywordWeight?: number;
  /** 默认最大结果数 */
  defaultMaxResults?: number;
  /** 默认最小分数 */
  defaultMinScore?: number;
  /** 片段最大长度 */
  snippetMaxLength?: number;
  /** FTS 是否启用 */
  ftsEnabled?: boolean;
}

// ============================================================================
// 索引类型
// ============================================================================

/**
 * 索引文档
 */
export interface IndexDocument {
  /** 文档 ID */
  id: string;
  /** 文件路径 */
  path: string;
  /** 内容 */
  content: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 创建时间 */
  createdAt?: number;
  /** 更新时间 */
  updatedAt?: number;
}

/**
 * 索引状态
 */
export interface IndexStatus {
  /** 总文档数 */
  totalDocuments: number;
  /** FTS 就绪 */
  ftsReady: boolean;
  /** 向量就绪 */
  vectorReady: boolean;
  /** 最后索引时间 */
  lastIndexed?: number;
  /** 索引大小 (字节) */
  indexSize?: number;
}

// ============================================================================
// 搜索历史类型
// ============================================================================

/**
 * 搜索历史条目
 */
export interface SearchHistoryEntry {
  /** 查询文本 */
  query: string;
  /** 搜索时间 */
  timestamp: number;
  /** 结果数 */
  resultCount: number;
  /** 搜索模式 */
  mode: "vector" | "keyword" | "hybrid";
  /** 选项 */
  options?: HybridSearchOptions;
}

/**
 * 搜索统计
 */
export interface SearchStats {
  /** 总搜索次数 */
  totalSearches: number;
  /** 向量搜索次数 */
  vectorSearches: number;
  /** 关键词搜索次数 */
  keywordSearches: number;
  /** 混合搜索次数 */
  hybridSearches: number;
  /** 平均结果数 */
  avgResultCount: number;
  /** 常见查询 */
  topQueries: Array<{ query: string; count: number }>;
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_HYBRID_CONFIG: Required<HybridEngineConfig> = {
  defaultVectorWeight: 0.7,
  defaultKeywordWeight: 0.3,
  defaultMaxResults: 10,
  defaultMinScore: 0.1,
  snippetMaxLength: 300,
  ftsEnabled: true,
};
