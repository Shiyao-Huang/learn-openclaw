/**
 * v21-agent/cron/handlers.ts - Cron 工具处理器
 */

import { CronManager } from "./manager.js";
import type { Schedule, Payload, CronJob } from "./types.js";
import { getScheduleDescription } from "./schedule.js";

/** 创建 Cron 工具处理器 */
export function createCronHandlers(cronManager: CronManager): Record<string, (args: any) => any> {
  return {
    // ============================================================================
    // Cron 任务管理
    // ============================================================================

    cron_create: (args: {
      name?: string;
      schedule: Schedule;
      payload: Payload;
      sessionTarget?: "main" | "isolated";
      enabled?: boolean;
    }) => {
      const job = cronManager.createJob(
        args.name,
        args.schedule,
        args.payload,
        args.sessionTarget || "isolated"
      );

      if (args.enabled === false) {
        cronManager.updateJob(job.id, { enabled: false });
        job.enabled = false;
      }

      return JSON.stringify({
        success: true,
        job: {
          id: job.id,
          name: job.name,
          schedule: getScheduleDescription(job.schedule),
          nextRunAt: job.nextRunAt ? new Date(job.nextRunAt).toISOString() : null,
          enabled: job.enabled,
        },
      }, null, 2);
    },

    cron_list: (args: { includeDisabled?: boolean } = {}) => {
      const jobs = cronManager.listJobs();
      const filtered = args.includeDisabled !== false 
        ? jobs 
        : jobs.filter(j => j.enabled);

      return JSON.stringify({
        count: filtered.length,
        jobs: filtered.map(job => ({
          id: job.id,
          name: job.name,
          schedule: getScheduleDescription(job.schedule),
          enabled: job.enabled,
          runCount: job.runCount,
          lastRunAt: job.lastRunAt ? new Date(job.lastRunAt).toISOString() : null,
          nextRunAt: job.nextRunAt ? new Date(job.nextRunAt).toISOString() : null,
        })),
      }, null, 2);
    },

    cron_update: (args: {
      jobId: string;
      name?: string;
      schedule?: Schedule;
      enabled?: boolean;
    }) => {
      const updates: Partial<CronJob> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.schedule !== undefined) updates.schedule = args.schedule;
      if (args.enabled !== undefined) updates.enabled = args.enabled;

      const job = cronManager.updateJob(args.jobId, updates);
      
      if (!job) {
        return JSON.stringify({ success: false, error: "Job not found" });
      }

      return JSON.stringify({
        success: true,
        job: {
          id: job.id,
          name: job.name,
          schedule: getScheduleDescription(job.schedule),
          enabled: job.enabled,
          nextRunAt: job.nextRunAt ? new Date(job.nextRunAt).toISOString() : null,
        },
      }, null, 2);
    },

    cron_remove: (args: { jobId: string }) => {
      const success = cronManager.removeJob(args.jobId);
      return JSON.stringify({
        success,
        message: success ? "Job removed" : "Job not found",
      });
    },

    cron_run: (args: { jobId: string }) => {
      const success = cronManager.runJob(args.jobId);
      return JSON.stringify({
        success,
        message: success ? "Job triggered" : "Job not found",
      });
    },

    cron_runs: (args: { jobId: string; limit?: number }) => {
      const logs = cronManager.getJobRuns(args.jobId, args.limit || 10);
      return JSON.stringify({
        jobId: args.jobId,
        count: logs.length,
        runs: logs.map(log => ({
          id: log.id,
          startedAt: new Date(log.startedAt).toISOString(),
          completedAt: log.completedAt ? new Date(log.completedAt).toISOString() : null,
          status: log.status,
          error: log.error,
        })),
      }, null, 2);
    },

    // ============================================================================
    // 提醒管理
    // ============================================================================

    reminder_set: (args: {
      text: string;
      triggerAt: string;
      channel?: string;
      target?: string;
    }) => {
      const triggerTime = new Date(args.triggerAt).getTime();
      
      if (isNaN(triggerTime)) {
        return JSON.stringify({
          success: false,
          error: "Invalid triggerAt format. Use ISO-8601 format.",
        });
      }

      if (triggerTime <= Date.now()) {
        return JSON.stringify({
          success: false,
          error: "Trigger time must be in the future",
        });
      }

      const reminder = cronManager.setReminder(
        args.text,
        triggerTime,
        args.channel,
        args.target
      );

      return JSON.stringify({
        success: true,
        reminder: {
          id: reminder.id,
          text: reminder.text,
          triggerAt: new Date(reminder.triggerAt).toISOString(),
          channel: reminder.channel,
        },
      }, null, 2);
    },

    reminder_list: (args: { includeFired?: boolean } = {}) => {
      const reminders = cronManager.listReminders(args.includeFired);
      
      return JSON.stringify({
        count: reminders.length,
        reminders: reminders.map(r => ({
          id: r.id,
          text: r.text,
          triggerAt: new Date(r.triggerAt).toISOString(),
          fired: r.fired,
          channel: r.channel,
        })),
      }, null, 2);
    },

    reminder_cancel: (args: { reminderId: string }) => {
      const success = cronManager.cancelReminder(args.reminderId);
      return JSON.stringify({
        success,
        message: success ? "Reminder cancelled" : "Reminder not found",
      });
    },

    // ============================================================================
    // 统计
    // ============================================================================

    cron_status: () => {
      const stats = cronManager.getStats();
      return JSON.stringify({
        ...stats,
        status: "running",
      }, null, 2);
    },
  };
}
