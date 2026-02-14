/**
 * V28: 链接理解系统 - 引擎核心
 * 
 * 统一的链接理解引擎
 */

import { DEFAULT_LINK_CONFIG } from "./defaults.js";
import { extractLinksFromMessage } from "./detect.js";
import { fetchLinkContent, batchFetchLinks } from "./fetcher.js";
import { getLinkCache } from "./cache.js";
import type {
  BatchExtractResult,
  ExtractLinksOptions,
  FetchLinkResult,
  LinkCacheEntry,
  LinkContentResult,
  LinkEngineConfig,
  LinkUnderstandingStats,
} from "./types.js";

/**
 * 链接理解引擎
 */
export class LinkUnderstandingEngine {
  private config: LinkEngineConfig;
  private stats: LinkUnderstandingStats;
  private cache: ReturnType<typeof getLinkCache>;

  constructor(config?: Partial<LinkEngineConfig>) {
    this.config = { ...DEFAULT_LINK_CONFIG, ...config };
    this.cache = getLinkCache();
    this.stats = {
      totalExtracts: 0,
      successfulExtracts: 0,
      failedExtracts: 0,
      avgDurationMs: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 从消息中提取链接
   */
  extractLinks(message: string, options?: ExtractLinksOptions): string[] {
    const links = extractLinksFromMessage(message, {
      maxLinks: options?.maxLinks ?? this.config.maxLinks,
      ...options,
    });

    this.stats.totalExtracts++;
    this.stats.lastUpdated = new Date().toISOString();

    return links;
  }

  /**
   * 获取单个链接内容
   */
  async fetchLink(
    url: string,
    options?: {
      timeoutSeconds?: number;
      format?: "text" | "markdown";
      useCache?: boolean;
    },
  ): Promise<FetchLinkResult> {
    const useCache = options?.useCache ?? true;

    // 检查缓存
    if (useCache) {
      const cached = this.cache.get(url);
      if (cached) {
        return {
          url: cached.url,
          content: cached.content,
          format: cached.format,
          metadata: cached.metadata,
        };
      }
    }

    // 获取内容
    const startTime = Date.now();
    const result = await fetchLinkContent(url, {
      timeoutSeconds: options?.timeoutSeconds ?? this.config.timeoutSeconds,
      format: options?.format,
    });
    const durationMs = Date.now() - startTime;

    // 更新统计
    if (result.error) {
      this.stats.failedExtracts++;
    } else {
      this.stats.successfulExtracts++;

      // 缓存成功的结果
      if (useCache && result.content) {
        this.cache.set(url, result.content, {
          format: result.format,
          metadata: result.metadata,
        });
      }
    }

    this.updateAvgDuration(durationMs);
    this.stats.lastUpdated = new Date().toISOString();

    return result;
  }

  /**
   * 批量获取链接内容
   */
  async fetchLinks(
    urls: string[],
    options?: {
      timeoutSeconds?: number;
      concurrency?: number;
      useCache?: boolean;
    },
  ): Promise<BatchExtractResult> {
    const startTime = Date.now();

    const results = await batchFetchLinks(urls, {
      timeoutSeconds: options?.timeoutSeconds ?? this.config.timeoutSeconds,
      concurrency: options?.concurrency,
    });

    const successful: LinkContentResult[] = [];
    const failed: Array<{ url: string; error: string }> = [];

    for (const result of results) {
      if (result.error) {
        failed.push({ url: result.url, error: result.error });
        this.stats.failedExtracts++;
      } else {
        successful.push(result);
        this.stats.successfulExtracts++;

        // 缓存成功的结果
        if (options?.useCache !== false && result.content) {
          this.cache.set(result.url, result.content, {
            format: result.format,
            metadata: result.metadata,
          });
        }
      }
    }

    const durationMs = Date.now() - startTime;
    this.stats.totalExtracts += urls.length;
    this.updateAvgDuration(durationMs / urls.length);
    this.stats.lastUpdated = new Date().toISOString();

    return {
      successful,
      failed,
      durationMs,
    };
  }

  /**
   * 清除缓存
   */
  clearCache(url?: string): number {
    if (url) {
      const deleted = this.cache.delete(url);
      return deleted ? 1 : 0;
    } else {
      return this.cache.clear();
    }
  }

  /**
   * 获取状态
   */
  getStatus(): {
    enabled: boolean;
    config: {
      maxLinks: number;
      timeoutSeconds: number;
      providers: number;
    };
    stats: LinkUnderstandingStats;
    cache: {
      size: number;
      maxSize: number;
    };
  } {
    return {
      enabled: this.config.enabled ?? true,
      config: {
        maxLinks: this.config.maxLinks ?? 5,
        timeoutSeconds: this.config.timeoutSeconds ?? 30,
        providers: this.config.providers?.length ?? 0,
      },
      stats: this.stats,
      cache: {
        size: this.cache.size,
        maxSize: this.cache.stats.maxSize,
      },
    };
  }

  /**
   * 更新平均处理时间
   */
  private updateAvgDuration(durationMs: number): void {
    const total = this.stats.totalExtracts;
    const current = this.stats.avgDurationMs;
    this.stats.avgDurationMs = Math.round((current * (total - 1) + durationMs) / total);
  }
}

/**
 * 全局引擎实例
 */
let globalEngine: LinkUnderstandingEngine | null = null;

/**
 * 获取全局引擎实例
 */
export function getLinkEngine(config?: Partial<LinkEngineConfig>): LinkUnderstandingEngine {
  if (!globalEngine) {
    globalEngine = new LinkUnderstandingEngine(config);
  }
  return globalEngine;
}

/**
 * 关闭全局引擎实例
 */
export function closeLinkEngine(): void {
  globalEngine = null;
}
