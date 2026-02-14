/**
 * V28: 链接理解系统 - 模块入口
 */

// 导出类型
export type {
  LinkProviderConfig,
  LinkEngineConfig,
  ExtractLinksOptions,
  LinkContentResult,
  BatchExtractResult,
  LinkUnderstandingStats,
  LinkCacheEntry,
  ExtractLinksRequest,
  ExtractLinksResult,
  FetchLinkRequest,
  FetchLinkResult,
  BatchFetchLinksRequest,
  BatchFetchLinksResult,
  LinkStatusResult,
  ClearLinkCacheRequest,
  ClearLinkCacheResult,
} from "./types.js";

// 导出常量
export {
  DEFAULT_MAX_LINKS,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_MAX_CACHE_SIZE,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_LINK_CONFIG,
} from "./defaults.js";

// 导出工具
export { LINK_TOOLS, LINK_TOOL_COUNT } from "./tools.js";

// 导出处理器
export {
  handleLinkExtract,
  handleLinkFetch,
  handleLinkBatchFetch,
  handleLinkStatus,
  handleLinkClearCache,
  handleLinkValidate,
  linkHandlers,
  closeLinkHandlers,
} from "./handlers.js";

// 导出引擎
export {
  LinkUnderstandingEngine,
  getLinkEngine,
  closeLinkEngine,
} from "./engine.js";

// 导出工具函数
export { extractLinksFromMessage, validateUrl } from "./detect.js";
export { fetchLinkContent, batchFetchLinks } from "./fetcher.js";
export { LinkContentCache, getLinkCache, clearLinkCache } from "./cache.js";
