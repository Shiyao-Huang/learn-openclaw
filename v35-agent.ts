/**
 * v35-agent.ts - OpenClaw V35: Usage/成本追踪系统
 *
 * V35 新增功能:
 * - usage_record: 记录 API 使用
 * - usage_get_totals: 获取使用总计
 * - usage_get_summary: 获取使用摘要
 * - usage_get_daily: 获取每日统计
 * - usage_get_tools: 获取工具使用统计
 * - usage_get_models: 获取模型使用统计
 * - usage_get_session: 获取会话使用摘要
 * - usage_get_latency: 获取延迟统计
 * - usage_get_daily_latency: 获取每日延迟统计
 * - usage_report: 生成使用报告
 * - usage_status: 获取系统状态
 * - usage_config: 获取/更新配置
 * - usage_model_costs: 管理模型成本配置
 * - usage_normalize: 标准化使用数据
 * - usage_clear: 清除所有记录
 *
 * 完整实现见 v35-agent/usage/ 目录
 */

export {
  UsageEngine,
  getUsageEngine,
  closeUsageEngine,
  normalizeUsage,
  USAGE_TOOLS,
  USAGE_TOOL_COUNT,
  createUsageHandlers,
  closeUsageHandlers,
  type NormalizedUsage,
  type UsageLike,
  type CostBreakdown,
  type ModelCostConfig,
  type UsageRecord,
  type UsageTotals,
  type DailyUsage,
  type ToolUsageStats,
  type ModelUsageStats,
  type LatencyStats,
  type DailyLatency,
  type UsageSummary,
  type SessionUsageSummary,
  type UsageTrackerConfig,
  type ReportOptions,
  type ReportFormat,
  DEFAULT_USAGE_CONFIG,
  DEFAULT_MODEL_COSTS,
} from "./v35-agent/usage/index.js";

// 继承 V34 去重缓存系统
export {
  DedupeCache,
  DedupeCacheManager,
  getDedupeManager,
  closeDedupeManager,
  DEDUPE_TOOLS,
  DEDUPE_TOOL_COUNT,
  createDedupeHandlers,
  closeDedupeHandlers,
  DEDUPE_PRESETS,
  type DedupeCacheConfig,
  type DedupeCacheStats,
  type CacheEntry,
  type DedupeResult,
  type BatchDedupeResult,
} from "./v34-agent/dedupe/index.js";

// 版本信息
export const VERSION = "v35";
export const VERSION_NAME = "Usage/成本追踪系统";
export const TOOL_COUNT = 235; // V34 的 219 + V35 的 16

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║            OpenClaw V35 - Usage/成本追踪系统                  ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  新增工具 (Usage):                                            ║
║    - usage_record:          记录 API 使用                   ║
║    - usage_get_totals:      获取使用总计                   ║
║    - usage_get_summary:     获取使用摘要                   ║
║    - usage_get_daily:       获取每日统计                   ║
║    - usage_get_tools:       工具使用统计                   ║
║    - usage_get_models:      模型使用统计                   ║
║    - usage_get_session:     会话使用摘要                   ║
║    - usage_get_latency:     延迟统计                       ║
║    - usage_get_daily_latency: 每日延迟统计                ║
║    - usage_report:          生成使用报告                   ║
║    - usage_status:          系统状态                       ║
║    - usage_config:          配置管理                       ║
║    - usage_model_costs:     模型成本配置                   ║
║    - usage_normalize:       标准化使用数据                 ║
║    - usage_clear:           清除所有记录                   ║
║                                                               ║
║  支持的模型成本:                                              ║
║    ✅ OpenAI (GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5)    ║
║    ✅ Anthropic (Claude 3.5 Sonnet, Opus, Haiku)            ║
║    ✅ Google (Gemini 1.5 Pro, Flash)                        ║
║    ✅ Zhipu (GLM-4, GLM-4-flash)                            ║
║                                                               ║
║  报告格式:                                                    ║
║    ✅ text - 文本格式                                        ║
║    ✅ json - JSON 格式                                       ║
║    ✅ markdown - Markdown 格式                               ║
║    ✅ csv - CSV 格式                                         ║
║                                                               ║
║  继承 V34 能力 (Dedupe):                                      ║
║    ✅ 去重缓存系统                                           ║
║                                                               ║
║  工具总数: 235 个                                             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v35-agent/index.ts 启动完整系统");
  process.exit(0);
}
