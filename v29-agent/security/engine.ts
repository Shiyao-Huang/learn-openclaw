/**
 * V29: 安全审计引擎
 * 
 * 提供基础的安全检查功能，包括：
 * - 文件权限检查
 * - 配置安全检查
 * - 密钥泄露检测
 */

import * as fs from "fs";
import * as path from "path";
import type {
  SecurityAuditSeverity,
  SecurityAuditFinding,
  SecurityAuditSummary,
  SecurityAuditReport,
  SecurityFixAction,
  SecurityFixResult,
  SecurityStatus,
  SecurityEngineConfig,
} from "./types.js";

export class SecurityEngine {
  private config: SecurityEngineConfig;
  private lastAudit: SecurityAuditReport | null = null;
  private auditHistory: SecurityAuditReport[] = [];
  private maxHistory = 100;

  constructor(config: SecurityEngineConfig = {}) {
    this.config = {
      enabled: true,
      checks: {
        filePermissions: true,
        configSafety: true,
        secretsInFiles: true,
      },
      storageDir: process.cwd(),
      ...config,
    };
  }

  /**
   * 执行完整安全审计
   */
  async runAudit(options: {
    targetDir?: string;
    checks?: {
      filePermissions?: boolean;
      configSafety?: boolean;
      secretsInFiles?: boolean;
    };
  } = {}): Promise<SecurityAuditReport> {
    const targetDir = options.targetDir || this.config.storageDir || process.cwd();
    const enabledChecks = {
      filePermissions: options.checks?.filePermissions ?? this.config.checks?.filePermissions ?? true,
      configSafety: options.checks?.configSafety ?? this.config.checks?.configSafety ?? true,
      secretsInFiles: options.checks?.secretsInFiles ?? this.config.checks?.secretsInFiles ?? true,
    };

    const findings: SecurityAuditFinding[] = [];

    // 1. 文件权限检查
    if (enabledChecks.filePermissions) {
      findings.push(...await this.checkFilePermissions(targetDir));
    }

    // 2. 配置安全检查
    if (enabledChecks.configSafety) {
      findings.push(...await this.checkConfigSafety(targetDir));
    }

    // 3. 密钥泄露检查
    if (enabledChecks.secretsInFiles) {
      findings.push(...await this.checkSecretsInFiles(targetDir));
    }

    // 生成报告
    const report: SecurityAuditReport = {
      ts: Date.now(),
      summary: this.countBySeverity(findings),
      findings,
      checks: enabledChecks,
    };

    this.lastAudit = report;
    this.auditHistory.push(report);
    
    // 限制历史记录
    if (this.auditHistory.length > this.maxHistory) {
      this.auditHistory = this.auditHistory.slice(-this.maxHistory);
    }

    return report;
  }

  /**
   * 检查文件权限
   */
  private async checkFilePermissions(targetDir: string): Promise<SecurityAuditFinding[]> {
    const findings: SecurityAuditFinding[] = [];
    
    try {
      // 检查目标目录权限
      const dirStat = fs.statSync(targetDir);
      const dirMode = dirStat.mode & 0o777;
      
      // 检查是否 world-writable
      if (dirMode & 0o002) {
        findings.push({
          checkId: "fs.world_writable",
          severity: "critical",
          title: "目录可被任何人写入",
          detail: `目录 ${targetDir} 权限为 ${dirMode.toString(8)}，其他用户可以写入`,
          remediation: `运行: chmod 755 ${targetDir}`,
        });
      }

      // 检查 .env 文件权限
      const envPath = path.join(targetDir, ".env");
      if (fs.existsSync(envPath)) {
        const envStat = fs.statSync(envPath);
        const envMode = envStat.mode & 0o777;
        
        if (envMode & 0o077) {
          findings.push({
            checkId: "fs.env_permissive",
            severity: "critical",
            title: ".env 文件权限过于宽松",
            detail: `.env 文件权限为 ${envMode.toString(8)}，可能泄露敏感信息`,
            remediation: `运行: chmod 600 ${envPath}`,
          });
        }
      }

      // 检查敏感文件
      const sensitiveFiles = [
        "credentials.json",
        "secrets.json",
        "private.key",
        "id_rsa",
        ".pem",
      ];

      for (const file of sensitiveFiles) {
        const filePath = path.join(targetDir, file);
        if (fs.existsSync(filePath)) {
          const fileStat = fs.statSync(filePath);
          const fileMode = fileStat.mode & 0o777;
          
          if (fileMode & 0o077) {
            findings.push({
              checkId: "fs.sensitive_file_permissive",
              severity: "critical",
              title: `敏感文件 ${file} 权限过于宽松`,
              detail: `文件权限为 ${fileMode.toString(8)}`,
              remediation: `运行: chmod 600 ${filePath}`,
            });
          }
        }
      }

    } catch (error) {
      findings.push({
        checkId: "fs.check_error",
        severity: "warn",
        title: "文件权限检查失败",
        detail: `${error}`,
      });
    }

    return findings;
  }

