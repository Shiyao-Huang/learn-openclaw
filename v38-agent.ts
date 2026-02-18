/**
 * v38-agent.ts - OpenClaw V38: 命令执行审批系统
 *
 * V38 新增功能:
 * - approval_allowlist_add: 添加命令到白名单
 * - approval_allowlist_remove: 从白名单移除命令
 * - approval_allowlist_list: 列出白名单
 * - approval_allowlist_get: 获取白名单条目详情
 * - approval_allowlist_update: 更新白名单条目
 * - approval_safebins_list: 列出安全二进制
 * - approval_safebins_add: 添加安全二进制
 * - approval_safebins_remove: 移除安全二进制
 * - approval_policy_get: 获取审批策略
 * - approval_policy_set: 设置审批策略
 * - approval_analyze: 分析命令
 * - approval_check: 检查命令审批状态
 * - approval_stats: 获取统计信息
 * - approval_config_export: 导出配置
 * - approval_config_import: 导入配置
 * - approval_reset: 重置配置
 *
 * 完整实现见 v38-agent/approval/ 目录
 */

export {
  // Types
  type ExecHost,
  type ExecSecurity,
  type ExecAsk,
  type ApprovalPolicy,
  type AllowlistEntry,
  type ApprovalConfig,
  type CommandSegment,
  type CommandAnalysis,
  type ApprovalDecision,
  type ApprovalResult,
  
  // Engine
  ApprovalEngine,
  getApprovalEngine,
  resetApprovalEngine,
  
  // Defaults
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_SAFE_BINS,
  
  // Tools
  APPROVAL_TOOLS,
  APPROVAL_TOOL_COUNT,
  createApprovalHandlers,
  closeApprovalHandlers,
} from "./v38-agent/approval/index.js";

// 继承 V37 系统工具集
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
  type SessionUsageSummary,
  type LatencyStats,
  type DailyLatency,
  type UsageReport,
  type UsageConfig,
  DEFAULT_USAGE_CONFIG,
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
  type DedupeCacheConfig,
  type DedupeCacheEntry,
  type DedupeCacheStats,
  type DedupePreset,
  DEFAULT_DEDUPE_CONFIGS,
} from "./v34-agent/dedupe/index.js";

// 继承 V33 Skill 安全扫描系统
export {
  SkillScanner,
  getSkillScanner,
  scanCodeSecurity,
  SECURITY_SCAN_TOOLS,
  SECURITY_SCAN_TOOL_COUNT,
  createScannerHandlers,
  closeScannerHandlers,
  type ScanRule,
  type ScanResult,
  type ScanFinding,
  type ScannerConfig,
  DEFAULT_SCANNER_CONFIG,
} from "./v33-agent/scanner/index.js";

// 继承 V32 速率限制与重试策略
export {
  RateLimitEngine,
  getRateLimitEngine,
  closeRateLimitEngine,
  RATELIMIT_TOOLS,
  RATELIMIT_TOOL_COUNT,
  createRatelimitHandlers,
  closeRatelimitHandlers,
  type RateLimitPolicy,
  type RateLimitEntry,
  type RateLimitConfig,
  type RetryPolicy,
  type RetryResult,
  DEFAULT_RATELIMIT_CONFIG,
} from "./v32-agent/ratelimit/index.js";

// 继承 V31 投票系统
export {
  PollEngine,
  getPollEngine,
  closePollEngine,
  POLL_TOOLS,
  POLL_TOOL_COUNT,
  createPollHandlers,
  closePollHandlers,
  type Poll,
  type PollOption,
  type PollVote,
  type PollResult,
  type PollStats,
  type PollConfig,
  DEFAULT_POLL_CONFIG,
} from "./v31-agent/poll/index.js";

// 继承 V30 混合搜索系统
export {
  HybridSearchEngine,
  getHybridSearchEngine,
  closeHybridSearchEngine,
  HYBRID_TOOLS,
  HYBRID_TOOL_COUNT,
  createHybridHandlers,
  closeHybridHandlers,
  type HybridSearchResult,
  type HybridSearchConfig,
  DEFAULT_HYBRID_CONFIG,
} from "./v30-agent/hybrid/index.js";

// 继承 V29 安全审计系统
export {
  SecurityEngine,
  getSecurityEngine,
  closeSecurityEngine,
  SECURITY_TOOLS,
  SECURITY_TOOL_COUNT,
  createSecurityHandlers,
  closeSecurityHandlers,
  type SecurityIssue,
  type SecurityAuditResult,
  type SecurityFix,
  type SecurityReport,
  type SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
} from "./v29-agent/security/index.js";

