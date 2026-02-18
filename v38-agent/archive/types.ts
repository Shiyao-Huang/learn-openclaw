/**
 * V38 Archive 打包系统 - 类型定义
 */

export type ArchiveKind = "tar" | "zip";

export type ArchiveFormat = "tar" | "tar.gz" | "tgz" | "zip";

export interface ArchiveOptions {
  /** 压缩格式 */
  format?: ArchiveFormat;
  /** 压缩级别 (1-9, 仅 zip) */
  compressionLevel?: number;
  /** 是否包含隐藏文件 */
  includeHidden?: boolean;
  /** 排除模式 */
  exclude?: string[];
  /** 超时时间 (毫秒) */
  timeoutMs?: number;
}

export interface ExtractOptions {
  /** 目标目录 */
  destDir: string;
  /** 是否覆盖已存在的文件 */
  overwrite?: boolean;
  /** 超时时间 (毫秒) */
  timeoutMs?: number;
}

export interface ArchiveResult {
  /** 压缩文件路径 */
  archivePath: string;
  /** 压缩格式 */
  format: ArchiveKind;
  /** 原始大小 (字节) */
  originalSize: number;
  /** 压缩后大小 (字节) */
  compressedSize: number;
  /** 压缩比 */
  compressionRatio: number;
  /** 文件数量 */
  fileCount: number;
  /** 耗时 (毫秒) */
  durationMs: number;
}

export interface ExtractResult {
  /** 解压目录 */
  destDir: string;
  /** 解压的文件数量 */
  fileCount: number;
  /** 总大小 (字节) */
  totalSize: number;
  /** 耗时 (毫秒) */
  durationMs: number;
}

export interface ArchiveEntry {
  /** 文件路径 (相对) */
  path: string;
  /** 是否是目录 */
  isDirectory: boolean;
  /** 文件大小 */
  size: number;
  /** 修改时间 */
  modifiedTime?: Date;
  /** CRC32 校验 (仅 zip) */
  crc32?: number;
}

export interface ArchiveInfo {
  /** 压缩文件路径 */
  archivePath: string;
  /** 压缩格式 */
  format: ArchiveKind;
  /** 条目列表 */
  entries: ArchiveEntry[];
  /** 总文件数 */
  fileCount: number;
  /** 总目录数 */
  directoryCount: number;
  /** 总大小 */
  totalSize: number;
  /** 压缩后大小 */
  compressedSize: number;
}

export interface ArchiveConfig {
  /** 默认压缩格式 */
  defaultFormat: ArchiveFormat;
  /** 默认超时 (毫秒) */
  defaultTimeoutMs: number;
  /** 最大文件大小 (字节) */
  maxFileSize: number;
  /** 最大条目数 */
  maxEntries: number;
  /** 是否启用日志 */
  enableLogging: boolean;
}

export const DEFAULT_ARCHIVE_CONFIG: ArchiveConfig = {
  defaultFormat: "tar.gz",
  defaultTimeoutMs: 60000, // 1 分钟
  maxFileSize: 1024 * 1024 * 1024, // 1GB
  maxEntries: 100000,
  enableLogging: false,
};
