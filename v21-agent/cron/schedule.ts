/**
 * v21-agent/cron/schedule.ts - 调度解析与计算
 */

import type { Schedule, AtSchedule, EverySchedule, CronSchedule } from "./types.js";

/**
 * 计算下一次执行时间
 */
export function getNextRunTime(schedule: Schedule, fromTime: number = Date.now()): number | undefined {
  switch (schedule.kind) {
    case "at": {
      const at = new Date(schedule.at).getTime();
      return at > fromTime ? at : undefined;
    }
    case "every": {
      const anchor = schedule.anchorMs || 0;
      const elapsed = fromTime - anchor;
      const periods = Math.floor(elapsed / schedule.everyMs) + 1;
      return anchor + periods * schedule.everyMs;
    }
    case "cron": {
      return parseCronNextRun(schedule.expr, schedule.tz, fromTime);
    }
    default:
      return undefined;
  }
}

/**
 * 简单 Cron 解析器（支持基础表达式）
 * 格式: "分 时 日 月 周"
 * 示例: "0 9 * * *" (每天9点), "*/30 * * * *" (每30分钟)
 */
function parseCronNextRun(expr: string, tz?: string, fromTime: number = Date.now()): number {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${expr}`);
  }

  const [minuteExpr, hourExpr, dayExpr, monthExpr, weekdayExpr] = parts;
  
  const date = new Date(fromTime);
  date.setSeconds(0, 0);
  
  // 简单实现：增加一分钟并检查匹配
  for (let i = 0; i < 366 * 24 * 60; i++) {
    date.setMinutes(date.getMinutes() + 1);
    
    if (matchCronField(date.getMinutes(), minuteExpr) &&
        matchCronField(date.getHours(), hourExpr) &&
        matchCronField(date.getDate(), dayExpr) &&
        matchCronField(date.getMonth() + 1, monthExpr) &&
        matchCronField(date.getDay(), weekdayExpr)) {
      return date.getTime();
    }
  }
  
  return fromTime + 24 * 60 * 60 * 1000; // 默认返回24小时后
}

/**
 * 匹配 Cron 字段
 */
function matchCronField(value: number, expr: string): boolean {
  if (expr === "*") return true;
  
  // 处理步长: */30
  if (expr.startsWith("*/")) {
    const step = parseInt(expr.slice(2), 10);
    return value % step === 0;
  }
  
  // 处理范围: 9-17
  if (expr.includes("-")) {
    const [start, end] = expr.split("-").map(Number);
    return value >= start && value <= end;
  }
  
  // 处理列表: 1,3,5
  if (expr.includes(",")) {
    const values = expr.split(",").map(Number);
    return values.includes(value);
  }
  
  // 单一值
  return value === parseInt(expr, 10);
}

/**
 * 获取人类可读的调度描述
 */
export function getScheduleDescription(schedule: Schedule): string {
  switch (schedule.kind) {
    case "at": {
      const date = new Date(schedule.at);
      return `一次性于 ${date.toLocaleString()}`;
    }
    case "every": {
      const ms = schedule.everyMs;
      if (ms < 60000) return `每 ${ms / 1000} 秒`;
      if (ms < 3600000) return `每 ${Math.floor(ms / 60000)} 分钟`;
      if (ms < 86400000) return `每 ${Math.floor(ms / 3600000)} 小时`;
      return `每 ${Math.floor(ms / 86400000)} 天`;
    }
    case "cron": {
      return `Cron: ${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ""}`;
    }
    default:
      return "未知调度";
  }
}

/**
 * 检查一次性任务是否已过期
 */
export function isOneTimeJobExpired(job: { schedule: Schedule; lastRunAt?: number }): boolean {
  if (job.schedule.kind !== "at") return false;
  if (job.lastRunAt) return true;
  const at = new Date((job.schedule as AtSchedule).at).getTime();
  return at < Date.now();
}
