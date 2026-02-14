/**
 * V28: 链接理解系统 - 内容获取器
 * 
 * 负责从 URL 获取内容
 */

import { DEFAULT_TIMEOUT_SECONDS } from "./defaults.js";
import type { FetchLinkResult, LinkProviderConfig } from "./types.js";

/**
 * 获取链接内容 (使用 fetch)
 */
export async function fetchLinkContent(
  url: string,
  options?: {
    timeoutSeconds?: number;
    format?: "text" | "markdown";
  },
): Promise<FetchLinkResult> {
  const timeoutMs = (options?.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000;

  try {
    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OpenClaw-V28/1.0)",
        Accept: "text/html,application/xhtml+xml,text/plain,text/markdown",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        url,
        content: "",
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") || "text/plain";
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);

    // 读取内容
    let content = await response.text();

    // 简单的 HTML 转文本转换
    if (contentType.includes("text/html")) {
      content = htmlToText(content);
    }

    return {
      url,
      content,
      format: options?.format ?? "text",
      metadata: {
        contentType,
        contentLength,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("abort")) {
      return {
        url,
        content: "",
        error: `Timeout after ${timeoutMs}ms`,
      };
    }

    return {
      url,
      content: "",
      error: errorMessage,
    };
  }
}

/**
 * 简单的 HTML 转文本
 */
function htmlToText(html: string): string {
  // 移除 script 和 style 标签
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // 移除所有标签，只保留文本
  text = text.replace(/<[^>]+>/g, " ");

  // 解码 HTML 实体
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 清理多余空白
  text = text.replace(/\s+/g, " ").trim();

  // 限制长度
  const maxLength = 5000;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + "...";
  }

  return text;
}

/**
 * 批量获取链接内容
 */
export async function batchFetchLinks(
  urls: string[],
  options?: {
    timeoutSeconds?: number;
    concurrency?: number;
  },
): Promise<FetchLinkResult[]> {
  const concurrency = options?.concurrency ?? 3;
  const results: FetchLinkResult[] = [];

  // 分批处理
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) =>
        fetchLinkContent(url, {
          timeoutSeconds: options?.timeoutSeconds,
        }),
      ),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * 使用 CLI 命令获取链接内容
 */
export async function fetchWithCli(
  url: string,
  config: LinkProviderConfig,
  context?: Record<string, string>,
): Promise<string | null> {
  if (config.type !== "cli" || !config.command) {
    return null;
  }

  // TODO: 实现 CLI 调用
  // 这需要使用 child_process.spawn 来执行命令
  // 为了简化，这里先返回 null

  console.log(`[Link] CLI fetch not implemented yet: ${config.command}`);
  return null;
}
