/**
 * V37: 系统工具集 - 系统存在引擎
 */

import { spawnSync } from "node:child_process";
import os from "node:os";
import type { SystemPresence, SystemPresenceUpdate, SysToolsConfig } from "./types.js";
import { DEFAULT_SYS_TOOLS_CONFIG } from "./types.js";

const entries = new Map<string, SystemPresence>();

/**
 * 标准化存在键
 */
function normalizePresenceKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const trimmed = key.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
}

/**
 * 获取主要 IPv4 地址
 */
function resolvePrimaryIPv4(): string | undefined {
  const nets = os.networkInterfaces();
  const prefer = ["en0", "eth0"];
  const pick = (names: string[]) => {
    for (const name of names) {
      const list = nets[name];
      const entry = list?.find((n) => n.family === "IPv4" && !n.internal);
      if (entry?.address) return entry.address;
    }
    for (const list of Object.values(nets)) {
      const entry = list?.find((n) => n.family === "IPv4" && !n.internal);
      if (entry?.address) return entry.address;
    }
    return undefined;
  };
  return pick(prefer) ?? os.hostname();
}

/**
 * 获取 macOS 型号
 */
function macosModel(): string | undefined {
  const res = spawnSync("sysctl", ["-n", "hw.model"], { encoding: "utf-8" });
  const out = typeof res.stdout === "string" ? res.stdout.trim() : "";
  return out.length > 0 ? out : undefined;
}

/**
 * 获取 macOS 版本
 */
function macOSVersion(): string {
  const res = spawnSync("sw_vers", ["-productVersion"], { encoding: "utf-8" });
  const out = typeof res.stdout === "string" ? res.stdout.trim() : "";
  return out.length > 0 ? out : os.release();
}

/**
 * 初始化自身存在
 */
function initSelfPresence(): void {
  const host = os.hostname();
  const ip = resolvePrimaryIPv4() ?? undefined;
  const version = process.env.OPENCLAW_VERSION ?? process.env.npm_package_version ?? "unknown";
  const arch = os.arch();
  const platform = os.platform();

  const modelIdentifier = (() => {
    if (platform === "darwin") return macosModel();
    return arch;
  })();

  const platformLabel = (() => {
    if (platform === "darwin") return `macOS ${macOSVersion()}`;
    if (platform === "win32") return `Windows ${os.release()}`;
    return `${platform} ${os.release()}`;
  })();

  const deviceFamily = (() => {
    if (platform === "darwin") return "Mac";
    if (platform === "win32") return "Windows";
    if (platform === "linux") return "Linux";
    return platform;
  })();

  const text = `Gateway: ${host}${ip ? ` (${ip})` : ""} · app ${version} · mode gateway · reason self`;
  const selfEntry: SystemPresence = {
    host,
    ip,
    version,
    platform: platformLabel,
    deviceFamily,
    modelIdentifier,
    mode: "gateway",
    reason: "self",
    text,
    ts: Date.now(),
  };
  const key = host.toLowerCase();
  entries.set(key, selfEntry);
}

/**
 * 确保自身存在已初始化
 */
function ensureSelfPresence(): void {
  if (entries.size === 0) {
    initSelfPresence();
  }
}

/**
 * 触碰自身存在
 */
function touchSelfPresence(): void {
  const host = os.hostname();
  const key = host.toLowerCase();
  const existing = entries.get(key);
  if (existing) {
    entries.set(key, { ...existing, ts: Date.now() });
  } else {
    initSelfPresence();
  }
}

// 初始化
initSelfPresence();

/**
 * 解析存在文本
 */
function parsePresence(text: string): SystemPresence {
  const trimmed = text.trim();
  const pattern =
    /Node:\s*([^ (]+)\s*\(([^)]+)\)\s*·\s*app\s*([^·]+?)\s*·\s*last input\s*([0-9]+)s ago\s*·\s*mode\s*([^·]+?)\s*·\s*reason\s*(.+)$/i;
  const match = trimmed.match(pattern);
  if (!match) {
    return { text: trimmed, ts: Date.now() };
  }
  const [, host, ip, version, lastInputStr, mode, reasonRaw] = match;
  const lastInputSeconds = Number.parseInt(lastInputStr, 10);
  const reason = reasonRaw.trim();
  return {
    host: host.trim(),
    ip: ip.trim(),
    version: version.trim(),
    lastInputSeconds: Number.isFinite(lastInputSeconds) ? lastInputSeconds : undefined,
    mode: mode.trim(),
    reason,
    text: trimmed,
    ts: Date.now(),
  };
}

/**
 * 合并字符串列表
 */
function mergeStringList(...values: Array<string[] | undefined>): string[] | undefined {
  const out = new Set<string>();
  for (const list of values) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const trimmed = String(item).trim();
      if (trimmed) out.add(trimmed);
    }
  }
  return out.size > 0 ? [...out] : undefined;
}

/**
 * 更新系统存在
 */
