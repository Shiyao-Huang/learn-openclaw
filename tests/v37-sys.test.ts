/**
 * V37: 系统工具集 - 测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock os module
vi.mock("os", () => ({
  default: {
    platform: () => "darwin",
    arch: () => "arm64",
    release: () => "24.6.0",
    hostname: () => "test-host",
    uptime: () => 86400,
    totalmem: () => 34359738368,
    freemem: () => 17179869184,
    cpus: () => [{ model: "Apple M3 Pro" }],
    networkInterfaces: () => ({
      en0: [{ address: "192.168.1.100", family: "IPv4" }],
    }),
    type: () => "Darwin",
    version: () => "Darwin Kernel Version 24.6.0",
  },
}));

// Mock child_process for clipboard
vi.mock("child_process", () => ({
  default: {
    spawn: vi.fn(() => ({
      stdin: { end: vi.fn() },
      on: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    })),
  },
}));

import {
  formatMemory,
  formatUptime,
  getPrimaryIPv4,
  getOsSummary,
  type OsSummary,
} from "../v37-agent/sys/index.js";

import {
  updateSystemPresence,
  listSystemPresence,
  getPresence,
  clearPresence,
  type SystemPresence,
} from "../v37-agent/sys/presence.js";

describe("V37 System Tools", () => {
  beforeEach(() => {
    clearPresence();
  });

  describe("formatMemory", () => {
    it("should format bytes to GB", () => {
      expect(formatMemory(34359738368)).toBe("32.00 GB");
    });

    it("should format bytes to MB", () => {
      expect(formatMemory(524288000)).toBe("500.00 MB");
    });

    it("should format bytes to KB", () => {
      {
        const kb = formatMemory(512000);
        expect(kb).toBe("500.00 KB");
      }
    });

    it("should handle zero", () => {
      expect(formatMemory(0)).toBe("0 B");
    });
  });

  describe("formatUptime", () => {
    it("should format uptime in days", () => {
      expect(formatUptime(86400)).toBe("1d 0h 0m");
    });

    it("should format uptime in hours", () => {
      expect(formatUptime(7320)).toBe("2h 2m");
    });

    it("should format uptime in minutes", () => {
      expect(formatUptime(180)).toBe("3m");
    });

    it("should handle zero", () => {
      expect(formatUptime(0)).toBe("0m");
    });
  });

  describe("getPrimaryIPv4", () => {
    it("should return primary IPv4 address", () => {
      const ip = getPrimaryIPv4();
      expect(ip).toBe("192.168.1.100");
    });
  });

  describe("OsSummary", () => {
    it("should get OS summary", () => {
      const summary = getOsSummary();
      expect(summary.platform).toBe("darwin");
      expect(summary.arch).toBe("arm64");
      expect(summary.hostname).toBe("test-host");
      expect(summary.totalMemory).toBe(34359738368);
    });
  });

  describe("System Presence", () => {
    it("should update system presence", () => {
      const result = updateSystemPresence({
        text: "Node: test-host (192.168.1.100) · app 1.0.0 · mode gateway · reason test",
        deviceId: "test-device",
        host: "test-host",
        ip: "192.168.1.100",
      });

      expect(result.key).toBe("test-device");
      expect(result.next.text).toContain("test-host");
    });

    it("should list presences", () => {
      updateSystemPresence({
        text: "online",
        deviceId: "device-1",
      });

      const list = listSystemPresence();
      // 会包含 self presence 和我们添加的
      expect(list.length).toBeGreaterThanOrEqual(1);
    });

    it("should get presence by deviceId", () => {
      updateSystemPresence({
        text: "online",
        deviceId: "device-1",
      });

      const presence = getPresence("device-1");
      expect(presence?.text).toBe("online");
    });

    it("should return undefined for unknown presence", () => {
      const presence = getPresence("unknown-key-12345");
      expect(presence).toBeUndefined();
    });

    it("should clear presence", () => {
      updateSystemPresence({
        text: "online",
        deviceId: "device-1",
      });

      clearPresence();
      // clearPresence 会重新初始化 self presence
      const list = listSystemPresence();
      expect(list.some((p) => p.reason === "self")).toBe(true);
    });

    it("should update existing presence", () => {
      updateSystemPresence({
        text: "online",
        deviceId: "device-1",
      });

      const updated = updateSystemPresence({
        text: "busy",
        deviceId: "device-1",
      });

      expect(updated.next.text).toBe("busy");
      expect(updated.previous?.text).toBe("online");
    });

    it("should store roles", () => {
      const result = updateSystemPresence({
        text: "online",
        deviceId: "device-1",
        roles: ["gateway", "agent"],
      });

      expect(result.next.roles).toEqual(["gateway", "agent"]);
    });

    it("should store version and mode", () => {
      const result = updateSystemPresence({
        text: "online",
        deviceId: "device-1",
        version: "1.0.0",
        mode: "production",
      });

      expect(result.next.version).toBe("1.0.0");
      expect(result.next.mode).toBe("production");
    });
  });

  describe("Tool Definitions", () => {
    it("should have correct tool count", async () => {
      const { SYS_TOOL_COUNT } = await import("../v37-agent/sys/index.js");
      expect(SYS_TOOL_COUNT).toBe(9);
    });

    it("should have clipboard tools", async () => {
      const { SYS_TOOLS } = await import("../v37-agent/sys/index.js");
      const toolNames = SYS_TOOLS.map((t) => t.name);
      expect(toolNames).toContain("sys_clipboard_copy");
      expect(toolNames).toContain("sys_clipboard_paste");
    });

    it("should have OS info tools", async () => {
      const { SYS_TOOLS } = await import("../v37-agent/sys/index.js");
      const toolNames = SYS_TOOLS.map((t) => t.name);
      expect(toolNames).toContain("sys_os_info");
      expect(toolNames).toContain("sys_hostname");
      expect(toolNames).toContain("sys_network_info");
      expect(toolNames).toContain("sys_uptime");
    });

    it("should have presence tools", async () => {
      const { SYS_TOOLS } = await import("../v37-agent/sys/index.js");
      const toolNames = SYS_TOOLS.map((t) => t.name);
      expect(toolNames).toContain("sys_presence_get");
      expect(toolNames).toContain("sys_presence_list");
      expect(toolNames).toContain("sys_presence_update");
    });
  });
});
