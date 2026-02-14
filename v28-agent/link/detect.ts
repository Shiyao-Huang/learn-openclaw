/**
 * V28: 链接理解系统 - 链接检测
 * 
 * 从消息中提取 HTTP/HTTPS 链接
 */

import { DEFAULT_MAX_LINKS } from "./defaults.js";
import type { ExtractLinksOptions } from "./types.js";

// Markdown 链接语法正则: [text](url)
const MARKDOWN_LINK_RE = /\[[^\]]*]\((https?:\/\/\S+?)\)/gi;

// 裸链接正则
const BARE_LINK_RE = /https?:\/\/\S+/gi;

// 私有 IP 正则
const PRIVATE_IP_RE =
  /^(127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|localhost)/i;

/**
 * 从 Markdown 链接语法中提取 URL
 */
function extractMarkdownLinks(message: string): string[] {
  const links: string[] = [];
  for (const match of message.matchAll(MARKDOWN_LINK_RE)) {
    if (match[1]) {
      links.push(match[1]);
    }
  }
  return links;
}

/**
 * 移除 Markdown 链接语法，只保留裸 URL
 */
function stripMarkdownLinks(message: string): string {
  return message.replace(MARKDOWN_LINK_RE, " ");
}

/**
 * 解析最大链接数
 */
function resolveMaxLinks(value?: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_MAX_LINKS;
}

/**
 * 检查 URL 是否允许
 */
function isAllowedUrl(
  raw: string,
  options?: ExtractLinksOptions,
): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(raw);

    // 只允许 HTTP/HTTPS
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { allowed: false, reason: "protocol_not_allowed" };
    }

    // 检查本地 URL (127.0.0.1 和 localhost)
    if (!options?.allowLocal) {
      if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
        return { allowed: false, reason: "localhost_blocked" };
      }
    }

    // 检查私有 IP
    if (!options?.allowPrivate && PRIVATE_IP_RE.test(parsed.hostname)) {
      return { allowed: false, reason: "private_ip_blocked" };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: "invalid_url" };
  }
}

/**
 * 从消息中提取链接
 */
export function extractLinksFromMessage(
  message: string,
  options?: ExtractLinksOptions,
): string[] {
  const source = message?.trim();
  if (!source) {
    return [];
  }

  const maxLinks = resolveMaxLinks(options?.maxLinks);
  const sanitized = stripMarkdownLinks(source);
  const seen = new Set<string>();
  const results: string[] = [];

  for (const match of sanitized.matchAll(BARE_LINK_RE)) {
    const raw = match[0]?.trim();
    if (!raw) {
      continue;
    }

    const check = isAllowedUrl(raw, options);
    if (!check.allowed) {
      continue;
    }

    if (seen.has(raw)) {
      continue;
    }

    seen.add(raw);
    results.push(raw);

    if (results.length >= maxLinks) {
      break;
    }
  }

  return results;
}

/**
 * 验证单个 URL
 */
export function validateUrl(
  url: string,
  options?: ExtractLinksOptions,
): { valid: boolean; reason?: string } {
  const check = isAllowedUrl(url, options);
  return {
    valid: check.allowed,
    reason: check.reason,
  };
}
