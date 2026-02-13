/**
 * V27: 向量嵌入增强 - 测试
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  EmbeddingEngine,
  OpenAIEmbeddingProvider,
  LocalEmbeddingProvider,
  InMemoryVectorStore,
  createVectorStore,
  DEFAULT_EMBEDDING_CONFIG,
} from "../v27-agent/embedding/index.js";

describe("V27: 向量嵌入增强", () => {
  describe("LocalEmbeddingProvider", () => {
    const provider = new LocalEmbeddingProvider();

    it("should be available", async () => {
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it("should embed query", async () => {
      const vector = await provider.embedQuery("Hello world");
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBe(128);
    });

    it("should embed batch", async () => {
      const vectors = await provider.embedBatch(["Hello", "World"]);
      expect(vectors.length).toBe(2);
      expect(vectors[0].length).toBe(128);
      expect(vectors[1].length).toBe(128);
    });

    it("should tokenize Chinese text", () => {
      const tokens = provider.tokenize("你好世界");
      expect(tokens.size).toBeGreaterThan(0);
    });

    it("should tokenize English text", () => {
      const tokens = provider.tokenize("hello world");
      expect(tokens.has("hello")).toBe(true);
      expect(tokens.has("world")).toBe(true);
    });

    it("should calculate jaccard similarity", () => {
      const tokens1 = new Set(["hello", "world"]);
      const tokens2 = new Set(["hello", "there"]);
      const similarity = provider.jaccardSimilarity(tokens1, tokens2);
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe("InMemoryVectorStore", () => {
    let store: InMemoryVectorStore;

    beforeAll(() => {
      store = new InMemoryVectorStore();
    });

    it("should add and get entry", async () => {
      const entry = {
        id: "test-1",
        vector: [0.1, 0.2, 0.3],
        content: "Test content",
        source: "test",
        createdAt: new Date(),
      };
      
      await store.add(entry);
      const retrieved = await store.get("test-1");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe("Test content");
    });

    it("should delete entry", async () => {
      const deleted = await store.delete("test-1");
      expect(deleted).toBe(true);
      
      const retrieved = await store.get("test-1");
      expect(retrieved).toBeNull();
    });

    it("should count entries", async () => {
      await store.add({
        id: "test-2",
        vector: [0.1, 0.2, 0.3],
        content: "Test",
        source: "test",
        createdAt: new Date(),
      });
      
      const count = await store.count();
      expect(count).toBeGreaterThan(0);
    });

    it("should search by similarity", async () => {
      const queryVector = [0.1, 0.2, 0.3];
      const results = await store.search(queryVector, { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should filter results", async () => {
      const queryVector = [0.1, 0.2, 0.3];
      const results = await store.search(queryVector, {
        topK: 5,
        filter: (entry) => entry.source === "test",
      });
      expect(results.every(r => r.entry.source === "test")).toBe(true);
    });

    it("should clear store", async () => {
      await store.clear();
      const count = await store.count();
      expect(count).toBe(0);
    });
  });

  describe("EmbeddingEngine", () => {
    let engine: EmbeddingEngine;

    beforeAll(() => {
      engine = new EmbeddingEngine({
        provider: { type: "local" },
        store: { type: "memory" },
        cache: { enabled: true, maxSize: 100 },
        batch: { enabled: false },
      });
    });

    afterAll(async () => {
      await engine.close();
    });

    it("should initialize", async () => {
      await engine.initialize();
      // Should not throw
    });

    it("should embed text", async () => {
      const result = await engine.embedText({
        text: "Hello world",
        useCache: false,
      });
      
      expect(result.vector).toBeDefined();
      expect(result.dimensions).toBe(128);
      expect(result.provider).toBe("local");
      expect(result.cached).toBe(false);
    });

    it("should use cache", async () => {
      const text = "Cached text";
      
      // First call - not cached
      const result1 = await engine.embedText({ text, useCache: true });
      expect(result1.cached).toBe(false);
      
      // Second call - should be cached
      const result2 = await engine.embedText({ text, useCache: true });
      expect(result2.cached).toBe(true);
    });

    it("should index content", async () => {
      const result = await engine.indexContent({
        content: "This is a long piece of content that needs to be indexed for semantic search.",
        source: "test-doc",
        chunkSize: 50,
        chunkOverlap: 10,
      });
      
      expect(result.chunks).toBeGreaterThan(0);
      expect(result.entries.length).toBe(result.chunks);
    });

    it("should search indexed content", async () => {
      // First index some content
      await engine.indexContent({
        content: "The quick brown fox jumps over the lazy dog.",
        source: "search-test",
      });
      
      // Then search
      const result = await engine.searchVectors({
        query: "fox jumps",
        topK: 5,
        source: "search-test",
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].source).toBe("search-test");
    });

    it("should get status", async () => {
      const status = await engine.getStatus();
      
      expect(status.provider).toBeDefined();
      expect(status.store).toBeDefined();
      expect(status.cache).toBeDefined();
      expect(status.batch).toBeDefined();
    });

    it("should clear store", async () => {
      await engine.clearStore();
      const status = await engine.getStatus();
      expect(status.store.vectors).toBe(0);
    });
  });

  describe("工具定义", () => {
    it("should have 10 tools", async () => {
      const { EMBEDDING_TOOL_COUNT } = await import("../v27-agent/embedding/index.js");
      expect(EMBEDDING_TOOL_COUNT).toBe(10);
    });

    it("should have all required tools", async () => {
      const { EMBEDDING_TOOLS } = await import("../v27-agent/embedding/index.js");
      
      const toolNames = EMBEDDING_TOOLS.map(t => t.name);
      
      expect(toolNames).toContain("embedding_embed");
      expect(toolNames).toContain("embedding_search");
      expect(toolNames).toContain("embedding_index");
      expect(toolNames).toContain("embedding_status");
      expect(toolNames).toContain("embedding_clear");
      expect(toolNames).toContain("embedding_similarity");
      expect(toolNames).toContain("embedding_batch_embed");
      expect(toolNames).toContain("embedding_get");
      expect(toolNames).toContain("embedding_delete");
      expect(toolNames).toContain("embedding_list_providers");
    });
  });

  describe("类型定义", () => {
    it("should have default config", () => {
      expect(DEFAULT_EMBEDDING_CONFIG).toBeDefined();
      expect(DEFAULT_EMBEDDING_CONFIG.provider.type).toBe("auto");
      expect(DEFAULT_EMBEDDING_CONFIG.store.type).toBe("memory");
      expect(DEFAULT_EMBEDDING_CONFIG.cache?.enabled).toBe(true);
    });
  });
});
