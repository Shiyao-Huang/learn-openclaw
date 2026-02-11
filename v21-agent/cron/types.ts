/**
 * v21-agent/cron/types.ts - 定时任务类型定义
 */

/** 调度类型 */
export type ScheduleKind = "at" | "every" | "cron";

/** 一次性调度 */
export interface AtSchedule {
  kind: "at";
  at: string; // ISO-8601 时间戳
}

/** 周期性调度 */
export interface EverySchedule {
  kind: "every";
  everyMs: number;
  anchorMs?: number; // 可选起始时间偏移
}

/** Cron 表达式调度 */
export interface CronSchedule {
  kind: "cron";
  expr: string; // 如 "0 9 * * *" (每天9点)
  tz?: string;  // 时区，默认 UTC
}

/** 调度配置 */
export type Schedule = AtSchedule | EverySchedule | CronSchedule;

/** Payload 类型 */
export type PayloadKind = "systemEvent" | "agentTurn";

/** SystemEvent 载荷 */
export interface SystemEventPayload {
  kind: "systemEvent";
  text: string;
}

/** AgentTurn 载荷 */
export interface AgentTurnPayload {
  kind: "agentTurn";
  message: string;
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
}

/** 任务载荷 */
export type Payload = SystemEventPayload | AgentTurnPayload;

/** 投递配置 */
export interface Delivery {
  mode: "none" | "announce";
  channel?: string;
  to?: string;
  bestEffort?: boolean;
}

/** Cron 任务定义 */
export interface CronJob {
  id: string;
  name?: string;
  schedule: Schedule;
  payload: Payload;
  delivery?: Delivery;
  sessionTarget: "main" | "isolated";
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
  runCount: number;
}

/** 提醒定义 */
export interface Reminder {
  id: string;
  text: string;
  triggerAt: number;
  createdAt: number;
  channel?: string;
  target?: string;
  fired: boolean;
}

/** 任务运行记录 */
export interface RunLog {
  id: string;
  jobId: string;
  startedAt: number;
  completedAt?: number;
  status: "running" | "completed" | "failed";
  error?: string;
  output?: string;
}

/** Cron 存储接口 */
export interface CronStore {
  jobs: Map<string, CronJob>;
  reminders: Map<string, Reminder>;
  runLogs: Map<string, RunLog[]>;
}

/** 作业状态 */
export interface JobStatus {
  id: string;
  name?: string;
  enabled: boolean;
  nextRunAt?: number;
  lastRunAt?: number;
  runCount: number;
  schedule: string; // 人类可读的描述
}
