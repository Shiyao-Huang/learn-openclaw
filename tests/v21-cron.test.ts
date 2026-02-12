/**
 * v21-cron.test.ts - V21 定时任务系统测试
 * 
 * 测试内容:
 * - CronManager 基本功能
 * - 任务调度 (at/every/cron)
 * - 提醒管理
 * - 执行历史
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// 导入 V21 模块
import {
  CronManager,
  ReminderService,
  type Schedule,
  type CronJob,
  type Reminder,
} from "../v21-agent/cron/index.js";

describe("V21 Cron System", () => {
  let tempDir: string;
  let cronManager: CronManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "v21-cron-test-"));
    cronManager = new CronManager(tempDir);
  });

  afterEach(async () => {
    cronManager.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("CronManager", () => {
    it("应该能创建一次性任务 (at schedule)", async () => {
      const schedule: Schedule = {
        kind: "at",
        at: new Date(Date.now() + 3600000).toISOString(), // 1小时后
      };

      const job = await cronManager.createJob({
        name: "测试一次性任务",
        schedule,
        payload: { kind: "systemEvent", text: "Hello" },
        sessionTarget: "main",
      });

      expect(job.id).toBeDefined();
      expect(job.name).toBe("测试一次性任务");
      expect(job.schedule.kind).toBe("at");
      expect(job.enabled).toBe(true);
    });

    it("应该能创建周期性任务 (every schedule)", async () => {
      const schedule: Schedule = {
        kind: "every",
        everyMs: 60000, // 每分钟
      };

      const job = await cronManager.createJob({
        name: "测试周期性任务",
        schedule,
        payload: { kind: "systemEvent", text: "Tick" },
        sessionTarget: "main",
      });

      expect(job.id).toBeDefined();
      expect(job.schedule.kind).toBe("every");
    });

    it("应该能创建 cron 表达式任务", async () => {
      const schedule: Schedule = {
        kind: "cron",
        expr: "0 9 * * *", // 每天9点
        tz: "Asia/Shanghai",
      };

      const job = await cronManager.createJob({
        name: "每日报告",
        schedule,
        payload: { kind: "agentTurn", message: "生成日报" },
        sessionTarget: "isolated",
      });

      expect(job.id).toBeDefined();
      expect(job.schedule.kind).toBe("cron");
    });

    it("应该能列出所有任务", async () => {
      await cronManager.createJob({
        name: "任务1",
        schedule: { kind: "every", everyMs: 60000 },
        payload: { kind: "systemEvent", text: "1" },
        sessionTarget: "main",
      });

      await cronManager.createJob({
        name: "任务2",
        schedule: { kind: "every", everyMs: 120000 },
        payload: { kind: "systemEvent", text: "2" },
        sessionTarget: "main",
      });

      const jobs = cronManager.listJobs();
      expect(jobs).toHaveLength(2);
    });

    it("应该能更新任务", async () => {
      const job = await cronManager.createJob({
        name: "原名称",
        schedule: { kind: "every", everyMs: 60000 },
        payload: { kind: "systemEvent", text: "Hello" },
        sessionTarget: "main",
      });

      await cronManager.updateJob(job.id, {
        name: "新名称",
        enabled: false,
      });

      const updated = cronManager.getJob(job.id);
      expect(updated?.name).toBe("新名称");
      expect(updated?.enabled).toBe(false);
    });

    it("应该能删除任务", async () => {
      const job = await cronManager.createJob({
        name: "待删除",
        schedule: { kind: "every", everyMs: 60000 },
        payload: { kind: "systemEvent", text: "Delete me" },
        sessionTarget: "main",
      });

      await cronManager.removeJob(job.id);
      
      const deleted = cronManager.getJob(job.id);
      expect(deleted).toBeUndefined();
    });

    it("应该能获取任务统计", () => {
      const stats = cronManager.getStats();
      expect(typeof stats.jobs).toBe("number");
      expect(typeof stats.activeReminders).toBe("number");
    });
  });

  describe("ReminderService", () => {
    it("应该能设置提醒", async () => {
      const reminder = await cronManager.setReminder({
        text: "测试提醒",
        triggerAt: Date.now() + 60000,
      });

      expect(reminder.id).toBeDefined();
      expect(reminder.text).toBe("测试提醒");
      expect(reminder.fired).toBe(false);
    });

    it("应该能列出活跃提醒", async () => {
      await cronManager.setReminder({
        text: "提醒1",
        triggerAt: Date.now() + 60000,
      });

      await cronManager.setReminder({
        text: "提醒2",
        triggerAt: Date.now() + 120000,
      });

      const reminders = cronManager.listReminders();
      expect(reminders).toHaveLength(2);
    });

    it("应该能取消提醒", async () => {
      const reminder = await cronManager.setReminder({
        text: "待取消",
        triggerAt: Date.now() + 60000,
      });

      await cronManager.cancelReminder(reminder.id);

      const reminders = cronManager.listReminders();
      expect(reminders).toHaveLength(0);
    });
  });

  describe("Job Validation", () => {
    it("应该拒绝无效的 cron 表达式", async () => {
      await expect(
        cronManager.createJob({
          name: "无效任务",
          schedule: { kind: "cron", expr: "invalid" },
          payload: { kind: "systemEvent", text: "Test" },
          sessionTarget: "main",
        })
      ).rejects.toThrow();
    });

    it("应该拒绝过期的一次性任务", async () => {
      await expect(
        cronManager.createJob({
          name: "过期任务",
          schedule: { kind: "at", at: new Date(Date.now() - 1000).toISOString() },
          payload: { kind: "systemEvent", text: "Test" },
          sessionTarget: "main",
        })
      ).rejects.toThrow();
    });
  });
});
