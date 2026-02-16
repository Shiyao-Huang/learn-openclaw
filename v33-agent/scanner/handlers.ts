/**
 * V33: Skill 安全扫描系统 - 工具处理器
 * 
 * 定义工具调用接口
 */

import type { Tool, ToolResult } from "../../types.js";
import { SkillScanner, getSkillScanner, closeSkillScanner } from "./engine.js";
import { getRuleStats, getAllRuleIds } from "./rules.js";
import type { ScanOptions, ScanSeverity } from "./types.js";
import { DEFAULT_SCANNER_CONFIG } from "./types.js";

/**
 * 扫描目录
 */
async function handleScanDirectory(params: {
  dirPath: string;
  includeFiles?: string[];
  maxFiles?: number;
  maxFileBytes?: number;
  skipNodeModules?: boolean;
  skipHidden?: boolean;
  severityFilter?: ScanSeverity[];
}): Promise<ToolResult> {
  const scanner = getSkillScanner();
  const options: ScanOptions = {
    includeFiles: params.includeFiles,
    maxFiles: params.maxFiles,
    maxFileBytes: params.maxFileBytes,
    skipNodeModules: params.skipNodeModules,
    skipHidden: params.skipHidden,
    severityFilter: params.severityFilter,
  };

  const result = await scanner.scanDirectory(params.dirPath, options);

  if (!result.ok) {
    return {
      ok: false,
      result: { error: result.error },
    };
  }

  const summary = result.summary;
  return {
    ok: true,
    result: {
      scannedFiles: summary.scannedFiles,
      totalFiles: summary.totalFiles,
      skippedFiles: summary.skippedFiles,
      critical: summary.critical,
      warn: summary.warn,
      info: summary.info,
      duration: summary.duration,
      findings: summary.findings.map((f) => ({
        ruleId: f.ruleId,
        severity: f.severity,
        file: f.file,
        line: f.line,
        message: f.message,
        evidence: f.evidence,
        suggestion: f.suggestion,
      })),
    },
  };
}

/**
 * 扫描单个文件
 */
async function handleScanFile(params: {
  filePath: string;
}): Promise<ToolResult> {
  const scanner = getSkillScanner();
  const result = await scanner.scanFile(params.filePath);

  if (!result.ok) {
    return {
      ok: false,
      result: { error: result.error },
    };
  }

  const summary = result.summary;
  return {
    ok: true,
    result: {
      scannedFiles: summary.scannedFiles,
      critical: summary.critical,
      warn: summary.warn,
      info: summary.info,
      duration: summary.duration,
      findings: summary.findings.map((f) => ({
        ruleId: f.ruleId,
        severity: f.severity,
        file: f.file,
        line: f.line,
        message: f.message,
        evidence: f.evidence,
        suggestion: f.suggestion,
      })),
    },
  };
}

/**
 * 扫描源码字符串
 */
async function handleScanSource(params: {
  source: string;
  fileName?: string;
}): Promise<ToolResult> {
  const scanner = getSkillScanner();
  const filePath = params.fileName || "<source>";
  const findings = scanner.scanSource(params.source, filePath);

  return {
    ok: true,
    result: {
      critical: findings.filter((f) => f.severity === "critical").length,
      warn: findings.filter((f) => f.severity === "warn").length,
      info: findings.filter((f) => f.severity === "info").length,
      findings: findings.map((f) => ({
        ruleId: f.ruleId,
        severity: f.severity,
        file: f.file,
        line: f.line,
        message: f.message,
        evidence: f.evidence,
        suggestion: f.suggestion,
      })),
    },
  };
}

/**
 * 获取扫描规则列表
 */
async function handleGetRules(): Promise<ToolResult> {
  const stats = getRuleStats();
  const ruleIds = getAllRuleIds();

  return {
    ok: true,
    result: {
      total: stats.total,
      critical: stats.critical,
      warn: stats.warn,
      info: stats.info,
      rules: ruleIds,
    },
  };
}

/**
 * 获取扫描配置
 */
async function handleGetConfig(): Promise<ToolResult> {
  return {
    ok: true,
    result: {
      maxFiles: DEFAULT_SCANNER_CONFIG.maxFiles,
      maxFileBytes: DEFAULT_SCANNER_CONFIG.maxFileBytes,
      skipNodeModules: DEFAULT_SCANNER_CONFIG.skipNodeModules,
      skipHidden: DEFAULT_SCANNER_CONFIG.skipHidden,
      extensions: DEFAULT_SCANNER_CONFIG.extensions,
    },
  };
}

/**
 * 生成扫描报告
 */
async function handleGenerateReport(params: {
  dirPath: string;
  format?: "text" | "json" | "markdown";
  includeInfo?: boolean;
}): Promise<ToolResult> {
  const scanner = getSkillScanner();
  const options: ScanOptions = {
    severityFilter: params.includeInfo 
      ? ["critical", "warn", "info"]
      : ["critical", "warn"],
  };

  const result = await scanner.scanDirectory(params.dirPath, options);

  if (!result.ok) {
    return {
      ok: false,
      result: { error: result.error },
    };
  }

  const summary = result.summary;
  const format = params.format || "text";

  let report: string;

  switch (format) {
    case "json":
      report = JSON.stringify(summary, null, 2);
      break;

    case "markdown":
      report = generateMarkdownReport(summary);
      break;

    default:
      report = generateTextReport(summary);
  }

  return {
    ok: true,
    result: {
      format,
      report,
      summary: {
        scannedFiles: summary.scannedFiles,
        critical: summary.critical,
        warn: summary.warn,
        info: summary.info,
      },
    },
  };
}

/**
 * 生成文本报告
 */
