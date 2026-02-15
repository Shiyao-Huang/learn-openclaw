/**
 * V29: 安全审计工具定义
 */

import type { Tool, ToolHandler } from "../types.js";
import type {
  SecurityAuditReport,
  SecurityFixResult,
  SecurityStatus,
} from "./types.js";
import {
  getSecurityEngine,
  closeSecurityEngine,
} from "./engine.js";

// ============ 工具 Schemas ============

export const SECURITY_TOOLS: Tool[] = [
  {
    name: "security_audit",
    description: "执行完整安全审计，检查文件权限、配置安全、密钥泄露等问题",
    input_schema: {
      type: "object",
      properties: {
        targetDir: {
          type: "string",
          description: "要审计的目标目录（默认当前目录）",
        },
        checks: {
          type: "object",
          properties: {
            filePermissions: {
              type: "boolean",
              description: "是否检查文件权限（默认 true）",
            },
            configSafety: {
              type: "boolean",
              description: "是否检查配置安全（默认 true）",
            },
            secretsInFiles: {
              type: "boolean",
              description: "是否检查密钥泄露（默认 true）",
            },
          },
        },
      },
    },
  },
  {
    name: "security_check_permissions",
    description: "检查文件和目录的权限安全",
    input_schema: {
      type: "object",
      properties: {
        targetDir: {
          type: "string",
          description: "要检查的目标目录",
        },
      },
    },
  },
  {
    name: "security_check_config",
    description: "检查配置文件的安全问题",
    input_schema: {
      type: "object",
      properties: {
        targetDir: {
          type: "string",
          description: "要检查的目标目录",
        },
      },
    },
  },
  {
    name: "security_check_secrets",
    description: "扫描文件中的密钥泄露风险",
    input_schema: {
      type: "object",
      properties: {
        targetDir: {
          type: "string",
          description: "要扫描的目标目录",
        },
      },
    },
  },
  {
    name: "security_status",
    description: "获取安全审计系统的状态",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "security_fix",
    description: "自动修复可修复的安全问题",
    input_schema: {
      type: "object",
      properties: {
        findingIds: {
          type: "array",
          items: { type: "string" },
          description: "要修复的问题 ID 列表（可选，默认修复所有可修复的问题）",
        },
      },
    },
  },
  {
    name: "security_report",
    description: "生成安全审计报告",
    input_schema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["text", "json", "markdown"],
          description: "报告格式（默认 text）",
        },
      },
    },
  },
  {
    name: "security_history",
    description: "获取审计历史记录",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "返回的历史记录数量（默认 10）",
        },
      },
    },
  },
];

// ============ 工具 Handlers ============

