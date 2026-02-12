/**
 * v12-agent/security/index.ts - 安全系统
 * 
 * V12 新增功能:
 * - 工具权限分级控制
 * - 信任等级管理
 * - 审计日志
 * - 敏感数据遮蔽
 */

import * as fs from "fs";
import * as path from "path";
import type {
  TrustLevel,
  RiskLevel,
  SecurityPolicy,
  SecurityContext,
  AuditRecord,
  PolicySuggestion,
} from "./types.js";

export class SecuritySystem {
  private auditDir: string;
  private policy: SecurityPolicy;
  private currentContext: SecurityContext;

  constructor(
    workDir: string,
    policy?: Partial<SecurityPolicy>,
    context?: Partial<SecurityContext>
  ) {
    this.auditDir = path.join(workDir, ".security", "audit");
    this.ensureAuditDir();

    // 默认策略
    this.policy = {
      defaultLevel: "normal",
      toolPermissions: {
        // safe - 只读操作
        read_file: "safe",
        grep: "safe",
        memory_search: "safe",
        memory_search_all: "safe",
        daily_read: "safe",
        daily_recent: "safe",
        longterm_read: "safe",
        session_list: "safe",
        channel_list: "safe",
        channel_status: "safe",
        introspect_stats: "safe",
        introspect_patterns: "safe",
        introspect_reflect: "safe",

        // confirm - 写操作但可撤销
        write_file: "confirm",
        edit_file: "confirm",
        daily_write: "confirm",
        longterm_append: "confirm",
        TodoWrite: "confirm",
        channel_send: "confirm",
        channel_config: "confirm",

        // dangerous - 破坏性操作
        bash: "dangerous",
        session_cleanup: "dangerous",
      },
      ...policy,
    };

    // 默认上下文
    this.currentContext = {
      userId: "default",
      trustLevel: "normal",
      ...context,
    };
  }

