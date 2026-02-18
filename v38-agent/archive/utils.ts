/**
 * V38 Archive 打包系统 - 工具函数
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ArchiveFormat, ArchiveKind } from "./types.js";

const TAR_SUFFIXES = [".tgz", ".tar.gz", ".tar"];
const ZIP_SUFFIXES = [".zip"];

/**
 * 解析压缩文件格式
 */
export function resolveArchiveKind(filePath: string): ArchiveKind | null {
  const lower = filePath.toLowerCase();
  if (ZIP_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return "zip";
  }
  if (TAR_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return "tar";
  }
  return null;
}

/**
 * 解析压缩格式
 */
export function resolveArchiveFormat(filePath: string): ArchiveFormat | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".tgz") || lower.endsWith(".tar.gz")) return "tar.gz";
  if (lower.endsWith(".tar")) return "tar";
  return null;
}

/**
 * 从格式推断文件扩展名
 */
export function getArchiveExtension(format: ArchiveFormat): string {
  switch (format) {
    case "zip":
      return ".zip";
    case "tar.gz":
    case "tgz":
      return ".tar.gz";
    case "tar":
      return ".tar";
    default:
      return ".tar.gz";
  }
}

/**
 * 带超时的 Promise 执行
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查目录是否存在
 */
export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 确保目录存在
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 获取文件/目录大小
 */
export async function getSize(targetPath: string): Promise<number> {
  let totalSize = 0;

  const stat = await fs.stat(targetPath);
  if (stat.isFile()) {
    return stat.size;
  }

  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getSize(entryPath);
      } else if (entry.isFile()) {
        const entryStat = await fs.stat(entryPath);
        totalSize += entryStat.size;
      }
    }
  }

  return totalSize;
}

/**
 * 计算压缩比
 */
export function calculateCompressionRatio(
  originalSize: number,
  compressedSize: number,
): number {
  if (originalSize === 0) return 0;
  return 1 - compressedSize / originalSize;
}

/**
 * 格式化文件大小
 */
export function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 统计目录中的文件数量
 */
export async function countFiles(dirPath: string): Promise<number> {
  let count = 0;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      count += await countFiles(entryPath);
    } else if (entry.isFile()) {
      count++;
    }
  }

  return count;
}

/**
 * 解压后的根目录解析
 */
export async function resolvePackedRootDir(extractDir: string): Promise<string> {
  // 检查 package 目录
  const direct = path.join(extractDir, "package");
  try {
    const stat = await fs.stat(direct);
    if (stat.isDirectory()) {
      return direct;
    }
  } catch {
    // ignore
  }

  // 检查唯一的目录
  const entries = await fs.readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  
  if (dirs.length === 1) {
    return path.join(extractDir, dirs[0]!);
  }

  // 如果没有子目录或多个子目录，返回解压目录
  return extractDir;
}
