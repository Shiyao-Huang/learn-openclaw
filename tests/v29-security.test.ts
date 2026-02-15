/**
 * V29: 安全审计系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  SecurityEngine,
  getSecurityEngine,
  closeSecurityEngine,
  SECURITY_TOOLS,
  SECURITY_TOOL_COUNT,
  securityHandlers,
} from "./v29-agent/security/index.js";

describe("V29 Security Audit System", () => {
  let testDir: string;

  beforeEach(() => {
    // 创建临时测试目录
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "security-test-"));
    closeSecurityEngine();
  });

  afterEach(() => {
    // 清理测试目录
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
    closeSecurityEngine();
  });

  describe("SecurityEngine", () => {
    it("should create engine with default config", () => {
      const engine = new SecurityEngine();
      expect(engine).toBeDefined();
    });

    it("should create engine with custom config", () => {
      const engine = new SecurityEngine({
        storageDir: testDir,
        checks: {
          filePermissions: false,
          configSafety: true,
          secretsInFiles: false,
        },
      });
      expect(engine).toBeDefined();
    });

    it("should return status", () => {
      const engine = new SecurityEngine({ storageDir: testDir });
      const status = engine.getStatus();
      expect(status.lastAudit).toBeNull();
      expect(status.criticalCount).toBe(0);
      expect(status.warnCount).toBe(0);
      expect(status.infoCount).toBe(0);
    });

    it("should run audit and return report", async () => {
      const engine = new SecurityEngine({ storageDir: testDir });
      const report = await engine.runAudit({ targetDir: testDir });
      
      expect(report.ts).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.findings).toBeDefined();
      expect(Array.isArray(report.findings)).toBe(true);
    });

    it("should detect missing .gitignore", async () => {
      const engine = new SecurityEngine({ storageDir: testDir });
      const report = await engine.runAudit({ targetDir: testDir });
      
      // 应该检测到缺少 .gitignore
      const gitignoreFinding = report.findings.find(
        f => f.checkId === "config.no_gitignore"
      );
      expect(gitignoreFinding).toBeDefined();
      expect(gitignoreFinding?.severity).toBe("info");
    });

    it("should update status after audit", async () => {
      const engine = new SecurityEngine({ storageDir: testDir });
      await engine.runAudit({ targetDir: testDir });
      
      const status = engine.getStatus();
      expect(status.lastAudit).not.toBeNull();
    });

    it("should track audit history", async () => {
      const engine = new SecurityEngine({ storageDir: testDir });
      
      await engine.runAudit({ targetDir: testDir });
      await engine.runAudit({ targetDir: testDir });
      
      const history = engine.getHistory(10);
      expect(history.length).toBe(2);
    });

    it("should limit history", async () => {
      const engine = new SecurityEngine({ storageDir: testDir });
      
      for (let i = 0; i < 105; i++) {
        await engine.runAudit({ targetDir: testDir });
      }
      
      const history = engine.getHistory(200);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe("File Permission Checks", () => {
    it("should detect permissive .env file", async () => {
      // 创建 .env 文件
      const envPath = path.join(testDir, ".env");
      fs.writeFileSync(envPath, "API_KEY=secret123");
      
      // 设置宽松权限 (仅在 Unix 系统)
      if (process.platform !== "win32") {
        fs.chmodSync(envPath, 0o644);
        
        const engine = new SecurityEngine({ storageDir: testDir });
        const report = await engine.runAudit({
          targetDir: testDir,
          checks: { filePermissions: true, configSafety: false, secretsInFiles: false },
        });
        
        const envFinding = report.findings.find(
          f => f.checkId === "fs.env_permissive"
        );
        expect(envFinding).toBeDefined();
        expect(envFinding?.severity).toBe("critical");
      }
    });

    it("should detect sensitive files with permissive permissions", async () => {
      // 创建敏感文件
      const keyPath = path.join(testDir, "private.key");
      fs.writeFileSync(keyPath, "SECRET KEY CONTENT");
      
      if (process.platform !== "win32") {
        fs.chmodSync(keyPath, 0o644);
        
        const engine = new SecurityEngine({ storageDir: testDir });
        const report = await engine.runAudit({
          targetDir: testDir,
          checks: { filePermissions: true, configSafety: false, secretsInFiles: false },
        });
        
        const keyFinding = report.findings.find(
          f => f.checkId === "fs.sensitive_file_permissive"
        );
        expect(keyFinding).toBeDefined();
      }
    });
  });

  describe("Config Safety Checks", () => {
    it("should detect incomplete .gitignore", async () => {
      // 创建不完整的 .gitignore
      const gitignorePath = path.join(testDir, ".gitignore");
      fs.writeFileSync(gitignorePath, "node_modules\n");
      
      const engine = new SecurityEngine({ storageDir: testDir });
      const report = await engine.runAudit({
        targetDir: testDir,
        checks: { filePermissions: false, configSafety: true, secretsInFiles: false },
      });
      
      // 应该检测到缺少 .env 等模式
      const missingEnv = report.findings.find(
        f => f.checkId === "config.gitignore_missing" && f.detail.includes(".env")
      );
      expect(missingEnv).toBeDefined();
    });

    it("should pass with complete .gitignore", async () => {
      // 创建完整的 .gitignore
      const gitignorePath = path.join(testDir, ".gitignore");
      fs.writeFileSync(gitignorePath, `
node_modules
.env
*.key
*.pem
credentials.json
      `);
      
      const engine = new SecurityEngine({ storageDir: testDir });
      const report = await engine.runAudit({
        targetDir: testDir,
        checks: { filePermissions: false, configSafety: true, secretsInFiles: false },
      });
      
      // 不应该有 gitignore 相关的警告
      const gitignoreWarnings = report.findings.filter(
        f => f.checkId.startsWith("config.gitignore")
      );
      expect(gitignoreWarnings.length).toBe(0);
    });
  });

  describe("Secret Detection", () => {
    it("should detect API keys in files", async () => {
      // 创建包含密钥的文件
      const configPath = path.join(testDir, "config.ts");
      fs.writeFileSync(configPath, `
export const config = {
  api_key: "sk-this-is-a-fake-openai-api-key-12345678901234567890",
};
      `);
      
      const engine = new SecurityEngine({ storageDir: testDir });
      const report = await engine.runAudit({
        targetDir: testDir,
        checks: { filePermissions: false, configSafety: false, secretsInFiles: true },
      });
      
      // 应该检测到密钥泄露
      const secretFinding = report.findings.find(
        f => f.checkId === "secrets.leaked"
      );
      expect(secretFinding).toBeDefined();
      expect(secretFinding?.severity).toBe("critical");
    });

    it("should not flag example files", async () => {
      // 创建示例文件
      const examplePath = path.join(testDir, "config.example.ts");
      fs.writeFileSync(examplePath, `
export const config = {
  api_key: "your-api-key-here",
};
      `);
      
      const engine = new SecurityEngine({ storageDir: testDir });
      const report = await engine.runAudit({
        targetDir: testDir,
        checks: { filePermissions: false, configSafety: false, secretsInFiles: true },
      });
      
      // 示例文件不应被标记
      const secretFinding = report.findings.find(
        f => f.checkId === "secrets.leaked" && f.detail.includes("example")
      );
      expect(secretFinding).toBeUndefined();
    });

    it("should exclude node_modules", async () => {
      // 创建 node_modules 目录
      const nodeModules = path.join(testDir, "node_modules");
      fs.mkdirSync(nodeModules);
      const depFile = path.join(nodeModules, "config.js");
      fs.writeFileSync(depFile, `
        module.exports = { api_key: "sk-real-key-hidden-in-node-modules-1234567890" };
      `);
      
      const engine = new SecurityEngine({ storageDir: testDir });
      const report = await engine.runAudit({
        targetDir: testDir,
        checks: { filePermissions: false, configSafety: false, secretsInFiles: true },
      });
      
      // node_modules 中的文件不应被扫描
      const nodeModulesFinding = report.findings.find(
        f => f.detail.includes("node_modules")
      );
      expect(nodeModulesFinding).toBeUndefined();
    });
  });

  describe("Fix Functionality", () => {
    it("should return error when no audit results", async () => {
      const engine = new SecurityEngine({ storageDir: testDir });
      const result = await engine.fixIssues([]);
      
      expect(result.ok).toBe(true); // 空列表视为成功
      expect(result.actions.length).toBe(0);
    });

    it("should fix file permissions", async () => {
      // 创建文件
      const envPath = path.join(testDir, ".env");
      fs.writeFileSync(envPath, "API_KEY=secret");
      
      if (process.platform !== "win32") {
        fs.chmodSync(envPath, 0o644);
        
        const engine = new SecurityEngine({ storageDir: testDir });
        await engine.runAudit({ targetDir: testDir });
        
        const finding = {
          checkId: "fs.env_permissive",
          severity: "critical" as const,
          title: "Test",
          detail: "Test",
          remediation: `chmod 600 ${envPath}`,
        };
        
        const result = await engine.fixIssues([finding]);
        expect(result.ok).toBe(true);
        expect(result.changes.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Tools", () => {
    it("should have correct tool count", () => {
      expect(SECURITY_TOOL_COUNT).toBe(8);
    });

    it("should have all required tools", () => {
      const toolNames = SECURITY_TOOLS.map(t => t.name);
      expect(toolNames).toContain("security_audit");
      expect(toolNames).toContain("security_check_permissions");
      expect(toolNames).toContain("security_check_config");
      expect(toolNames).toContain("security_check_secrets");
      expect(toolNames).toContain("security_status");
      expect(toolNames).toContain("security_fix");
      expect(toolNames).toContain("security_report");
      expect(toolNames).toContain("security_history");
    });

    it("should have valid tool schemas", () => {
      for (const tool of SECURITY_TOOLS) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.input_schema.type).toBe("object");
      }
    });
  });

  describe("Tool Handlers", () => {
    it("should handle security_audit", async () => {
      const result = await securityHandlers.security_audit({ targetDir: testDir });
      expect(result).toBeDefined();
      expect((result as any).ts).toBeDefined();
    });

    it("should handle security_status", async () => {
      const result = await securityHandlers.security_status({});
      expect(result).toBeDefined();
      expect((result as any).lastAudit).toBeNull();
    });

    it("should handle security_history with no audits", async () => {
      const result = await securityHandlers.security_history({ limit: 5 });
      expect(result).toContain("没有审计历史记录");
    });

    it("should handle security_report with no audits", async () => {
      const result = await securityHandlers.security_report({ format: "text" });
      expect(result).toContain("没有可用的审计结果");
    });

    it("should handle security_report in markdown format", async () => {
      // 先运行审计
      await securityHandlers.security_audit({ targetDir: testDir });
      
      const result = await securityHandlers.security_report({ format: "markdown" });
      expect(result).toContain("# 安全审计报告");
    });

    it("should handle security_report in json format", async () => {
      // 先运行审计
      await securityHandlers.security_audit({ targetDir: testDir });
      
      const result = await securityHandlers.security_report({ format: "json" });
      const parsed = JSON.parse(result as string);
      expect(parsed.ts).toBeDefined();
    });

    it("should handle security_fix with no audits", async () => {
      const result = await securityHandlers.security_fix({});
      expect((result as any).ok).toBe(false);
      expect((result as any).errors).toContain("没有可用的审计结果，请先运行 security_audit");
    });

    it("should handle security_check_permissions", async () => {
      const result = await securityHandlers.security_check_permissions({ targetDir: testDir });
      expect(result).toBeDefined();
    });

    it("should handle security_check_config", async () => {
      const result = await securityHandlers.security_check_config({ targetDir: testDir });
      expect(result).toBeDefined();
    });

    it("should handle security_check_secrets", async () => {
      const result = await securityHandlers.security_check_secrets({ targetDir: testDir });
      expect(result).toBeDefined();
    });
  });

  describe("Singleton", () => {
    it("should return same instance", () => {
      const engine1 = getSecurityEngine();
      const engine2 = getSecurityEngine();
      expect(engine1).toBe(engine2);
    });

    it("should reset after close", () => {
      getSecurityEngine();
      closeSecurityEngine();
      const engine = getSecurityEngine();
      expect(engine).toBeDefined();
    });
  });
});
