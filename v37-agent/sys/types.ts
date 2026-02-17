/**
 * V37: 系统工具集 - 类型定义
 */

/**
 * 系统摘要信息
 */
export type OsSummary = {
  platform: NodeJS.Platform;
  arch: string;
  release: string;
  label: string;
  hostname: string;
  cpus: number;
  totalMemory: number;
  freeMemory: number;
  uptime: number;
};

/**
 * 系统存在信息
 */
export type SystemPresence = {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  lastInputSeconds?: number;
  mode?: string;
  reason?: string;
  deviceId?: string;
  roles?: string[];
  scopes?: string[];
  instanceId?: string;
  text: string;
  ts: number;
};

/**
 * 系统存在更新
 */
export type SystemPresenceUpdate = {
  key: string;
  previous?: SystemPresence;
  next: SystemPresence;
  changes: Partial<SystemPresence>;
  changedKeys: (keyof SystemPresence)[];
};

/**
 * 剪贴板操作结果
 */
export type ClipboardResult = {
  success: boolean;
  method?: string;
  error?: string;
};

/**
 * 系统工具配置
 */
export type SysToolsConfig = {
  enabled: boolean;
  presenceTtlMs: number;
  presenceMaxEntries: number;
};

export const DEFAULT_SYS_TOOLS_CONFIG: SysToolsConfig = {
  enabled: true,
  presenceTtlMs: 5 * 60 * 1000, // 5 minutes
  presenceMaxEntries: 200,
};
