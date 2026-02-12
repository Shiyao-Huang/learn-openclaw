/**
 * v22-agent/sandbox/types.ts - 代码执行沙箱类型定义
 * 
 * V22: 代码执行沙箱 - 类型系统
 */

/** 支持的编程语言 */
export type SupportedLanguage = "python" | "javascript" | "typescript" | "bash";

/** 执行结果 */
export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number; // 毫秒
  memoryUsed: number;    // MB
}

/** 安全扫描结果 */
export interface SecurityScanResult {
  passed: boolean;
  issues: SecurityIssue[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

/** 安全问题 */
export interface SecurityIssue {
  type: "dangerous_import" | "file_access" | "network" | "system_call" | "eval" | "resource";
  severity: "warning" | "error" | "critical";
  message: string;
  line?: number;
  code?: string;
}

/** 资源限制 */
export interface ResourceLimits {
  maxExecutionTimeMs: number;  // 默认 30000ms (30s)
  maxMemoryMb: number;         // 默认 512MB
  maxOutputSize: number;       // 默认 10MB
  allowNetwork: boolean;       // 默认 false
  allowFileWrite: boolean;     // 默认 false
  allowFileRead: boolean;      // 默认 true (限制在工作目录)
}

/** 代码执行请求 */
export interface ExecutionRequest {
  code: string;
  language: SupportedLanguage;
  inputs?: Record<string, string>;
  workingDir?: string;
  limits?: Partial<ResourceLimits>;
}

/** 沙箱配置 */
export interface SandboxConfig {
  workDir: string;
  pythonPath: string;
  nodePath: string;
  defaultLimits: ResourceLimits;
  allowedImports: {
    python: string[];
    javascript: string[];
    typescript: string[];
  };
  blockedPatterns: string[];
}

/** 执行历史记录 */
export interface ExecutionHistory {
  id: string;
  request: ExecutionRequest;
  result: ExecutionResult;
  scanResult: SecurityScanResult;
  timestamp: number;
}

/** 依赖安装请求 */
export interface DependencyRequest {
  language: SupportedLanguage;
  packages: string[];
  dev?: boolean;
}

/** 依赖安装结果 */
export interface DependencyResult {
  success: boolean;
  installed: string[];
  failed: string[];
  output: string;
  error?: string;
}

/** 代码模板 */
export interface CodeTemplate {
  id: string;
  name: string;
  language: SupportedLanguage;
  description: string;
  code: string;
  inputs?: string[];
}
