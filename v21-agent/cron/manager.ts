/**
 * v21-agent/cron/manager.ts - Cron 任务管理器
 */

import * as fs from "fs";
import * as path from "path";
import type { 
  CronJob, 
  Reminder, 
  RunLog, 
  Schedule, 
  Payload, 
  Delivery 
} from "./types.js";
import { getNextRunTime, getScheduleDescription, isOneTimeJobExpired } from "./schedule.js";

/** 存储数据结构 */
interface StoreData {
  jobs: Record<string, CronJob>;
  reminders: Record<string, Reminder>;
  runLogs: Record<string, RunLog[]>;
}

export class CronManager {
  private jobs: Map<string, CronJob> = new Map();
  private reminders: Map<string, Reminder> = new Map();
  private runLogs: Map<string, RunLog[]> = new Map();
  private storePath: string;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(workDir: string) {
    this.storePath = path.join(workDir, ".cron");
    this.ensureDir();
    this.load();
    this.startChecking();
  }

  /** 确保存储目录存在 */
  private ensureDir(): void {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }
  }

  /** 加载存储 */
  private load(): void {
    const storeFile = path.join(this.storePath, "store.json");
    if (fs.existsSync(storeFile)) {
      try {
        const data: StoreData = JSON.parse(fs.readFileSync(storeFile, "utf-8"));
        this.jobs = new Map(Object.entries(data.jobs || {}));
        this.reminders = new Map(Object.entries(data.reminders || {}));
        this.runLogs = new Map(Object.entries(data.runLogs || {}));
      } catch (e) {
        console.error("[CronManager] Failed to load store:", e);
      }
    }
  }

  /** 保存存储 */
  private save(): void {
    const storeFile = path.join(this.storePath, "store.json");
    const data: StoreData = {
      jobs: Object.fromEntries(this.jobs),
      reminders: Object.fromEntries(this.reminders),
      runLogs: Object.fromEntries(this.runLogs),
    };
    fs.writeFileSync(storeFile, JSON.stringify(data, null, 2));
  }

  /** 启动检查循环 */
  private startChecking(): void {
    this.checkInterval = setInterval(() => {
      this.checkAndExecute();
    }, 5000); // 每5秒检查一次
  }

  /** 停止检查 */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /** 检查并执行任务 */
  private checkAndExecute(): void {
    const now = Date.now();

    // 检查任务
    for (const job of this.jobs.values()) {
      if (!job.enabled) continue;
      if (job.nextRunAt && now >= job.nextRunAt) {
        this.executeJob(job);
      }
    }

    // 检查提醒
    for (const reminder of this.reminders.values()) {
      if (!reminder.fired && now >= reminder.triggerAt) {
        this.fireReminder(reminder);
      }
    }
  }

  /** 执行任务 */
  private executeJob(job: CronJob): void {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const runLog: RunLog = {
      id: runId,
      jobId: job.id,
      startedAt: Date.now(),
      status: "running",
    };

    // 记录运行日志
    const logs = this.runLogs.get(job.id) || [];
    logs.push(runLog);
    this.runLogs.set(job.id, logs);

    // 更新任务状态
    job.lastRunAt = Date.now();
    job.runCount++;
    
    // 重新计算下次执行时间
    if (!isOneTimeJobExpired(job)) {
      job.nextRunAt = getNextRunTime(job.schedule);
    } else {
      job.enabled = false; // 一次性任务完成后禁用
    }
    
    this.jobs.set(job.id, job);
    this.save();

    // 实际执行（简化版，实际应该调用执行器）
    console.log(`[Cron] Executing job: ${job.name || job.id}`);
    
    // 完成日志
    runLog.completedAt = Date.now();
    runLog.status = "completed";
    this.save();
  }

  /** 触发提醒 */
  private fireReminder(reminder: Reminder): void {
    reminder.fired = true;
    this.reminders.set(reminder.id, reminder);
    this.save();

    console.log(`[Reminder] 🔔 ${reminder.text}`);
    
    // 实际应该发送到指定 channel
  }

  // ============================================================================
  // 任务管理 API
  // ============================================================================

  /** 创建任务 */
  createJob(
    name: string | undefined,
    schedule: Schedule,
    payload: Payload,
    sessionTarget: "main" | "isolated" = "isolated",
    delivery?: Delivery
  ): CronJob {
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nextRunAt = getNextRunTime(schedule);

    const job: CronJob = {
      id,
      name,
      schedule,
      payload,
      delivery,
      sessionTarget,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nextRunAt,
      runCount: 0,
    };

    this.jobs.set(id, job);
    this.save();
    
    return job;
  }

  /** 列出所有任务 */
  listJobs(): CronJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** 获取任务 */
  getJob(id: string): CronJob | undefined {
    return this.jobs.get(id);
  }

  /** 更新任务 */
  updateJob(id: string, updates: Partial<CronJob>): CronJob | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    Object.assign(job, updates, { updatedAt: Date.now() });
    
    // 如果调度改变，重新计算下次执行时间
    if (updates.schedule) {
      job.nextRunAt = getNextRunTime(job.schedule);
    }

    this.jobs.set(id, job);
    this.save();
    return job;
  }

  /** 删除任务 */
  removeJob(id: string): boolean {
    const deleted = this.jobs.delete(id);
    if (deleted) {
      this.runLogs.delete(id);
      this.save();
    }
    return deleted;
  }

  /** 立即运行任务 */
  runJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    
    this.executeJob(job);
    return true;
  }

  /** 获取任务运行历史 */
  getJobRuns(id: string, limit: number = 10): RunLog[] {
    const logs = this.runLogs.get(id) || [];
    return logs.slice(-limit).reverse();
  }

  // ============================================================================
  // 提醒管理 API
  // ============================================================================

  /** 设置提醒 */
  setReminder(text: string, triggerAt: number, channel?: string, target?: string): Reminder {
    const id = `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    const reminder: Reminder = {
      id,
      text,
      triggerAt,
      createdAt: Date.now(),
      channel,
      target,
      fired: false,
    };

    this.reminders.set(id, reminder);
    this.save();
    
    return reminder;
  }

  /** 列出提醒 */
  listReminders(includeFired: boolean = false): Reminder[] {
    const reminders = Array.from(this.reminders.values());
    if (!includeFired) {
      return reminders.filter(r => !r.fired).sort((a, b) => a.triggerAt - b.triggerAt);
    }
    return reminders.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** 取消提醒 */
  cancelReminder(id: string): boolean {
    return this.reminders.delete(id);
  }

  /** 获取统计 */
  getStats(): { jobs: number; reminders: number; activeReminders: number } {
    return {
      jobs: this.jobs.size,
      reminders: this.reminders.size,
      activeReminders: Array.from(this.reminders.values()).filter(r => !r.fired).length,
    };
  }
}