// 继承 V28 链接理解系统
export {
  LinkUnderstandingEngine,
  getLinkEngine,
  closeLinkEngine,
  LINK_TOOLS,
  LINK_TOOL_COUNT,
  createLinkHandlers,
  closeLinkHandlers,
  type LinkInfo,
  type LinkFetchResult,
  type LinkEngineConfig,
  DEFAULT_LINK_CONFIG,
} from "./v28-agent/link/index.js";

// 继承 V27 向量嵌入增强
export {
  EmbeddingEngine,
  getEmbeddingEngine,
  closeEmbeddingEngine,
  EMBEDDING_TOOLS,
  EMBEDDING_TOOL_COUNT,
  createEmbeddingHandlers,
  closeEmbeddingHandlers,
  type EmbeddingEntry,
  type EmbeddingSearchResult,
  type EmbeddingConfig,
  DEFAULT_EMBEDDING_CONFIG,
} from "./v27-agent/embedding/index.js";

// 继承 V26 Canvas 显示系统
export {
  CanvasEngine,
  getCanvasEngine,
  closeCanvasEngine,
  CANVAS_TOOLS,
  CANVAS_TOOL_COUNT,
  createCanvasHandlers,
  closeCanvasHandlers,
  type CanvasConfig,
  type CanvasHistory,
  DEFAULT_CANVAS_CONFIG,
} from "./v26-agent/canvas/index.js";

// 继承 V25 语音识别 (STT)
export {
  STTEngine,
  getSTTEngine,
  closeSTTEngine,
  STT_TOOLS,
  STT_TOOL_COUNT,
  createSTTHandlers,
  closeSTTHandlers,
  type STTConfig,
  type STTResult,
  type STTHistoryEntry,
  DEFAULT_STT_CONFIG,
} from "./v25-agent/stt/index.js";

// 继承 V24 语音能力 (TTS)
export {
  TTSEngine,
  getTTSEngine,
  closeTTSEngine,
  AudioPlayer,
  getAudioPlayer,
  closeAudioPlayer,
  TTS_TOOLS,
  TTS_TOOL_COUNT,
  createTTSHandlers,
  closeTTSHandlers,
  type TTSConfig,
  type TTSVoice,
  type TTSHistoryEntry,
  DEFAULT_TTS_CONFIG,
} from "./v24-agent/audio/index.js";

// 继承 V23 图像理解
export {
  VisionAnalyzer,
  getVisionAnalyzer,
  closeVisionAnalyzer,
  VISION_TOOLS,
  VISION_TOOL_COUNT,
  createVisionHandlers,
  closeVisionHandlers,
  type VisionConfig,
  type VisionAnalysisResult,
  type VisionHistoryEntry,
  DEFAULT_VISION_CONFIG,
} from "./v23-agent/vision/index.js";

// 继承 V22 代码执行沙箱
export {
  SandboxRunner,
  getSandboxRunner,
  closeSandboxRunner,
  SANDBOX_TOOLS,
  SANDBOX_TOOL_COUNT,
  createSandboxHandlers,
  closeSandboxHandlers,
  type SandboxConfig,
  type SandboxResult,
  type SandboxExecution,
  DEFAULT_SANDBOX_CONFIG,
} from "./v22-agent/sandbox/index.js";

// 继承 V21 定时任务与提醒系统
export {
  CronManager,
  getCronManager,
  closeCronManager,
  CRON_TOOLS,
  CRON_TOOL_COUNT,
  createCronHandlers,
  closeCronHandlers,
  type CronJob,
  type CronSchedule,
  type CronPayload,
  type CronRun,
  type CronConfig,
  DEFAULT_CRON_CONFIG,
} from "./v21-agent/cron/index.js";

// 继承 V20 浏览器自动化
export {
  BrowserController,
  getBrowserController,
  closeBrowserController,
  BROWSER_TOOLS,
  BROWSER_TOOL_COUNT,
  createBrowserHandlers,
  closeBrowserHandlers,
  type BrowserConfig,
  type BrowserSession,
  DEFAULT_BROWSER_CONFIG,
} from "./v20-agent/browser/index.js";

// 继承 V19 持久化与恢复系统
export {
  PersistenceManager,
  getPersistenceManager,
  closePersistenceManager,
  PERSISTENCE_TOOLS,
  PERSISTENCE_TOOL_COUNT,
  createPersistenceHandlers,
  closePersistenceHandlers,
  type PersistenceConfig,
  type PersistedState,
  type SnapshotInfo,
  DEFAULT_PERSISTENCE_CONFIG,
} from "./v19-agent/persistence/index.js";

// 继承 V18 团队协作系统
export {
  CollaborationManager,
  getCollaborationManager,
  closeCollaborationManager,
  COLLABORATION_TOOLS,
  COLLABORATION_TOOL_COUNT,
  createCollaborationHandlers,
  closeCollaborationHandlers,
  type CollaborationConfig,
  type TeamMember,
  type SharedTask,
  type CollaborationSession,
  DEFAULT_COLLABORATION_CONFIG,
} from "./v18-agent/collaboration/index.js";

