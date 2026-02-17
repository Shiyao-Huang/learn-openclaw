/**
 * V36: 诊断事件系统 - 类型定义
 *
 * 提供系统可观测性，追踪内部状态、性能指标和错误
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 会话状态
 */
export type DiagnosticSessionState = "idle" | "processing" | "waiting";

/**
 * 基础事件结构
 */
export type DiagnosticBaseEvent = {
  ts: number;
  seq: number;
};

// ============================================================================
// 事件类型定义
// ============================================================================

/**
 * 模型使用事件
 */
export type DiagnosticUsageEvent = DiagnosticBaseEvent & {
  type: "model.usage";
  sessionKey?: string;
  sessionId?: string;
  channel?: string;
  provider?: string;
  model?: string;
  usage: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    promptTokens?: number;
    total?: number;
  };
  context?: {
    limit?: number;
    used?: number;
  };
  costUsd?: number;
  durationMs?: number;
};

/**
 * Webhook 接收事件
 */
export type DiagnosticWebhookReceivedEvent = DiagnosticBaseEvent & {
  type: "webhook.received";
  channel: string;
  updateType?: string;
  chatId?: number | string;
};

/**
 * Webhook 处理完成事件
 */
export type DiagnosticWebhookProcessedEvent = DiagnosticBaseEvent & {
  type: "webhook.processed";
  channel: string;
  updateType?: string;
  chatId?: number | string;
  durationMs?: number;
};

/**
 * Webhook 错误事件
 */
export type DiagnosticWebhookErrorEvent = DiagnosticBaseEvent & {
  type: "webhook.error";
  channel: string;
  updateType?: string;
  chatId?: number | string;
  error: string;
};

/**
 * 消息入队事件
 */
export type DiagnosticMessageQueuedEvent = DiagnosticBaseEvent & {
  type: "message.queued";
  sessionKey?: string;
  sessionId?: string;
  channel?: string;
  source: string;
  queueDepth?: number;
};

/**
 * 消息处理完成事件
 */
export type DiagnosticMessageProcessedEvent = DiagnosticBaseEvent & {
  type: "message.processed";
  channel: string;
  messageId?: number | string;
  chatId?: number | string;
  sessionKey?: string;
  sessionId?: string;
  durationMs?: number;
  outcome: "completed" | "skipped" | "error";
  reason?: string;
  error?: string;
};

/**
 * 会话状态变更事件
 */
export type DiagnosticSessionStateEvent = DiagnosticBaseEvent & {
  type: "session.state";
  sessionKey?: string;
  sessionId?: string;
  prevState?: DiagnosticSessionState;
  state: DiagnosticSessionState;
  reason?: string;
  queueDepth?: number;
};

/**
 * 会话卡住事件
 */
export type DiagnosticSessionStuckEvent = DiagnosticBaseEvent & {
  type: "session.stuck";
  sessionKey?: string;
  sessionId?: string;
  state: DiagnosticSessionState;
  ageMs: number;
  queueDepth?: number;
};

/**
 * 队列入队事件
 */
export type DiagnosticLaneEnqueueEvent = DiagnosticBaseEvent & {
  type: "queue.lane.enqueue";
  lane: string;
  queueSize: number;
};

/**
 * 队列出队事件
 */
export type DiagnosticLaneDequeueEvent = DiagnosticBaseEvent & {
  type: "queue.lane.dequeue";
  lane: string;
  queueSize: number;
  waitMs: number;
};

/**
 * 运行尝试事件
 */
export type DiagnosticRunAttemptEvent = DiagnosticBaseEvent & {
  type: "run.attempt";
  sessionKey?: string;
  sessionId?: string;
  runId: string;
  attempt: number;
};

/**
 * 诊断心跳事件
 */
export type DiagnosticHeartbeatEvent = DiagnosticBaseEvent & {
  type: "diagnostic.heartbeat";
  webhooks: {
    received: number;
    processed: number;
    errors: number;
  };
  active: number;
  waiting: number;
  queued: number;
};

/**
 * 工具调用事件
 */
export type DiagnosticToolCallEvent = DiagnosticBaseEvent & {
  type: "tool.call";
  toolName: string;
  sessionKey?: string;
  sessionId?: string;
  durationMs?: number;
  success: boolean;
  error?: string;
};

/**
 * 错误事件
 */
export type DiagnosticErrorEvent = DiagnosticBaseEvent & {
  type: "error";
  category: "network" | "auth" | "rate_limit" | "timeout" | "internal" | "unknown";
  message: string;
  stack?: string;
  sessionKey?: string;
  sessionId?: string;
  context?: Record<string, unknown>;
};

// ============================================================================
// 联合类型
// ============================================================================

/**
 * 所有诊断事件类型的联合
 */
export type DiagnosticEventPayload =
  | DiagnosticUsageEvent
  | DiagnosticWebhookReceivedEvent
  | DiagnosticWebhookProcessedEvent
  | DiagnosticWebhookErrorEvent
  | DiagnosticMessageQueuedEvent
  | DiagnosticMessageProcessedEvent
  | DiagnosticSessionStateEvent
  | DiagnosticSessionStuckEvent
  | DiagnosticLaneEnqueueEvent
  | DiagnosticLaneDequeueEvent
  | DiagnosticRunAttemptEvent
  | DiagnosticHeartbeatEvent
  | DiagnosticToolCallEvent
  | DiagnosticErrorEvent;

/**
 * 诊断事件输入（不包含自动生成的 seq 和 ts）
 */
export type DiagnosticEventInput = DiagnosticEventPayload extends infer Event
  ? Event extends DiagnosticEventPayload
    ? Omit<Event, "seq" | "ts">
    : never
  : never;

// ============================================================================
// 统计类型
// ============================================================================

/**
 * 事件类型统计
 */
export type EventTypeStats = {
  type: string;
  count: number;
  firstTs: number;
  lastTs: number;
  avgDurationMs?: number;
  errorCount?: number;
};

/**
 * 诊断系统状态
 */
export type DiagnosticStatus = {
  enabled: boolean;
  eventCount: number;
  listenerCount: number;
  startTime: number;
  uptimeMs: number;
  eventTypes: EventTypeStats[];
  recentErrors: DiagnosticErrorEvent[];
};

/**
 * 诊断系统配置
 */
export type DiagnosticConfig = {
  enabled: boolean;
  maxEvents: number;
  retentionMs: number;
  captureStacks: boolean;
  heartbeatIntervalMs: number;
};

// ============================================================================
// 查询类型
// ============================================================================

/**
 * 事件查询选项
 */
export type DiagnosticQueryOptions = {
  types?: string[];
  sessionKey?: string;
  sessionId?: string;
  channel?: string;
  startMs?: number;
  endMs?: number;
  limit?: number;
  errorsOnly?: boolean;
};

/**
 * 事件查询结果
 */
export type DiagnosticQueryResult = {
  events: DiagnosticEventPayload[];
  total: number;
  hasMore: boolean;
};

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_DIAGNOSTIC_CONFIG: DiagnosticConfig = {
  enabled: true,
  maxEvents: 10000,
  retentionMs: 24 * 60 * 60 * 1000, // 24 hours
  captureStacks: true,
  heartbeatIntervalMs: 60000, // 1 minute
};