  private ensureAuditDir(): void {
    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }
  }

  // 检查权限
  checkPermission(tool: string, context?: SecurityContext): boolean {
    const ctx = context || this.currentContext;
    const risk = this.policy.toolPermissions[tool] || "confirm";

    const levels: TrustLevel[] = ["restricted", "normal", "trusted", "owner"];
    const userLevel = levels.indexOf(ctx.trustLevel);

    // 检查 denyList
    if (this.policy.denyList?.includes(tool)) {
      return false;
    }

    // 检查 allowList（如果设置了，只允许列表中的工具）
    if (this.policy.allowList && !this.policy.allowList.includes(tool)) {
      return false;
    }

    switch (risk) {
      case "safe":
        return true;
      case "confirm":
        return userLevel >= 1; // normal+
      case "dangerous":
        return userLevel >= 2; // trusted+
      default:
        return false;
    }
  }

  // 设置当前上下文
  setContext(context: Partial<SecurityContext>): void {
    this.currentContext = { ...this.currentContext, ...context };
  }

  // 获取当前上下文
  getContext(): SecurityContext {
    return { ...this.currentContext };
  }

  // 记录审计日志
  audit(
    action: string,
    allowed: boolean,
    details?: {
      tool?: string;
      args?: Record<string, any>;
      reason?: string;
    }
  ): void {
    const record: AuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      action,
      tool: details?.tool,
      args: details?.args ? this.maskSensitiveInArgs(details.args) : undefined,
      userId: this.currentContext.userId,
      trustLevel: this.currentContext.trustLevel,
      allowed,
      reason: details?.reason,
      masked: true,
    };

    const date = new Date().toISOString().split("T")[0];
    const auditFile = path.join(this.auditDir, `${date}.jsonl`);

    fs.appendFileSync(auditFile, JSON.stringify(record) + "\n");
  }

  // 遮蔽敏感信息
  maskSensitive(data: string): string {
    // API Keys
    data = data.replace(/sk-[a-zA-Z0-9]{48}/g, "sk-***");
    // 密码
    data = data.replace(/password["']?\s*[:=]\s*["'][^"']+/gi, 'password: "***"');
    // Token
    data = data.replace(/token["']?\s*[:=]\s*["'][^"']+/gi, 'token: "***"');
    // 私钥
    data = data.replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[PRIVATE KEY]");

    return data;
  }

  // 在参数中遮蔽敏感信息
  private maskSensitiveInArgs(args: Record<string, any>): Record<string, any> {
    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === "string") {
        masked[key] = this.maskSensitive(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  // 获取审计日志
  getAuditLogs(options?: {
    date?: string;
    limit?: number;
    userId?: string;
  }): AuditRecord[] {
    const date = options?.date || new Date().toISOString().split("T")[0];
    const auditFile = path.join(this.auditDir, `${date}.jsonl`);

    if (!fs.existsSync(auditFile)) {
      return [];
    }

    const lines = fs.readFileSync(auditFile, "utf-8").trim().split("\n");
    let records = lines
      .filter((line) => line)
      .map((line) => JSON.parse(line) as AuditRecord);

    if (options?.userId) {
      records = records.filter((r) => r.userId === options.userId);
    }

    if (options?.limit) {
      records = records.slice(-options.limit);
    }

    return records;
  }

  // 生成策略建议
  generateSuggestions(auditLogs: AuditRecord[]): PolicySuggestion[] {
    const suggestions: PolicySuggestion[] = [];
    const toolStats: Record<
      string,
      { calls: number; errors: number; denied: number }
    > = {};

    // 统计工具使用情况
    for (const log of auditLogs) {
      if (!log.tool) continue;
      if (!toolStats[log.tool]) {
        toolStats[log.tool] = { calls: 0, errors: 0, denied: 0 };
      }
      toolStats[log.tool].calls++;
      if (!log.allowed) toolStats[log.tool].denied++;
    }

    // 生成建议
    for (const [tool, stats] of Object.entries(toolStats)) {
      const currentRisk = this.policy.toolPermissions[tool] || "confirm";

      // 如果从未被拒绝且调用次数多，建议降低风险等级
      if (stats.denied === 0 && stats.calls > 10) {
        if (currentRisk === "dangerous") {
          suggestions.push({
            type: "risk_level",
            tool,
            currentValue: currentRisk,
            suggestedValue: "confirm",
            confidence: 0.8,
            reason: `${tool} 被调用 ${stats.calls} 次，从未被拒绝，建议降级为 confirm`,
          });
        } else if (currentRisk === "confirm") {
          suggestions.push({
            type: "risk_level",
            tool,
            currentValue: currentRisk,
            suggestedValue: "safe",
            confidence: 0.7,
            reason: `${tool} 被调用 ${stats.calls} 次，从未被拒绝，建议降级为 safe`,
          });
        }
      }
    }

    return suggestions;
  }

  // 应用策略建议
  applySuggestion(suggestion: PolicySuggestion): boolean {
    if (suggestion.type === "risk_level" && suggestion.tool) {
      this.policy.toolPermissions[suggestion.tool] =
        suggestion.suggestedValue as RiskLevel;
      return true;
    }
    return false;
  }

  // 获取当前策略
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  // 更新策略
  updatePolicy(policy: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  // 遮蔽敏感信息
  maskSensitive(data: string): string {
    // API Keys
    data = data.replace(/sk-[a-zA-Z0-9]{48}/g, "sk-***");
    // 密码
    data = data.replace(/password["']?\s*[:=]\s*["'][^"']+/gi, 'password: "***"');
    // Token
    data = data.replace(/token["']?\s*[:=]\s*["'][^"']+/gi, 'token: "***"');
    // 私钥
    data = data.replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[PRIVATE KEY]");

    return data;
  }

  // 获取审计日志（带过滤）
  getAuditLogs(options?: {
    date?: string;
    limit?: number;
    userId?: string;
    tool?: string;
  }): AuditRecord[] {
    return this.getAuditLogs(options);
  }
}

export default SecuritySystem;

// ============================================================================
// 安全工具定义
// ============================================================================

export function getSecurityTools() {
  return [
    {
      name: "security_check",
      description: "检查操作是否被允许",
      input_schema: {
        type: "object" as const,
        properties: {
          tool: { type: "string", description: "要检查的工具名" },
          args: { type: "object", description: "工具参数" },
        },
        required: ["tool"],
      },
    },
    {
      name: "security_audit",
      description: "查看审计日志",
      input_schema: {
        type: "object" as const,
        properties: {
          days: { type: "number", description: "查看最近几天，默认7" },
          tool: { type: "string", description: "筛选特定工具" },
          limit: { type: "number", description: "最大条数，默认100" },
        },
      },
    },
    {
      name: "security_policy",
      description: "查看或更新安全策略",
      input_schema: {
        type: "object" as const,
        properties: {
          action: { 
            type: "string", 
            enum: ["get", "update"],
            description: "操作类型" 
          },
          updates: { 
            type: "object", 
            description: "更新内容（action=update时）" 
          },
        },
        required: ["action"],
      },
    },
    {
      name: "security_mask",
      description: "遮蔽敏感信息",
      input_schema: {
        type: "object" as const,
        properties: {
          text: { type: "string", description: "要遮蔽的文本" },
        },
        required: ["text"],
      },
    },
  ];
}

// ============================================================================
// 工具处理器
// ============================================================================

export function createSecurityHandlers(security: SecuritySystem) {
  return {
    security_check: (args: { tool: string; args?: Record<string, any> }) => {
      const result = security.checkPermission(args.tool, args.args || {});
      return JSON.stringify(result, null, 2);
    },
    
    security_audit: (args: { days?: number; tool?: string; limit?: number }) => {
      const logs = security.getAuditLogs(args);
      return JSON.stringify({
        count: logs.length,
        logs: logs.slice(0, 20),  // 只返回前20条
      }, null, 2);
    },
    
    security_policy: (args: { action: string; updates?: Partial<SecurityPolicy> }) => {
      if (args.action === 'get') {
        return JSON.stringify(security.getPolicy(), null, 2);
      } else if (args.action === 'update' && args.updates) {
        security.updatePolicy(args.updates);
        return '策略已更新';
      }
      return '无效操作';
    },
    
    security_mask: (args: { text: string }) => {
      return security.maskSensitive(args.text);
    },
  };
}
