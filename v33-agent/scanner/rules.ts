/**
 * V33: Skill 安全扫描系统 - 扫描规则
 * 
 * 定义各种安全检测规则
 */

import type { LineRule, SourceRule } from "./types.js";

// 标准端口（不会触发警告）
const STANDARD_PORTS = new Set([80, 443, 8080, 8443, 3000, 3001, 5000, 8000, 9000]);

/**
 * 行规则 - 逐行检测
 */
export const LINE_RULES: LineRule[] = [
  // --- 危险命令执行 ---
  {
    ruleId: "dangerous-exec",
    severity: "critical",
    message: "检测到 Shell 命令执行 (child_process)",
    pattern: /\b(exec|execSync|spawn|spawnSync|execFile|execFileSync)\s*\(/,
    requiresContext: /child_process|require\s*\(\s*['"]child_process['"]\s*\)/,
    suggestion: "考虑使用更安全的 API，或确保命令参数经过严格验证",
  },

  // --- 动态代码执行 ---
  {
    ruleId: "dynamic-code-execution",
    severity: "critical",
    message: "检测到动态代码执行 (eval/Function)",
    pattern: /\beval\s*\(|new\s+Function\s*\(/,
    suggestion: "避免使用 eval 和 new Function，它们可能导致代码注入",
  },

  // --- 加密挖矿 ---
  {
    ruleId: "crypto-mining",
    severity: "critical",
    message: "检测到可能的加密货币挖矿引用",
    pattern: /stratum\+tcp|stratum\+ssl|coinhive|cryptonight|xmrig|minerd/i,
    suggestion: "确认此代码不是恶意挖矿脚本",
  },

  // --- 可疑网络连接 ---
  {
    ruleId: "suspicious-network",
    severity: "warn",
    message: "WebSocket 连接到非标准端口",
    pattern: /new\s+WebSocket\s*\(\s*["']wss?:\/\/[^"']*:(\d+)/,
    suggestion: "检查此 WebSocket 连接是否安全",
  },

  // --- 危险导入 ---
  {
    ruleId: "dangerous-import",
    severity: "warn",
    message: "导入潜在危险的模块",
    pattern: /require\s*\(\s*['"](?:child_process|fs|net|http|https|dgram)['"]\s*\)|import.*from\s*['"](?:child_process|fs|net|http|https|dgram)['"]/,
    suggestion: "确认这些模块的使用是必要的且经过安全审查",
  },

  // --- 文件系统访问 ---
  {
    ruleId: "file-system-access",
    severity: "info",
    message: "检测到文件系统访问",
    pattern: /\b(readFile|writeFile|readFileSync|writeFileSync|readdir|readdirSync|unlink|unlinkSync|rmdir|rmdirSync)\s*\(/,
    suggestion: "确保文件路径经过验证，防止路径遍历攻击",
  },

  // --- 网络访问 ---
  {
    ruleId: "network-access",
    severity: "info",
    message: "检测到网络访问",
    pattern: /\b(fetch|http\.request|https\.request|net\.connect)\s*\(/,
    suggestion: "确保网络请求的目标是受信任的",
  },
];

/**
 * 源码规则 - 全文检测
 */
export const SOURCE_RULES: SourceRule[] = [
  // --- 数据泄露 ---
  {
    ruleId: "potential-exfiltration",
    severity: "warn",
    message: "文件读取与网络发送组合 - 可能的数据泄露",
    pattern: /readFileSync|readFile|fs\.read/,
    requiresContext: /\bfetch\b|\bpost\b|http\.request|https\.request|WebSocket/i,
    suggestion: "检查文件读取后是否会通过网络发送到不受信任的目标",
  },

  // --- 代码混淆 ---
  {
    ruleId: "obfuscated-code",
    severity: "warn",
    message: "检测到十六进制编码字符串序列 - 可能的代码混淆",
    pattern: /(\\x[0-9a-fA-F]{2}){6,}/,
    suggestion: "代码混淆可能隐藏恶意行为，建议人工审查",
  },
  {
    ruleId: "obfuscated-code",
    severity: "warn",
    message: "检测到大型 Base64 载荷和解码调用 - 可能的代码混淆",
    pattern: /(?:atob|Buffer\.from)\s*\(\s*["'][A-Za-z0-9+/=]{200,}["']/,
    suggestion: "Base64 编码可能隐藏恶意载荷，建议人工审查",
  },

  // --- 环境变量窃取 ---
  {
    ruleId: "env-harvesting",
    severity: "critical",
    message: "环境变量访问与网络发送组合 - 可能的凭证窃取",
    pattern: /process\.env/,
    requiresContext: /\bfetch\b|\bpost\b|http\.request|https\.request|WebSocket/i,
    suggestion: "环境变量不应该被发送到外部服务器",
  },
];

/**
 * 检查端口是否为标准端口
 */
export function isStandardPort(port: number): boolean {
  return STANDARD_PORTS.has(port);
}

/**
 * 获取所有规则 ID
 */
export function getAllRuleIds(): string[] {
  const ids = new Set<string>();
  for (const rule of LINE_RULES) {
    ids.add(rule.ruleId);
  }
  for (const rule of SOURCE_RULES) {
    ids.add(rule.ruleId);
  }
  return Array.from(ids);
}

/**
 * 获取规则统计
 */
export function getRuleStats(): { total: number; critical: number; warn: number; info: number } {
  const allRules = [...LINE_RULES, ...SOURCE_RULES];
  return {
    total: allRules.length,
    critical: allRules.filter((r) => r.severity === "critical").length,
    warn: allRules.filter((r) => r.severity === "warn").length,
    info: allRules.filter((r) => r.severity === "info").length,
  };
}
