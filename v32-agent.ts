/**
 * v32-agent.ts - OpenClaw V32: 速率限制与重试策略
 *
 * V32 新增功能:
 * - ratelimit_create: 创建速率限制器
 * - ratelimit_delete: 删除限制器
 * - ratelimit_reset: 重置限制器状态
 * - ratelimit_list: 列出所有限制器
 * - ratelimit_get: 获取限制器详情
 * - ratelimit_check: 检查是否允许请求
 * - ratelimit_consume: 消耗请求配额
 * - ratelimit_wait: 等待可用配额
 * - ratelimit_stats: 获取统计信息
 * - ratelimit_status: 获取引擎状态
 * - ratelimit_presets: 获取预设配置
 * - ratelimit_config: 获取/更新配置
 * - ratelimit_retry: 使用重试策略执行操作
 * - ratelimit_delay: 计算重试延迟
 *
 * 完整实现见 v32-agent/ratelimit/ 目录
 */

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

// 继承 V31 投票系统
export {
  PollEngine,
  getPollEngine,
  closePollEngine,
  POLL_TOOLS,
  POLL_TOOL_COUNT,
  pollHandlers,
  closePollHandlers,
  type Poll,
  type PollOption,
  type PollStatus,
  type PollConfig,
  type PollResult,
  type PollFilter,
  type PollStats,
  type PollEngineConfig,
  type UserVote,
} from "./v31-agent/poll/index.js";

// 版本信息
export const VERSION = "v32";
export const VERSION_NAME = "速率限制与重试策略";
export const TOOL_COUNT = 202; // V31 的 187 + V32 的 15

console.log(`
╔═══════════════════════════════════════════════════════════╗
║            OpenClaw V32 - 速率限制与重试策略              ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (Rate Limit):                                   ║
║    - ratelimit_create:        创建限制器                 ║
║    - ratelimit_delete:        删除限制器                 ║
║    - ratelimit_reset:         重置状态                   ║
║    - ratelimit_list:          列出限制器                 ║
║    - ratelimit_get:           获取详情                   ║
║    - ratelimit_check:         检查配额                   ║
║    - ratelimit_consume:       消耗配额                   ║
║    - ratelimit_wait:          等待可用                   ║
║    - ratelimit_stats:         统计信息                   ║
║    - ratelimit_status:        引擎状态                   ║
║    - ratelimit_presets:       预设配置                   ║
║    - ratelimit_config:        获取配置                   ║
║    - ratelimit_retry:         重试执行                   ║
║    - ratelimit_delay:         计算延迟                   ║
║                                                           ║
║  特性:                                                    ║
║    ✅ 多种限流策略                                     ║
║       - Token Bucket (令牌桶)                          ║
║       - Sliding Window (滑动窗口)                      ║
║       - Fixed Window (固定窗口)                        ║
║    ✅ 重试策略                                         ║
║       - Fixed (固定延迟)                               ║
║       - Exponential (指数退避)                         ║
║       - Linear (线性退避)                              ║
║       - Decorrelated Jitter (抖动退避)                 ║
║    ✅ 预设配置                                         ║
║       - low/medium/high/api/strict                    ║
║       - quick/exponential/linear/jitter               ║
║    ✅ 统计与监控                                       ║
║                                                           ║
║  继承 V31 能力 (Poll System):                             ║
║    ✅ 单选/多选投票                                    ║
║    ✅ 限时投票                                         ║
║    ✅ 匿名投票                                         ║
║                                                           ║
║  工具总数: 202 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v32-agent/index.ts 启动完整系统");
  process.exit(0);
}
