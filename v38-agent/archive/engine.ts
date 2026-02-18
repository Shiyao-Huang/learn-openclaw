/**
 * V38 Archive 打包系统 - 核心引擎
 */

import fs from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import JSZip from "jszip";
import {
  resolveArchiveKind,
  resolveArchiveFormat,
  withTimeout,
  fileExists,
  dirExists,
  ensureDir,
  getSize,
  countFiles,
  calculateCompressionRatio,
  resolvePackedRootDir,
} from "./utils.js";
import type {
  ArchiveKind,
  ArchiveFormat,
  ArchiveOptions,
  ExtractOptions,
  ArchiveResult,
  ExtractResult,
  ArchiveEntry,
  ArchiveInfo,
  ArchiveConfig,
  DEFAULT_ARCHIVE_CONFIG,
} from "./types.js";

export class ArchiveEngine {
  private config: ArchiveConfig;

  constructor(config?: Partial<ArchiveConfig>) {
    this.config = {
      defaultFormat: config?.defaultFormat ?? "tar.gz",
      defaultTimeoutMs: config?.defaultTimeoutMs ?? 60000,
      maxFileSize: config?.maxFileSize ?? 1024 * 1024 * 1024,
      maxEntries: config?.maxEntries ?? 100000,
      enableLogging: config?.enableLogging ?? false,
    };
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[ArchiveEngine] ${message}`);
    }
  }

  /**
   * 压缩目录或文件
   */
  async archive(
    sourcePath: string,
    archivePath: string,
    options?: ArchiveOptions,
  ): Promise<ArchiveResult> {
    const startTime = Date.now();
    const format = options?.format ?? this.config.defaultFormat;
    const timeoutMs = options?.timeoutMs ?? this.config.defaultTimeoutMs;

    this.log(`Archiving ${sourcePath} to ${archivePath} (format: ${format})`);

    // 检查源是否存在
    const sourceExists = await fileExists(sourcePath);
    if (!sourceExists) {
      const dirExistsResult = await dirExists(sourcePath);
      if (!dirExistsResult) {
        throw new Error(`Source path does not exist: ${sourcePath}`);
      }
    }

    // 获取原始大小和文件数
    const originalSize = await getSize(sourcePath);
    const fileCount = (await fs.stat(sourcePath)).isDirectory()
      ? await countFiles(sourcePath)
      : 1;

    // 确保目标目录存在
    const destDir = path.dirname(archivePath);
    await ensureDir(destDir);

    const kind = this.getKindFromFormat(format);

    // 执行压缩
    if (kind === "tar") {
      await this.archiveTar(sourcePath, archivePath, format, timeoutMs);
    } else {
      await this.archiveZip(sourcePath, archivePath, options?.compressionLevel, timeoutMs);
    }

    // 获取压缩后大小
    const compressedStat = await fs.stat(archivePath);
    const compressedSize = compressedStat.size;

    const durationMs = Date.now() - startTime;

    return {
      archivePath,
      format: kind,
      originalSize,
      compressedSize,
      compressionRatio: calculateCompressionRatio(originalSize, compressedSize),
      fileCount,
      durationMs,
    };
  }

  /**
   * 解压压缩文件
   */
  async extract(
    archivePath: string,
    options: ExtractOptions,
  ): Promise<ExtractResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;
    const destDir = options.destDir;

    this.log(`Extracting ${archivePath} to ${destDir}`);

    // 检查压缩文件是否存在
    if (!(await fileExists(archivePath))) {
      throw new Error(`Archive does not exist: ${archivePath}`);
    }

    // 确保目标目录存在
    await ensureDir(destDir);

    const kind = resolveArchiveKind(archivePath);
    if (!kind) {
      throw new Error(`Unsupported archive format: ${archivePath}`);
    }

    // 执行解压
    if (kind === "tar") {
      await this.extractTar(archivePath, destDir, timeoutMs);
    } else {
      await this.extractZip(archivePath, destDir, timeoutMs);
    }

    // 统计结果
    const fileCount = await countFiles(destDir);
    const totalSize = await getSize(destDir);

    const durationMs = Date.now() - startTime;

    return {
      destDir,
      fileCount,
      totalSize,
      durationMs,
    };
  }

  /**
   * 列出压缩文件内容
   */
  async list(archivePath: string): Promise<ArchiveInfo> {
    this.log(`Listing ${archivePath}`);

    if (!(await fileExists(archivePath))) {
      throw new Error(`Archive does not exist: ${archivePath}`);
    }

    const kind = resolveArchiveKind(archivePath);
    if (!kind) {
      throw new Error(`Unsupported archive format: ${archivePath}`);
    }

    const entries: ArchiveEntry[] = [];

    if (kind === "tar") {
      // tar 文件需要解压才能列出详细内容
      // 这里简化处理，只返回基本信息
      const stat = await fs.stat(archivePath);
      return {
        archivePath,
        format: kind,
        entries: [],
        fileCount: 0,
        directoryCount: 0,
        totalSize: 0,
        compressedSize: stat.size,
      };
    }

    // zip 文件可以不解压直接列出
    const buffer = await fs.readFile(archivePath);
    const zip = await JSZip.loadAsync(buffer);
    const zipEntries = Object.values(zip.files);

    let fileCount = 0;
    let directoryCount = 0;
    let totalSize = 0;

    for (const entry of zipEntries) {
      const isDirectory = entry.dir;
      if (isDirectory) {
        directoryCount++;
      } else {
        fileCount++;
        totalSize += entry._data?.uncompressedSize ?? 0;
      }

      entries.push({
        path: entry.name,
        isDirectory,
        size: entry._data?.uncompressedSize ?? 0,
        modifiedTime: entry.date,
        crc32: entry._data?.crc32,
      });
    }

    const stat = await fs.stat(archivePath);

    return {
      archivePath,
      format: kind,
      entries,
      fileCount,
      directoryCount,
      totalSize,
      compressedSize: stat.size,
    };
  }

  /**
   * 获取压缩文件信息
   */
  async info(archivePath: string): Promise<ArchiveInfo> {
    return this.list(archivePath);
  }

  /**
   * 检测压缩文件格式
   */
  detectFormat(archivePath: string): ArchiveKind | null {
    return resolveArchiveKind(archivePath);
  }

  private getKindFromFormat(format: ArchiveFormat): ArchiveKind {
    if (format === "zip") return "zip";
    return "tar";
  }

  private async archiveTar(
    sourcePath: string,
    archivePath: string,
    format: ArchiveFormat,
    timeoutMs: number,
  ): Promise<void> {
    const isGzipped = format === "tar.gz" || format === "tgz";

    await withTimeout(
      tar.c(
        {
          gzip: isGzipped,
          file: archivePath,
          cwd: path.dirname(sourcePath),
        },
        [path.basename(sourcePath)],
      ),
      timeoutMs,
      "Archive tar",
    );
  }

  private async archiveZip(
    sourcePath: string,
    archivePath: string,
    compressionLevel?: number,
    timeoutMs?: number,
  ): Promise<void> {
    const zip = new JSZip();
    const sourceBasename = path.basename(sourcePath);

    const stat = await fs.stat(sourcePath);

    if (stat.isDirectory()) {
      // 递归添加目录
      await this.addDirectoryToZip(zip.folder(sourceBasename)!, sourcePath);
    } else {
      // 添加单个文件
      const content = await fs.readFile(sourcePath);
      zip.file(sourceBasename, content);
    }

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: compressionLevel ?? 6 },
    });

    await fs.writeFile(archivePath, buffer);
  }

  private async addDirectoryToZip(
    zipFolder: JSZip,
    dirPath: string,
  ): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.addDirectoryToZip(zipFolder.folder(entry.name)!, entryPath);
      } else if (entry.isFile()) {
        const content = await fs.readFile(entryPath);
        zipFolder.file(entry.name, content);
      }
    }
  }

  private async extractTar(
    archivePath: string,
    destDir: string,
    timeoutMs: number,
  ): Promise<void> {
    await withTimeout(
      tar.x({
        file: archivePath,
        cwd: destDir,
      }),
      timeoutMs,
      "Extract tar",
    );
  }

  private async extractZip(
    archivePath: string,
    destDir: string,
    timeoutMs: number,
  ): Promise<void> {
    await withTimeout(
      this._extractZip(archivePath, destDir),
      timeoutMs,
      "Extract zip",
    );
  }

  private async _extractZip(
    archivePath: string,
    destDir: string,
  ): Promise<void> {
    const buffer = await fs.readFile(archivePath);
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.values(zip.files);

    for (const entry of entries) {
      const entryPath = entry.name.replaceAll("\\", "/");

      if (!entryPath || entryPath.endsWith("/")) {
        // 目录
        const dirPath = path.resolve(destDir, entryPath);
        if (!dirPath.startsWith(destDir)) {
          throw new Error(`zip entry escapes destination: ${entry.name}`);
        }
        await ensureDir(dirPath);
        continue;
      }

      // 文件
      const outPath = path.resolve(destDir, entryPath);
      if (!outPath.startsWith(destDir)) {
        throw new Error(`zip entry escapes destination: ${entry.name}`);
      }

      await ensureDir(path.dirname(outPath));
      const data = await entry.async("nodebuffer");
      await fs.writeFile(outPath, data);
    }
  }
}

// 单例
let archiveEngine: ArchiveEngine | null = null;

export function getArchiveEngine(config?: Partial<ArchiveConfig>): ArchiveEngine {
  if (!archiveEngine) {
    archiveEngine = new ArchiveEngine(config);
  }
  return archiveEngine;
}

export function closeArchiveEngine(): void {
  archiveEngine = null;
}

export function resetArchiveEngine(config?: Partial<ArchiveConfig>): ArchiveEngine {
  archiveEngine = null;
  return getArchiveEngine(config);
}
