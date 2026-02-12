/**
 * v22-agent/sandbox/scanner.ts - 代码安全扫描器
 * 
 * V22: 代码执行沙箱 - 安全扫描
 * 扫描代码中的危险操作和潜在安全风险
 */

import {
  SecurityScanResult,
  SecurityIssue,
  SupportedLanguage,
  SandboxConfig,
} from "./types.js";

/** 默认危险模式 */
const DEFAULT_BLOCKED_PATTERNS = [
  // 系统命令执行
  /\bos\.system\s*\(/i,
  /\bsubprocess\.(call|run|Popen)\s*\(/i,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /\bFunction\s*\(/i,
  /\bchild_process\b/i,
  
  // 文件系统危险操作
  /\bos\.remove\s*\(/i,
  /\bos\.rmdir\s*\(/i,
  /\bunlink\s*\(/i,
  /\brm\s+-rf/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  
  // 网络操作 (可选)
  /\bsocket\b/i,
  /\burllib\.(request|urlopen)/i,
  /\brequests\.(get|post|put|delete)\s*\(/i,
  /\bfetch\s*\(/i,
  
  // 代码注入
  /\b__import__\s*\(/i,
  /\bimportlib\b/i,
  /\bcompile\s*\(/i,
  
  // 敏感信息
  /\bpassword\s*=/i,
  /\bapi_key\s*=/i,
  /\bsecret\s*=/i,
  /\btoken\s*=/i,
  
  // 资源耗尽
  /\bwhile\s*\(\s*true\s*\)/i,
  /\bwhile\s+True\s*:/i,
  /\bfor\s+\w+\s+in\s+range\s*\(\s*9999999/i,
];

/** Python 允许的标准库 */
const DEFAULT_ALLOWED_PYTHON_IMPORTS = [
  "math", "random", "datetime", "json", "re", "string", "collections",
  "itertools", "functools", "decimal", "fractions", "statistics", "typing",
  "hashlib", "base64", "uuid", "time", "calendar", "inspect", "copy",
  "dataclasses", "enum", "pathlib", "abc", "numbers", "textwrap",
  "csv", "io", " pprint",
];

/** JavaScript/TypeScript 允许的内置模块 */
const DEFAULT_ALLOWED_JS_IMPORTS = [
  "fs", "path", "os", "crypto", "util", "stream", "buffer", "url",
  "querystring", "string_decoder", "punycode", "dgram", "dns", "net",
];

/** TypeScript 额外允许的模块 */
const DEFAULT_ALLOWED_TS_IMPORTS = [
  ...DEFAULT_ALLOWED_JS_IMPORTS,
];

/** 创建默认配置 */
export function createDefaultConfig(workDir: string): SandboxConfig {
  return {
    workDir,
    pythonPath: "python3",
    nodePath: "node",
    defaultLimits: {
      maxExecutionTimeMs: 30000,
      maxMemoryMb: 512,
      maxOutputSize: 10 * 1024 * 1024, // 10MB
      allowNetwork: false,
      allowFileWrite: false,
      allowFileRead: true,
    },
    allowedImports: {
      python: DEFAULT_ALLOWED_PYTHON_IMPORTS,
      javascript: DEFAULT_ALLOWED_JS_IMPORTS,
      typescript: DEFAULT_ALLOWED_TS_IMPORTS,
    },
    blockedPatterns: [],
  };
}

/** 扫描 Python 代码 */
function scanPython(code: string, config: SandboxConfig): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  const lines = code.split("\n");
  
  // 检查导入语句
  const importRegex = /^(?:from\s+(\S+)\s+import|import\s+(\S+))/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = importRegex.exec(line);
    
    if (match) {
      const moduleName = match[1] || match[2];
      const baseModule = moduleName.split(".")[0];
      
      if (!config.allowedImports.python.includes(baseModule)) {
        // 检查是否是绝对禁止的模块
        const dangerousModules = ["os", "sys", "subprocess", "shutil", "ctypes", "socket", "urllib"];
        const severity = dangerousModules.includes(baseModule) ? "critical" : "warning";
        
        issues.push({
          type: "dangerous_import",
          severity,
          message: `检测到未授权的模块导入: ${baseModule}`,
          line: i + 1,
          code: line.trim(),
        });
      }
    }
    
    // 检查危险函数调用
    if (/\beval\s*\(/i.test(line) || /\bexec\s*\(/i.test(line)) {
      issues.push({
        type: "eval",
        severity: "critical",
        message: "检测到 eval/exec 调用，存在代码注入风险",
        line: i + 1,
        code: line.trim(),
      });
    }
    
    // 检查文件操作
    if (/\bopen\s*\(\s*['"]\/etc\/|['"]\/var\/|['"]\/sys\/|['"]\/proc\//.test(line)) {
      issues.push({
        type: "file_access",
        severity: "error",
        message: "检测到对系统敏感目录的访问",
        line: i + 1,
        code: line.trim(),
      });
    }
    
    // 检查无限循环
    if (/^\s*while\s+True\s*:/i.test(line) || /^\s*while\s+1\s*:/i.test(line)) {
      // 检查是否有 break
      let hasBreak = false;
      for (let j = i + 1; j < lines.length && j < i + 20; j++) {
        if (/^\s*break\s*$/i.test(lines[j])) {
          hasBreak = true;
          break;
        }
        if (/^\S/.test(lines[j]) && !lines[j].startsWith("#")) {
          break;
        }
      }
      if (!hasBreak) {
        issues.push({
          type: "resource",
          severity: "warning",
          message: "检测到可能的无条件无限循环",
          line: i + 1,
          code: line.trim(),
        });
      }
    }
  }
  
  return issues;
}

/** 扫描 JavaScript/TypeScript 代码 */
function scanJavaScript(code: string, config: SandboxConfig, isTypeScript = false): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  const lines = code.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检查 require 导入
    const requireMatch = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/.exec(line);
    if (requireMatch) {
      const moduleName = requireMatch[1];
      const allowed = isTypeScript 
        ? config.allowedImports.typescript 
        : config.allowedImports.javascript;
      
      if (!allowed.includes(moduleName) && !moduleName.startsWith(".")) {
        const dangerousModules = ["child_process", "cluster", "dgram", "net", "tls", "http", "https"];
        const severity = dangerousModules.includes(moduleName) ? "critical" : "warning";
        
        issues.push({
          type: "dangerous_import",
          severity,
          message: `检测到未授权的模块导入: ${moduleName}`,
          line: i + 1,
          code: line.trim(),
        });
      }
    }
    
    // 检查 ES6 import
    const importMatch = /\bimport\s+.*?\s+from\s+['"]([^'"]+)['"]/.exec(line);
    if (importMatch) {
      const moduleName = importMatch[1];
      const allowed = isTypeScript 
        ? config.allowedImports.typescript 
        : config.allowedImports.javascript;
      
      if (!allowed.includes(moduleName) && !moduleName.startsWith(".")) {
        issues.push({
          type: "dangerous_import",
          severity: "warning",
          message: `检测到未授权的模块导入: ${moduleName}`,
          line: i + 1,
          code: line.trim(),
        });
      }
    }
    
    // 检查危险函数
    if (/\beval\s*\(/.test(line)) {
      issues.push({
        type: "eval",
        severity: "critical",
        message: "检测到 eval 调用，存在代码注入风险",
        line: i + 1,
        code: line.trim(),
      });
    }
    
    if (/\bnew\s+Function\s*\(/.test(line)) {
      issues.push({
        type: "eval",
        severity: "critical",
        message: "检测到 Function 构造函数调用，存在代码注入风险",
        line: i + 1,
        code: line.trim(),
      });
    }
    
    // 检查 child_process
    if (/\bchild_process\b/.test(line)) {
      issues.push({
        type: "system_call",
        severity: "critical",
        message: "检测到 child_process 使用，存在命令执行风险",
        line: i + 1,
        code: line.trim(),
      });
    }
    
    // 检查 while(true) 无限循环
    if (/\bwhile\s*\(\s*true\s*\)/i.test(line) || /\bwhile\s*\(\s*1\s*\)/i.test(line)) {
      issues.push({
        type: "resource",
        severity: "warning",
        message: "检测到可能的无条件无限循环",
        line: i + 1,
        code: line.trim(),
      });
    }
  }
  
  return issues;
}

/** 扫描 Bash 脚本 */
function scanBash(code: string, _config: SandboxConfig): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  const lines = code.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检查危险命令
    const dangerousCommands = [
      { pattern: /\brm\s+-rf\s+\//, message: "检测到危险的根目录删除命令" },
      { pattern: /\bmkfs\b/, message: "检测到文件系统格式化命令" },
      { pattern: /\bdd\s+if=/, message: "检测到磁盘操作命令" },
      { pattern: /\b:\(\)\s*\{\s*:\s*\|\s*:\s*\&\s*\}/, message: "检测到 Fork Bomb" },
      { pattern: /\bwget\s+.*\s*\|\s*sh/i, message: "检测到管道到 shell 的危险操作" },
      { pattern: /\bcurl\s+.*\s*\|\s*sh/i, message: "检测到管道到 shell 的危险操作" },
      { pattern: /\beval\s+/, message: "检测到 eval 命令" },
      { pattern: /\bsudo\b/, message: "检测到 sudo 使用" },
    ];
    
    for (const { pattern, message } of dangerousCommands) {
      if (pattern.test(line)) {
        issues.push({
          type: "system_call",
          severity: "critical",
          message,
          line: i + 1,
          code: line.trim(),
        });
      }
    }
  }
  
  return issues;
}

/** 执行安全扫描 */
export function scanCode(
  code: string,
  language: SupportedLanguage,
  config: SandboxConfig
): SecurityScanResult {
  let issues: SecurityIssue[] = [];
  
  switch (language) {
    case "python":
      issues = scanPython(code, config);
      break;
    case "javascript":
      issues = scanJavaScript(code, config, false);
      break;
    case "typescript":
      issues = scanJavaScript(code, config, true);
      break;
    case "bash":
      issues = scanBash(code, config);
      break;
  }
  
  // 检查自定义阻止模式
  for (const pattern of config.blockedPatterns) {
    const regex = new RegExp(pattern, "gi");
    const matches = code.matchAll(regex);
    for (const match of matches) {
      const line = code.substring(0, match.index).split("\n").length;
      issues.push({
        type: "dangerous_import",
        severity: "error",
        message: `匹配到阻止模式: ${pattern}`,
        line,
        code: match[0].substring(0, 50),
      });
    }
  }
  
  // 计算风险等级
  const criticalCount = issues.filter(i => i.severity === "critical").length;
  const errorCount = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  
  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  if (criticalCount > 0) {
    riskLevel = "critical";
  } else if (errorCount > 0) {
    riskLevel = "high";
  } else if (warningCount > 0) {
    riskLevel = "medium";
  }
  
  return {
    passed: criticalCount === 0 && errorCount === 0,
    issues,
    riskLevel,
  };
}

/** 检查代码是否通过安全扫描 */
export function isCodeSafe(
  code: string,
  language: SupportedLanguage,
  config: SandboxConfig
): boolean {
  const result = scanCode(code, language, config);
  return result.passed;
}
