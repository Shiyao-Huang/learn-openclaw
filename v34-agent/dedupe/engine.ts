/**
 * V34: 去重缓存系统 - 核心引擎
 */

import type {
  DedupeCacheConfig,
  DedupeCacheStats,
  CacheEntry,
  DedupeResult,
  BatchDedupeResult,
} from "./types.js";
import { DEDUPE_PRESETS } from "./types.js";

/**
 * 去重缓存实例
 */
export class DedupeCache {
  private cache = new Map<string, CacheEntry>();
  private config: DedupeCacheConfig;
  private createdAt: number;
  private totalChecks = 0;
  private hits = 0;
  private misses = 0;
  private lastActivityAt: number | null = null;

  constructor(config: Partial<DedupeCacheConfig> & { preset?: string } = {}) {
    // 如果指定了预设，先加载预设配置
    if (config.preset && DEDUPE_PRESETS[config.preset]) {
      this.config = { ...DEDUPE_PRESETS[config.preset], ...config };
    } else {
      this.config = {
        ttlMs: config.ttlMs ?? 300_000, // 默认 5 分钟
        maxSize: config.maxSize ?? 10000, // 默认最大 10000 条
        name: config.name ?? "default",
      };
    }
    this.createdAt = Date.now();
  }

  /**
   * 检查键是否重复
   * @returns true = 重复, false = 新键
   */
  check(key: string | undefined | null, now = Date.now()): boolean {
    if (!key) {
      return false;
    }

    this.totalChecks++;
    this.lastActivityAt = now;

    const existing = this.cache.get(key);
    if (existing !== undefined) {
      // 检查是否过期
      if (this.config.ttlMs > 0 && now - existing.timestamp >= this.config.ttlMs) {
        // 已过期，视为新键
        this.touch(key, now);
        this.misses++;
        return false;
      }
      // 未过期，是重复
      existing.hitCount++;
      this.touch(key, now);
      this.hits++;
      return true;
    }

    // 新键
    this.touch(key, now);
    this.misses++;
    return false;
  }

  /**
   * 添加键到缓存
   */
  private touch(key: string, now: number): void {
    // 先删除再添加，确保顺序正确 (最新的在最后)
    this.cache.delete(key);
    this.cache.set(key, {
      key,
      timestamp: now,
      hitCount: this.cache.get(key)?.hitCount ?? 0,
    });

    // 清理过期条目
    this.prune(now);
  }

  /**
   * 清理过期和超量条目
   */
  private prune(now: number): void {
    // 先清理过期条目
    if (this.config.ttlMs > 0) {
      const cutoff = now - this.config.ttlMs;
      for (const [entryKey, entry] of this.cache) {
        if (entry.timestamp < cutoff) {
          this.cache.delete(entryKey);
        }
      }
    }

    // 如果超过最大大小，删除最旧的条目
    if (this.config.maxSize > 0 && this.cache.size > this.config.maxSize) {
      const deleteCount = this.cache.size - this.config.maxSize;
      let deleted = 0;
      for (const [entryKey] of this.cache) {
        if (deleted >= deleteCount) break;
        this.cache.delete(entryKey);
        deleted++;
      }
    }
  }

  /**
   * 获取键的详情
   */
  get(key: string, now = Date.now()): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 检查是否过期
    if (this.config.ttlMs > 0 && now - entry.timestamp >= this.config.ttlMs) {
      return null;
    }

