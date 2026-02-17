/**
 * v36-agent.ts - OpenClaw V36: 诊断事件系统
 *
 * V36 新增功能:
 * - diagnostic_emit_usage: 发射模型使用事件
 * - diagnostic_emit_tool_call: 发射工具调用事件
 * - diagnostic_emit_error: 发射错误事件
 * - diagnostic_emit_session_state: 发射会话状态变更事件
 * - diagnostic_emit_message: 发射消息处理事件
 * - diagnostic_query: 查询诊断事件
 * - diagnostic_get_events: 获取最近的诊断事件
 * - diagnostic_stats: 获取事件类型统计
 * - diagnostic_errors: 获取最近的错误事件
 * - diagnostic_status: 获取诊断系统状态
 * - diagnostic_config: 获取或更新诊断配置
 * - diagnostic_report: 生成诊断报告
 * - diagnostic_clear: 清除所有诊断事件
 * - diagnostic_subscribe: 订阅诊断事件
 *
 * 完整实现见 v36-agent/diagnostic/ 目录
 */

export {
  DiagnosticEngine,
  getDiagnosticEngine,
  closeDiagnosticEngine,
  resetDiagnosticEngine,
  emitModelUsage,
  emitToolCall,
  emitError,
  emitSessionState,
  emitMessageProcessed,
  DIAGNOSTIC_TOOLS,
  DIAGNOSTIC_TOOL_COUNT,
  createDiagnosticHandlers,
  closeDiagnosticHandlers,
  type DiagnosticEventPayload,
  type DiagnosticEventInput,
  type DiagnosticSessionState,
  type DiagnosticUsageEvent,
  type DiagnosticWebhookReceivedEvent,
  type DiagnosticWebhookProcessedEvent,
  type DiagnosticWebhookErrorEvent,
  type DiagnosticMessageQueuedEvent,
  type DiagnosticMessageProcessedEvent,
  type DiagnosticSessionStateEvent,
  type DiagnosticSessionStuckEvent,
  type DiagnosticLaneEnqueueEvent,
  type DiagnosticLaneDequeueEvent,
  type DiagnosticRunAttemptEvent,
  type DiagnosticHeartbeatEvent,
  type DiagnosticToolCallEvent,
  type DiagnosticErrorEvent,
  type EventTypeStats,
  type DiagnosticStatus,
  type DiagnosticConfig,
  type DiagnosticQueryOptions,
  type DiagnosticQueryResult,
  DEFAULT_DIAGNOSTIC_CONFIG,
} from "./v36-agent/diagnostic/index.js";

// 继承 V35 Usage/成本追踪系统
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

// 版本信息
export const VERSION = "v36";
export const VERSION_NAME = "诊断事件系统";
export const TOOL_COUNT = 250; // V35 的 235 + V36 的 15

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║            OpenClaw V36 - 诊断事件系统                        ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  新增工具 (Diagnostic):                                       ║
║    - diagnostic_emit_usage:        发射模型使用事件          ║
║    - diagnostic_emit_tool_call:    发射工具调用事件          ║
║    - diagnostic_emit_error:        发射错误事件              ║
║    - diagnostic_emit_session_state: 发射会话状态变更         ║
║    - diagnostic_emit_message:      发射消息处理事件          ║
║    - diagnostic_query:             查询诊断事件              ║
║    - diagnostic_get_events:        获取最近事件              ║
║    - diagnostic_stats:             获取统计信息              ║
║    - diagnostic_errors:            获取最近错误              ║
║    - diagnostic_status:            获取系统状态              ║
║    - diagnostic_config:            配置管理                  ║
║    - diagnostic_report:            生成诊断报告              ║
║    - diagnostic_clear:             清除所有事件              ║
║    - diagnostic_subscribe:         订阅事件                  ║
║                                                               ║
║  事件类型:                                                    ║
║    ✅ model.usage - 模型使用追踪                             ║
║    ✅ tool.call - 工具调用追踪                               ║
║    ✅ error - 错误追踪                                       ║
║    ✅ session.state - 会话状态变更                           ║
║    ✅ message.processed - 消息处理                           ║
║    ✅ webhook.* - Webhook 事件                               ║
║    ✅ queue.* - 队列事件                                     ║
║                                                               ║
║  特性:                                                        ║
║    ✅ 事件发射与监听                                         ║
║    ✅ 事件存储与查询                                         ║
║    ✅ 统计与分析                                             ║
║    ✅ 错误追踪                                               ║
║    ✅ 报告生成 (text/json/markdown)                          ║
║                                                               ║
║  继承 V35 能力 (Usage):                                       ║
║    ✅ 成本追踪系统                                           ║
║                                                               ║
║  工具总数: 250 个                                             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v36-agent/index.ts 启动完整系统");
  process.exit(0);
}