function generateTextReport(summary: import("./types.js").ScanSummary): string {
  const lines: string[] = [
    "=".repeat(60),
    "Skill 安全扫描报告",
    "=".repeat(60),
    "",
    `扫描文件: ${summary.scannedFiles}/${summary.totalFiles}`,
    `跳过文件: ${summary.skippedFiles}`,
    `扫描耗时: ${summary.duration}ms`,
    "",
    `严重 (Critical): ${summary.critical}`,
    `警告 (Warn): ${summary.warn}`,
    `信息 (Info): ${summary.info}`,
    "",
  ];

  if (summary.findings.length > 0) {
    lines.push("-".repeat(60));
    lines.push("发现问题:");
    lines.push("-".repeat(60));

    // 按严重级别排序
    const sorted = [...summary.findings].sort((a, b) => {
      const order: Record<ScanSeverity, number> = { critical: 0, warn: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });

    for (const finding of sorted) {
      lines.push("");
      lines.push(`[${finding.severity.toUpperCase()}] ${finding.ruleId}`);
      lines.push(`  文件: ${finding.file}:${finding.line}`);
      lines.push(`  问题: ${finding.message}`);
      lines.push(`  证据: ${finding.evidence}`);
      if (finding.suggestion) {
        lines.push(`  建议: ${finding.suggestion}`);
      }
    }
  } else {
    lines.push("✅ 未发现安全问题");
  }

  lines.push("");
  lines.push("=".repeat(60));

  return lines.join("\n");
}

/**
 * 生成 Markdown 报告
 */
function generateMarkdownReport(summary: import("./types.js").ScanSummary): string {
  const lines: string[] = [
    "# Skill 安全扫描报告",
    "",
    "## 摘要",
    "",
    "| 指标 | 值 |",
    "|------|-----|",
    `| 扫描文件 | ${summary.scannedFiles}/${summary.totalFiles} |`,
    `| 跳过文件 | ${summary.skippedFiles} |`,
    `| 扫描耗时 | ${summary.duration}ms |`,
    `| 🔴 严重 | ${summary.critical} |`,
    `| 🟡 警告 | ${summary.warn} |`,
    `| 🔵 信息 | ${summary.info} |`,
    "",
  ];

  if (summary.findings.length > 0) {
    lines.push("## 发现问题");
    lines.push("");

    const sorted = [...summary.findings].sort((a, b) => {
      const order: Record<ScanSeverity, number> = { critical: 0, warn: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });

    for (const finding of sorted) {
      const icon = finding.severity === "critical" ? "🔴" : finding.severity === "warn" ? "🟡" : "🔵";
      lines.push(`### ${icon} ${finding.ruleId}`);
      lines.push("");
      lines.push(`- **文件**: \`${finding.file}:${finding.line}\``);
      lines.push(`- **问题**: ${finding.message}`);
      lines.push(`- **证据**: \`${finding.evidence}\``);
      if (finding.suggestion) {
        lines.push(`- **建议**: ${finding.suggestion}`);
      }
      lines.push("");
    }
  } else {
    lines.push("## ✅ 未发现安全问题");
  }

  return lines.join("\n");
}

// 工具定义
export const SCANNER_TOOLS: Tool[] = [
  {
    name: "scanner_scan_dir",
    description: "扫描目录中的代码安全问题",
    parameters: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "要扫描的目录路径",
        },
        includeFiles: {
          type: "array",
          items: { type: "string" },
          description: "要包含的特定文件（相对路径）",
        },
        maxFiles: {
          type: "number",
          description: "最大扫描文件数（默认 500）",
        },
        skipNodeModules: {
          type: "boolean",
          description: "是否跳过 node_modules（默认 true）",
        },
        severityFilter: {
          type: "array",
          items: { type: "string", enum: ["critical", "warn", "info"] },
          description: "严重级别过滤器",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "scanner_scan_file",
    description: "扫描单个文件的代码安全问题",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "要扫描的文件路径",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "scanner_scan_source",
    description: "扫描源码字符串的安全问题",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "要扫描的源码",
        },
        fileName: {
          type: "string",
          description: "文件名（用于显示）",
        },
      },
      required: ["source"],
    },
  },
  {
    name: "scanner_rules",
    description: "获取扫描规则列表",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "scanner_config",
    description: "获取扫描器配置",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "scanner_report",
    description: "生成安全扫描报告",
    parameters: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "要扫描的目录路径",
        },
        format: {
          type: "string",
          enum: ["text", "json", "markdown"],
          description: "报告格式（默认 text）",
        },
        includeInfo: {
          type: "boolean",
          description: "是否包含 info 级别（默认 false）",
        },
      },
      required: ["dirPath"],
    },
  },
];

export const SCANNER_TOOL_COUNT = SCANNER_TOOLS.length;

// 工具处理器映射
export function createScannerHandlers(): Map<string, (params: Record<string, unknown>) => Promise<ToolResult>> {
  const handlers = new Map<string, (params: Record<string, unknown>) => Promise<ToolResult>>();

  handlers.set("scanner_scan_dir", (params) =>
    handleScanDirectory(params as Parameters<typeof handleScanDirectory>[0])
  );
  handlers.set("scanner_scan_file", (params) =>
    handleScanFile(params as Parameters<typeof handleScanFile>[0])
  );
  handlers.set("scanner_scan_source", (params) =>
    handleScanSource(params as Parameters<typeof handleScanSource>[0])
  );
  handlers.set("scanner_rules", () => handleGetRules());
  handlers.set("scanner_config", () => handleGetConfig());
  handlers.set("scanner_report", (params) =>
    handleGenerateReport(params as Parameters<typeof handleGenerateReport>[0])
  );

  return handlers;
}

// 导出
export { SkillScanner, getSkillScanner, closeSkillScanner };
