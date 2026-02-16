/**
 * v33-agent.ts - OpenClaw V33: Skill 安全扫描系统
 *
 * V33 新增功能:
 * - scanner_scan_dir: 扫描目录中的代码安全问题
 * - scanner_scan_file: 扫描单个文件的安全问题
 * - scanner_scan_source: 扫描源码字符串的安全问题
 * - scanner_rules: 获取扫描规则列表
 * - scanner_config: 获取扫描器配置
 * - scanner_report: 生成安全扫描报告
 *
 * 完整实现见 v33-agent/scanner/ 目录
 */

export {
  SkillScanner,
  getSkillScanner,
  closeSkillScanner,
  SCANNER_TOOLS,
  SCANNER_TOOL_COUNT,
  createScannerHandlers,
  LINE_RULES,
  SOURCE_RULES,
  getAllRuleIds,
  getRuleStats,
  type ScanSeverity,
  type ScanRuleId,
  type ScanFinding,
  type ScanSummary,
  type ScanOptions,
  type ScanResult,
  type ScannerConfig,
  type LineRule,
  type SourceRule,
} from "./v33-agent/scanner/index.js";

// 继承 V32 速率限制系统
export {
  RateLimitEngine,
  getRateLimitEngine,
  closeRateLimitEngine,
  ratelimitHandlers,
  closeRatelimitHandlers,
  RATELIMIT_TOOLS,
  RATELIMIT_TOOL_COUNT,
  RATE_LIMIT_PRESETS,
  RETRY_PRESETS,
  type RateLimitStrategy,
  type RateLimitConfig,
  type RateLimitState,
  type RateLimitResult,
  type RetryStrategy,
  type RetryConfig,
  type RetryState,
  type RetryResult,
  type RetryHistoryEntry,
  type LimiterDefinition,
  type LimiterStats,
  type RateLimitEngineConfig,
  type EngineStatus,
} from "./v32-agent/ratelimit/index.js";

// 版本信息
export const VERSION = "v33";
export const VERSION_NAME = "Skill 安全扫描系统";
export const TOOL_COUNT = 208; // V32 的 202 + V33 的 6

console.log(`
╔═══════════════════════════════════════════════════════════╗
║            OpenClaw V33 - Skill 安全扫描系统              ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (Scanner):                                      ║
║    - scanner_scan_dir:        扫描目录                   ║
║    - scanner_scan_file:       扫描文件                   ║
║    - scanner_scan_source:     扫描源码                   ║
║    - scanner_rules:           获取规则                   ║
║    - scanner_config:          获取配置                   ║
║    - scanner_report:          生成报告                   ║
║                                                           ║
║  安全检测规则:                                            ║
║    ✅ 危险命令执行 (exec/spawn)                        ║
║    ✅ 动态代码执行 (eval/Function)                    ║
║    ✅ 加密挖矿检测                                    ║
║    ✅ 可疑网络连接                                    ║
║    ✅ 数据泄露风险                                    ║
║    ✅ 代码混淆检测                                    ║
║    ✅ 凭证窃取风险                                    ║
║    ✅ 危险模块导入                                    ║
║                                                           ║
║  严重级别:                                                ║
║    🔴 Critical - 严重安全问题                          ║
║    🟡 Warn     - 潜在风险                              ║
║    🔵 Info     - 信息提示                              ║
║                                                           ║
║  报告格式:                                                ║
║    ✅ text      - 文本格式                             ║
║    ✅ json      - JSON 格式                            ║
║    ✅ markdown  - Markdown 格式                        ║
║                                                           ║
║  继承 V32 能力 (Rate Limit):                              ║
║    ✅ 多种限流策略 (Token Bucket/Sliding/Fixed)       ║
║    ✅ 多种重试策略 (Fixed/Exponential/Linear/Jitter)  ║
║                                                           ║
║  工具总数: 208 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v33-agent/index.ts 启动完整系统");
  process.exit(0);
}
