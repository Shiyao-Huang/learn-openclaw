/**
 * V31 - 投票系统工具定义
 */

import type { Tool } from "../../v10-agent/types.js";

export const POLL_TOOLS: Tool[] = [
  {
    name: "poll_create",
    description: "创建一个新投票。支持单选、多选、限时、匿名等配置",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "投票问题",
          maxLength: 200,
        },
        options: {
          type: "array",
          items: { type: "string" },
          description: "选项列表 (2-10个)",
          minItems: 2,
          maxItems: 10,
        },
        maxSelections: {
          type: "number",
          description: "最大可选数量 (默认 1)",
          minimum: 1,
        },
        durationHours: {
          type: "number",
          description: "持续时间 (小时, 默认 24)",
          minimum: 0,
        },
        anonymous: {
          type: "boolean",
          description: "是否匿名投票 (默认 false)",
        },
        allowChange: {
          type: "boolean",
          description: "是否允许修改投票 (默认 true)",
        },
      },
      required: ["question", "options"],
    },
  },
  {
    name: "poll_vote",
    description: "在投票中选择选项。可以修改已有投票 (如果允许)",
    inputSchema: {
      type: "object",
      properties: {
        pollId: {
          type: "string",
          description: "投票 ID",
        },
        optionIds: {
          type: "array",
          items: { type: "string" },
          description: "选择的选项 ID 列表",
          minItems: 1,
        },
      },
      required: ["pollId", "optionIds"],
    },
  },
  {
    name: "poll_get",
    description: "获取投票详情",
    inputSchema: {
      type: "object",
      properties: {
        pollId: {
          type: "string",
          description: "投票 ID",
        },
      },
      required: ["pollId"],
    },
  },
  {
    name: "poll_result",
    description: "获取投票结果统计",
    inputSchema: {
      type: "object",
      properties: {
        pollId: {
          type: "string",
          description: "投票 ID",
        },
      },
      required: ["pollId"],
    },
  },
  {
    name: "poll_close",
    description: "关闭投票 (仅创建者可操作)",
    inputSchema: {
      type: "object",
      properties: {
        pollId: {
          type: "string",
          description: "投票 ID",
        },
      },
      required: ["pollId"],
    },
  },
  {
    name: "poll_cancel",
    description: "取消投票 (仅创建者可操作)",
    inputSchema: {
      type: "object",
      properties: {
        pollId: {
          type: "string",
          description: "投票 ID",
        },
      },
      required: ["pollId"],
    },
  },
  {
    name: "poll_list",
    description: "列出投票",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "closed", "cancelled"],
          description: "状态过滤",
        },
        creator: {
          type: "string",
          description: "创建者过滤",
        },
        limit: {
          type: "number",
          description: "返回数量限制",
          minimum: 1,
          maximum: 100,
        },
      },
    },
  },
  {
    name: "poll_stats",
    description: "获取投票系统统计",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "poll_delete",
    description: "删除投票",
    inputSchema: {
      type: "object",
      properties: {
        pollId: {
          type: "string",
          description: "投票 ID",
        },
      },
      required: ["pollId"],
    },
  },
  {
    name: "poll_check_expired",
    description: "检查并关闭过期投票",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export const POLL_TOOL_COUNT = POLL_TOOLS.length;