// 继承 V17 外部集成
export {
  ExternalIntegrationEngine,
  getExternalEngine,
  closeExternalEngine,
  EXTERNAL_TOOLS,
  EXTERNAL_TOOL_COUNT,
  createExternalHandlers,
  closeExternalHandlers,
  type ExternalConfig,
  DEFAULT_EXTERNAL_CONFIG,
} from "./v17-agent/external/index.js";

// 继承 V16 工作流引擎
export {
  WorkflowEngine,
  getWorkflowEngine,
  closeWorkflowEngine,
  WORKFLOW_TOOLS,
  WORKFLOW_TOOL_COUNT,
  createWorkflowHandlers,
  closeWorkflowHandlers,
  type WorkflowDAG,
  type WorkflowNode,
  type WorkflowEdge,
  type WorkflowState,
  type WorkflowConfig,
  DEFAULT_WORKFLOW_CONFIG,
} from "./v16-agent/workflow/index.js";

// 继承 V15 多模型协作
export {
  MultiModelOrchestrator,
  getMultiModelOrchestrator,
  closeMultiModelOrchestrator,
  MULTIMODEL_TOOLS,
  MULTIMODEL_TOOL_COUNT,
  createMultimodelHandlers,
  closeMultimodelHandlers,
  type ModelConfig,
  type ModelResponse,
  type MultiModelConfig,
  DEFAULT_MULTIMODEL_CONFIG,
} from "./v15-agent/multimodel/index.js";

// 继承 V14 插件系统
export {
  PluginManager,
  getPluginManager,
  closePluginManager,
  PLUGIN_TOOLS,
  PLUGIN_TOOL_COUNT,
  createPluginHandlers,
  closePluginHandlers,
  type Plugin,
  type PluginManifest,
  type PluginConfig,
  DEFAULT_PLUGIN_CONFIG,
} from "./v14-agent/plugins/index.js";

// 继承 V13.5 上下文压缩
export {
  ContextCompressor,
  compressContext,
  CONTEXT_COMPRESSION_TOOLS,
  CONTEXT_COMPRESSION_TOOL_COUNT,
  createCompressionHandlers,
  type CompressionConfig,
  type CompressionResult,
  DEFAULT_COMPRESSION_CONFIG,
} from "./v13.5-agent/compression/index.js";

// 继承 V13 自进化系统
export {
  EvolutionEngine,
  getEvolutionEngine,
  closeEvolutionEngine,
  EVOLUTION_TOOLS,
  EVOLUTION_TOOL_COUNT,
  createEvolutionHandlers,
  closeEvolutionHandlers,
  type EvolutionConfig,
  type EvolutionProposal,
  type EvolutionResult,
  DEFAULT_EVOLUTION_CONFIG,
} from "./v13-agent/evolution/index.js";

// 继承 V12 安全策略系统
export {
  SecurityPolicyManager,
  getSecurityPolicyManager,
  closeSecurityPolicyManager,
  SECURITY_POLICY_TOOLS,
  SECURITY_POLICY_TOOL_COUNT,
  createSecurityPolicyHandlers,
  closeSecurityPolicyHandlers,
  type SecurityPolicy,
  type SecurityPolicyConfig,
  DEFAULT_SECURITY_POLICY_CONFIG,
} from "./v12-agent/security/index.js";

// 继承 V11 Channel 系统
export {
  ChannelManager,
  getChannelManager,
  closeChannelManager,
  CHANNEL_TOOLS,
  CHANNEL_TOOL_COUNT,
  createChannelHandlers,
  closeChannelHandlers,
  type Channel,
  type ChannelConfig,
  type ChannelMessage,
  DEFAULT_CHANNEL_CONFIG,
} from "./v11-agent/channel/index.js";

// 继承 V10 内省系统
export {
  IntrospectionEngine,
  getIntrospectionEngine,
  closeIntrospectionEngine,
  INTROSPECTION_TOOLS,
  INTROSPECTION_TOOL_COUNT,
  createIntrospectionHandlers,
  closeIntrospectionHandlers,
  type IntrospectionState,
  type IntrospectionConfig,
  DEFAULT_INTROSPECTION_CONFIG,
} from "./v10-agent/introspection/index.js";

// 继承 V9 会话管理
export {
  SessionManager,
  getSessionManager,
  closeSessionManager,
  SESSION_TOOLS,
  SESSION_TOOL_COUNT,
  createSessionHandlers,
  closeSessionHandlers,
  type Session,
  type SessionState,
  type SessionConfig,
  DEFAULT_SESSION_CONFIG,
} from "./v9-agent/session/index.js";

