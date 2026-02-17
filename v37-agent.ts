/**
 * v37-agent.ts - OpenClaw V37: 系统工具集
 *
 * V37 新增功能:
 * - sys_clipboard_copy: 复制到剪贴板
 * - sys_clipboard_paste: 从剪贴板读取
 * - sys_os_info: 获取操作系统信息
 * - sys_hostname: 获取主机名
 * - sys_network_info: 获取网络信息
 * - sys_uptime: 获取系统运行时间
 * - sys_presence_get: 获取当前节点存在信息
 * - sys_presence_list: 列出所有节点
 * - sys_presence_update: 更新节点存在信息
 *
 * 完整实现见 v37-agent/sys/ 目录
 */

export {
  copyToClipboard,
  pasteFromClipboard,
  getOsSummary,
  getPrimaryIPv4,
  formatMemory,
  formatUptime,
  updateSystemPresence,
  upsertPresence,
  listSystemPresence,
  getPresence,
  clearPresence,
  SYS_TOOLS,
  SYS_TOOL_COUNT,
  createSysHandlers,
  closeSysHandlers,
  getSysConfig,
  updateSysConfig,
  type OsSummary,
  type SystemPresence,
  type SystemPresenceUpdate,
  type ClipboardResult,
  type SysToolsConfig,
  DEFAULT_SYS_TOOLS_CONFIG,
} from "./v37-agent/sys/index.js";

// 继承 V36 诊断事件系统
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
export const VERSION = "v37";
export const VERSION_NAME = "系统工具集";
export const TOOL_COUNT = 259; // V36 的 250 + V37 的 9

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║            OpenClaw V37 - 系统工具集                          ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  新增工具 (System):                                           ║
║    剪贴板:                                                    ║
║    - sys_clipboard_copy:   复制到剪贴板                      ║
║    - sys_clipboard_paste:  从剪贴板读取                      ║
║                                                               ║
║    系统信息:                                                  ║
║    - sys_os_info:         获取操作系统信息                   ║
║    - sys_hostname:        获取主机名                         ║
║    - sys_network_info:    获取网络信息                       ║
║    - sys_uptime:          获取系统运行时间                   ║
║                                                               ║
║    节点存在:                                                  ║
║    - sys_presence_get:    获取当前节点信息                   ║
║    - sys_presence_list:   列出所有节点                       ║
║    - sys_presence_update: 更新节点存在信息                   ║
║                                                               ║
║  特性:                                                        ║
║    ✅ 跨平台剪贴板操作 (macOS/Linux/Windows)                 ║
║    ✅ 系统信息获取 (CPU/内存/网络)                           ║
║    ✅ 节点存在追踪 (状态/模式/时间)                          ║
║    ✅ 多节点管理 (TTL/LRU)                                   ║
║                                                               ║
║  继承 V36 能力 (Diagnostic):                                  ║
║    ✅ 诊断事件系统                                           ║
║                                                               ║
║  继承 V35 能力 (Usage):                                       ║
║    ✅ 成本追踪系统                                           ║
║                                                               ║
║  工具总数: 259 个                                             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v37-agent/index.ts 启动完整系统");
  process.exit(0);
}