export const securityHandlers: Record<string, ToolHandler> = {
  security_audit: async (params: {
    targetDir?: string;
    checks?: {
      filePermissions?: boolean;
      configSafety?: boolean;
      secretsInFiles?: boolean;
    };
  }): Promise<SecurityAuditReport> => {
    const engine = getSecurityEngine();
    return engine.runAudit(params);
  },

  security_check_permissions: async (params: {
    targetDir?: string;
  }): Promise<SecurityAuditReport> => {
    const engine = getSecurityEngine();
    return engine.runAudit({
      targetDir: params.targetDir,
      checks: {
        filePermissions: true,
        configSafety: false,
        secretsInFiles: false,
      },
    });
  },

  security_check_config: async (params: {
    targetDir?: string;
  }): Promise<SecurityAuditReport> => {
    const engine = getSecurityEngine();
    return engine.runAudit({
      targetDir: params.targetDir,
      checks: {
        filePermissions: false,
        configSafety: true,
        secretsInFiles: false,
      },
    });
  },

  security_check_secrets: async (params: {
    targetDir?: string;
  }): Promise<SecurityAuditReport> => {
    const engine = getSecurityEngine();
    return engine.runAudit({
      targetDir: params.targetDir,
      checks: {
        filePermissions: false,
        configSafety: false,
        secretsInFiles: true,
      },
    });
  },

  security_status: async (): Promise<SecurityStatus> => {
    const engine = getSecurityEngine();
    return engine.getStatus();
  },

  security_fix: async (params: {
    findingIds?: string[];
  }): Promise<SecurityFixResult> => {
    const engine = getSecurityEngine();
    const status = engine.getStatus();
    
    if (!status.lastAudit) {
      return {
        ok: false,
        actions: [],
        changes: [],
        errors: ["没有可用的审计结果，请先运行 security_audit"],
      };
    }

    const lastReport = engine.getHistory(1)[0];
    if (!lastReport) {
      return {
        ok: false,
        actions: [],
        changes: [],
        errors: ["无法获取审计报告"],
      };
    }

    let findingsToFix = lastReport.findings;
    if (params.findingIds && params.findingIds.length > 0) {
      findingsToFix = findingsToFix.filter(f => 
        params.findingIds!.includes(f.checkId)
      );
    }

    return engine.fixIssues(findingsToFix);
  },

  security_report: async (params: {
    format?: "text" | "json" | "markdown";
  }): Promise<string> => {
    const engine = getSecurityEngine();
    const status = engine.getStatus();
    
    if (!status.lastAudit) {
      return "没有可用的审计结果，请先运行 security_audit";
    }

    const lastReport = engine.getHistory(1)[0];
    if (!lastReport) {
      return "无法获取审计报告";
    }

    const format = params.format || "text";

    if (format === "json") {
      return JSON.stringify(lastReport, null, 2);
    }

    if (format === "markdown") {
      let md = "# 安全审计报告\n\n";
      md += `**时间**: ${new Date(lastReport.ts).toISOString()}\n\n`;
      md += `## 摘要\n\n`;
      md += `- 🔴 严重: ${lastReport.summary.critical}\n`;
      md += `- 🟡 警告: ${lastReport.summary.warn}\n`;
      md += `- 🔵 信息: ${lastReport.summary.info}\n\n`;
      
      if (lastReport.findings.length > 0) {
        md += `## 发现的问题\n\n`;
        for (const f of lastReport.findings) {
          const icon = f.severity === "critical" ? "🔴" : 
                       f.severity === "warn" ? "🟡" : "🔵";
          md += `### ${icon} ${f.title}\n\n`;
          md += `- **检查 ID**: ${f.checkId}\n`;
          md += `- **严重程度**: ${f.severity}\n`;
          md += `- **详情**: ${f.detail}\n`;
          if (f.remediation) {
            md += `- **修复建议**: ${f.remediation}\n`;
          }
          md += "\n";
        }
      } else {
        md += `## 未发现问题 ✅\n\n`;
      }

      return md;
    }

    // 默认文本格式
    let text = "=== 安全审计报告 ===\n\n";
    text += `时间: ${new Date(lastReport.ts).toISOString()}\n`;
    text += `摘要: 严重(${lastReport.summary.critical}) 警告(${lastReport.summary.warn}) 信息(${lastReport.summary.info})\n\n`;
    
    if (lastReport.findings.length > 0) {
      text += "发现的问题:\n";
      for (const f of lastReport.findings) {
        const sev = f.severity === "critical" ? "[严重]" : 
                    f.severity === "warn" ? "[警告]" : "[信息]";
        text += `  ${sev} ${f.title}\n`;
        text += `    - ${f.detail}\n`;
        if (f.remediation) {
          text += `    - 修复: ${f.remediation}\n`;
        }
      }
    } else {
      text += "✅ 未发现安全问题\n";
    }

    return text;
  },

  security_history: async (params: {
    limit?: number;
  }): Promise<string> => {
    const engine = getSecurityEngine();
    const history = engine.getHistory(params.limit || 10);
    
    if (history.length === 0) {
      return "没有审计历史记录";
    }

    let text = "=== 审计历史 ===\n\n";
    for (const report of history) {
      const date = new Date(report.ts).toLocaleString();
      text += `${date}: 严重(${report.summary.critical}) 警告(${report.summary.warn}) 信息(${report.summary.info})\n`;
    }

    return text;
  },
};

export function closeSecurityHandlers(): void {
  closeSecurityEngine();
}

// 工具数量
export const SECURITY_TOOL_COUNT = SECURITY_TOOLS.length;
