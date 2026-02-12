/**
 * v22-agent/sandbox/index.ts - 代码执行沙箱模块入口
 * 
 * V22: 代码执行沙箱
 * 
 * 功能:
 * - 安全执行 Python、JavaScript、TypeScript、Bash 代码
 * - 代码安全扫描
 * - 资源限制 (时间、内存、输出)
 * - 依赖管理
 * - 执行历史
 */

export { SandboxRunner } from "./runner.js";
export { scanCode, createDefaultConfig, isCodeSafe } from "./scanner.js";
export { getSandboxTools } from "./tools.js";
export { createSandboxHandlers } from "./handlers.js";

export type {
  SupportedLanguage,
  ExecutionResult,
  SecurityScanResult,
  SecurityIssue,
  ResourceLimits,
  ExecutionRequest,
  SandboxConfig,
  ExecutionHistory,
  DependencyRequest,
  DependencyResult,
} from "./types.js";
