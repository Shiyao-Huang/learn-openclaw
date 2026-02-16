/**
 * V30: 混合搜索系统 - 导出模块
 */

export {
  HybridSearchEngine,
  getHybridEngine,
  closeHybridEngine,
} from "./engine.js";

export {
  FTSEngine,
  getFTSEngine,
  closeFTSEngine,
} from "./fts.js";

export {
  mergeHybridResults,
  normalizeScores,
  calculateQueryDiversity,
  adjustWeights,
  calculateResultDiversity,
  rerankResults,
  type VectorSearchResult,
  type KeywordSearchResult,
  type MergeParams,
} from "./merger.js";

export type {
  FTSResult,
  FTSSearchOptions,
  HybridSearchResult,
  HybridSearchOptions,
  HybridEngineConfig,
  IndexDocument,
  IndexStatus,
  SearchHistoryEntry,
  SearchStats,
  DEFAULT_HYBRID_CONFIG,
} from "./types.js";

import { HybridSearchEngine, getHybridEngine, closeHybridEngine } from "./engine.js";
import type {
  HybridSearchResult,
  HybridSearchOptions,
  IndexDocument,
  IndexStatus,
  SearchStats,
} from "./types.js";

// ============================================================================
// 工具定义
// ============================================================================

export const HYBRID_TOOLS = [
  {
    name: "hybrid_search",
    description: "混合搜索：同时使用向量搜索和关键词搜索，返回最佳结果",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索查询",
        },
        maxResults: {
          type: "number",
          description: "最大结果数 (默认 10)",
        },
        vectorWeight: {
          type: "number",
          description: "向量搜索权重 (0-1, 默认 0.7)",
        },
        keywordWeight: {
          type: "number",
          description: "关键词搜索权重 (0-1, 默认 0.3)",
        },
        minScore: {
          type: "number",
          description: "最低分数阈值 (默认 0.1)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "hybrid_vector_search",
    description: "仅使用向量搜索 (语义相似度)",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索查询",
        },
        maxResults: {
          type: "number",
          description: "最大结果数 (默认 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "hybrid_keyword_search",
    description: "仅使用关键词搜索 (全文搜索)",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索查询",
        },
        maxResults: {
          type: "number",
          description: "最大结果数 (默认 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "hybrid_index",
    description: "索引文档到混合搜索引擎",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "文档 ID",
        },
        path: {
          type: "string",
          description: "文件路径",
        },
        content: {
          type: "string",
          description: "文档内容",
        },
        source: {
          type: "string",
          description: "来源标识",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "hybrid_index_batch",
    description: "批量索引文档",
    input_schema: {
      type: "object",
      properties: {
        documents: {
          type: "array",
          description: "文档列表",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              path: { type: "string" },
              content: { type: "string" },
              source: { type: "string" },
            },
            required: ["path", "content"],
          },
        },
      },
      required: ["documents"],
    },
  },
  {
    name: "hybrid_delete",
    description: "从索引中删除文档",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "文档 ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "hybrid_status",
    description: "获取混合搜索引擎状态",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "hybrid_stats",
    description: "获取搜索统计信息",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "hybrid_history",
    description: "获取搜索历史",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "返回记录数 (默认 100)",
        },
      },
    },
  },
  {
    name: "hybrid_clear",
    description: "清空所有索引",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

export const HYBRID_TOOL_COUNT = HYBRID_TOOLS.length;

// ============================================================================
// 工具处理器
// ============================================================================

export async function hybridHandlers(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const engine = getHybridEngine();

  switch (toolName) {
    case "hybrid_search": {
      const results = await engine.search(args.query as string, {
        maxResults: args.maxResults as number | undefined,
        vectorWeight: args.vectorWeight as number | undefined,
        keywordWeight: args.keywordWeight as number | undefined,
        minScore: args.minScore as number | undefined,
      });
      return {
        success: true,
        count: results.length,
        results,
      };
    }

    case "hybrid_vector_search": {
      const results = await engine.vectorSearch(args.query as string, {
        maxResults: args.maxResults as number | undefined,
      });
      return {
        success: true,
        count: results.length,
        mode: "vector",
        results,
      };
    }

    case "hybrid_keyword_search": {
      const results = await engine.keywordSearch(args.query as string, {
        maxResults: args.maxResults as number | undefined,
      });
      return {
        success: true,
        count: results.length,
        mode: "keyword",
        results,
      };
    }

    case "hybrid_index": {
      const doc: IndexDocument = {
        id: args.id as string,
        path: args.path as string,
        content: args.content as string,
        metadata: {
          source: args.source as string,
        },
      };
      await engine.indexDocument(doc);
      return {
        success: true,
        indexed: doc.id || doc.path,
      };
    }

    case "hybrid_index_batch": {
      const docs = (args.documents as Array<Record<string, unknown>>).map(
        (d) =>
          ({
            id: d.id as string,
            path: d.path as string,
            content: d.content as string,
            metadata: {
              source: d.source as string,
            },
          }) as IndexDocument
      );
      const count = await engine.indexDocuments(docs);
      return {
        success: true,
        indexed: count,
      };
    }

    case "hybrid_delete": {
      const deleted = await engine.deleteDocument(args.id as string);
      return {
        success: deleted,
        deleted: args.id,
      };
    }

    case "hybrid_status": {
      const status = await engine.getStatus();
      return status;
    }

    case "hybrid_stats": {
      const stats = engine.getStats();
      return stats;
    }

    case "hybrid_history": {
      const history = engine.getHistory(args.limit as number | undefined);
      return history;
    }

    case "hybrid_clear": {
      await engine.clear();
      return {
        success: true,
        cleared: true,
      };
    }

    default:
      throw new Error(`Unknown hybrid tool: ${toolName}`);
  }
}

/**
 * 关闭混合搜索处理器
 */
export async function closeHybridHandlers(): Promise<void> {
  await closeHybridEngine();
}
