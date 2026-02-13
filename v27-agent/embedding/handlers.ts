/**
 * V27: 向量嵌入增强 - 工具处理器
 */

import type { ToolHandler } from "../types.js";
import { EmbeddingEngine } from "./engine.js";
import {
  OpenAIEmbeddingProvider,
  LocalEmbeddingProvider,
  createEmbeddingProvider,
} from "./providers.js";
import type {
  EmbedTextRequest,
  SearchVectorsRequest,
  IndexContentRequest,
} from "./types.js";

// ============================================================================
// 引擎实例管理
// ============================================================================

let engine: EmbeddingEngine | null = null;

export function getEmbeddingEngine(): EmbeddingEngine {
  if (!engine) {
    engine = new EmbeddingEngine({
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
        ttlMs: 3600000,
      },
      batch: {
        enabled: true,
        maxSize: 100,
        concurrency: 5,
        timeoutMs: 30000,
      },
    });
  }
  return engine;
}

export function closeEmbeddingEngine(): void {
  if (engine) {
    engine.close();
    engine = null;
  }
}

// ============================================================================
// 工具处理器
// ============================================================================

export const embeddingEmbedHandler: ToolHandler = async (params: EmbedTextRequest) => {
  const e = getEmbeddingEngine();
  const result = await e.embedText(params);
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          dimensions: result.dimensions,
          provider: result.provider,
          model: result.model,
          cached: result.cached,
          // 不返回完整向量，太长了
          vectorPreview: result.vector.slice(0, 10),
        }, null, 2),
      },
    ],
  };
};

export const embeddingSearchHandler: ToolHandler = async (params: SearchVectorsRequest) => {
  const e = getEmbeddingEngine();
  const result = await e.searchVectors(params);
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          query: result.query,
          provider: result.provider,
          model: result.model,
          results: result.results.map(r => ({
            id: r.id,
            content: r.content.length > 200 
              ? r.content.slice(0, 200) + "..."
              : r.content,
            source: r.source,
            score: r.score.toFixed(4),
          })),
        }, null, 2),
      },
    ],
  };
};

export const embeddingIndexHandler: ToolHandler = async (params: IndexContentRequest) => {
  const e = getEmbeddingEngine();
  const result = await e.indexContent(params);
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          chunks: result.chunks,
          entries: result.entries,
          provider: result.provider,
          model: result.model,
        }, null, 2),
      },
    ],
  };
};

export const embeddingStatusHandler: ToolHandler = async () => {
  const e = getEmbeddingEngine();
  const result = await e.getStatus();
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
};

export const embeddingClearHandler: ToolHandler = async (params: { confirm: boolean }) => {
  if (!params.confirm) {
    return {
      content: [
        {
          type: "text",
          text: "清除操作需要确认。请设置 confirm: true",
        },
      ],
    };
  }
  
  const e = getEmbeddingEngine();
  await e.clearStore();
  
  return {
    content: [
      {
        type: "text",
        text: "向量存储和缓存已清除",
      },
    ],
  };
};

export const embeddingSimilarityHandler: ToolHandler = async (params: {
  text1: string;
  text2: string;
}) => {
  const e = getEmbeddingEngine();
  
  // 获取两个文本的嵌入
  const [emb1, emb2] = await Promise.all([
    e.embedText({ text: params.text1 }),
    e.embedText({ text: params.text2 }),
  ]);
  
  // 计算余弦相似度
  const similarity = cosineSimilarity(emb1.vector, emb2.vector);
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          text1: params.text1.slice(0, 100),
          text2: params.text2.slice(0, 100),
          similarity: similarity.toFixed(4),
          interpretation: similarity > 0.8 ? "高度相似" 
            : similarity > 0.5 ? "中等相似" 
            : similarity > 0.2 ? "略微相似"
            : "不相似",
        }, null, 2),
      },
    ],
  };
};

export const embeddingBatchEmbedHandler: ToolHandler = async (params: {
  texts: string[];
}) => {
  const e = getEmbeddingEngine();
  
  const results = await Promise.all(
    params.texts.map(text => e.embedText({ text }))
  );
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          count: results.length,
          provider: results[0]?.provider || "unknown",
          model: results[0]?.model || "unknown",
          cached: results.filter(r => r.cached).length,
          dimensions: results[0]?.dimensions || 0,
        }, null, 2),
      },
    ],
  };
};

export const embeddingGetHandler: ToolHandler = async (params: { id: string }) => {
  // 需要直接访问存储 - 简化实现
  return {
    content: [
      {
        type: "text",
        text: `获取向量条目: ${params.id} (功能待实现)`,
      },
    ],
  };
};

export const embeddingDeleteHandler: ToolHandler = async (params: { id: string }) => {
  // 需要直接访问存储 - 简化实现
  return {
    content: [
      {
        type: "text",
        text: `删除向量条目: ${params.id} (功能待实现)`,
      },
    ],
  };
};

export const embeddingListProvidersHandler: ToolHandler = async () => {
  const providers = [
    {
      id: "openai",
      name: "OpenAI Embeddings",
      type: "cloud",
      models: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
      dimensions: [1536, 3072, 1536],
      requires: "OPENAI_API_KEY",
    },
    {
      id: "local",
      name: "Local (Jaccard)",
      type: "local",
      models: ["jaccard-v1"],
      dimensions: [128],
      requires: null,
    },
  ];
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          providers,
          default: "auto (优先 OpenAI, fallback 到 local)",
        }, null, 2),
      },
    ],
  };
};

// ============================================================================
// 辅助函数
// ============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
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

// ============================================================================
// 导出处理器映射
// ============================================================================

export const embeddingHandlers: Record<string, ToolHandler> = {
  embedding_embed: embeddingEmbedHandler,
  embedding_search: embeddingSearchHandler,
  embedding_index: embeddingIndexHandler,
  embedding_status: embeddingStatusHandler,
  embedding_clear: embeddingClearHandler,
  embedding_similarity: embeddingSimilarityHandler,
  embedding_batch_embed: embeddingBatchEmbedHandler,
  embedding_get: embeddingGetHandler,
  embedding_delete: embeddingDeleteHandler,
  embedding_list_providers: embeddingListProvidersHandler,
};