  /**
   * 检查配置安全
   */
  private async checkConfigSafety(targetDir: string): Promise<SecurityAuditFinding[]> {
    const findings: SecurityAuditFinding[] = [];

    // 检查 .gitignore 是否包含敏感文件
    const gitignorePath = path.join(targetDir, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, "utf-8");
      const requiredPatterns = [".env", "*.key", "*.pem", "credentials.json"];
      
      for (const pattern of requiredPatterns) {
        if (!gitignore.includes(pattern)) {
          findings.push({
            checkId: "config.gitignore_missing",
            severity: "warn",
            title: ".gitignore 缺少敏感文件模式",
            detail: `.gitignore 中未包含 ${pattern}`,
            remediation: `将 ${pattern} 添加到 .gitignore`,
          });
        }
      }
    } else {
      findings.push({
        checkId: "config.no_gitignore",
        severity: "info",
        title: "缺少 .gitignore 文件",
        detail: "建议创建 .gitignore 以保护敏感文件",
        remediation: "创建 .gitignore 并添加 .env, *.key 等敏感文件模式",
      });
    }

    // 检查 .env 是否被 git 追踪
    const envPath = path.join(targetDir, ".env");
    if (fs.existsSync(envPath)) {
      try {
        const { execSync } = await import("child_process");
        const gitRoot = execSync("git rev-parse --show-toplevel 2>/dev/null", {
          cwd: targetDir,
          encoding: "utf-8",
        }).trim();
        
        const trackedFiles = execSync("git ls-files", {
          cwd: gitRoot,
          encoding: "utf-8",
        });
        
        const relativeEnvPath = path.relative(gitRoot, envPath);
        if (trackedFiles.includes(relativeEnvPath)) {
          findings.push({
            checkId: "config.env_tracked",
            severity: "critical",
            title: ".env 文件被 Git 追踪",
            detail: ".env 文件包含敏感信息，不应被提交到版本控制",
            remediation: "运行: git rm --cached .env，然后添加到 .gitignore",
          });
        }
      } catch {
        // 不在 git 仓库中，跳过
      }
    }

