/**
 * V26: Canvas 显示系统 - 工具定义
 */

import type { Tool } from "../../v11-agent/types.js";

/** Canvas 工具列表 */
export function getCanvasTools(): Tool[] {
  return [
    {
      name: "canvas_present",
      description: `展示 Canvas 内容 (URL 或 HTML)

用途:
- 展示 HTML 页面
- 打开指定 URL
- 创建交互式 UI 界面

参数:
- content: URL 或 HTML 内容
- contentType: 'url' | 'html'
- title: 可选标题
- width/height: 可选尺寸

示例:
1. 展示 HTML: { content: "<html>...</html>", contentType: "html" }
2. 打开 URL: { content: "https://example.com", contentType: "url" }`,
      input_schema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "URL 或 HTML 内容",
          },
          contentType: {
            type: "string",
            enum: ["url", "html"],
            description: "内容类型",
          },
          title: {
            type: "string",
            description: "标题",
          },
          x: {
            type: "number",
            description: "X 坐标",
          },
          y: {
            type: "number",
            description: "Y 坐标",
          },
          width: {
            type: "number",
            description: "宽度",
          },
          height: {
            type: "number",
            description: "高度",
          },
        },
        required: ["content", "contentType"],
      },
    },
    {
      name: "canvas_navigate",
      description: `导航到指定 URL

用途:
- 在 Canvas 中打开新 URL
- 页面跳转

参数:
- url: 目标 URL
- waitMs: 等待时间 (毫秒)

示例:
{ url: "https://example.com", waitMs: 1000 }`,
      input_schema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "目标 URL",
          },
          waitMs: {
            type: "number",
            description: "等待时间 (毫秒)",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "canvas_eval",
      description: `在 Canvas 中执行 JavaScript 代码

用途:
- 执行页面脚本
- 获取页面数据
- 操作 DOM

参数:
- code: JavaScript 代码
- timeout: 超时时间 (毫秒)

示例:
1. 获取标题: { code: "document.title" }
2. 点击元素: { code: "document.querySelector('#btn').click()" }`,
      input_schema: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "JavaScript 代码",
          },
          timeout: {
            type: "number",
            description: "超时时间 (毫秒)",
          },
        },
        required: ["code"],
      },
    },
    {
      name: "canvas_snapshot",
      description: `截取 Canvas 快照

用途:
- 截取页面截图
- 保存为图片文件
- 支持全页面或元素截图

参数:
- format: 'png' | 'jpeg' (默认 png)
- fullPage: 是否全页面 (默认 false)
- selector: 选择器 (截取特定元素)
- maxWidth: 最大宽度
- quality: JPEG 质量 (1-100)
- outputPath: 输出路径

示例:
1. 全页面截图: { fullPage: true }
2. 元素截图: { selector: "#chart", format: "png" }`,
      input_schema: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["png", "jpeg"],
            description: "输出格式",
          },
          fullPage: {
            type: "boolean",
            description: "是否全页面",
          },
          selector: {
            type: "string",
            description: "元素选择器",
          },
          maxWidth: {
            type: "number",
            description: "最大宽度",
          },
          quality: {
            type: "number",
            description: "JPEG 质量 (1-100)",
          },
          outputPath: {
            type: "string",
            description: "输出路径",
          },
        },
      },
    },
    {
      name: "canvas_hide",
      description: `隐藏 Canvas

用途:
- 隐藏当前展示的内容
- 可选择关闭服务器

参数:
- shutdown: 是否关闭服务器 (默认 false)

示例:
1. 隐藏: { }
2. 关闭: { shutdown: true }`,
      input_schema: {
        type: "object",
        properties: {
          shutdown: {
            type: "boolean",
            description: "是否关闭服务器",
          },
        },
      },
    },
    {
      name: "canvas_status",
      description: `获取 Canvas 状态

用途:
- 检查服务器是否运行
- 获取当前 URL 和标题
- 查看连接数和截图数量

返回:
- running: 是否运行中
- currentUrl: 当前 URL
- title: 页面标题
- port: 端口
- connections: 活跃连接数
- screenshotCount: 截图数量`,
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "canvas_history",
      description: `获取 Canvas 操作历史

用途:
- 查看历史操作记录
- 调试和追踪

参数:
- limit: 返回数量限制 (默认 100)`,
      input_schema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "返回数量限制",
          },
        },
      },
    },
    {
      name: "canvas_screenshots",
      description: `获取截图历史列表

用途:
- 查看所有截图记录
- 获取截图文件路径

返回:
截图记录列表，包含 id, path, width, height, format, size 等`,
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "canvas_clear",
      description: `清除 Canvas 历史记录

用途:
- 清除操作历史
- 清除截图记录`,
      input_schema: {
        type: "object",
        properties: {},
      },
    },
  ];
}

/** Canvas 工具数量 */
export const CANVAS_TOOL_COUNT = 9;
