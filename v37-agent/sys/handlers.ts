/**
 * V37: 系统工具集 - 工具处理器
 */

import type { ToolHandler } from "../types.js";
import { copyToClipboard, pasteFromClipboard } from "./clipboard.js";
import { getOsSummary, getPrimaryIPv4, formatMemory, formatUptime } from "./os-summary.js";
import {
  updateSystemPresence,
  listSystemPresence,
  getPresence,
} from "./presence.js";
import { DEFAULT_SYS_TOOLS_CONFIG, type SysToolsConfig } from "./types.js";
import os from "node:os";

let config = { ...DEFAULT_SYS_TOOLS_CONFIG };

/**
 * 创建系统工具处理器
 */
export function createSysHandlers(): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 剪贴板工具
  handlers.set("sys_clipboard_copy", async (params: { text: string }) => {
    const result = await copyToClipboard(params.text);
    if (result.success) {
      return {
        content: [{ type: "text", text: `已复制到剪贴板 (使用 ${result.method})` }],
      };
    }
    return {
      content: [{ type: "text", text: `复制失败: ${result.error}` }],
      isError: true,
    };
  });

  handlers.set("sys_clipboard_paste", async () => {
    const result = await pasteFromClipboard();
    if (result.success && result.content !== undefined) {
      return {
        content: [{ type: "text", text: result.content }],
      };
    }
    return {
      content: [{ type: "text", text: `读取失败: ${result.error}` }],
      isError: true,
    };
  });

  // 系统摘要工具
  handlers.set("sys_os_info", async () => {
    const info = getOsSummary();
    return {
      content: [{
        type: "text",
        text: `操作系统信息:
- 平台: ${info.label}
- 主机名: ${info.hostname}
- 架构: ${info.arch}
- CPU 核心数: ${info.cpus}
- 总内存: ${formatMemory(info.totalMemory)}
- 可用内存: ${formatMemory(info.freeMemory)}
- 系统运行时间: ${formatUptime(info.uptime)}`,
      }],
    };
  });

  handlers.set("sys_hostname", async () => {
    return {
      content: [{ type: "text", text: os.hostname() }],
    };
  });

  handlers.set("sys_network_info", async () => {
    const ip = getPrimaryIPv4();
    return {
      content: [{
        type: "text",
        text: `网络信息:
- 主机名: ${os.hostname()}
- 主要 IP: ${ip || "未知"}
- 平台: ${os.platform()}`,
      }],
    };
  });

  handlers.set("sys_uptime", async () => {
    const uptime = os.uptime();
    return {
      content: [{
        type: "text",
        text: `系统运行时间: ${formatUptime(uptime)}`,
      }],
    };
  });

  // 系统存在工具
  handlers.set("sys_presence_get", async () => {
    const hostname = os.hostname();
    const presence = getPresence(hostname);
    if (presence) {
      return {
        content: [{
          type: "text",
          text: `当前节点:
- 主机: ${presence.host || "未知"}
- IP: ${presence.ip || "未知"}
- 平台: ${presence.platform || "未知"}
- 模式: ${presence.mode || "未知"}
- 原因: ${presence.reason || "未知"}
- 最后更新: ${new Date(presence.ts).toISOString()}`,
        }],
      };
    }
    return {
      content: [{ type: "text", text: "未找到当前节点的存在信息" }],
    };
  });

  handlers.set("sys_presence_list", async () => {
    const presences = listSystemPresence(config);
    if (presences.length === 0) {
      return {
        content: [{ type: "text", text: "没有已知的节点" }],
      };
    }

    const lines = presences.map((p, i) => {
      return `${i + 1}. ${p.host || "未知"} (${p.ip || "无IP"}) - ${p.mode || "未知"} - ${formatAge(Date.now() - p.ts)}`;
    });

    return {
      content: [{
        type: "text",
        text: `已知节点 (${presences.length}):\n${lines.join("\n")}`,
      }],
    };
  });

  handlers.set("sys_presence_update", async (params: {
    text: string;
    deviceId?: string;
    host?: string;
    ip?: string;
    version?: string;
    mode?: string;
    reason?: string;
    roles?: string[];
  }) => {
    try {
      const result = updateSystemPresence(params, config);
      return {
        content: [{
          type: "text",
          text: `已更新节点存在:
- 键: ${result.key}
- 变更: ${result.changedKeys.length > 0 ? result.changedKeys.join(", ") : "无"}
- 文本: ${result.next.text}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `更新失败: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  });

  return handlers;
}

/**
 * 格式化年龄
 */
function formatAge(ms: number): string {
  if (ms < 0) return "未知";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * 获取配置
 */
export function getSysConfig(): SysToolsConfig {
  return { ...config };
}

/**
 * 更新配置
 */
export function updateSysConfig(newConfig: Partial<SysToolsConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * 关闭处理器
 */
export function closeSysHandlers(): void {
  // 清理资源
}
