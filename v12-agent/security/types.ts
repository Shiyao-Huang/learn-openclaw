/**
 * v12-agent/security/types.ts - 安全系统类型
 * 
 * V12 新增: 安全策略与审计
 */

// 信任等级
export type TrustLevel = "owner" | "trusted" | "normal" | "restricted";

// 工具风险等级
export type RiskLevel = "safe" | "confirm" | "dangerous";

// 安全策略配置
export interface SecurityPolicy {
  defaultLevel: TrustLevel;
  toolPermissions: Record<string, RiskLevel>;
  denyList?: string[];      // 禁止的工具
  allowList?: string[];     // 允许的工具（优先级高于 denyList）
  confirmDangerous?: boolean;  // 是否需要确认危险操作（默认 false = YOLO 模式）
}

// 安全上下文
export interface SecurityContext {
  userId: string;
  trustLevel: TrustLevel;
  channel?: string;
  session?: string;
}

// 审计记录
export interface AuditRecord {
  id: string;
  timestamp: number;
  action: string;
  tool?: string;
  args?: Record<string, any>;
  userId: string;
  trustLevel: TrustLevel;
  allowed: boolean;
  reason?: string;
  masked?: boolean;
}

// 策略建议
export interface PolicySuggestion {
  type: "risk_level" | "trust_adjustment" | "deny_list";
  tool?: string;
  currentValue: string;
  suggestedValue: string;
  confidence: number;
  reason: string;
}
