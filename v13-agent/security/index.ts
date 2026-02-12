/**
 * security/index.ts - V12 安全策略系统
 * 
 * 核心哲学: "信任但验证"
 * 
 * 功能:
 * - 工具权限分级: safe/confirm/dangerous
 * - 上下文感知: 根据渠道/用户调整策略
 * - 审计日志: 记录所有敏感操作
 * - 敏感数据保护: 自动识别和遮蔽
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// ============================================================================
// 类型定义
// ============================================================================

export type ToolRiskLevel = 'safe' | 'confirm' | 'dangerous';
export type TrustLevel = 'owner' | 'trusted' | 'normal' | 'restricted';

export interface AuditEntry {
  timestamp: number;
  tool: string;
  args: Record<string, any>;
  userId?: string;
  channel?: string;
  chatType?: 'direct' | 'group';
  decision: 'allowed' | 'denied' | 'confirmed';
  reason?: string;
}

export interface SecurityContext {
  userId?: string;
  channel?: string;
  chatType?: 'direct' | 'group';
  trustLevel: TrustLevel;
}

export interface SecurityPolicy {
  toolRiskLevels: Record<string, ToolRiskLevel>;
  trustAllowedRisk: Record<TrustLevel, ToolRiskLevel[]>;
  groupDenyList: string[];
  sensitivePatterns: RegExp[];
  auditEnabled: boolean;
  confirmDangerous: boolean;
}

// ============================================================================
// 默认安全策略
// ============================================================================

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  toolRiskLevels: {
    // Safe: 只读操作
    'read_file': 'safe',
    'grep': 'safe',
    'memory_search': 'safe',
    'memory_get': 'safe',
    'memory_stats': 'safe',
    'identity_get': 'safe',
    'daily_read': 'safe',
    'daily_recent': 'safe',
    'daily_list': 'safe',
    'longterm_read': 'safe',
    'time_context': 'safe',
    'heartbeat_get': 'safe',
    'heartbeat_status': 'safe',
    'session_list': 'safe',
    'introspect_stats': 'safe',
    'introspect_patterns': 'safe',
    'introspect_logs': 'safe',
    'channel_list': 'safe',
    'channel_status': 'safe',
    'security_audit': 'safe',
    'security_policy': 'safe',
    
    // Confirm: 写操作
    'write_file': 'confirm',
    'edit_file': 'confirm',
    'memory_append': 'confirm',
    'memory_ingest': 'confirm',
    'identity_update': 'confirm',
    'daily_write': 'confirm',
    'longterm_update': 'confirm',
    'longterm_append': 'confirm',
    'heartbeat_update': 'confirm',
    'heartbeat_record': 'confirm',
    'session_create': 'confirm',
    'session_delete': 'confirm',
    'channel_send': 'confirm',
    'channel_config': 'confirm',
    'channel_start': 'confirm',
    'channel_stop': 'confirm',
    'TodoWrite': 'confirm',
    'Claw': 'confirm',
    'subagent': 'confirm',
    
    // Dangerous: 系统操作
    'bash': 'dangerous',
    'identity_init': 'dangerous',
    'session_cleanup': 'dangerous',
    'heartbeat_run': 'dangerous',
    'introspect_reflect': 'dangerous',
  },
  
  trustAllowedRisk: {
    'owner': ['safe', 'confirm', 'dangerous'],
    'trusted': ['safe', 'confirm'],
    'normal': ['safe'],
    'restricted': [],
  },
  
  groupDenyList: [
    'bash',
    'write_file',
    'edit_file',
    'identity_update',
    'identity_init',
    'session_cleanup',
    'longterm_update',
  ],
  
  sensitivePatterns: [
    /api[_-]?key/i,
    /password/i,
    /secret/i,
    /token/i,
    /private[_-]?key/i,
    /credential/i,
    /\b[A-Za-z0-9+/]{40,}\b/,  // Base64 长字符串
    /sk-[a-zA-Z0-9]{20,}/,     // OpenAI API key
    /ghp_[a-zA-Z0-9]{36}/,     // GitHub token
  ],
  
  auditEnabled: true,
  confirmDangerous: false,  // 默认 YOLO 模式
};

// ============================================================================
// 安全系统类
// ============================================================================

export class SecuritySystem {
  private workspaceDir: string;
  private auditDir: string;
  private policyFile: string;
  private policy: SecurityPolicy;
  private currentContext: SecurityContext = { trustLevel: 'normal' };
  private pendingConfirmations: Map<string, { 
    tool: string; 
    args: Record<string, any>; 
    resolve: (confirmed: boolean) => void 
  }> = new Map();

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.auditDir = path.join(workspaceDir, '.security', 'audit');
    this.policyFile = path.join(workspaceDir, '.security', 'policy.json');
    
    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }
    
    this.policy = this.loadPolicy();
  }

  private loadPolicy(): SecurityPolicy {
    if (fs.existsSync(this.policyFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(this.policyFile, 'utf-8'));
        return {
          ...DEFAULT_SECURITY_POLICY,
          ...saved,
          toolRiskLevels: { ...DEFAULT_SECURITY_POLICY.toolRiskLevels, ...saved.toolRiskLevels },
          trustAllowedRisk: { ...DEFAULT_SECURITY_POLICY.trustAllowedRisk, ...saved.trustAllowedRisk },
        };
      } catch (e) {
        console.log('\x1b[33m警告: 安全策略文件损坏，使用默认策略\x1b[0m');
      }
    }
    return { ...DEFAULT_SECURITY_POLICY };
  }

  private savePolicy() {
    const dir = path.dirname(this.policyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.policyFile, JSON.stringify(this.policy, null, 2));
  }

  // 设置当前安全上下文
  setContext(ctx: Partial<SecurityContext>) {
    this.currentContext = { ...this.currentContext, ...ctx };
  }

  // 获取当前上下文
  getContext(): SecurityContext {
    return { ...this.currentContext };
  }

  // 获取工具风险等级
  getToolRiskLevel(tool: string): ToolRiskLevel {
    return this.policy.toolRiskLevels[tool] || 'confirm';
  }

  // 检查操作是否允许
  checkPermission(tool: string, args: Record<string, any>): { 
    allowed: boolean; 
    reason?: string; 
    needsConfirm?: boolean 
  } {
    const riskLevel = this.getToolRiskLevel(tool);
    const { trustLevel, chatType } = this.currentContext;
    
    // 检查信任等级
    const allowedRisks = this.policy.trustAllowedRisk[trustLevel];
    if (!allowedRisks.includes(riskLevel)) {
      return { 
        allowed: false, 
        reason: `信任等级 ${trustLevel} 不允许执行 ${riskLevel} 级别的操作` 
      };
    }
    
    // 检查群聊限制
    if (chatType === 'group' && this.policy.groupDenyList.includes(tool)) {
      return { 
        allowed: false, 
        reason: `工具 ${tool} 在群聊中被禁用` 
      };
    }
    
    // 检查是否需要确认
    if (riskLevel === 'dangerous' && this.policy.confirmDangerous) {
      return { 
        allowed: true, 
        needsConfirm: true,
        reason: `危险操作需要确认` 
      };
    }
    
    return { allowed: true };
  }

  // 记录审计日志
  audit(entry: Omit<AuditEntry, 'timestamp'>) {
    if (!this.policy.auditEnabled) return;
    
    const fullEntry: AuditEntry = {
      ...entry,
      timestamp: Date.now(),
      userId: entry.userId || this.currentContext.userId,
      channel: entry.channel || this.currentContext.channel,
      chatType: entry.chatType || this.currentContext.chatType,
    };
    
    // 遮蔽敏感信息
    fullEntry.args = this.maskSensitive(fullEntry.args);
    
    // 写入日志文件
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.auditDir, `${date}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify(fullEntry) + '\n');
  }

  // 遮蔽敏感信息
  maskSensitive(data: any): any {
    if (typeof data === 'string') {
      let masked = data;
      for (const pattern of this.policy.sensitivePatterns) {
        masked = masked.replace(pattern, '[REDACTED]');
      }
      return masked;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitive(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        // 检查 key 是否敏感
        const isSensitiveKey = this.policy.sensitivePatterns.some(p => p.test(key));
        result[key] = isSensitiveKey ? '[REDACTED]' : this.maskSensitive(value);
      }
      return result;
    }
    
    return data;
  }

  // 获取审计日志
  getAuditLogs(options: { days?: number; tool?: string; limit?: number } = {}): AuditEntry[] {
    const { days = 7, tool, limit = 100 } = options;
    const logs: AuditEntry[] = [];
    
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(this.auditDir)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .reverse();
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.auditDir, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      for (const line of lines.reverse()) {
        try {
          const entry = JSON.parse(line) as AuditEntry;
          if (entry.timestamp < cutoff) continue;
          if (tool && entry.tool !== tool) continue;
          logs.push(entry);
          if (logs.length >= limit) return logs;
        } catch (e) {
          // 跳过损坏的行
        }
      }
    }
    
    return logs;
  }

  // 更新策略
  updatePolicy(updates: Partial<SecurityPolicy>) {
    this.policy = { ...this.policy, ...updates };
    this.savePolicy();
  }

  // 获取策略
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  // 请求确认（默认 YOLO 模式 - 自动确认所有操作）
  requestConfirmation(tool: string, args: Record<string, any>): Promise<boolean> {
    // YOLO 模式：除非 confirmDangerous 被显式设置为 true，否则自动确认
    if (!this.policy.confirmDangerous) {
      return Promise.resolve(true);
    }
    
    // 打印警告但仍然自动确认
    console.log(`\x1b[33m[安全警告] 危险操作: ${tool}\x1b[0m`);
    const argsPreview = JSON.stringify(this.maskSensitive(args), null, 2).slice(0, 200);
    console.log(`参数: ${argsPreview}${argsPreview.length >= 200 ? '...' : ''}`);
    
    // 自动确认（YOLO 模式）
    return Promise.resolve(true);
  }

  // 处理确认
  handleConfirmation(id: string, confirmed: boolean): boolean {
    const pending = this.pendingConfirmations.get(id);
    if (!pending) return false;
    
    pending.resolve(confirmed);
    this.pendingConfirmations.delete(id);
    return true;
  }

  // 获取待确认列表
  getPendingConfirmations(): Array<{ id: string; tool: string; args: Record<string, any> }> {
    return Array.from(this.pendingConfirmations.entries()).map(([id, { tool, args }]) => ({
      id,
      tool,
      args: this.maskSensitive(args),
    }));
  }
}

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
// 工具处理���
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
