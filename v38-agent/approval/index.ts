/**
 * V38: 命令执行审批系统 - 导出
 */

export {
  // Types
  type ExecHost,
  type ExecSecurity,
  type ExecAsk,
  type ApprovalPolicy,
  type AllowlistEntry,
  type ApprovalConfig,
  type CommandSegment,
  type CommandAnalysis,
  type ApprovalDecision,
  type ApprovalResult,
  
  // Engine
  ApprovalEngine,
  getApprovalEngine,
  resetApprovalEngine,
  
  // Defaults
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_SAFE_BINS,
} from "./engine.js";

export {
  // Tools
  APPROVAL_TOOLS,
  APPROVAL_TOOL_COUNT,
  createApprovalHandlers,
  closeApprovalHandlers,
} from "./tools.js";
