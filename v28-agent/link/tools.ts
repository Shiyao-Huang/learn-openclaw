/**
 * V28: 链接理解系统 - 工具定义
 */

export const LINK_TOOLS = [
  {
    name: "link_extract",
    description: "从消息中提取 HTTP/HTTPS 链接",
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "要提取链接的消息文本",
        },
        maxLinks: {
          type: "number",
          description: "最大提取链接数 (默认 5)",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "link_fetch",
    description: "获取单个链接的内容",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "要获取的 URL",
        },
        timeoutSeconds: {
          type: "number",
          description: "超时时间 (秒, 默认 30)",
        },
        format: {
          type: "string",
          enum: ["text", "markdown"],
          description: "返回格式 (默认 text)",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "link_batch_fetch",
    description: "批量获取多个链接的内容",
    input_schema: {
      type: "object",
      properties: {
        urls: {
          type: "array",
          items: { type: "string" },
          description: "要获取的 URL 列表",
        },
        timeoutSeconds: {
          type: "number",
          description: "每个请求的超时时间 (秒)",
        },
        concurrency: {
          type: "number",
          description: "并发数 (默认 3)",
        },
      },
      required: ["urls"],
    },
  },
  {
    name: "link_status",
    description: "获取链接理解系统的状态",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "link_clear_cache",
    description: "清除链接内容缓存",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "要清除的 URL (不提供则清除全部)",
        },
      },
      required: [],
    },
  },
  {
    name: "link_validate",
    description: "验证 URL 是否有效和安全",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "要验证的 URL",
        },
      },
      required: ["url"],
    },
  },
];

export const LINK_TOOL_COUNT = LINK_TOOLS.length;
