/**
 * v21-agent/cron/tools.ts - 定时任务工具定义
 */

import type { Tool } from "../../v11-agent/types.js";

/** Cron 相关工具定义 */
export const cronTools: Tool[] = [
  {
    name: "cron_create",
    description: "创建一个新的定时任务。支持三种调度方式: at(一次性)、every(周期性)、cron(Cron表达式)",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "任务名称（可选）",
        },
        schedule: {
          type: "object",
          description: "调度配置",
          oneOf: [
            {
              type: "object",
              properties: {
                kind: { const: "at" },
                at: { type: "string", description: "ISO-8601 时间戳，如 2026-02-12T10:00:00Z" },
              },
              required: ["kind", "at"],
            },
            {
              type: "object",
              properties: {
                kind: { const: "every" },
                everyMs: { type: "number", description: "间隔毫秒数，如 3600000 = 1小时" },
                anchorMs: { type: "number", description: "可选起始时间偏移" },
              },
              required: ["kind", "everyMs"],
            },
            {
              type: "object",
              properties: {
                kind: { const: "cron" },
                expr: { type: "string", description: "Cron 表达式，如 '0 9 * * *' (每天9点)" },
                tz: { type: "string", description: "可选时区，如 'Asia/Shanghai'" },
              },
              required: ["kind", "expr"],
            },
          ],
        },
        payload: {
          type: "object",
          description: "任务执行内容",
          oneOf: [
            {
              type: "object",
              properties: {
                kind: { const: "systemEvent" },
                text: { type: "string", description: "要注入的系统事件文本" },
              },
              required: ["kind", "text"],
            },
            {
              type: "object",
              properties: {
                kind: { const: "agentTurn" },
                message: { type: "string", description: "要执行的任务描述" },
                model: { type: "string", description: "可选指定模型" },
                thinking: { type: "string", description: "可选思考模式配置" },
                timeoutSeconds: { type: "number", description: "可选超时时间" },
              },
              required: ["kind", "message"],
            },
          ],
        },
        sessionTarget: {
          type: "string",
          enum: ["main", "isolated"],
          description: "执行目标：main(主会话) 或 isolated(隔离会话)",
        },
        enabled: {
          type: "boolean",
          description: "是否启用，默认为 true",
        },
      },
      required: ["schedule", "payload", "sessionTarget"],
    },
  },
  {
    name: "cron_list",
    description: "列出所有定时任务，包括任务ID、名称、调度、状态、下次执行时间等",
    input_schema: {
      type: "object",
      properties: {
        includeDisabled: {
          type: "boolean",
          description: "是否包含已禁用的任务，默认为 true",
        },
      },
    },
  },
  {
    name: "cron_update",
    description: "更新现有任务的配置，如修改调度时间、禁用/启用任务",
    input_schema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "要更新的任务ID",
        },
        name: {
          type: "string",
          description: "新的任务名称",
        },
        schedule: {
          type: "object",
          description: "新的调度配置（格式同 cron_create）",
        },
        enabled: {
          type: "boolean",
          description: "启用或禁用任务",
        },
      },
      required: ["jobId"],
    },
  },
  {
    name: "cron_remove",
    description: "删除一个定时任务及其运行历史",
    input_schema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "要删除的任务ID",
        },
      },
      required: ["jobId"],
    },
  },
  {
    name: "cron_run",
    description: "立即触发执行一个定时任务（不影响正常调度）",
    input_schema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "要执行的任务ID",
        },
      },
      required: ["jobId"],
    },
  },
  {
    name: "cron_runs",
    description: "获取任务的运行历史记录",
    input_schema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "任务ID",
        },
        limit: {
          type: "number",
          description: "返回的最大记录数，默认 10",
        },
      },
      required: ["jobId"],
    },
  },
];

/** 提醒相关工具定义 */
export const reminderTools: Tool[] = [
  {
    name: "reminder_set",
    description: "设置一个一次性提醒，在指定时间触发",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "提醒内容",
        },
        triggerAt: {
          type: "string",
          description: "ISO-8601 触发时间，如 2026-02-12T10:00:00Z",
        },
        channel: {
          type: "string",
          description: "可选，发送到的渠道",
        },
        target: {
          type: "string",
          description: "可选，目标用户或会话",
        },
      },
      required: ["text", "triggerAt"],
    },
  },
  {
    name: "reminder_list",
    description: "列出所有提醒",
    input_schema: {
      type: "object",
      properties: {
        includeFired: {
          type: "boolean",
          description: "是否包含已触发的提醒，默认为 false",
        },
      },
    },
  },
  {
    name: "reminder_cancel",
    description: "取消一个提醒",
    input_schema: {
      type: "object",
      properties: {
        reminderId: {
          type: "string",
          description: "提醒ID",
        },
      },
      required: ["reminderId"],
    },
  },
];

/** 获取所有 Cron 相关工具 */
export function getCronTools(): Tool[] {
  return [...cronTools, ...reminderTools];
}
