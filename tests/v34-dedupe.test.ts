/**
 * V34: 去重缓存系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DedupeCache, DedupeCacheManager, getDedupeManager, closeDedupeManager } from "./v34-agent/dedupe/engine.js";
import { DEDUPE_PRESETS } from "./v34-agent/dedupe/types.js";
import { createDedupeHandlers, closeDedupeHandlers } from "./v34-agent/dedupe/handlers.js";

describe("V34: DedupeCache", () => {
  let cache: DedupeCache;

  beforeEach(() => {
    cache = new DedupeCache({ ttlMs: 1000, maxSize: 100 });
  });

  describe("基本功能", () => {
    it("应该正确检测新键", () => {
      const result = cache.check("key1");
      expect(result).toBe(false); // 新键，不是重复
    });

    it("应该正确检测重复键", () => {
      cache.check("key1");
      const result = cache.check("key1");
      expect(result).toBe(true); // 重复键
    });

    it("应该正确处理空键", () => {
      expect(cache.check("")).toBe(false);
      expect(cache.check(null as any)).toBe(false);
      expect(cache.check(undefined as any)).toBe(false);
    });

    it("应该正确获取键的详情", () => {
      const now = Date.now();
      cache.check("key1");
      const entry = cache.get("key1");
      expect(entry).toBeDefined();
      expect(entry?.key).toBe("key1");
      expect(entry?.timestamp).toBeGreaterThanOrEqual(now);
    });

    it("应该返回 null 对于不存在的键", () => {
      const entry = cache.get("nonexistent");
      expect(entry).toBeNull();
    });

    it("应该正确删除键", () => {
      cache.check("key1");
      expect(cache.delete("key1")).toBe(true);
      expect(cache.get("key1")).toBeNull();
    });

    it("应该正确返回 false 删除不存在的键", () => {
      expect(cache.delete("nonexistent")).toBe(false);
    });
  });

  describe("TTL 过期", () => {
    it("应该正确处理过期条目", async () => {
      const shortCache = new DedupeCache({ ttlMs: 50, maxSize: 100 });
      shortCache.check("key1");
      
      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // 过期后应视为新键
      const result = shortCache.check("key1");
      expect(result).toBe(false);
    });

    it("TTL = 0 应该永不过期", async () => {
      const permanentCache = new DedupeCache({ ttlMs: 0, maxSize: 100 });
      permanentCache.check("key1");
      
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const result = permanentCache.check("key1");
      expect(result).toBe(true);
    });
  });

  describe("容量限制", () => {
    it("应该正确限制最大容量", () => {
      const smallCache = new DedupeCache({ ttlMs: 0, maxSize: 5 });
      
      for (let i = 0; i < 10; i++) {
        smallCache.check(`key${i}`);
      }
      
      expect(smallCache.size()).toBeLessThanOrEqual(5);
    });

    it("应该淘汰最旧的条目", () => {
      const smallCache = new DedupeCache({ ttlMs: 0, maxSize: 3 });
      
      smallCache.check("key1");
      smallCache.check("key2");
      smallCache.check("key3");
      smallCache.check("key4");
      
      // key1 应该被淘汰
      expect(smallCache.get("key1")).toBeNull();
      expect(smallCache.get("key4")).not.toBeNull();
    });
  });

  describe("批量检查", () => {
    it("应该正确批量检查多个键", () => {
      cache.check("existing1");
      cache.check("existing2");
      
      const result = cache.checkBatch(["existing1", "new1", "existing2", "new2"]);
      
      expect(result.uniqueCount).toBe(2);
      expect(result.duplicateCount).toBe(2);
      expect(result.results).toHaveLength(4);
      expect(result.results[0].isDuplicate).toBe(true);
      expect(result.results[1].isDuplicate).toBe(false);
    });

    it("应该正确处理空数组", () => {
      const result = cache.checkBatch([]);
      expect(result.uniqueCount).toBe(0);
      expect(result.duplicateCount).toBe(0);
    });
  });

  describe("统计功能", () => {
    it("应该正确统计检查次数", () => {
      cache.check("key1");
      cache.check("key2");
      cache.check("key1");
      
      const stats = cache.getStats();
      expect(stats.totalChecks).toBe(3);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
    });

    it("应该正确计算命中率", () => {
      cache.check("key1");
      cache.check("key1");
      cache.check("key1");
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });
  });

  describe("清空缓存", () => {
    it("应该正确清空缓存", () => {
      cache.check("key1");
      cache.check("key2");
      cache.clear();
      
      expect(cache.size()).toBe(0);
      const stats = cache.getStats();
      expect(stats.totalChecks).toBe(0);
    });
  });

  describe("配置更新", () => {
    it("应该正确更新 TTL", () => {
      cache.updateConfig({ ttlMs: 5000 });
      const config = cache.getConfig();
      expect(config.ttlMs).toBe(5000);
    });

    it("应该正确更新最大容量", () => {
      cache.updateConfig({ maxSize: 50 });
      const config = cache.getConfig();
      expect(config.maxSize).toBe(50);
    });
  });

  describe("预设配置", () => {
    it("应该正确加载预设配置", () => {
      const presetCache = new DedupeCache({ preset: "short" });
      const config = presetCache.getConfig();
      expect(config.ttlMs).toBe(60_000);
      expect(config.maxSize).toBe(1000);
    });

    it("预设配置应该可被覆盖", () => {
      const presetCache = new DedupeCache({ preset: "short", ttlMs: 5000 });
      const config = presetCache.getConfig();
      expect(config.ttlMs).toBe(5000);
    });
  });
});

describe("V34: DedupeCacheManager", () => {
  let manager: DedupeCacheManager;

  beforeEach(() => {
    manager = new DedupeCacheManager();
  });

  it("应该正确创建和获取缓存", () => {
    const cache = manager.getCache("test");
    expect(cache).toBeDefined();
    expect(cache.getConfig().name).toBe("test");
  });

  it("应该返回相同的缓存实例", () => {
    const cache1 = manager.getCache("test");
    const cache2 = manager.getCache("test");
    expect(cache1).toBe(cache2);
  });

  it("应该正确列出所有缓存", () => {
    manager.getCache("cache1");
    manager.getCache("cache2");
    manager.getCache("cache3");
    
    const caches = manager.listCaches();
    expect(caches).toHaveLength(3);
    expect(caches).toContain("cache1");
  });

  it("应该正确删除缓存", () => {
    manager.getCache("test");
    expect(manager.deleteCache("test")).toBe(true);
    expect(manager.listCaches()).not.toContain("test");
  });

  it("应该返回 false 删除不存在的缓存", () => {
    expect(manager.deleteCache("nonexistent")).toBe(false);
  });

  it("应该正确获取所有缓存统计", () => {
    const cache1 = manager.getCache("cache1");
    const cache2 = manager.getCache("cache2");
    cache1.check("key1");
    cache2.check("key1");
    cache2.check("key2");
    
    const stats = manager.getAllStats();
    expect(stats).toHaveLength(2);
  });

  it("应该正确清空所有缓存", () => {
    const cache1 = manager.getCache("cache1");
    cache1.check("key1");
    
    manager.clearAll();
    
    expect(cache1.size()).toBe(0);
  });

  it("应该正确获取管理器状态", () => {
    const cache = manager.getCache("test");
    cache.check("key1");
    cache.check("key1");
    
    const status = manager.getStatus();
    expect(status.cacheCount).toBe(1);
    expect(status.totalChecks).toBe(2);
    expect(status.totalHits).toBe(1);
  });
});

describe("V34: Dedupe 预设配置", () => {
  it("应该包含所有预设", () => {
    expect(DEDUPE_PRESETS.short).toBeDefined();
    expect(DEDUPE_PRESETS.medium).toBeDefined();
    expect(DEDUPE_PRESETS.long).toBeDefined();
    expect(DEDUPE_PRESETS.permanent).toBeDefined();
    expect(DEDUPE_PRESETS.message).toBeDefined();
    expect(DEDUPE_PRESETS.action).toBeDefined();
  });

  it("预设配置应该有正确的值", () => {
    expect(DEDUPE_PRESETS.short.ttlMs).toBe(60_000);
    expect(DEDUPE_PRESETS.medium.ttlMs).toBe(300_000);
    expect(DEDUPE_PRESETS.long.ttlMs).toBe(3_600_000);
    expect(DEDUPE_PRESETS.permanent.ttlMs).toBe(0);
  });
});

describe("V34: Dedupe 工具处理器", () => {
  let handlers: Record<string, any>;

  beforeEach(() => {
    closeDedupeHandlers();
    handlers = createDedupeHandlers();
  });

  afterEach(() => {
    closeDedupeHandlers();
  });

  it("应该创建所有 11 个工具处理器", () => {
    expect(Object.keys(handlers)).toHaveLength(11);
    expect(handlers.dedupe_check).toBeDefined();
    expect(handlers.dedupe_batch).toBeDefined();
    expect(handlers.dedupe_create).toBeDefined();
    expect(handlers.dedupe_get).toBeDefined();
    expect(handlers.dedupe_delete).toBeDefined();
    expect(handlers.dedupe_clear).toBeDefined();
    expect(handlers.dedupe_list).toBeDefined();
    expect(handlers.dedupe_stats).toBeDefined();
    expect(handlers.dedupe_status).toBeDefined();
    expect(handlers.dedupe_presets).toBeDefined();
    expect(handlers.dedupe_config).toBeDefined();
  });

  it("dedupe_check 应该正确工作", async () => {
    const result1 = await handlers.dedupe_check({ key: "test-key" });
    expect(result1.success).toBe(true);
    expect(result1.isDuplicate).toBe(false);

    const result2 = await handlers.dedupe_check({ key: "test-key" });
    expect(result2.success).toBe(true);
    expect(result2.isDuplicate).toBe(true);
  });

  it("dedupe_batch 应该正确工作", async () => {
    await handlers.dedupe_check({ key: "existing" });
    
    const result = await handlers.dedupe_batch({ keys: ["existing", "new"] });
    expect(result.success).toBe(true);
    expect(result.uniqueCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("dedupe_create 应该正确创建缓存", async () => {
    const result = await handlers.dedupe_create({ name: "custom-cache", ttlMs: 5000 });
    expect(result.success).toBe(true);
    expect(result.name).toBe("custom-cache");
  });

  it("dedupe_create 应该拒绝重复的缓存名", async () => {
    await handlers.dedupe_create({ name: "test-cache" });
    const result = await handlers.dedupe_create({ name: "test-cache" });
    expect(result.success).toBe(false);
  });

  it("dedupe_get 应该正确获取键", async () => {
    await handlers.dedupe_check({ key: "test-key" });
    
    const result = await handlers.dedupe_get({ key: "test-key" });
    expect(result.success).toBe(true);
    expect(result.key).toBe("test-key");
  });

  it("dedupe_get 应该返回错误对于不存在的键", async () => {
    const result = await handlers.dedupe_get({ key: "nonexistent" });
    expect(result.success).toBe(false);
  });

  it("dedupe_delete 应该正确删除键", async () => {
    await handlers.dedupe_check({ key: "test-key" });
    
    const result = await handlers.dedupe_delete({ key: "test-key" });
    expect(result.success).toBe(true);
  });

  it("dedupe_list 应该列出所有缓存", async () => {
    const result = await handlers.dedupe_list({});
    expect(result.success).toBe(true);
    expect(result.caches).toBeDefined();
  });

  it("dedupe_stats 应该返回统计信息", async () => {
    await handlers.dedupe_check({ key: "key1" });
    await handlers.dedupe_check({ key: "key1" });
    
    const result = await handlers.dedupe_stats({});
    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
  });

  it("dedupe_status 应该返回系统状态", async () => {
    const result = await handlers.dedupe_status({});
    expect(result.success).toBe(true);
    expect(result.status).toBeDefined();
  });

  it("dedupe_presets 应该返回预设配置", async () => {
    const result = await handlers.dedupe_presets({});
    expect(result.success).toBe(true);
    expect(result.presets).toHaveLength(6);
  });

  it("dedupe_config 应该正确获取和更新配置", async () => {
    const result1 = await handlers.dedupe_config({ cache: "default" });
    expect(result1.success).toBe(true);
    expect(result1.config).toBeDefined();

    const result2 = await handlers.dedupe_config({ 
      cache: "default", 
      updates: { ttlMs: 10000 } 
    });
    expect(result2.success).toBe(true);
    expect(result2.config.ttlMs).toBe(10000);
  });
});

describe("V34: 全局管理器", () => {
  beforeEach(() => {
    closeDedupeManager();
  });

  it("getDedupeManager 应该返回单例", () => {
    const manager1 = getDedupeManager();
    const manager2 = getDedupeManager();
    expect(manager1).toBe(manager2);
  });

  it("closeDedupeManager 应该重置管理器", () => {
    const manager1 = getDedupeManager();
    closeDedupeManager();
    const manager2 = getDedupeManager();
    expect(manager1).not.toBe(manager2);
  });
});
