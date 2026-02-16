/**
 * V30 混合搜索系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  HybridSearchEngine,
  getHybridEngine,
  closeHybridEngine,
  FTSEngine,
  getFTSEngine,
  closeFTSEngine,
  mergeHybridResults,
  adjustWeights,
  calculateQueryDiversity,
  rerankResults,
  hybridHandlers,
} from "./v30-agent/hybrid/index.js";

describe("V30: 混合搜索系统", () => {
  beforeEach(async () => {
    // 每个测试前重置引擎
    await closeHybridEngine();
  });

  afterEach(async () => {
    await closeHybridEngine();
  });

  describe("FTSEngine", () => {
    it("应该能创建 FTS 引擎", () => {
      const engine = getFTSEngine();
      expect(engine).toBeDefined();
    });

    it("应该能初始化 FTS 引擎", async () => {
      const engine = getFTSEngine();
      await engine.initialize();
      const status = await engine.getStatus();
      expect(status.ftsReady).toBe(true);
    });

    it("应该能索引和搜索文档", async () => {
      const engine = getFTSEngine();
      await engine.initialize();

      // 索引测试文档
      await engine.indexDocument({
        id: "test-1",
        path: "/test/file1.md",
        content: "This is a test document about machine learning and AI",
      });

      await engine.indexDocument({
        id: "test-2",
        path: "/test/file2.md",
        content: "Another document about programming in TypeScript",
      });

      // 搜索
      const results = await engine.search("machine learning");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe("test-1");
    });

    it("应该能删除文档", async () => {
      const engine = getFTSEngine();
      await engine.initialize();

      await engine.indexDocument({
        id: "delete-test",
        path: "/test/delete.md",
        content: "Document to be deleted",
      });

      const deleted = await engine.deleteDocument("delete-test");
      expect(deleted).toBe(true);

      const results = await engine.search("deleted");
      expect(results.find((r) => r.id === "delete-test")).toBeUndefined();
    });

    it("应该能清空索引", async () => {
      const engine = getFTSEngine();
      await engine.initialize();

      await engine.indexDocument({
        id: "clear-test",
        path: "/test/clear.md",
        content: "Document to be cleared",
      });

      await engine.clear();
      const status = await engine.getStatus();
      expect(status.totalDocuments).toBe(0);
    });
  });

  describe("HybridSearchEngine", () => {
    it("应该能创建混合搜索引擎", () => {
      const engine = getHybridEngine();
      expect(engine).toBeDefined();
    });

    it("应该能初始化混合搜索引擎", async () => {
      const engine = getHybridEngine();
      await engine.initialize();
      const status = await engine.getStatus();
      expect(status.ftsReady).toBe(true);
    });

    it("应该能执行关键词搜索", async () => {
      const engine = getHybridEngine();
      await engine.initialize();

      await engine.indexDocument({
        id: "hybrid-1",
        path: "/test/hybrid1.md",
        content: "Hybrid search combines vector and keyword search",
      });

      const results = await engine.keywordSearch("hybrid search");
      expect(results.length).toBeGreaterThan(0);
    });

    it("应该能索引多个文档", async () => {
      const engine = getHybridEngine();
      await engine.initialize();

      const count = await engine.indexDocuments([
        {
          id: "batch-1",
          path: "/test/batch1.md",
          content: "First batch document",
        },
        {
          id: "batch-2",
          path: "/test/batch2.md",
          content: "Second batch document",
        },
      ]);

      expect(count).toBe(2);
    });

    it("应该能获取搜索统计", async () => {
      const engine = getHybridEngine();
      await engine.initialize();

      await engine.indexDocument({
        id: "stats-test",
        path: "/test/stats.md",
        content: "Statistics test document",
      });

      await engine.search("test");

      const stats = engine.getStats();
      expect(stats.totalSearches).toBeGreaterThan(0);
    });

    it("应该能获取搜索历史", async () => {
      const engine = getHybridEngine();
      await engine.initialize();

      await engine.indexDocument({
        id: "history-test",
        path: "/test/history.md",
        content: "History test document",
      });

      await engine.search("history");

      const history = engine.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].query).toBe("history");
    });

    it("应该能清除搜索历史", async () => {
      const engine = getHybridEngine();
      await engine.initialize();

      engine.clearHistory();
      const history = engine.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe("结果合并", () => {
    it("应该能合并向量和关键词搜索结果", () => {
      const vectorResults = [
        {
          id: "doc-1",
          path: "/a.md",
          snippet: "Vector match",
          score: 0.9,
          startLine: 1,
          endLine: 5,
          source: "vector",
        },
      ];

      const keywordResults = [
        {
          id: "doc-1",
          path: "/a.md",
          snippet: "Keyword match longer snippet",
          score: 0.8,
          startLine: 1,
          endLine: 5,
          source: "keyword",
        },
        {
          id: "doc-2",
          path: "/b.md",
          snippet: "Only keyword",
          score: 0.7,
          startLine: 1,
          endLine: 3,
          source: "keyword",
        },
      ];

      const merged = mergeHybridResults({
        vectorResults,
        keywordResults,
        vectorWeight: 0.6,
        keywordWeight: 0.4,
      });

      expect(merged.length).toBe(2);
      // doc-1 应该排在前面 (两个来源都有)
      expect(merged[0].id).toBe("doc-1");
      expect(merged[0].matchedBy).toContain("vector");
      expect(merged[0].matchedBy).toContain("keyword");
    });
  });

  describe("权重调整", () => {
    it("应该能分析查询特征", () => {
      const diversity1 = calculateQueryDiversity("getUserData function");
      expect(diversity1.technicalTerms).toBeGreaterThan(0);

      const diversity2 = calculateQueryDiversity("what is the meaning of life");
      expect(diversity2.naturalLanguage).toBeGreaterThan(0);
    });

    it("应该能根据查询调整权重", () => {
      // 技术查询应该提高关键词权重
      const weights1 = adjustWeights("getUserData camelCase");
      expect(weights1.keywordWeight).toBeGreaterThan(0.3);

      // 自然语言查询应该提高向量权重
      const weights2 = adjustWeights("what are the best practices");
      expect(weights2.vectorWeight).toBeGreaterThan(0.5);
    });
  });

  describe("结果重排序", () => {
    it("应该能重排序结果以提高多样性", () => {
      const results = [
        {
          id: "1",
          path: "/a.md",
          snippet: "Result 1",
          vectorScore: 0.9,
          keywordScore: 0.8,
          hybridScore: 0.85,
          startLine: 1,
          endLine: 5,
          source: "docs",
          matchedBy: ["vector", "keyword"] as const,
        },
        {
          id: "2",
          path: "/b.md",
          snippet: "Result 2",
          vectorScore: 0.8,
          keywordScore: 0.7,
          hybridScore: 0.75,
          startLine: 1,
          endLine: 5,
          source: "docs",
          matchedBy: ["keyword"] as const,
        },
        {
          id: "3",
          path: "/c.md",
          snippet: "Result 3",
          vectorScore: 0.7,
          keywordScore: 0.6,
          hybridScore: 0.65,
          startLine: 1,
          endLine: 5,
          source: "code",
          matchedBy: ["vector"] as const,
        },
      ];

      const reranked = rerankResults(results, { diversityBoost: 0.1 });
      expect(reranked.length).toBe(3);
    });
  });

  describe("工具处理器", () => {
    it("应该能处理 hybrid_search 工具", async () => {
      // 先索引一些文档
      await hybridHandlers("hybrid_index", {
        id: "handler-test",
        path: "/test/handler.md",
        content: "Handler test document for hybrid search",
      });

      const result = (await hybridHandlers("hybrid_search", {
        query: "handler test",
      })) as any;

      expect(result.success).toBe(true);
      expect(result.count).toBeDefined();
    });

    it("应该能处理 hybrid_status 工具", async () => {
      const result = (await hybridHandlers("hybrid_status", {})) as any;
      expect(result.ftsReady).toBeDefined();
    });

    it("应该能处理 hybrid_stats 工具", async () => {
      const result = (await hybridHandlers("hybrid_stats", {})) as any;
      expect(result.totalSearches).toBeDefined();
    });

    it("应该能处理 hybrid_clear 工具", async () => {
      const result = (await hybridHandlers("hybrid_clear", {})) as any;
      expect(result.success).toBe(true);
    });

    it("应该拒绝未知工具", async () => {
      await expect(hybridHandlers("unknown_tool", {})).rejects.toThrow(
        "Unknown hybrid tool"
      );
    });
  });
});
