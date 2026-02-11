/**
 * v21-agent.ts - OpenClaw V21: 定时任务与提醒系统
 * 
 * V21 新增功能:
 * - cron_create: 创建定时任务
 * - cron_list: 列出所有任务
 * - cron_update: 更新任务
 * - cron_remove: 删除任务
 * - cron_run: 立即执行任务
 * - reminder_set: 设置一次性提醒
 * - reminder_list: 列出提醒
 * - reminder_cancel: 取消提醒
 * 
 * 完整实现见 v21-agent/ 目录
 */

export { 
  CronManager,
  ReminderService,
  getCronTools,
  createCronHandlers,
  type CronJob,
  type Reminder,
  type Schedule,
} from "./v21-agent/cron/index.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║           OpenClaw V21 - 定时任务与提醒系统               ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - cron_create:        创建定时任务                   ║
║    - cron_list:          列出所有任务                   ║
║    - cron_update:        更新任务                       ║
║    - cron_remove:        删除任务                       ║
║    - cron_run:           立即执行任务                   ║
║    - cron_runs:          获取任务运行历史               ║
║    - reminder_set:       设置一次性提醒                 ║
║    - reminder_list:      列出活跃提醒                   ║
║    - reminder_cancel:    取消提醒                       ║
║                                                           ║
║  核心能力:                                                ║
║    ✅ 类 Cron 表达式调度                                ║
║    ✅ 一次性/周期性任务                                 ║
║    ✅ 多类型任务 (systemEvent/agentTurn)                ║
║    ✅ 提醒与通知系统                                    ║
║    ✅ 任务执行历史追踪                                  ║
║                                                           ║
║  调度格式:                                                ║
║    - at:      { kind: "at", at: "ISO时间" }             ║
║    - every:   { kind: "every", everyMs: 3600000 }       ║
║    - cron:    { kind: "cron", expr: "0 9 * * *" }       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v21-agent/index.ts 启动完整系统");
  process.exit(0);
}
