/**
 * V34: 去重缓存系统 - 工具处理器
 */

import type { ToolHandler } from "../../v11-agent/types.js";
import { getDedupeManager, closeDedupeManager, DedupeCache } from "./engine.js";
import { DEDUPE_PRESETS } from "./types.js";

/**
 * 去重缓存工具定义
 */
export const DEDUPE_TOOLS = [
  {
    name: "dedupe_check",
    description: "检查键是否重复 (重复返回 true)",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "要检查的键",
        },
        cache: {
          type: "string",
          description: "缓存名称 (默认: default)",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "dedupe_batch",
    description: "批量检查多个键是否重复",
    input_schema: {
      type: "object",
      properties: {
        keys: {
          type: "array",
          items: { type: "string" },
          description: "要检查的键列表",
        },
        cache: {
          type: "string",
          description: "缓存名称 (默认: default)",
        },
      },
      required: ["keys"],
    },
  },
  {
    name: "dedupe_create",
    description: "创建新的去重缓存",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "缓存名称",
        },
        ttlMs: {
          type: "number",
          description: "条目 TTL (毫秒), 0 = 永不过期",
        },
        maxSize: {
          type: "number",
          description: "最大条目数, 0 = 无限制",
        },
        preset: {
          type: "string",
          description: "预设配置 (short/medium/long/permanent/message/action)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "dedupe_get",
    description: "获取键的详情",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "要查询的键",
        },
        cache: {
          type: "string",
          description: "缓存名称 (默认: default)",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "dedupe_delete",
    description: "从缓存中删除键",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "要删除的键",
        },
        cache: {
          type: "string",
          description: "缓存名称 (默认: default)",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "dedupe_clear",
    description: "清空缓存",
    input_schema: {
      type: "object",
      properties: {
        cache: {
          type: "string",
          description: "缓存名称 (不指定则清空所有)",
        },
      },
    },
  },
  {
    name: "dedupe_list",
    description: "列出所有缓存或缓存中的键",
    input_schema: {
      type: "object",
      properties: {
        cache: {
          type: "string",
          description: "缓存名称 (不指定则列出所有缓存)",
        },
        limit: {
          type: "number",
          description: "返回键的最大数量 (默认: 100)",
        },
      },
    },
  },
  {
    name: "dedupe_stats",
    description: "获取缓存统计信息",
    input_schema: {
      type: "object",
      properties: {
        cache: {
          type: "string",
          description: "缓存名称 (不指定则返回所有缓存统计)",
        },
      },
    },
  },
  {
    name: "dedupe_status",
    description: "获取去重系统状态",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "dedupe_presets",
    description: "获取预设配置列表",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "dedupe_config",
    description: "获取或更新缓存配置",
    input_schema: {
      type: "object",
      properties: {
        cache: {
          type: "string",
          description: "缓存名称",
        },
        updates: {
          type: "object",
          description: "要更新的配置项 (ttlMs, maxSize, name)",
        },
      },
      required: ["cache"],
    },
  },
];

export const DEDUPE_TOOL_COUNT = DEDUPE_TOOLS.length;

/**
 * 创建去重缓存工具处理器
 */
export function createDedupeHandlers(): Record<string, ToolHandler> {
  const manager = getDedupeManager();

  return {
    dedupe_check: async (params: { key: string; cache?: string }) => {
      const cache = manager.getCache(params.cache ?? "default");
      const isDuplicate = cache.check(params.key);
      const entry = cache.get(params.key);

      return {
        success: true,
        isDuplicate,
        key: params.key,
        cache: params.cache ?? "default",
        firstSeen: entry?.timestamp,
        hitCount: entry?.hitCount,
      };
    },

    dedupe_batch: async (params: { keys: string[]; cache?: string }) => {
      const cache = manager.getCache(params.cache ?? "default");
      const result = cache.checkBatch(params.keys);

      return {
        success: true,
        cache: params.cache ?? "default",
        uniqueCount: result.uniqueCount,
        duplicateCount: result.duplicateCount,
        results: result.results,
      };
    },

    dedupe_create: async (params: {
      name: string;
      ttlMs?: number;
      maxSize?: number;
      preset?: string;
    }) => {
      if (manager.listCaches().includes(params.name)) {
        return {
          success: false,
          error: `Cache "${params.name}" already exists`,
        };
      }

      const config: Record<string, unknown> = { name: params.name };
      if (params.preset) config.preset = params.preset;
      if (params.ttlMs !== undefined) config.ttlMs = params.ttlMs;
      if (params.maxSize !== undefined) config.maxSize = params.maxSize;

      manager.getCache(params.name, config);

      return {
        success: true,
        name: params.name,
        config: manager.getCache(params.name).getConfig(),
      };
    },

    dedupe_get: async (params: { key: string; cache?: string }) => {
      const cache = manager.getCache(params.cache ?? "default");
      const entry = cache.get(params.key);

      if (!entry) {
        return {
          success: false,
          error: "Key not found or expired",
          key: params.key,
        };
      }

      return {
        success: true,
        key: params.key,
        cache: params.cache ?? "default",
        entry,
      };
    },

    dedupe_delete: async (params: { key: string; cache?: string }) => {
      const cache = manager.getCache(params.cache ?? "default");
      const deleted = cache.delete(params.key);

      return {
        success: deleted,
        key: params.key,
        cache: params.cache ?? "default",
        message: deleted ? "Key deleted" : "Key not found",
      };
    },

    dedupe_clear: async (params: { cache?: string }) => {
      if (params.cache) {
        const cache = manager.getCache(params.cache);
        cache.clear();
        return {
          success: true,
          message: `Cache "${params.cache}" cleared`,
        };
      } else {
        manager.clearAll();
        return {
          success: true,
          message: "All caches cleared",
        };
      }
    },

    dedupe_list: async (params: { cache?: string; limit?: number }) => {
      if (params.cache) {
        const cache = manager.getCache(params.cache);
        const keys = cache.listKeys(params.limit ?? 100);
        return {
          success: true,
          cache: params.cache,
          keys,
          total: cache.size(),
        };
      } else {
        return {
          success: true,
          caches: manager.listCaches(),
          count: manager.listCaches().length,
        };
      }
    },

    dedupe_stats: async (params: { cache?: string }) => {
      if (params.cache) {
        const cache = manager.getCache(params.cache);
        return {
          success: true,
          stats: cache.getStats(),
        };
      } else {
        return {
          success: true,
          stats: manager.getAllStats(),
          summary: manager.getStatus(),
        };
      }
    },

    dedupe_status: async () => {
      return {
        success: true,
        status: manager.getStatus(),
        caches: manager.listCaches(),
      };
    },

    dedupe_presets: async () => {
      return {
        success: true,
        presets: Object.entries(DEDUPE_PRESETS).map(([name, config]) => ({
          name,
          ...config,
        })),
      };
    },

    dedupe_config: async (params: { cache: string; updates?: Record<string, unknown> }) => {
      const cache = manager.getCache(params.cache);

      if (params.updates) {
        cache.updateConfig(params.updates);
      }

      return {
        success: true,
        cache: params.cache,
        config: cache.getConfig(),
      };
    },
  };
}

/**
 * 关闭去重缓存处理器
 */
export function closeDedupeHandlers(): void {
  closeDedupeManager();
}
