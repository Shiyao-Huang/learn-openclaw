/**
 * v22-agent/sandbox/runner.ts - 代码执行运行器
 * 
 * V22: 代码执行沙箱 - 安全执行代码
 * 支持 Python, JavaScript, TypeScript, Bash
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import {
  ExecutionRequest,
  ExecutionResult,
  SupportedLanguage,
  ResourceLimits,
  SandboxConfig,
  DependencyRequest,
  DependencyResult,
  ExecutionHistory,
} from "./types.js";
import { scanCode, createDefaultConfig } from "./scanner.js";

/** 代码沙箱运行器 */
export class SandboxRunner {
  private config: SandboxConfig;
  private history: ExecutionHistory[] = [];
  private runningProcesses = new Map<string, ChildProcess>();
  private historyDir: string;

  constructor(workDir: string, config?: Partial<SandboxConfig>) {
    this.config = { ...createDefaultConfig(workDir), ...config };
    this.historyDir = path.join(workDir, ".sandbox", "history");
    this.ensureDirectories();
  }

  /** 确保目录存在 */
  private async ensureDirectories() {
    await fs.mkdir(this.historyDir, { recursive: true });
    await fs.mkdir(path.join(this.config.workDir, ".sandbox", "temp"), { recursive: true });
  }

  /** 获取资源限制 */
  private getLimits(requestLimits?: Partial<ResourceLimits>): ResourceLimits {
    return { ...this.config.defaultLimits, ...requestLimits };
  }

  /** 创建临时文件 */
  private async createTempFile(code: string, language: SupportedLanguage): Promise<string> {
    const tempDir = path.join(this.config.workDir, ".sandbox", "temp");
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    
    const extensions: Record<SupportedLanguage, string> = {
      python: ".py",
      javascript: ".js",
      typescript: ".ts",
      bash: ".sh",
    };
    
    const filename = `sandbox_${timestamp}_${randomId}${extensions[language]}`;
    const filepath = path.join(tempDir, filename);
    
    await fs.writeFile(filepath, code, "utf-8");
    
    // Bash 脚本需要可执行权限
    if (language === "bash") {
      await fs.chmod(filepath, 0o755);
    }
    
    return filepath;
  }

  /** 清理临时文件 */
  private async cleanupTempFile(filepath: string) {
    try {
      await fs.unlink(filepath);
    } catch {
      // 忽略清理错误
    }
  }

  /** 执行 Python 代码 */
  private async runPython(
    filepath: string,
    limits: ResourceLimits,
    inputs?: Record<string, string>
  ): Promise<ExecutionResult> {
    const env = { ...process.env };
    if (inputs) {
      for (const [key, value] of Object.entries(inputs)) {
        env[`INPUT_${key.toUpperCase()}`] = value;
      }
    }

    return this.runProcess(
      this.config.pythonPath,
      ["-u", filepath],  // -u 表示无缓冲输出
      env,
      limits
    );
  }

  /** 执行 JavaScript/TypeScript 代码 */
  private async runJavaScript(
    filepath: string,
    limits: ResourceLimits,
    isTypeScript: boolean,
    inputs?: Record<string, string>
  ): Promise<ExecutionResult> {
    const env = { ...process.env };
    if (inputs) {
      for (const [key, value] of Object.entries(inputs)) {
        env[`INPUT_${key.toUpperCase()}`] = value;
      }
    }

    const args: string[] = [];
    if (isTypeScript) {
      // 使用 tsx 运行 TypeScript
      args.push("--loader", "tsx", "--no-warnings");
    }
    args.push(filepath);

    return this.runProcess(
      this.config.nodePath,
      args,
      env,
      limits
    );
  }

  /** 执行 Bash 脚本 */
  private async runBash(
    filepath: string,
    limits: ResourceLimits,
    inputs?: Record<string, string>
  ): Promise<ExecutionResult> {
    const env = { ...process.env };
    if (inputs) {
      for (const [key, value] of Object.entries(inputs)) {
        env[key.toUpperCase()] = value;
      }
    }

    // 使用 bash 执行脚本
    return this.runProcess("bash", [filepath], env, limits);
  }