// 继承 V8 心跳主动性
export {
  HeartbeatManager,
  getHeartbeatManager,
  closeHeartbeatManager,
  HEARTBEAT_TOOLS,
  HEARTBEAT_TOOL_COUNT,
  createHeartbeatHandlers,
  closeHeartbeatHandlers,
  type HeartbeatConfig,
  type HeartbeatState,
  DEFAULT_HEARTBEAT_CONFIG,
} from "./v8-agent/heartbeat/index.js";

// 继承 V7 分层记忆
export {
  LayeredMemory,
  getLayeredMemory,
  closeLayeredMemory,
  LAYERED_MEMORY_TOOLS,
  LAYERED_MEMORY_TOOL_COUNT,
  createMemoryHandlers,
  closeMemoryHandlers,
  type MemoryLayer,
  type MemoryEntry,
  type LayeredMemoryConfig,
  DEFAULT_LAYERED_MEMORY_CONFIG,
} from "./v7-agent/memory/index.js";

// 继承 V6 身份与灵魂
export {
  IdentityManager,
  getIdentityManager,
  closeIdentityManager,
  IDENTITY_TOOLS,
  IDENTITY_TOOL_COUNT,
  createIdentityHandlers,
  closeIdentityHandlers,
  type Identity,
  type Soul,
  type IdentityConfig,
  DEFAULT_IDENTITY_CONFIG,
} from "./v6-agent/identity/index.js";

// 继承 V5.5 Hook 生命周期
export {
  HookManager,
  getHookManager,
  closeHookManager,
  HOOK_TOOLS,
  HOOK_TOOL_COUNT,
  createHookHandlers,
  closeHookHandlers,
  type Hook,
  type HookContext,
  type HookConfig,
  DEFAULT_HOOK_CONFIG,
} from "./v5.5-agent/hooks/index.js";

// 继承 V5 Skill 系统
export {
  SkillLoader,
  getSkillLoader,
  closeSkillLoader,
  SKILL_TOOLS,
  SKILL_TOOL_COUNT,
  createSkillHandlers,
  closeSkillHandlers,
  type Skill,
  type SkillManifest,
  type SkillConfig,
  DEFAULT_SKILL_CONFIG,
} from "./v5-agent/skills/index.js";

// 继承 V4 子代理协调
export {
  SubAgentCoordinator,
  getSubAgentCoordinator,
  closeSubAgentCoordinator,
  SUBAGENT_TOOLS,
  SUBAGENT_TOOL_COUNT,
  createSubAgentHandlers,
  closeSubAgentHandlers,
  type SubAgent,
  type SubAgentTask,
  type SubAgentConfig,
  DEFAULT_SUBAGENT_CONFIG,
} from "./v4-agent/subagent/index.js";

// 继承 V3 任务规划
export {
  PlanningEngine,
  getPlanningEngine,
  closePlanningEngine,
  PLANNING_TOOLS,
  PLANNING_TOOL_COUNT,
  createPlanningHandlers,
  closePlanningHandlers,
  type Plan,
  type PlanStep,
  type PlanningConfig,
  DEFAULT_PLANNING_CONFIG,
} from "./v3-agent/planning/index.js";

// 继承 V2 本地向量记忆
export {
  LocalVectorMemory,
  getLocalVectorMemory,
  closeLocalVectorMemory,
  VECTOR_MEMORY_TOOLS,
  VECTOR_MEMORY_TOOL_COUNT,
  createVectorMemoryHandlers,
  closeVectorMemoryHandlers,
  type VectorMemoryEntry,
  type VectorMemoryConfig,
  DEFAULT_VECTOR_MEMORY_CONFIG,
} from "./v2-agent/memory/index.js";

// 继承 V1 安全文件工具
export {
  SafeFileTools,
  getSafeFileTools,
  closeSafeFileTools,
  FILE_TOOLS,
  FILE_TOOL_COUNT,
  createFileHandlers,
  closeFileHandlers,
  type FileToolsConfig,
  DEFAULT_FILE_TOOLS_CONFIG,
} from "./v1-agent/files/index.js";

// 版本信息
export const VERSION = "v38";
export const VERSION_NAME = "命令执行审批系统";
export const TOOL_COUNT = 259 + 17; // V37 (259) + V38 (17) = 276

/**
 * V38 新增工具 (17 个):
 * 
 * 白名单管理:
 * - approval_allowlist_add
 * - approval_allowlist_remove
 * - approval_allowlist_list
 * - approval_allowlist_get
 * - approval_allowlist_update
 * 
 * 安全二进制管理:
 * - approval_safebins_list
 * - approval_safebins_add
 * - approval_safebins_remove
 * 
 * 策略管理:
 * - approval_policy_get
 * - approval_policy_set
 * 
 * 命令分析与审批:
 * - approval_analyze
 * - approval_check
 * 
 * 统计与管理:
 * - approval_stats
 * - approval_config_export
 * - approval_config_import
 * - approval_reset
 */
