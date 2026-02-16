/**
 * V33: Skill 安全扫描系统 - 扫描引擎
 * 
 * 核心扫描逻辑
 */

import fs from "node:fs/promises";
import path from "node:path";
import type {
  ScanFinding,
  ScanOptions,
  ScanResult,
  ScanSeverity,
  ScanSummary,
  ScannerConfig,
} from "./types.js";
import { DEFAULT_SCANNER_CONFIG } from "./types.js";
import { LINE_RULES, SOURCE_RULES, isStandardPort } from "./rules.js";

/**
 * Skill 安全扫描引擎
 */
export class SkillScanner {
  private config: ScannerConfig;

  constructor(config?: Partial<ScannerConfig>) {
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...config };
  }

  /**
   * 扫描目录
   */
  async scanDirectory(dirPath: string, options?: ScanOptions): Promise<ScanResult> {
    const startTime = Date.now();
    
    try {
      const resolvedDir = path.resolve(dirPath);
      const stats = await fs.stat(resolvedDir);
      
      if (!stats.isDirectory()) {
        return {
          ok: false,
          summary: this.createEmptySummary(0),
          error: `Not a directory: ${resolvedDir}`,
        };
      }

      // 收集可扫描文件
      const files = await this.collectScannableFiles(resolvedDir, options);
      const findings: ScanFinding[] = [];
      let scannedFiles = 0;
      let skippedFiles = 0;

      // 扫描每个文件
      for (const file of files) {
        const source = await this.readFileSource(file, options);
        if (source === null) {
          skippedFiles++;
          continue;
        }

        scannedFiles++;
        const fileFindings = this.scanSource(source, file);
        findings.push(...fileFindings);
      }

      // 过滤结果
      const filteredFindings = this.filterFindings(findings, options);

      const duration = Date.now() - startTime;
      const summary: ScanSummary = {
        scannedFiles,
        totalFiles: files.length,
        skippedFiles,
        critical: filteredFindings.filter((f) => f.severity === "critical").length,
        warn: filteredFindings.filter((f) => f.severity === "warn").length,
        info: filteredFindings.filter((f) => f.severity === "info").length,
        findings: filteredFindings,
        duration,
      };

      return { ok: true, summary };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        summary: this.createEmptySummary(0),
        error: message,
      };
    }
  }

  /**
   * 扫描单个文件
   */
  async scanFile(filePath: string): Promise<ScanResult> {
    const startTime = Date.now();
    
    try {
      const resolvedPath = path.resolve(filePath);
      const source = await this.readFileSource(resolvedPath);
      
      if (source === null) {
        return {
          ok: false,
          summary: this.createEmptySummary(0),
          error: `Cannot read file: ${resolvedPath}`,
        };
      }

      const findings = this.scanSource(source, resolvedPath);
      const duration = Date.now() - startTime;

      const summary: ScanSummary = {
        scannedFiles: 1,
        totalFiles: 1,
        skippedFiles: 0,
        critical: findings.filter((f) => f.severity === "critical").length,
        warn: findings.filter((f) => f.severity === "warn").length,
        info: findings.filter((f) => f.severity === "info").length,
        findings,
        duration,
      };

      return { ok: true, summary };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        summary: this.createEmptySummary(0),
        error: message,
      };
    }
  }

  /**
   * 扫描源码
   */
  scanSource(source: string, filePath: string): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const lines = source.split("\n");
    const matchedLineRules = new Set<string>();

    // 行规则检测
    for (const rule of LINE_RULES) {
      if (matchedLineRules.has(rule.ruleId)) {
        continue;
      }

      // 检查上下文要求
      if (rule.requiresContext && !rule.requiresContext.test(source)) {
        continue;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = rule.pattern.exec(line);
        if (!match) {
          continue;
        }

        // 特殊处理：可疑网络端口检查
        if (rule.ruleId === "suspicious-network" && match[1]) {
          const port = parseInt(match[1], 10);
          if (isStandardPort(port)) {
            continue;
          }
        }

        findings.push({
          ruleId: rule.ruleId,
          severity: rule.severity,
          file: filePath,
          line: i + 1,
          message: rule.message,
          evidence: this.truncateEvidence(line.trim()),
          suggestion: rule.suggestion,
        });

        matchedLineRules.add(rule.ruleId);
        break; // 每个行规则每个文件只报告一次
      }
    }

    // 源码规则检测
    const matchedSourceRules = new Set<string>();
    for (const rule of SOURCE_RULES) {
      const ruleKey = `${rule.ruleId}::${rule.message}`;
      if (matchedSourceRules.has(ruleKey)) {
        continue;
      }

      if (!rule.pattern.test(source)) {
        continue;
      }
      if (rule.requiresContext && !rule.requiresContext.test(source)) {
        continue;
      }

      // 找到第一个匹配的行作为证据
      let matchLine = 0;
      let matchEvidence = "";
      for (let i = 0; i < lines.length; i++) {
        if (rule.pattern.test(lines[i])) {
          matchLine = i + 1;
          matchEvidence = lines[i].trim();
          break;
        }
      }

      if (matchLine === 0) {
        matchLine = 1;
        matchEvidence = source.slice(0, 120);
      }

      findings.push({
        ruleId: rule.ruleId,
        severity: rule.severity,
        file: filePath,
        line: matchLine,
        message: rule.message,
        evidence: this.truncateEvidence(matchEvidence),
        suggestion: rule.suggestion,
      });

      matchedSourceRules.add(ruleKey);
    }

    return findings;
  }

  /**
   * 收集可扫描文件
   */
  private async collectScannableFiles(
    dirPath: string,
    options?: ScanOptions
  ): Promise<string[]> {
    const maxFiles = options?.maxFiles ?? this.config.maxFiles;
    const skipNodeModules = options?.skipNodeModules ?? this.config.skipNodeModules;
    const skipHidden = options?.skipHidden ?? this.config.skipHidden;
    const extensions = options?.extensions ?? this.config.extensions;

    const files: string[] = [];
    const stack: string[] = [dirPath];

    while (stack.length > 0 && files.length < maxFiles) {
      const currentDir = stack.pop();
      if (!currentDir) break;

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (files.length >= maxFiles) break;

          // 跳过隐藏文件和目录
          if (skipHidden && entry.name.startsWith(".")) {
            continue;
          }

          // 跳过 node_modules
          if (skipNodeModules && entry.name === "node_modules") {
            continue;
          }

          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            stack.push(fullPath);
          } else if (entry.isFile() && this.isScannable(entry.name, extensions)) {
            files.push(fullPath);
          }
        }
      } catch {
        // 忽略无法访问的目录
        continue;
      }
    }

    // 添加强制包含的文件
    if (options?.includeFiles && options.includeFiles.length > 0) {
      for (const includeFile of options.includeFiles) {
        const fullPath = path.resolve(dirPath, includeFile);
        if (!files.includes(fullPath) && this.isScannable(fullPath, extensions)) {
          try {
            const stat = await fs.stat(fullPath);
            if (stat.isFile()) {
              files.unshift(fullPath);
            }
          } catch {
            // 忽略不存在的文件
          }
        }
      }
    }

    return files.slice(0, maxFiles);
  }

  /**
   * 读取文件源码
   */
  private async readFileSource(
    filePath: string,
    options?: ScanOptions
  ): Promise<string | null> {
    const maxFileBytes = options?.maxFileBytes ?? this.config.maxFileBytes;

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size > maxFileBytes) {
        return null;
      }

      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * 判断文件是否可扫描
   */
  private isScannable(fileName: string, extensions: string[]): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return extensions.includes(ext);
  }

  /**
   * 过滤扫描结果
   */
  private filterFindings(findings: ScanFinding[], options?: ScanOptions): ScanFinding[] {
    if (!options?.severityFilter || options.severityFilter.length === 0) {
      return findings;
    }

    return findings.filter((f) =>
      options.severityFilter!.includes(f.severity)
    );
  }

  /**
   * 截断证据
   */
  private truncateEvidence(evidence: string, maxLen = 120): string {
    if (evidence.length <= maxLen) {
      return evidence;
    }
    return `${evidence.slice(0, maxLen)}…`;
  }

  /**
   * 创建空摘要
   */
  private createEmptySummary(totalFiles: number): ScanSummary {
    return {
      scannedFiles: 0,
      totalFiles,
      skippedFiles: 0,
      critical: 0,
      warn: 0,
      info: 0,
      findings: [],
      duration: 0,
    };
  }
}

// 单例实例
let scannerInstance: SkillScanner | null = null;

export function getSkillScanner(config?: Partial<ScannerConfig>): SkillScanner {
  if (!scannerInstance) {
    scannerInstance = new SkillScanner(config);
  }
  return scannerInstance;
}

export function closeSkillScanner(): void {
  scannerInstance = null;
}