    return findings;
  }

  /**
   * 检查文件中的密钥泄露
   */
  private async checkSecretsInFiles(targetDir: string): Promise<SecurityAuditFinding[]> {
    const findings: SecurityAuditFinding[] = [];
    
    // 密钥模式
    const secretPatterns = [
      { pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/gi, name: "API Key" },
      { pattern: /(?:secret[_-]?key|secretkey)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/gi, name: "Secret Key" },
      { pattern: /(?:access[_-]?token|accesstoken)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/gi, name: "Access Token" },
      { pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"]?[^\s'"]{8,}/gi, name: "Password" },
      { pattern: /sk-[a-zA-Z0-9]{48,}/g, name: "OpenAI API Key" },
      { pattern: /ghp_[a-zA-Z0-9]{36,}/g, name: "GitHub Token" },
      { pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/g, name: "Slack Token" },
    ];

    // 要检查的文件扩展名
    const extensions = [".ts", ".js", ".json", ".env", ".yaml", ".yml", ".md"];
    
    // 要排除的目录
    const excludeDirs = ["node_modules", ".git", "dist", "build", "coverage"];

    const checkFile = (filePath: string) => {
      const ext = path.extname(filePath);
      if (!extensions.includes(ext) && !filePath.endsWith(".env")) return;
      
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        
        for (const { pattern, name } of secretPatterns) {
          const matches = content.match(pattern);
          if (matches && matches.length > 0) {
            // 检查是否在示例/文档中
            const isExample = filePath.includes("example") || 
                             filePath.includes("sample") ||
                             filePath.includes(".sample") ||
                             content.includes("your-api-key-here") ||
                             content.includes("YOUR_API_KEY");
            
            if (!isExample) {
              findings.push({
                checkId: "secrets.leaked",
                severity: "critical",
                title: `发现可能的 ${name} 泄露`,
                detail: `文件 ${filePath} 中可能包含 ${name}`,
                remediation: "将密钥移至环境变量或密钥管理服务",
              });
            }
          }
        }
      } catch {
        // 忽略读取错误
      }
    };

    const walkDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) {
              walkDir(fullPath);
            }
          } else if (entry.isFile()) {
            checkFile(fullPath);
          }
        }
      } catch {
        // 忽略访问错误
      }
    };

    walkDir(targetDir);
    return findings;
  }

  /**
   * 自动修复安全问题
   */
  async fixIssues(findings: SecurityAuditFinding[]): Promise<SecurityFixResult> {
    const actions: SecurityFixAction[] = [];
    const changes: string[] = [];
    const errors: string[] = [];

    for (const finding of findings) {
      try {
        if (finding.checkId === "fs.world_writable" || 
            finding.checkId === "fs.env_permissive" ||
            finding.checkId === "fs.sensitive_file_permissive") {
          
          // 从 remediation 中提取路径
          const match = finding.remediation?.match(/chmod \d+ (.+)/);
          if (match) {
            const targetPath = match[1];
            const modeMatch = finding.remediation?.match(/chmod (\d+)/);
            if (modeMatch) {
              const mode = parseInt(modeMatch[1], 8);
              fs.chmodSync(targetPath, mode);
              actions.push({
                kind: "chmod",
                path: targetPath,
                change: `权限修改为 ${mode.toString(8)}`,
                ok: true,
              });
              changes.push(`修复: ${finding.title}`);
            }
          }
        }
      } catch (error) {
        actions.push({
          kind: "chmod",
          ok: false,
          error: `${error}`,
        });
        errors.push(`修复失败: ${finding.title} - ${error}`);
      }
    }

    return {
      ok: errors.length === 0,
      actions,
      changes,
      errors,
    };
  }

  /**
   * 获取状态
   */
  getStatus(): SecurityStatus {
    return {
      lastAudit: this.lastAudit?.ts ?? null,
      criticalCount: this.lastAudit?.summary.critical ?? 0,
      warnCount: this.lastAudit?.summary.warn ?? 0,
      infoCount: this.lastAudit?.summary.info ?? 0,
      checks: {
        filePermissions: this.config.checks?.filePermissions ?? true,
        configSafety: this.config.checks?.configSafety ?? true,
        secretsInFiles: this.config.checks?.secretsInFiles ?? true,
      },
    };
  }

  /**
   * 获取审计历史
   */
  getHistory(limit = 10): SecurityAuditReport[] {
    return this.auditHistory.slice(-limit);
  }

  /**
   * 计算各严重级别数量
   */
  private countBySeverity(findings: SecurityAuditFinding[]): SecurityAuditSummary {
    let critical = 0;
    let warn = 0;
    let info = 0;
    
    for (const f of findings) {
      if (f.severity === "critical") critical++;
      else if (f.severity === "warn") warn++;
      else info++;
    }
    
    return { critical, warn, info };
  }
}

// 单例实例
let engineInstance: SecurityEngine | null = null;

export function getSecurityEngine(config?: SecurityEngineConfig): SecurityEngine {
  if (!engineInstance) {
    engineInstance = new SecurityEngine(config);
  }
  return engineInstance;
}

export function closeSecurityEngine(): void {
  engineInstance = null;
}
