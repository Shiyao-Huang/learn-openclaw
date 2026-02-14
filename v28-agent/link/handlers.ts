/**
 * V28: 链接理解系统 - 工具处理器
 */

import { validateUrl } from "./detect.js";
import { getLinkEngine, closeLinkEngine } from "./engine.js";
import type {
  BatchFetchLinksRequest,
  BatchFetchLinksResult,
  ClearLinkCacheRequest,
  ClearLinkCacheResult,
  ExtractLinksRequest,
  ExtractLinksResult,
  FetchLinkRequest,
  FetchLinkResult,
  LinkStatusResult,
} from "./types.js";

/**
 * 处理 link_extract 工具
 */
export async function handleLinkExtract(params: ExtractLinksRequest): Promise<ExtractLinksResult> {
  const engine = getLinkEngine();
  const links = engine.extractLinks(params.message, {
    maxLinks: params.maxLinks,
  });

  return {
    links,
    count: links.length,
  };
}

/**
 * 处理 link_fetch 工具
 */
export async function handleLinkFetch(params: FetchLinkRequest): Promise<FetchLinkResult> {
  const engine = getLinkEngine();
  return await engine.fetchLink(params.url, {
    timeoutSeconds: params.timeoutSeconds,
    format: params.format,
  });
}

/**
 * 处理 link_batch_fetch 工具
 */
export async function handleLinkBatchFetch(
  params: BatchFetchLinksRequest,
): Promise<BatchFetchLinksResult> {
  const engine = getLinkEngine();
  return await engine.fetchLinks(params.urls, {
    timeoutSeconds: params.timeoutSeconds,
    concurrency: params.concurrency,
  });
}

/**
 * 处理 link_status 工具
 */
export async function handleLinkStatus(): Promise<LinkStatusResult> {
  const engine = getLinkEngine();
  const status = engine.getStatus();

  return {
    enabled: status.enabled,
    config: status.config,
    stats: status.stats,
    cache: status.cache,
  };
}

/**
 * 处理 link_clear_cache 工具
 */
export async function handleLinkClearCache(
  params: ClearLinkCacheRequest,
): Promise<ClearLinkCacheResult> {
  const engine = getLinkEngine();
  const cleared = engine.clearCache(params.url);

  return {
    cleared,
  };
}

/**
 * 处理 link_validate 工具
 */
export async function handleLinkValidate(params: { url: string }): Promise<{
  valid: boolean;
  reason?: string;
}> {
  return validateUrl(params.url);
}

/**
 * 链接理解工具处理器映射
 */
export const linkHandlers: Record<string, (params: any) => Promise<any>> = {
  link_extract: handleLinkExtract,
  link_fetch: handleLinkFetch,
  link_batch_fetch: handleLinkBatchFetch,
  link_status: handleLinkStatus,
  link_clear_cache: handleLinkClearCache,
  link_validate: handleLinkValidate,
};

/**
 * 关闭链接理解引擎
 */
export function closeLinkHandlers(): void {
  closeLinkEngine();
}
