/**
 * V37: 系统工具集 - 系统摘要引擎
 */

import { spawnSync } from "node:child_process";
import os from "node:os";
import type { OsSummary } from "./types.js";

/**
 * 安全 trim
 */
function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 获取 macOS 版本
 */
function macosVersion(): string {
  const res = spawnSync("sw_vers", ["-productVersion"], { encoding: "utf-8" });
  const out = safeTrim(res.stdout);
  return out || os.release();
}

/**
 * 获取 macOS 型号
 */
function macosModel(): string | undefined {
  const res = spawnSync("sysctl", ["-n", "hw.model"], { encoding: "utf-8" });
  const out = safeTrim(res.stdout);
  return out.length > 0 ? out : undefined;
}

/**
 * 获取系统摘要
 */
export function getOsSummary(): OsSummary {
  const platform = os.platform();
  const release = os.release();
  const arch = os.arch();
  const hostname = os.hostname();
  const cpus = os.cpus().length;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const uptime = os.uptime();

  const label = (() => {
    if (platform === "darwin") {
      return `macOS ${macosVersion()} (${arch})`;
    }
    if (platform === "win32") {
      return `Windows ${release} (${arch})`;
    }
    return `${platform} ${release} (${arch})`;
  })();

  const deviceFamily = (() => {
    if (platform === "darwin") return "Mac";
    if (platform === "win32") return "Windows";
    if (platform === "linux") return "Linux";
    return platform;
  })();

  const modelIdentifier = (() => {
    if (platform === "darwin") {
      return macosModel();
    }
    return arch;
  })();

  return {
    platform,
    arch,
    release,
    label,
    hostname,
    cpus,
    totalMemory,
    freeMemory,
    uptime,
  };
}

/**
 * 获取主要 IPv4 地址
 */
export function getPrimaryIPv4(): string | undefined {
  const nets = os.networkInterfaces();
  const prefer = ["en0", "eth0"];

  const pick = (names: string[]): string | undefined => {
    for (const name of names) {
      const list = nets[name];
      const entry = list?.find((n) => n.family === "IPv4" && !n.internal);
      if (entry?.address) {
        return entry.address;
      }
    }
    for (const list of Object.values(nets)) {
      const entry = list?.find((n) => n.family === "IPv4" && !n.internal);
      if (entry?.address) {
        return entry.address;
      }
    }
    return undefined;
  };

  return pick(prefer) ?? hostname;
}

/**
 * 格式化内存大小
 */
export function formatMemory(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/**
 * 格式化运行时间
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);

  return parts.length > 0 ? parts.join(" ") : "<1m";
}
