/**
 * v22-agent/sandbox/handlers.ts - 代码执行沙箱处理器
 * 
 * V22: 代码执行沙箱 - 工具处理器
 */

import { SandboxRunner } from "./runner.js";
import {
  ExecutionRequest,
  SupportedLanguage,
  ResourceLimits,
  DependencyRequest,
} from "./types.js";

/** 创建沙箱处理器 */
export function createSandboxHandlers(runner: SandboxRunner) {
  return {
    /** 执行代码 */
    async sandbox_execute(args: {
      language: string;
      code: string;
      inputs?: Record<string, string>;
      workingDir?: string;
      limits?: Partial<ResourceLimits>;
    }): Promise<string> {
      const request: ExecutionRequest = {
        language: args.language as SupportedLanguage,
        code: args.code,
        inputs: args.inputs,
        workingDir: args.workingDir,
        limits: args.limits,
      };

      const result = await runner.execute(request);

      const lines = [
        `执行结果: ${result.success ? "✅ 成功" : "❌ 失败"}`,
        `退出码: ${result.exitCode}`,
        `执行时间: ${result.executionTime}ms`,
        `内存使用: ${result.memoryUsed}MB`,
        "",
        "=== STDOUT ===",
        result.stdout || "(无输出)",
      ];

      if (result.stderr) {
        lines.push("", "=== STDERR ===", result.stderr);
      }

      return lines.join("\n");
    },

    /** 扫描代码 */
    async sandbox_scan(args: {
      language: string;
      code: string;
    }): Promise<string> {
      const { scanCode, createDefaultConfig } = await import("./scanner.js");
      
      const config = createDefaultConfig(process.cwd());
      const result = scanCode(args.code, args.language as SupportedLanguage, config);

      const lines = [
        `扫描结果: ${result.passed ? "✅ 通过" : "❌ 未通过"}`,
        `风险等级: ${result.riskLevel.toUpperCase()}`,
        `发现问题: ${result.issues.length} 个`,
        "",
      ];

      if (result.issues.length > 0) {
        lines.push("=== 问题详情 ===");
        for (const issue of result.issues) {
          const icon = issue.severity === "critical" ? "🔴" : issue.severity === "error" ? "🟠" : "🟡";
          lines.push(`${icon} [${issue.severity.toUpperCase()}] ${issue.type}`);
          lines.push(`   ${issue.message}`);
          if (issue.line) {
            lines.push(`   行 ${issue.line}: ${issue.code?.substring(0, 60)}`);
          }
          lines.push("");
        }
      } else {
        lines.push("✅ 未发现安全问题");
      }

      return lines.join("\n");
    },

    /** 安装依赖 */
    async sandbox_install(args: {
      language: string;
      packages: string[];
      dev?: boolean;
    }): Promise<string> {
      const request: DependencyRequest = {
        language: args.language as SupportedLanguage,
        packages: args.packages,
        dev: args.dev,
      };

      const result = await runner.installDependencies(request);

      const lines = [
        `安装结果: ${result.success ? "✅ 成功" : "❌ 部分失败"}`,
        `成功: ${result.installed.length} 个`,
        `失败: ${result.failed.length} 个`,
        "",
      ];

      if (result.installed.length > 0) {
        lines.push(`✅ 已安装: ${result.installed.join(", ")}`);
      }
      
      if (result.failed.length > 0) {
        lines.push(`❌ 失败: ${result.failed.join(", ")}`);
      }

      if (result.output) {
        lines.push("", "=== 输出 ===", result.output.substring(0, 2000));
      }

      if (result.error) {
        lines.push("", `错误: ${result.error}`);
      }

      return lines.join("\n");
    },

    /** 获取执行历史 */
    async sandbox_history(args: {
      limit?: number;
    }): Promise<string> {
      const history = runner.getHistory(args.limit ?? 50);

      if (history.length === 0) {
        return "暂无执行历史";
      }

      const lines = [
        `执行历史 (最近 ${history.length} 条)`,
        "",
      ];

      for (const item of history.slice().reverse()) {
        const date = new Date(item.timestamp).toLocaleString("zh-CN");
        lines.push(`[${date}] ${item.request.language}`);
        lines.push(`  状态: ${item.result.success ? "✅" : "❌"}`);
        lines.push(`  风险: ${item.scanResult.riskLevel}`);
        lines.push(`  耗时: ${item.result.executionTime}ms`);
        lines.push("");
      }

      return lines.join("\n");
    },

    /** 获取沙箱状态 */
    async sandbox_status(): Promise<string> {
      const status = runner.getStatus();

      return [
        "=== 沙箱状态 ===",
        `运行中进程: ${status.runningProcesses}`,
        `历史记录: ${status.historyCount} 条`,
        "",
        "=== 配置 ===",
        `Python: ${status.config.pythonPath}`,
        `Node: ${status.config.nodePath}`,
        `工作目录: ${status.config.workDir}`,
        "",
        "=== 默认资源限制 ===",
        `最大执行时间: ${status.config.defaultLimits.maxExecutionTimeMs}ms`,
        `最大内存: ${status.config.defaultLimits.maxMemoryMb}MB`,
        `最大输出: ${(status.config.defaultLimits.maxOutputSize / 1024 / 1024).toFixed(1)}MB`,
        `允许网络: ${status.config.defaultLimits.allowNetwork ? "是" : "否"}`,
        `允许写文件: ${status.config.defaultLimits.allowFileWrite ? "是" : "否"}`,
      ].join("\n");
    },
  };
}
