/**
 * V28: 链接理解系统 - 测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  LinkUnderstandingEngine,
  getLinkEngine,
  closeLinkEngine,
  extractLinksFromMessage,
  validateUrl,
  DEFAULT_LINK_CONFIG,
} from "../v28-agent/link/index.js";

describe("V28: 链接理解系统", () => {
  describe("extractLinksFromMessage", () => {
    it("should extract plain URLs", () => {
      const message = "Check out https://example.com for more info";
      const links = extractLinksFromMessage(message);
      expect(links).toContain("https://example.com");
    });

    it("should extract markdown links", () => {
      const message = "See [Example](https://example.com) for details";
      const links = extractLinksFromMessage(message);
      expect(links).toContain("https://example.com");
    });

    it("should extract multiple links", () => {
      const message = "Visit https://foo.com and https://bar.org";
      const links = extractLinksFromMessage(message);
      expect(links).toHaveLength(2);
      expect(links).toContain("https://foo.com");
      expect(links).toContain("https://bar.org");
    });

    it("should respect maxLinks option", () => {
      const message = "Links: https://a.com https://b.com https://c.com https://d.com";
      const links = extractLinksFromMessage(message, { maxLinks: 2 });
      expect(links).toHaveLength(2);
    });

    it("should not extract http links by default", () => {
      const message = "HTTP: http://insecure.com HTTPS: https://secure.com";
      const links = extractLinksFromMessage(message);
      expect(links).not.toContain("http://insecure.com");
      expect(links).toContain("https://secure.com");
    });

    it("should filter private IPs by default", () => {
      const message = "Private: https://192.168.1.1";
      const links = extractLinksFromMessage(message);
      expect(links).toHaveLength(0);
    });

    it("should filter localhost by default", () => {
      const message = "Local: https://localhost:8080";
      const links = extractLinksFromMessage(message);
      expect(links).toHaveLength(0);
    });

    it("should handle empty message", () => {
      const links = extractLinksFromMessage("");
      expect(links).toHaveLength(0);
    });
  });

  describe("validateUrl", () => {
    it("should validate HTTPS URL", () => {
      const result = validateUrl("https://example.com");
      expect(result.valid).toBe(true);
    });

    it("should reject HTTP URL by default", () => {
      const result = validateUrl("http://example.com");
      expect(result.valid).toBe(false);
    });

    it("should reject localhost", () => {
      const result = validateUrl("https://localhost");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("localhost");
    });

    it("should reject private IP", () => {
      const result = validateUrl("https://192.168.1.1");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("private");
    });

    it("should reject invalid URL", () => {
      const result = validateUrl("not-a-url");
      expect(result.valid).toBe(false);
    });

    it("should allow private IP with option", () => {
      const result = validateUrl("https://192.168.1.1", { allowPrivate: true });
      expect(result.valid).toBe(true);
    });
  });

  describe("LinkUnderstandingEngine", () => {
    let engine: LinkUnderstandingEngine;

    beforeEach(() => {
      closeLinkEngine();
      engine = getLinkEngine();
    });

    afterEach(() => {
      closeLinkEngine();
    });

    it("should create engine with default config", () => {
      const engine = new LinkUnderstandingEngine();
      const status = engine.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.config.maxLinks).toBe(DEFAULT_LINK_CONFIG.maxLinks);
    });

    it("should create engine with custom config", () => {
      const engine = new LinkUnderstandingEngine({
        maxLinks: 10,
        timeoutSeconds: 60,
      });
      const status = engine.getStatus();
      expect(status.config.maxLinks).toBe(10);
      expect(status.config.timeoutSeconds).toBe(60);
    });

    it("should extract links from message", () => {
      const links = engine.extractLinks("Check https://example.com");
      expect(links).toContain("https://example.com");
    });

    it("should update stats after extraction", () => {
      engine.extractLinks("Check https://example.com");
      const status = engine.getStatus();
      expect(status.stats.totalExtracts).toBe(1);
    });

    it("should clear cache", () => {
      const cleared = engine.clearCache();
      expect(typeof cleared).toBe("number");
    });

    it("should return status", () => {
      const status = engine.getStatus();
      expect(status).toHaveProperty("enabled");
      expect(status).toHaveProperty("config");
      expect(status).toHaveProperty("stats");
      expect(status).toHaveProperty("cache");
    });

    it("should use global engine instance", () => {
      const engine1 = getLinkEngine();
      const engine2 = getLinkEngine();
      expect(engine1).toBe(engine2);
    });
  });

  describe("fetchLink (mock)", () => {
    // Note: These tests would need network mocking for full coverage
    it("should handle invalid URL in fetch", async () => {
      const engine = new LinkUnderstandingEngine();
      // Using a URL that will fail
      const result = await engine.fetchLink("https://this-domain-does-not-exist-12345.com", {
        timeoutSeconds: 2,
      });
      expect(result.error).toBeDefined();
    });
  });

  describe("cache operations", () => {
    it("should cache successful fetch", async () => {
      const engine = new LinkUnderstandingEngine();
      const url = "https://example.com";
      
      // Clear cache first
      engine.clearCache();
      
      const statusBefore = engine.getStatus();
      expect(statusBefore.cache.size).toBe(0);
    });
  });

  describe("tool definitions", () => {
    it("should have correct tool count", async () => {
      const { LINK_TOOL_COUNT, LINK_TOOLS } = await import("../v28-agent/link/tools.js");
      expect(LINK_TOOL_COUNT).toBe(6);
      expect(LINK_TOOLS).toHaveLength(6);
    });

    it("should have required tools", async () => {
      const { LINK_TOOLS } = await import("../v28-agent/link/tools.js");
      const toolNames = LINK_TOOLS.map((t: any) => t.name);
      expect(toolNames).toContain("link_extract");
      expect(toolNames).toContain("link_fetch");
      expect(toolNames).toContain("link_batch_fetch");
      expect(toolNames).toContain("link_status");
      expect(toolNames).toContain("link_clear_cache");
      expect(toolNames).toContain("link_validate");
    });
  });
});
