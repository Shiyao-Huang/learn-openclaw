/**
 * tools/definitions.ts - 工具定义
 */

import type { ToolDefinition } from "../core/types.js";

export const tools: ToolDefinition[] = [
  // 基础工具
  {
    name: "bash",
    description: "执行 shell 命令",
    input_schema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"]
    }
  },
  {
    name: "read_file",
    description: "读取文件内容",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        limit: { type: "number", description: "最大行数" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "写入文件内容",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "edit_file",
    description: "精确编辑文件",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" }
      },
      required: ["path", "old_text", "new_text"]
    }
  },
  {
    name: "grep",
    description: "搜索文件内容",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string" },
        recursive: { type: "boolean" }
      },
      required: ["pattern", "path"]
    }
  },
  
  // 记忆工具
  {
    name: "memory_search",
    description: "语义搜索长期记忆",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        max_results: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "daily_write",
    description: "写入今日日记",
    input_schema: {
      type: "object",
      properties: { content: { type: "string" } },
      required: ["content"]
    }
  },
  {
    name: "daily_read",
    description: "读取某天的日记",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD 格式" } }
    }
  },
  {
    name: "daily_recent",
    description: "读取最近几天的日记",
    input_schema: {
      type: "object",
      properties: { days: { type: "number" } }
    }
  },
  {
    name: "longterm_read",
    description: "读取长期记忆 (MEMORY.md)",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "longterm_append",
    description: "追加到长期记忆的某个分类",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", description: "分类名" },
        content: { type: "string" }
      },
      required: ["section", "content"]
    }
  },
  {
    name: "memory_search_all",
    description: "搜索所有记忆（日记 + 长期记忆）",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"]
    }
  },
  
  // 会话工具
  {
    name: "session_list",
    description: "列出所有会话",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "session_cleanup",
    description: "清理过期会话",
    input_schema: { type: "object", properties: {} }
  },
  
  // 渠道工具
  {
    name: "channel_list",
    description: "列出所有已注册渠道",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "channel_send",
    description: "向指定渠道发送消息",
    input_schema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        target: { type: "string" },
        message: { type: "string" }
      },
      required: ["channel", "target", "message"]
    }
  },
  {
    name: "channel_status",
    description: "查看渠道状态",
    input_schema: {
      type: "object",
      properties: { channel: { type: "string" } }
    }
  },
  {
    name: "channel_config",
    description: "配置渠道参数",
    input_schema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        enabled: { type: "boolean" },
        groupPolicy: { type: "string", enum: ["all", "mention-only", "disabled"] },
        dmPolicy: { type: "string", enum: ["all", "allowlist", "disabled"] },
        trustedUsers: { type: "array", items: { type: "string" } }
      },
      required: ["channel"]
    }
  },
  {
    name: "channel_start",
    description: "启动所有已启用的渠道",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "channel_stop",
    description: "停止所有渠道",
    input_schema: { type: "object", properties: {} }
  },
  
  // 身份工具
  {
    name: "identity_load",
    description: "重新加载身份信息",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "identity_get",
    description: "获取当前身份摘要",
    input_schema: { type: "object", properties: {} }
  },
  
  // 内省工具
  {
    name: "introspect_stats",
    description: "查看行为统计（工具使用频率、响应时间等）",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "introspect_patterns",
    description: "分析行为模式（识别重复的工具链、时间分布等）",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "introspect_reflect",
    description: "生成自我反思报告（综合分析行为、模式和改进建议）",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "introspect_logs",
    description: "查看当前会话的行为日志",
    input_schema: { type: "object", properties: {} }
  },
  
  // Skill 工具
  {
    name: "Skill",
    description: "加载领域技能",
    input_schema: {
      type: "object",
      properties: { skill: { type: "string" } },
      required: ["skill"]
    }
  },
  
  // 任务规划
  {
    name: "TodoWrite",
    description: "更新任务列表",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"] },
              activeForm: { type: "string" }
            },
            required: ["content", "status"]
          }
        }
      },
      required: ["items"]
    }
  },
  
  // V17: Web 工具
  {
    name: "web_fetch",
    description: "Fetch and extract readable content from a URL (HTML → markdown/text). Use for lightweight page access without browser automation.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "HTTP or HTTPS URL to fetch." },
        extractMode: { 
          type: "string", 
          enum: ["markdown", "text"],
          description: 'Extraction mode ("markdown" or "text").',
          default: "markdown"
        },
        maxChars: { 
          type: "number", 
          description: "Maximum characters to return (truncates when exceeded).",
          minimum: 100
        }
      },
      required: ["url"]
    }
  },
  {
    name: "web_search",
    description: "Search the web using Brave Search API. Supports region-specific and localized search via country and language parameters.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string." },
        count: { 
          type: "number", 
          description: "Number of results to return (1-10).",
          minimum: 1,
          maximum: 10,
          default: 5
        },
        country: { 
          type: "string", 
          description: "2-letter country code for region-specific results (e.g., 'DE', 'US', 'ALL'). Default: 'US'."
        },
        search_lang: { 
          type: "string", 
          description: "ISO language code for search results (e.g., 'de', 'en', 'fr')."
        },
        freshness: { 
          type: "string", 
          description: "Filter results by discovery time (Brave only). Values: 'pd' (past 24h), 'pw' (past week), 'pm' (past month), 'py' (past year)."
        }
      },
      required: ["query"]
    }
  },
];