  /** 运行进程 */
  private runProcess(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    limits: ResourceLimits
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      let stdout = "";
      let stderr = "";
      let killed = false;

      const child = spawn(command, args, {
        env,
        cwd: this.config.workDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.runningProcesses.set(executionId, child);

      // 设置超时
      const timeout = setTimeout(() => {
        killed = true;
        child.kill("SIGTERM");
        // 5秒后强制终止
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        }, 5000);
      }, limits.maxExecutionTimeMs);

      // 收集输出
      child.stdout?.on("data", (data) => {
        stdout += data.toString();
        // 检查输出大小限制
        if (stdout.length + stderr.length > limits.maxOutputSize) {
          killed = true;
          child.kill("SIGTERM");
          stdout += "\n[输出截断: 超出最大限制]";
        }
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
        // 检查输出大小限制
        if (stdout.length + stderr.length > limits.maxOutputSize) {
          killed = true;
          child.kill("SIGTERM");
          stderr += "\n[输出截断: 超出最大限制]";
        }
      });

      // 处理进程结束
      child.on("close", (exitCode, signal) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(executionId);
        
        const executionTime = Date.now() - startTime;
        
        // 估算内存使用 (简化版)
        const memoryUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        if (killed && signal === "SIGTERM") {
          resolve({
            success: false,
            stdout,
            stderr: stderr + "\n[执行超时或被终止]",
            exitCode: -1,
            executionTime,
            memoryUsed,
          });
        } else {
          resolve({
            success: exitCode === 0,
            stdout,
            stderr,
            exitCode: exitCode ?? -1,
            executionTime,
            memoryUsed,
          });
        }
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(executionId);
        
        resolve({
          success: false,
          stdout,
          stderr: stderr + `\n[进程错误: ${error.message}]`,
          exitCode: -1,
          executionTime: Date.now() - startTime,
          memoryUsed: 0,
        });
      });
    });
  }

  /** 执行代码 */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const { code, language, inputs, limits: requestLimits } = request;
    
    // 1. 安全扫描
    const scanResult = scanCode(code, language, this.config);
    if (!scanResult.passed) {
      const criticalIssues = scanResult.issues.filter(i => i.severity === "critical");
      return {
        success: false,
        stdout: "",
        stderr: `安全扫描未通过:\n${criticalIssues.map(i => `[${i.severity}] ${i.message} (第${i.line}行)`).join("\n")}`,
        exitCode: -1,
        executionTime: 0,
        memoryUsed: 0,
      };
    }

    // 2. 创建临时文件
    const filepath = await this.createTempFile(code, language);
    
    // 3. 获取资源限制
    const limits = this.getLimits(requestLimits);

    try {
      // 4. 执行代码
      let result: ExecutionResult;
      
      switch (language) {
        case "python":
          result = await this.runPython(filepath, limits, inputs);
          break;
        case "javascript":
          result = await this.runJavaScript(filepath, limits, false, inputs);
          break;
        case "typescript":
          result = await this.runJavaScript(filepath, limits, true, inputs);
          break;
        case "bash":
          result = await this.runBash(filepath, limits, inputs);
          break;
        default:
          result = {
            success: false,
            stdout: "",
            stderr: `不支持的语言: ${language}`,
            exitCode: -1,
            executionTime: 0,
            memoryUsed: 0,
          };
      }

      // 5. 记录历史
      const history: ExecutionHistory = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        request,
        result,
        scanResult,
        timestamp: Date.now(),
      };
      this.history.push(history);
      await this.saveHistory(history);

      return result;
    } finally {
      // 6. 清理临时文件
      await this.cleanupTempFile(filepath);
    }
  }

  /** 保存执行历史 */
  private async saveHistory(history: ExecutionHistory) {
    try {
      const filepath = path.join(this.historyDir, `${history.id}.json`);
      await fs.writeFile(filepath, JSON.stringify(history, null, 2), "utf-8");
    } catch {
      // 忽略保存错误
    }
  }

  /** 安装依赖 */
  async installDependencies(request: DependencyRequest): Promise<DependencyResult> {
    const { language, packages, dev = false } = request;
    
    const installed: string[] = [];
    const failed: string[] = [];
    let output = "";

    if (language === "python") {
      for (const pkg of packages) {
        try {
          const result = await this.runProcess(
            this.config.pythonPath,
            ["-m", "pip", "install", "--user", pkg],
            process.env,
            this.config.defaultLimits
          );
          output += result.stdout + "\n" + result.stderr + "\n";
          
          if (result.success) {
            installed.push(pkg);
          } else {
            failed.push(pkg);
          }
        } catch (error: any) {
          failed.push(pkg);
          output += `安装 ${pkg} 失败: ${error.message}\n`;
        }
      }
    } else if (language === "javascript" || language === "typescript") {
      for (const pkg of packages) {
        try {
          const args = ["install"];
          if (dev) args.push("--save-dev");
          args.push(pkg);
          
          const result = await this.runProcess(
            "npm",
            args,
            process.env,
            this.config.defaultLimits
          );
          output += result.stdout + "\n" + result.stderr + "\n";
          
          if (result.success) {
            installed.push(pkg);
          } else {
            failed.push(pkg);
          }
        } catch (error: any) {
          failed.push(pkg);
          output += `安装 ${pkg} 失败: ${error.message}\n`;
        }
      }
    }

    return {
      success: failed.length === 0,
      installed,
      failed,
      output,
    };
  }

  /** 获取执行历史 */
  getHistory(limit = 100): ExecutionHistory[] {
    return this.history.slice(-limit);
  }

  /** 清空历史 */
  clearHistory() {
    this.history = [];
  }

  /** 终止所有运行中的进程 */
  async terminateAll(): Promise<void> {
    for (const [id, process] of this.runningProcesses) {
      process.kill("SIGTERM");
      this.runningProcesses.delete(id);
    }
  }

  /** 获取状态 */
  getStatus() {
    return {
      runningProcesses: this.runningProcesses.size,
      historyCount: this.history.length,
      config: {
        workDir: this.config.workDir,
        pythonPath: this.config.pythonPath,
        nodePath: this.config.nodePath,
        defaultLimits: this.config.defaultLimits,
      },
    };
  }
}