export function updateSystemPresence(
  payload: {
    text: string;
    deviceId?: string;
    instanceId?: string;
    host?: string;
    ip?: string;
    version?: string;
    platform?: string;
    deviceFamily?: string;
    modelIdentifier?: string;
    lastInputSeconds?: number;
    mode?: string;
    reason?: string;
    roles?: string[];
    scopes?: string[];
  },
  config: SysToolsConfig = DEFAULT_SYS_TOOLS_CONFIG,
): SystemPresenceUpdate {
  if (!config.enabled) {
    throw new Error("System presence is disabled");
  }

  ensureSelfPresence();
  const parsed = parsePresence(payload.text);
  const key =
    normalizePresenceKey(payload.deviceId) ||
    normalizePresenceKey(payload.instanceId) ||
    normalizePresenceKey(parsed.instanceId) ||
    normalizePresenceKey(parsed.host) ||
    parsed.ip ||
    parsed.text.slice(0, 64) ||
    os.hostname().toLowerCase();

  const hadExisting = entries.has(key);
  const existing = entries.get(key) ?? ({} as SystemPresence);
  const merged: SystemPresence = {
    ...existing,
    ...parsed,
    host: payload.host ?? parsed.host ?? existing.host,
    ip: payload.ip ?? parsed.ip ?? existing.ip,
    version: payload.version ?? parsed.version ?? existing.version,
    platform: payload.platform ?? existing.platform,
    deviceFamily: payload.deviceFamily ?? existing.deviceFamily,
    modelIdentifier: payload.modelIdentifier ?? existing.modelIdentifier,
    mode: payload.mode ?? parsed.mode ?? existing.mode,
    lastInputSeconds: payload.lastInputSeconds ?? parsed.lastInputSeconds ?? existing.lastInputSeconds,
    reason: payload.reason ?? parsed.reason ?? existing.reason,
    deviceId: payload.deviceId ?? existing.deviceId,
    roles: mergeStringList(existing.roles, payload.roles),
    scopes: mergeStringList(existing.scopes, payload.scopes),
    instanceId: payload.instanceId ?? parsed.instanceId ?? existing.instanceId,
    text: payload.text || parsed.text || existing.text,
    ts: Date.now(),
  };

  entries.set(key, merged);

  const trackKeys = ["host", "ip", "version", "mode", "reason"] as const;
  type TrackKey = (typeof trackKeys)[number];
  const changes: Partial<Pick<SystemPresence, TrackKey>> = {};
  const changedKeys: TrackKey[] = [];
  for (const k of trackKeys) {
    const prev = existing[k];
    const next = merged[k];
    if (prev !== next) {
      changes[k] = next;
      changedKeys.push(k);
    }
  }

  return {
    key,
    previous: hadExisting ? existing : undefined,
    next: merged,
    changes,
    changedKeys,
  } satisfies SystemPresenceUpdate;
}

/**
 * 更新或插入存在
 */
export function upsertPresence(
  key: string,
  presence: Partial<SystemPresence>,
  config: SysToolsConfig = DEFAULT_SYS_TOOLS_CONFIG,
): void {
  if (!config.enabled) return;

  ensureSelfPresence();
  const normalizedKey = normalizePresenceKey(key) ?? os.hostname().toLowerCase();
  const existing = entries.get(normalizedKey) ?? ({} as SystemPresence);
  const roles = mergeStringList(existing.roles, presence.roles);
  const scopes = mergeStringList(existing.scopes, presence.scopes);
  const merged: SystemPresence = {
    ...existing,
    ...presence,
    roles,
    scopes,
    ts: Date.now(),
    text:
      presence.text ||
      existing.text ||
      `Node: ${presence.host ?? existing.host ?? "unknown"} · mode ${presence.mode ?? existing.mode ?? "unknown"}`,
  };
  entries.set(normalizedKey, merged);
}

/**
 * 列出系统存在
 */
export function listSystemPresence(config: SysToolsConfig = DEFAULT_SYS_TOOLS_CONFIG): SystemPresence[] {
  if (!config.enabled) return [];

  ensureSelfPresence();

  // 清理过期条目
  const now = Date.now();
  for (const [k, v] of entries) {
    if (now - v.ts > config.presenceTtlMs) {
      entries.delete(k);
    }
  }

  // 强制最大大小 (按时间戳 LRU)
  if (entries.size > config.presenceMaxEntries) {
    const sorted = [...entries.entries()].toSorted((a, b) => a[1].ts - b[1].ts);
    const toDrop = entries.size - config.presenceMaxEntries;
    for (let i = 0; i < toDrop; i++) {
      entries.delete(sorted[i][0]);
    }
  }

  touchSelfPresence();
  return [...entries.values()].toSorted((a, b) => b.ts - a.ts);
}

/**
 * 获取单个存在
 */
export function getPresence(key: string): SystemPresence | undefined {
  ensureSelfPresence();
  return entries.get(normalizePresenceKey(key) ?? "");
}

/**
 * 清除所有存在
 */
export function clearPresence(): void {
  entries.clear();
  initSelfPresence();
}
