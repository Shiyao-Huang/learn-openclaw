/**
 * V28: 链接理解系统 - 默认配置
 */

export const DEFAULT_MAX_LINKS = 5;
export const DEFAULT_TIMEOUT_SECONDS = 30;
export const DEFAULT_MAX_CACHE_SIZE = 100;
export const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * 默认链接理解配置
 */
export const DEFAULT_LINK_CONFIG: import("./types.js").LinkEngineConfig = {
  enabled: true,
  maxLinks: DEFAULT_MAX_LINKS,
  timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
  providers: [],
  storageDir: ".link-cache",
};
