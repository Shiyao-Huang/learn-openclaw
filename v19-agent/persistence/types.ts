/**
 * persistence/types.ts - V19 持久化系统类型定义
 * 
 * 定义状态快照、检查点、恢复机制的核心类型
 */

// ============================================================================
// 状态快照
// ============================================================================

/** 快照元数据 */
export interface SnapshotMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  version: string;
  tags: string[];
  size: number;
}

/** 完整状态快照 */
export interface StateSnapshot {
  metadata: SnapshotMetadata;
  agent: AgentState;
  session: SessionState;
  tasks: TaskState[];
  subagents: SubAgentState[];
  memory: MemoryState;
  workflow: WorkflowState;
}

/** Agent 状态 */
export interface AgentState {
  id: string;
  name: string;
  status: "idle" | "running" | "paused" | "error";
  currentTask?: string;
  trustLevel: "owner" | "trusted" | "normal" | "restricted";
  config: Record<string, unknown>;
  stats: {
    tasksCompleted: number;
    tasksFailed: number;
    uptime: number;
  };
}

/** 会话状态 */
export interface SessionState {
  id: string;
  channel: string;
  userId: string;
  messages: MessageSnapshot[];
  context: Record<string, unknown>;
}

/** 消息快照 */
export interface MessageSnapshot {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: ToolCallSnapshot[];
}

/** 工具调用快照 */
export interface ToolCallSnapshot {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  startTime: number;
  endTime?: number;
}

/** 任务状态 */
export interface TaskState {
  id: string;
  type: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  priority: number;
  description: string;
  assignedTo?: string;
  dependencies: string[];
  checkpoint?: TaskCheckpoint;
  progress: number;
  result?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/** 任务检查点 */
export interface TaskCheckpoint {
  step: number;
  data: Record<string, unknown>;
  timestamp: number;
}

/** 子代理状态 */
export interface SubAgentState {
  id: string;
  name: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "stopped";
  task: string;
  pid?: number;
  progress: number;
  checkpoint?: TaskCheckpoint;
  logs: string[];
  workDir: string;
  result?: string;
  error?: string;
  startTime: number;
  lastActive: number;
}

/** 记忆状态 */
export interface MemoryState {
  shortTerm: Record<string, unknown>[];
  longTerm: Record<string, unknown>[];
  dailyNotes: Record<string, string>;
  sessionContext: Record<string, unknown>;
}

/** 工作流状态 */
export interface WorkflowState {
  activeWorkflows: ActiveWorkflowState[];
  completedWorkflows: string[];
}

/** 活跃工作流状态 */
export interface ActiveWorkflowState {
  id: string;
  name: string;
  status: "running" | "paused" | "error";
  currentNode: string;
  completedNodes: string[];
  nodeStates: Record<string, unknown>;
  checkpoint?: WorkflowCheckpoint;
}

/** 工作流检查点 */
export interface WorkflowCheckpoint {
  nodeId: string;
  output: unknown;
  timestamp: number;
}

// ============================================================================
// 检查点与恢复
// ============================================================================

/** 检查点配置 */
export interface CheckpointConfig {
  enabled: boolean;
  intervalMs: number;
  maxCheckpoints: number;
  autoCleanup: boolean;
  persistOnError: boolean;
}

/** 恢复策略 */
export interface RecoveryStrategy {
  type: "restart" | "resume" | "rollback";
  targetSnapshot?: string;
  targetCheckpoint?: string;
  retryCount: number;
  retryDelayMs: number;
}

/** 恢复结果 */
export interface RecoveryResult {
  success: boolean;
  snapshotId?: string;
  restoredComponents: string[];
  failedComponents: string[];
  errors: string[];
  timestamp: number;
}

/** 持久化配置 */
export interface PersistenceConfig {
  snapshotsDir: string;
  checkpointsDir: string;
  autoSnapshotIntervalMs: number;
  maxSnapshots: number;
  maxCheckpointsPerTask: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

// ============================================================================
// 崩溃恢复
// ============================================================================

/** 崩溃信息 */
export interface CrashInfo {
  id: string;
  timestamp: number;
  type: "error" | "timeout" | "killed" | "unknown";
  message: string;
  stack?: string;
  component: string;
  snapshotId?: string;
  recovered: boolean;
}

/** 恢复计划 */
export interface RecoveryPlan {
  crashId: string;
  strategy: RecoveryStrategy;
  steps: RecoveryStep[];
  estimatedTime: number;
}

/** 恢复步骤 */
export interface RecoveryStep {
  id: string;
  type: "restore_snapshot" | "restore_checkpoint" | "restart_component" | "notify";
  target: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  error?: string;
}
