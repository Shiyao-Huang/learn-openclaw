/**
 * V28: 链接理解系统 - 缓存管理
 */

import crypto from "node:crypto";
import { DEFAULT_CACHE_TTL_MS, DEFAULT_MAX_CACHE_SIZE } from "./defaults.js";
import type { LinkCacheEntry } from "./types.js";

/**
 * 链接内容缓存
 */
export class LinkContentCache {
  private cache = new Map<string, LinkCacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(options?: { maxSize?: number; ttlMs?: number }) {
    this.maxSize = options?.maxSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  /**
   * 生成缓存键
   */
  private hash(url: string): string {
    return crypto.createHash("sha256").update(url).digest("hex").substring(0, 16);
  }

  /**
   * 获取缓存
   */
  get(url: string): LinkCacheEntry | null {
    const key = this.hash(url);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * 设置缓存
   */
  set(
    url: string,
    content: string,
    options?: {
      format?: "text" | "markdown" | "html" | "json";
      metadata?: LinkCacheEntry["metadata"];
      ttlMs?: number;
    },
  ): void {
    const key = this.hash(url);

    // 如果缓存满了，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const ttl = options?.ttlMs ?? this.ttlMs;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl);

    const entry: LinkCacheEntry = {
      url,
      content,
      format: options?.format,
      metadata: options?.metadata,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.cache.set(key, entry);
  }

  /**
   * 删除缓存
   */
  delete(url: string): boolean {
    const key = this.hash(url);
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): number {
    const size = this.cache.size;
    this.cache.clear();
    return size;
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计
   */
  get stats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // TODO: 实现命中率统计
    };
  }
}

/**
 * 全局缓存实例
 */
let globalCache: LinkContentCache | null = null;

/**
 * 获取全局缓存实例
 */
export function getLinkCache(): LinkContentCache {
  if (!globalCache) {
    globalCache = new LinkContentCache();
  }
  return globalCache;
}

/**
 * 清除全局缓存实例
 */
export function clearLinkCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
}
