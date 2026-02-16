/**
 * V33: Skill 安全扫描系统 - 类型定义
 * 
 * 扫描 Skill 代码的安全问题，检测潜在风险
 */

export type ScanSeverity = "critical" | "warn" | "info";

export type ScanRuleId =
  // 行规则
  | "dangerous-exec"
  | "dynamic-code-execution"
  | "crypto-mining"
  | "suspicious-network"
  // 源码规则
  | "potential-exfiltration"
  | "obfuscated-code"
  | "env-harvesting"
  | "dangerous-import"
  | "file-system-access"
  | "network-access";

export type ScanFinding = {
  ruleId: ScanRuleId;
  severity: ScanSeverity;
  file: string;
  line: number;
  message: string;
  evidence: string;
  suggestion?: string;
};

export type ScanSummary = {
  scannedFiles: number;
  totalFiles: number;
  skippedFiles: number;
  critical: number;
  warn: number;
  info: number;
  findings: ScanFinding[];
  duration: number;
};

export type ScanOptions = {
  /** 要包含的特定文件（相对路径） */
  includeFiles?: string[];
  /** 最大扫描文件数 */
  maxFiles?: number;
  /** 单文件最大字节数 */
  maxFileBytes?: number;
  /** 是否跳过 node_modules */
  skipNodeModules?: boolean;
  /** 是否跳过隐藏文件 */
  skipHidden?: boolean;
  /** 要扫描的扩展名 */
  extensions?: string[];
  /** 严重级别过滤器 */
  severityFilter?: ScanSeverity[];
};

export type ScanResult = {
  ok: boolean;
  summary: ScanSummary;
  error?: string;
};

// 规则类型
export type LineRule = {
  ruleId: ScanRuleId;
  severity: ScanSeverity;
  message: string;
  pattern: RegExp;
  suggestion?: string;
  /** 上下文要求：只有当源码匹配此模式时才触发 */
  requiresContext?: RegExp;
};

export type SourceRule = {
  ruleId: ScanRuleId;
  severity: ScanSeverity;
  message: string;
  pattern: RegExp;
  suggestion?: string;
  /** 上下文要求：只有当源码匹配此模式时才触发 */
  requiresContext?: RegExp;
};

// 配置
export type ScannerConfig = {
  maxFiles: number;
  maxFileBytes: number;
  skipNodeModules: boolean;
  skipHidden: boolean;
  extensions: string[];
};

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  maxFiles: 500,
  maxFileBytes: 1024 * 1024, // 1MB
  skipNodeModules: true,
  skipHidden: true,
  extensions: [".js", ".ts", ".mjs", ".cjs", ".mts", ".cts", ".jsx", ".tsx"],
};