    return entry;
  }

  /**
   * 手动删除键
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.totalChecks = 0;
    this.hits = 0;
    this.misses = 0;
    this.lastActivityAt = null;
  }

  /**
   * 获取当前缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取统计信息
   */
  getStats(): DedupeCacheStats {
    return {
      name: this.config.name ?? "default",
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttlMs: this.config.ttlMs,
      totalChecks: this.totalChecks,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.totalChecks > 0 ? this.hits / this.totalChecks : 0,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
    };
  }

  /**
   * 获取配置
   */
  getConfig(): DedupeCacheConfig {
    return { ...this.config };
  }

  /**
   * 更新配置 (只更新可动态修改的配置)
   */
  updateConfig(updates: Partial<DedupeCacheConfig>): void {
    if (updates.ttlMs !== undefined) {
      this.config.ttlMs = Math.max(0, updates.ttlMs);
    }
    if (updates.maxSize !== undefined) {
      this.config.maxSize = Math.max(0, Math.floor(updates.maxSize));
    }
    if (updates.name !== undefined) {
      this.config.name = updates.name;
    }
    // 立即执行清理
    this.prune(Date.now());
  }

  /**
   * 列出所有键
   */
  listKeys(limit = 100): string[] {
    const keys: string[] = [];
    let count = 0;
    for (const key of this.cache.keys()) {
      if (count >= limit) break;
      keys.push(key);
      count++;
    }
    return keys;
  }

  /**
   * 批量检查
   */
  checkBatch(keys: string[], now = Date.now()): BatchDedupeResult {
    const results: DedupeResult[] = [];
    let uniqueCount = 0;
    let duplicateCount = 0;

    for (const key of keys) {
      const existing = this.cache.get(key);
      const isExpired =
        existing && this.config.ttlMs > 0 && now - existing.timestamp >= this.config.ttlMs;

      if (existing && !isExpired) {
        results.push({
          isDuplicate: true,
          key,
          firstSeen: existing.timestamp,
          count: existing.hitCount + 1,
        });
        duplicateCount++;
        existing.hitCount++;
        this.touch(key, now);
      } else {
        results.push({
          isDuplicate: false,
          key,
          count: 1,
        });
        uniqueCount++;
        this.touch(key, now);
      }
    }

    this.totalChecks += keys.length;
    this.hits += duplicateCount;
    this.misses += uniqueCount;
    this.lastActivityAt = now;

    return {
      results,
      uniqueCount,
      duplicateCount,
    };
  }
}

/**
 * 去重缓存管理器 - 管理多个独立的缓存实例
 */
export class DedupeCacheManager {
  private caches = new Map<string, DedupeCache>();
  private defaultConfig: DedupeCacheConfig;

  constructor(defaultConfig: Partial<DedupeCacheConfig> = {}) {
    this.defaultConfig = {
      ttlMs: defaultConfig.ttlMs ?? 300_000,
      maxSize: defaultConfig.maxSize ?? 10000,
      name: defaultConfig.name ?? "default",
    };
  }

  /**
   * 获取或创建缓存
   */
  getCache(name: string, config?: Partial<DedupeCacheConfig>): DedupeCache {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new DedupeCache({ ...this.defaultConfig, ...config, name });
      this.caches.set(name, cache);
    }
    return cache;
  }

  /**
   * 删除缓存
   */
  deleteCache(name: string): boolean {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      return this.caches.delete(name);
    }
    return false;
  }

  /**
   * 列出所有缓存
   */
  listCaches(): string[] {
    return Array.from(this.caches.keys());
  }

  /**
   * 获取所有缓存的统计
   */
  getAllStats(): DedupeCacheStats[] {
    return Array.from(this.caches.values()).map((cache) => cache.getStats());
  }

  /**
   * 清空所有缓存
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * 获取管理器状态
   */
  getStatus(): {
    cacheCount: number;
    totalSize: number;
    totalChecks: number;
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
  } {
    let totalSize = 0;
    let totalChecks = 0;
    let totalHits = 0;
    let totalMisses = 0;

    for (const cache of this.caches.values()) {
      const stats = cache.getStats();
      totalSize += stats.size;
      totalChecks += stats.totalChecks;
      totalHits += stats.hits;
      totalMisses += stats.misses;
    }

    return {
      cacheCount: this.caches.size,
      totalSize,
      totalChecks,
      totalHits,
      totalMisses,
      overallHitRate: totalChecks > 0 ? totalHits / totalChecks : 0,
    };
  }
}

// 全局默认管理器
let defaultManager: DedupeCacheManager | null = null;

/**
 * 获取默认管理器
 */
export function getDedupeManager(): DedupeCacheManager {
  if (!defaultManager) {
    defaultManager = new DedupeCacheManager();
  }
  return defaultManager;
}

/**
 * 关闭默认管理器
 */
export function closeDedupeManager(): void {
  if (defaultManager) {
    defaultManager.clearAll();
    defaultManager = null;
  }
}
