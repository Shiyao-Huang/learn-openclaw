/**
 * V38: 命令执行审批系统 - 测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ApprovalEngine,
  getApprovalEngine,
  resetApprovalEngine,
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_SAFE_BINS,
  type ApprovalConfig,
  type AllowlistEntry,
  type CommandAnalysis,
  type ApprovalResult,
} from "../v38-agent/approval/index.js";

describe("V38: 命令执行审批系统", () => {
  let engine: ApprovalEngine;

  beforeEach(() => {
    resetApprovalEngine();
    engine = getApprovalEngine({
      configFile: ":memory:",
      defaults: { ...DEFAULT_APPROVAL_POLICY },
      allowlist: [],
      safeBins: [...DEFAULT_SAFE_BINS],
    });
  });

  afterEach(() => {
    engine = null as any;
    resetApprovalEngine();
  });

  describe("ApprovalEngine - 初始化", () => {
    it("should create engine with default config", () => {
      const e = getApprovalEngine();
      expect(e).toBeDefined();
      expect(e.getConfig().defaults.security).toBe("deny");
    });

    it("should create engine with custom config", () => {
      const e = getApprovalEngine({
        defaults: { security: "full", ask: "off", askFallback: "deny", autoAllowSkills: true },
        allowlist: [],
        safeBins: ["npm", "node"],
      });
      expect(e.getConfig().defaults.security).toBe("full");
      expect(e.getConfig().defaults.autoAllowSkills).toBe(true);
      expect(e.getConfig().safeBins).toContain("npm");
    });

    it("should return singleton engine", () => {
      const e1 = getApprovalEngine();
      const e2 = getApprovalEngine();
      expect(e1).toBe(e2);
    });
  });

  describe("CommandAnalysis - 命令解析", () => {
    it("should parse simple command", () => {
      const analysis = engine.analyze("ls -la");
      expect(analysis.ok).toBe(true);
      expect(analysis.segments).toHaveLength(1);
      expect(analysis.segments[0].executable).toBe("ls");
      expect(analysis.segments[0].argv).toEqual(["ls", "-la"]);
    });

    it("should parse command with pipe", () => {
      const analysis = engine.analyze("cat file.txt | grep pattern");
      expect(analysis.ok).toBe(true);
      expect(analysis.chains).toBeDefined();
      expect(analysis.chains!.length).toBeGreaterThan(1);
    });

    it("should parse command with && ", () => {
      const analysis = engine.analyze("npm install && npm run build");
      expect(analysis.ok).toBe(true);
      expect(analysis.chains).toBeDefined();
      expect(analysis.chains!.length).toBe(2);
    });

    it("should parse command with ||", () => {
      const analysis = engine.analyze("npm test || echo 'tests failed'");
      expect(analysis.ok).toBe(true);
      expect(analysis.chains).toBeDefined();
      expect(analysis.chains!.length).toBe(2);
    });

    it("should parse command with semicolon", () => {
      const analysis = engine.analyze("echo hello; echo world");
      expect(analysis.ok).toBe(true);
      expect(analysis.chains).toBeDefined();
      expect(analysis.chains!.length).toBe(2);
    });

    it("should detect path-based executable", () => {
      const analysis = engine.analyze("/usr/local/bin/node script.js");
      expect(analysis.ok).toBe(true);
      expect(analysis.segments[0].isPathBased).toBe(true);
      expect(analysis.segments[0].resolvedPath).toBe("/usr/local/bin/node");
    });

    it("should handle empty command", () => {
      const analysis = engine.analyze("");
      expect(analysis.ok).toBe(false);
    });

    it("should handle whitespace-only command", () => {
      const analysis = engine.analyze("   ");
      expect(analysis.ok).toBe(false);
    });
  });

  describe("Allowlist - 白名单管理", () => {
    it("should add entry to allowlist", () => {
      const entry = engine.addAllowlistEntry({
        pattern: "npm*",
        description: "NPM commands",
      });
      expect(entry.id).toBeDefined();
      expect(entry.pattern).toBe("npm*");
      expect(entry.createdAt).toBeDefined();
    });

    it("should list allowlist entries", () => {
      engine.addAllowlistEntry({ pattern: "git*" });
      engine.addAllowlistEntry({ pattern: "npm*" });
      const entries = engine.listAllowlist();
      expect(entries.length).toBeGreaterThanOrEqual(2);
    });

    it("should get allowlist entry by id", () => {
      const entry = engine.addAllowlistEntry({ pattern: "git*" });
      const found = engine.getAllowlistEntry(entry.id!);
      expect(found).toBeDefined();
      expect(found?.pattern).toBe("git*");
    });

    it("should remove allowlist entry", () => {
      const entry = engine.addAllowlistEntry({ pattern: "git*" });
      engine.removeAllowlistEntry(entry.id!);
      const entries = engine.listAllowlist();
      expect(entries.find((e) => e.id === entry.id)).toBeUndefined();
    });

    it("should update allowlist entry", () => {
      const entry = engine.addAllowlistEntry({ pattern: "git*" });
      engine.updateAllowlistEntry(entry.id!, { description: "Git commands" });
      const updated = engine.getAllowlistEntry(entry.id!);
      expect(updated?.description).toBe("Git commands");
    });

    it("should match pattern with wildcard", () => {
      engine.addAllowlistEntry({ pattern: "npm*" });
      expect(engine.matchAllowlist("npm install")).toBe(true);
      expect(engine.matchAllowlist("npm run build")).toBe(true);
      expect(engine.matchAllowlist("yarn install")).toBe(false);
    });

    it("should match exact pattern", () => {
      engine.addAllowlistEntry({ pattern: "git" });
      expect(engine.matchAllowlist("git")).toBe(true);
      expect(engine.matchAllowlist("git status")).toBe(false);
    });
  });

  describe("SafeBins - 安全二进制管理", () => {
    it("should list safe bins", () => {
      const bins = engine.listSafeBins();
      expect(bins).toContain("ls");
      expect(bins).toContain("cat");
      expect(bins).toContain("grep");
    });

    it("should add safe bin", () => {
      engine.addSafeBin("my-custom-tool");
      const bins = engine.listSafeBins();
      expect(bins).toContain("my-custom-tool");
    });

    it("should remove safe bin", () => {
      engine.addSafeBin("test-bin");
      engine.removeSafeBin("test-bin");
      const bins = engine.listSafeBins();
      expect(bins).not.toContain("test-bin");
    });

    it("should not duplicate safe bins", () => {
      engine.addSafeBin("unique-bin");
      engine.addSafeBin("unique-bin");
      const bins = engine.listSafeBins().filter((b) => b === "unique-bin");
      expect(bins.length).toBe(1);
    });
  });

  describe("Approval - 审批检查", () => {
    it("should deny command by default", () => {
      const result = engine.check("rm -rf /");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it("should allow safe bin command", () => {
      const result = engine.check("ls -la");
      expect(result.allowed).toBe(true);
    });

    it("should allow allowlisted command", () => {
      engine.addAllowlistEntry({ pattern: "rm*" });
      const result = engine.check("rm -rf ./node_modules");
      expect(result.allowed).toBe(true);
      expect(result.matchedEntries.length).toBeGreaterThan(0);
    });

    it("should track matched entries", () => {
      engine.addAllowlistEntry({ pattern: "npm*", description: "NPM" });
      const result = engine.check("npm install");
      expect(result.matchedEntries.length).toBeGreaterThan(0);
      expect(result.matchedEntries[0].pattern).toBe("npm*");
    });

    it("should use correct security policy", () => {
      // deny policy
      engine.setPolicy({ ...DEFAULT_APPROVAL_POLICY, security: "deny" });
      const r1 = engine.check("some-unknown-command");
      expect(r1.allowed).toBe(false);

      // full policy
      engine.setPolicy({ ...DEFAULT_APPROVAL_POLICY, security: "full" });
      const r2 = engine.check("some-unknown-command");
      expect(r2.allowed).toBe(true);
    });

    it("should analyze complex commands", () => {
      engine.addAllowlistEntry({ pattern: "npm*" });
      engine.addAllowlistEntry({ pattern: "echo*" });
      const result = engine.check("npm run build && echo 'done'");
      expect(result.analysis.chains).toBeDefined();
      expect(result.analysis.chains!.length).toBe(2);
    });
  });

  describe("Policy - 策略管理", () => {
    it("should get current policy", () => {
      const policy = engine.getPolicy();
      expect(policy.security).toBeDefined();
      expect(policy.ask).toBeDefined();
    });

    it("should set new policy", () => {
      engine.setPolicy({
        security: "allowlist",
        ask: "always",
        askFallback: "deny",
        autoAllowSkills: true,
      });
      const policy = engine.getPolicy();
      expect(policy.security).toBe("allowlist");
      expect(policy.ask).toBe("always");
    });
  });

  describe("Stats - 统计信息", () => {
    it("should return stats", () => {
      const stats = engine.getStats();
      expect(stats.totalChecks).toBeDefined();
      expect(stats.allowed).toBeDefined();
      expect(stats.denied).toBeDefined();
    });

    it("should track check counts", () => {
      engine.check("ls");
      engine.check("rm -rf");
      const stats = engine.getStats();
      expect(stats.totalChecks).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Config - 配置管理", () => {
    it("should export config", () => {
      engine.addAllowlistEntry({ pattern: "test*" });
      const config = engine.exportConfig();
      expect(config.allowlist).toBeDefined();
      expect(config.defaults).toBeDefined();
      expect(config.safeBins).toBeDefined();
    });

    it("should import config", () => {
      const config: Partial<ApprovalConfig> = {
        defaults: { security: "full", ask: "off", askFallback: "deny", autoAllowSkills: false },
        allowlist: [{ pattern: "imported*" }],
        safeBins: ["imported-bin"],
      };
      engine.importConfig(config);
      expect(engine.getPolicy().security).toBe("full");
      expect(engine.listAllowlist().some((e) => e.pattern === "imported*")).toBe(true);
      expect(engine.listSafeBins()).toContain("imported-bin");
    });

    it("should reset config", () => {
      engine.addAllowlistEntry({ pattern: "test*" });
      engine.addSafeBin("test-bin");
      engine.reset();
      const entries = engine.listAllowlist();
      const bins = engine.listSafeBins();
      expect(entries.some((e) => e.pattern === "test*")).toBe(false);
      expect(bins).not.toContain("test-bin");
    });
  });

  describe("Edge Cases - 边界情况", () => {
    it("should handle quoted arguments", () => {
      const analysis = engine.analyze('echo "hello world"');
      expect(analysis.ok).toBe(true);
      expect(analysis.segments[0].argv).toContain("hello world");
    });

    it("should handle escaped characters", () => {
      const analysis = engine.analyze('echo "hello\\nworld"');
      expect(analysis.ok).toBe(true);
    });

    it("should handle environment variables", () => {
      const analysis = engine.analyze("echo $HOME");
      expect(analysis.ok).toBe(true);
      expect(analysis.segments[0].argv).toContain("$HOME");
    });

    it("should handle subshell syntax", () => {
      const analysis = engine.analyze("echo $(date)");
      expect(analysis.ok).toBe(true);
    });

    it("should handle redirect operators", () => {
      const analysis = engine.analyze("cat file.txt > output.txt");
      expect(analysis.ok).toBe(true);
    });

    it("should handle very long command", () => {
      const args = Array(100).fill("arg");
      const cmd = `echo ${args.join(" ")}`;
      const analysis = engine.analyze(cmd);
      expect(analysis.ok).toBe(true);
      expect(analysis.segments[0].argv.length).toBe(101);
    });
  });
});
