/**
 * V29: 安全审计系统 - 类型定义
 */

export type SecurityAuditSeverity = "info" | "warn" | "critical";

export type SecurityAuditFinding = {
  checkId: string;
  severity: SecurityAuditSeverity;
  title: string;
  detail: string;
  remediation?: string;
};

export type SecurityAuditSummary = {
  critical: number;
  warn: number;
  info: number;
};

export type SecurityAuditReport = {
  ts: number;
  summary: SecurityAuditSummary;
  findings: SecurityAuditFinding[];
  checks: {
    filePermissions: boolean;
    configSafety: boolean;
    secretsInFiles: boolean;
  };
};

export type SecurityFixAction = {
  kind: "chmod" | "config_change" | "file_change";
  path?: string;
  change?: string;
  ok: boolean;
  error?: string;
};

export type SecurityFixResult = {
  ok: boolean;
  actions: SecurityFixAction[];
  changes: string[];
  errors: string[];
};

export type SecurityStatus = {
  lastAudit: number | null;
  criticalCount: number;
  warnCount: number;
  infoCount: number;
  checks: {
    filePermissions: boolean;
    configSafety: boolean;
    secretsInFiles: boolean;
  };
};

export type SecurityEngineConfig = {
  enabled?: boolean;
  checks?: {
    filePermissions?: boolean;
    configSafety?: boolean;
    secretsInFiles?: boolean;
  };
  storageDir?: string;
};

export type AuditCheck = (params: {
  config: SecurityEngineConfig;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
}) => Promise<SecurityAuditFinding[]>;
