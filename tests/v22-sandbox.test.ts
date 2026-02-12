/**
 * v22-sandbox.test.ts - V22 代码执行沙箱测试
 * 
 * 测试内容:
 * - SandboxRunner 基本功能
 * - 多语言代码执行 (Python/JS/TS/Bash)
 * - 安全扫描
 * - 资源限制
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// 导入 V22 模块
import {
  SandboxRunner,
  scanCode,
  createDefaultConfig,
  isCodeSafe,
  type SupportedLanguage,
  type ExecutionRequest,
} from "../v22-agent/sandbox/index.js";

describe("V22 Code Sandbox", () => {
  let tempDir: string;
  let runner: SandboxRunner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "v22-sandbox-test-"));
    runner = new SandboxRunner(tempDir);
  });

  afterEach(async () => {
    await runner.terminateAll();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("SandboxRunner.execute", () => {
    it("应该能执行 Python 代码", async () => {
      const result = await runner.execute({
        language: "python",
        code: "print('Hello from Python')\nprint(2 + 2)",
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Hello from Python");
      expect(result.stdout).toContain("4");
      expect(result.exitCode).toBe(0);
    });

    it("应该能执行 JavaScript 代码", async () => {
      const result = await runner.execute({
        language: "javascript",
        code: "console.log('Hello from JS');\nconsole.log(2 + 2);",
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Hello from JS");
      expect(result.stdout).toContain("4");
    });

    it("应该能执行 Bash 脚本", async () => {
      const result = await runner.execute({
        language: "bash",
        code: "echo 'Hello from Bash'\necho $((2 + 2))",
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Hello from Bash");
      expect(result.stdout).toContain("4");
    });

    it("应该支持输入变量", async () => {
      const result = await runner.execute({
        language: "python",
        code: "import os\nprint(os.environ.get('INPUT_NAME', 'default'))",
        inputs: { name: "TestUser" },
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain("TestUser");
    });

    it("应该能处理执行错误", async () => {
      const result = await runner.execute({
        language: "python",
        code: "print(1 / 0)",
      });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain("ZeroDivisionError");
    });

    it("应该遵守执行时间限制", async () => {
      const result = await runner.execute({
        language: "python",
        code: "import time\ntime.sleep(5)\nprint('Done')",
        limits: { maxExecutionTimeMs: 1000 },
      });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain("超时");
    });
  });

  describe("Security Scanner", () => {
    it("应该检测到危险的 Python eval", () => {
      const code = "eval('__import__(\"os\").system(\"ls\")')";
      const config = createDefaultConfig(tempDir);
      const result = scanCode(code, "python", config);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe("critical");
      expect(result.issues.some(i => i.type === "eval")).toBe(true);
    });

    it("应该检测到危险的 JS eval", () => {
      const code = "eval('process.exit(1)')";
      const config = createDefaultConfig(tempDir);
      const result = scanCode(code, "javascript", config);

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe("critical");
    });

    it("应该检测到未授权的 Python 导入", () => {
      const code = "import os\nos.system('rm -rf /')";
      const config = createDefaultConfig(tempDir);
      const result = scanCode(code, "python", config);

      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.type === "dangerous_import" && i.message.includes("os"))).toBe(true);
    });

    it("应该允许安全的 Python 代码", () => {
      const code = "import math\nprint(math.sqrt(16))";
      const config = createDefaultConfig(tempDir);
      const result = scanCode(code, "python", config);

      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe("low");
    });

    it("应该检测到 Bash 危险命令", () => {
      const code = "rm -rf /";
      const config = createDefaultConfig(tempDir);
      const result = scanCode(code, "bash", config);

      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.severity === "critical")).toBe(true);
    });

    it("isCodeSafe 应该正确判断", () => {
      const safeCode = "print('Hello')";
      const unsafeCode = "eval('dangerous')";
      const config = createDefaultConfig(tempDir);

      expect(isCodeSafe(safeCode, "python", config)).toBe(true);
      expect(isCodeSafe(unsafeCode, "python", config)).toBe(false);
    });
  });

  describe("Sandbox Status & History", () => {
    it("应该能获取沙箱状态", () => {
      const status = runner.getStatus();
      
      expect(status.runningProcesses).toBe(0);
      expect(status.config.pythonPath).toBeDefined();
      expect(status.config.nodePath).toBeDefined();
    });

    it("应该记录执行历史", async () => {
      await runner.execute({
        language: "python",
        code: "print('test')",
      });

      const history = runner.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].request.language).toBe("python");
      expect(history[0].result.success).toBe(true);
    });

    it("应该能清空历史", async () => {
      await runner.execute({
        language: "python",
        code: "print('test')",
      });

      runner.clearHistory();
      const history = runner.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe("TypeScript Support", () => {
    it("应该能执行 TypeScript 代码", async () => {
      const result = await runner.execute({
        language: "typescript",
        code: `const greeting: string = "Hello from TS";\nconsole.log(greeting);\nconst sum: number = 2 + 2;\nconsole.log(sum);`,
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain("Hello from TS");
      expect(result.stdout).toContain("4");
    });
  });
});
