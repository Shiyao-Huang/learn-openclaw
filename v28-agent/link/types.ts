/**
 * V28: 链接理解系统 - 类型定义
 * 
 * 基于 OpenClaw 的 link-understanding 模块
 */

/**
 * 链接理解提供者配置
 */
export type LinkProviderConfig = {
  /** 提供者类型 */
  type: "cli" | "fetch" | "built-in";
  /** CLI 命令 (type=cli 时) */
  command?: string;
  /** CLI 参数模板 */
  args?: string[];
  /** 超时时间 (秒) */
  timeoutSeconds?: number;
  /** 提供者名称 */
  name?: string;
};

/**
 * 链接理解引擎配置
 */
export type LinkEngineConfig = {
  /** 是否启用 */
  enabled?: boolean;
  /** 最大链接数 */
  maxLinks?: number;
  /** 默认超时时间 (秒) */
  timeoutSeconds?: number;
  /** 提供者列表 */
  providers?: LinkProviderConfig[];
  /** 存储目录 */
  storageDir?: string;
};

/**
 * 链接提取选项
 */
export type ExtractLinksOptions = {
  /** 最大链接数 */
  maxLinks?: number;
  /** 是否允许本地 URL */
  allowLocal?: boolean;
  /** 是否允许私有 IP */
  allowPrivate?: boolean;
};

/**
 * 链接内容结果
 */
export type LinkContentResult = {
  /** 原始 URL */
  url: string;
  /** 提取的内容 */
  content: string;
  /** 内容格式 */
  format?: "text" | "markdown" | "html" | "json";
  /** 元数据 */
  metadata?: {
    title?: string;
    description?: string;
    contentType?: string;
    contentLength?: number;
  };
  /** 错误信息 */
  error?: string;
};

/**
 * 批量链接提取结果
 */
export type BatchExtractResult = {
  /** 成功的链接 */
  successful: LinkContentResult[];
  /** 失败的链接 */
  failed: Array<{ url: string; error: string }>;
  /** 总处理时间 (ms) */
  durationMs: number;
};

/**
 * 链接理解统计
 */
export type LinkUnderstandingStats = {
  /** 总提取次数 */
  totalExtracts: number;
  /** 成功次数 */
  successfulExtracts: number;
  /** 失败次数 */
  failedExtracts: number;
  /** 平均处理时间 (ms) */
  avgDurationMs: number;
  /** 最后更新时间 */
  lastUpdated: string;
};

/**
 * 链接内容缓存条目
 */
export type LinkCacheEntry = {
  url: string;
  content: string;
  format?: "text" | "markdown" | "html" | "json";
  metadata?: {
    title?: string;
    description?: string;
    contentType?: string;
  };
  cachedAt: string;
  expiresAt?: string;
};

/**
 * 链接理解工具请求类型
 */

export type ExtractLinksRequest = {
  message: string;
  maxLinks?: number;
};

export type ExtractLinksResult = {
  links: string[];
  count: number;
};

export type FetchLinkRequest = {
  url: string;
  timeoutSeconds?: number;
  format?: "text" | "markdown";
};

export type FetchLinkResult = LinkContentResult;

export type BatchFetchLinksRequest = {
  urls: string[];
  timeoutSeconds?: number;
  concurrency?: number;
};

export type BatchFetchLinksResult = BatchExtractResult;

export type LinkStatusResult = {
  enabled: boolean;
  config: {
    maxLinks: number;
    timeoutSeconds: number;
    providers: number;
  };
  stats: LinkUnderstandingStats;
  cache: {
    size: number;
    maxSize: number;
  };
};

export type ClearLinkCacheRequest = {
  url?: string;
};

export type ClearLinkCacheResult = {
  cleared: number;
};
