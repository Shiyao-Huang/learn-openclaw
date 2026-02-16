/**
 * V34: 去重缓存系统 - 类型定义
 */

/**
 * 去重缓存配置
 */
export interface DedupeCacheConfig {
  /** 缓存条目 TTL (毫秒), 0 = 永不过期 */
  ttlMs: number;
  /** 最大缓存条目数, 0 = 无限制 */
  maxSize: number;
  /** 缓存名称 */
  name?: string;
}

/**
 * 去重缓存统计
 */
export interface DedupeCacheStats {
  /** 缓存名称 */
  name: string;
  /** 当前条目数 */
  size: number;
  /** 最大条目数 */
  maxSize: number;
  /** TTL (毫秒) */
  ttlMs: number;
  /** 总检查次数 */
  totalChecks: number;
  /** 命中次数 (重复检测) */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 创建时间 */
  createdAt: number;
  /** 最后活动时间 */
  lastActivityAt: number | null;
}

/**
 * 缓存条目
 */
export interface CacheEntry {
  /** 键 */
  key: string;
  /** 时间戳 */
  timestamp: number;
  /** 命中次数 */
  hitCount: number;
}

/**
 * 去重结果
 */
export interface DedupeResult {
  /** 是否重复 */
  isDuplicate: boolean;
  /** 键 */
  key: string;
  /** 首次出现时间 */
  firstSeen?: number;
  /** 重复次数 (含本次) */
  count?: number;
}

/**
 * 批量去重结果
 */
export interface BatchDedupeResult {
  /** 结果列表 */
  results: DedupeResult[];
  /** 唯一项数 */
  uniqueCount: number;
  /** 重复项数 */
  duplicateCount: number;
}

/**
 * 预设配置
 */
export const DEDUPE_PRESETS: Record<string, DedupeCacheConfig> = {
  short: {
    name: "short",
    ttlMs: 60_000, // 1 分钟
    maxSize: 1000,
  },
  medium: {
    name: "medium",
    ttlMs: 300_000, // 5 分钟
    maxSize: 5000,
  },
  long: {
    name: "long",
    ttlMs: 3_600_000, // 1 小时
    maxSize: 10000,
  },
  permanent: {
    name: "permanent",
    ttlMs: 0, // 永不过期
    maxSize: 100000,
  },
  message: {
    name: "message",
    ttlMs: 600_000, // 10 分钟
    maxSize: 2000,
  },
  action: {
    name: "action",
    ttlMs: 300_000, // 5 分钟
    maxSize: 1000,
  },
};
