/**
 * external/index.ts - V17 外部集成模块
 * 
 * 导出 Web 工具和相关功能
 */

export { webFetch, webSearch, getWebTools, createWebHandlers } from "./web.js";
export { htmlToText, htmlToMarkdown } from "./web.js";
export type { WebFetchOptions, WebSearchOptions, WebSearchResult } from "./web.js";
