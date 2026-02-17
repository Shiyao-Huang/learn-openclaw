/**
 * V37: 系统工具集 - 工具定义
 */

import type { Tool } from "../types.js";

export const SYS_TOOLS: Tool[] = [
  // 剪贴板工具
  {
    name: "sys_clipboard_copy",
    description: "将文本复制到系统剪贴板",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "要复制的文本内容",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "sys_clipboard_paste",
    description: "从系统剪贴板读取文本",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // 系统摘要工具
  {
    name: "sys_os_info",
    description: "获取操作系统信息（平台、架构、版本、内存等）",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sys_hostname",
    description: "获取主机名",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sys_network_info",
    description: "获取网络信息（IP地址等）",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sys_uptime",
    description: "获取系统运行时间",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // 系统存在工具
  {
    name: "sys_presence_get",
    description: "获取当前节点的存在信息",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sys_presence_list",
    description: "列出所有已知节点的存在信息",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sys_presence_update",
    description: "更新节点存在信息",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "存在状态文本",
        },
        deviceId: {
          type: "string",
          description: "设备 ID",
        },
        host: {
          type: "string",
          description: "主机名",
        },
        ip: {
          type: "string",
          description: "IP 地址",
        },
        version: {
          type: "string",
          description: "版本号",
        },
        mode: {
          type: "string",
          description: "运行模式",
        },
        reason: {
          type: "string",
          description: "原因",
        },
        roles: {
          type: "array",
          items: { type: "string" },
          description: "角色列表",
        },
      },
      required: ["text"],
    },
  },
];

export const SYS_TOOL_COUNT = SYS_TOOLS.length;
