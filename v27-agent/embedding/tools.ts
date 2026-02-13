/**
 * V27: 向量嵌入增强 - 工具定义
 */

import type { Tool } from "../types.js";

// ============================================================================
// 嵌入工具定义
// ============================================================================

export const EMBEDDING_TOOLS: Tool[] = [
  // 核心嵌入工具
  {
    name: "embedding_embed",
    description: "将文本转换为向量嵌入。返回一个数值数组，可用于语义搜索和相似度计算。",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "要嵌入的文本",
        },
        useCache: {
          type: "boolean",
          description: "是否使用缓存 (默认 true)",
        },
      },
      required: ["text"],
    },
  },

  {
    name: "embedding_search",
    description: "在已索引的内容中搜索相似文本。返回匹配结果及其相似度分数。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索查询文本",
        },
        topK: {
          type: "number",
          description: "返回的最大结果数 (默认 5)",
        },
        minScore: {
          type: "number",
          description: "最小相似度分数 0-1 (默认 0)",
        },
        source: {
          type: "string",
          description: "可选的来源过滤",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "embedding_index",
    description: "将内容索引到向量存储中，支持自动分块。索引后的内容可通过 embedding_search 搜索。",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "要索引的内容",
        },
        source: {
          type: "string",
          description: "内容来源标识 (如文件路径、URL)",
        },
        chunkSize: {
          type: "number",
          description: "分块大小 (默认 500 字符)",
        },
        chunkOverlap: {
          type: "number",
          description: "分块重叠 (默认 50 字符)",
        },
      },
      required: ["content", "source"],
    },
  },

  {
    name: "embedding_status",
    description: "获取嵌入系统的状态信息，包括提供者、存储、缓存和批处理状态。",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "embedding_clear",
    description: "清除向量存储和缓存。慎用，此操作不可恢复。",
    inputSchema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "确认清除 (必须为 true)",
        },
      },
      required: ["confirm"],
    },
  },

  // 相似度计算工具
  {
    name: "embedding_similarity",
    description: "计算两个文本之间的语义相似度。返回 0-1 之间的分数，1 表示完全相似。",
    inputSchema: {
      type: "object",
      properties: {
        text1: {
          type: "string",
          description: "第一个文本",
        },
        text2: {
          type: "string",
          description: "第二个文本",
        },
      },
      required: ["text1", "text2"],
    },
  },

  // 批量操作
  {
    name: "embedding_batch_embed",
    description: "批量嵌入多个文本。比逐个嵌入更高效。",
    inputSchema: {
      type: "object",
      properties: {
        texts: {
          type: "array",
          items: { type: "string" },
          description: "要嵌入的文本数组",
        },
      },
      required: ["texts"],
    },
  },

  // 向量存储管理
  {
    name: "embedding_get",
    description: "根据 ID 获取已存储的向量条目。",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "向量条目 ID",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "embedding_delete",
    description: "根据 ID 删除向量条目。",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "要删除的向量条目 ID",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "embedding_list_providers",
    description: "列出可用的嵌入提供者及其配置。",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// 工具数量
export const EMBEDDING_TOOL_COUNT = EMBEDDING_TOOLS.length;
