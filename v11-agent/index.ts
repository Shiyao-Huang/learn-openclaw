#!/usr/bin/env tsx
/**
 * v11-agent/index.ts - OpenClaw V11 模块化入口
 * 
 * 核心功能：
 * - 多渠道接入（飞书、Telegram、Discord）
 * - 自动消息处理（消息 → 会话 → chat → 回复）
 * - 分层记忆系统
 * - 会话隔离
 * - 内省追踪
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// 模块导入
import { MemoryManager } from "./memory/index.js";
import { SessionManager } from "./session/manager.js";
import { ChannelManager } from "./channel/index.js";
import { IdentitySystem } from "./identity/system.js";
import { IntrospectionTracker } from "./introspect/tracker.js";
import { ClawLoader } from "./claw/loader.js";
import { tools, createExecutor } from "./tools/index.js";
import { MessageDeduplicator } from "./utils/dedup.js";

// 加载 .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env'), override: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("\x1b[31m错误: 未设置 ANTHROPIC_API_KEY\x1b[0m");
  process.exit(1);
}

// ============================================================================
// 配置
// ============================================================================

const config = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
  model: process.env.MODEL_ID || "claude-sonnet-4-20250514",
  maxTokens: parseInt(process.env.MAX_TOKENS || "8192", 10),
  bashTimeout: parseInt(process.env.BASH_TIMEOUT || "30000", 10),
  workDir: process.env.WORK_DIR || rootDir,
  clawDir: process.env.CLAW_DIR || path.join(rootDir, "claws"),
  identityDir: process.env.IDENTITY_DIR || rootDir,
  idSampleDir: process.env.ID_SAMPLE_DIR || path.join(rootDir, ".ID.sample"),
};

// ============================================================================
// 初始化系统组件
// ============================================================================

const client = new Anthropic({
  apiKey: config.apiKey,
  baseURL: config.baseURL,
});

// ============================================================================
// Token 统计
// ============================================================================

interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  sessionStart: Date;
}

const tokenStats: TokenStats = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  requestCount: 0,
  sessionStart: new Date(),
};

function updateTokenStats(usage: { input_tokens: number; output_tokens: number }) {
  tokenStats.inputTokens += usage.input_tokens;
  tokenStats.outputTokens += usage.output_tokens;
  tokenStats.totalTokens += usage.input_tokens + usage.output_tokens;
  tokenStats.requestCount++;
}

function getTokenStatsReport(): string {
  const elapsed = (Date.now() - tokenStats.sessionStart.getTime()) / 1000;
  const tokensPerSecond = elapsed > 0 ? (tokenStats.totalTokens / elapsed).toFixed(1) : "0";
  return `📊 Token 统计:
  - 输入: ${tokenStats.inputTokens.toLocaleString()} tokens
  - 输出: ${tokenStats.outputTokens.toLocaleString()} tokens
  - 总计: ${tokenStats.totalTokens.toLocaleString()} tokens
  - 请求数: ${tokenStats.requestCount}
  - 平均速率: ${tokensPerSecond} tokens/s
  - 会话时长: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`;
}

const memoryManager = new MemoryManager(config.workDir);
const sessionManager = new SessionManager(config.workDir);
const channelManager = new ChannelManager(config.workDir);
const identitySystem = new IdentitySystem(config.identityDir, config.idSampleDir);
const introspection = new IntrospectionTracker(config.workDir);
const clawLoader = new ClawLoader(config.clawDir);

// 加载身份
identitySystem.load();

// 创建工具执行器
const executeTool = createExecutor({
  workDir: config.workDir,
  bashTimeout: config.bashTimeout,
  memoryManager,
  sessionManager,
  channelManager,
  identitySystem,
  introspection,
  clawLoader,
});

// ============================================================================
// 构建 System Prompt
// ============================================================================

function buildSystemPrompt(): string {
  const parts: string[] = [];
  
  // 身份信息
  const identity = identitySystem.getSummary();
  if (identity) {
    parts.push(identity);
  }
  
  // 已加载的 Claw
  const clawContent = clawLoader.getLoadedContent();
  if (clawContent) {
    parts.push(clawContent);
  }
  
  // 时间上下文
  const now = new Date();
  const timeContext = `当前时间: ${now.toLocaleString("zh-CN", { 
    timeZone: "Asia/Shanghai",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
  parts.push(timeContext);

  // 系统注意事项
  parts.push(`## 重要提醒
- macOS 环境：grep 不支持 -P (Perl正则)，请用 grep -E 或 egrep
- 记忆工具：用户说"记住"时，使用 daily_write 或 longterm_append，不要用 bash
- 搜索记忆：用 memory_search_all 搜索，不要用 bash grep
- 重要：读写大文件时，必须使用分段操作。读取大文件时使用 offset/limit 参数分段读取；写入大文件时分多次小编辑完成，每次不超过 5000 字符。

## 任务规划
- 复杂任务先用 TodoWrite 创建任务列表，分解步骤
- 每完成一步更新任务状态 (pending → in_progress → completed)
- 任务列表帮助你追踪进度，也让用户看到你的计划`);

  // 可用 Claw
  const clawList = clawLoader.list();
  if (clawList !== "无可用技能") {
    parts.push(`\n## 可用技能\n${clawList}`);
  }
  
  return parts.join("\n\n");
}

// ============================================================================
// Chat 函数
// ============================================================================

async function chat(
  input: string,
  history: Anthropic.MessageParam[] = []
): Promise<string> {
  // 自动加载相关 Claw
  clawLoader.autoLoad(input);

  const systemPrompt = buildSystemPrompt();
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: input }
  ];

  // 构建请求
  const request: Anthropic.MessageCreateParamsNonStreaming = {
    model: config.model,
    max_tokens: config.maxTokens,
    system: [{ type: "text" as const, text: systemPrompt }],
    tools: tools as Anthropic.Tool[],
    messages,
  };

  // 记录请求日志
  const logDir = path.join(config.workDir, "logs");
  if (!fs.existsSync(logDir)) await fsp.mkdir(logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(logDir, `request-${timestamp}.json`);
  await fsp.writeFile(logFile, JSON.stringify(request, null, 2));
  console.log(`\x1b[90m[LOG] ${logFile}\x1b[0m`);

  let response = await client.messages.create(request);
  updateTokenStats(response.usage);

  // 工具调用循环
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      console.log(`\x1b[33m[Tool] ${toolUse.name}\x1b[0m`);
      const result = await executeTool(toolUse.name, toolUse.input as Record<string, any>);
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: [{ type: "text" as const, text: systemPrompt }],
      tools: tools as Anthropic.Tool[],
      messages,
    });
    updateTokenStats(response.usage);
  }
  
  // 提取文本响应
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  
  return textBlocks.map(b => b.text).join("\n");
}

// ============================================================================
// 注册渠道插件
// ============================================================================

async function registerPlugins() {
  try {
    // 动态导入飞书插件
    const { FeishuChannel } = await import('../plug/feishu/index.js');
    channelManager.register(new FeishuChannel());
    console.log('\x1b[32m[Plugin] 飞书插件已加载\x1b[0m');
  } catch (e: any) {
    console.log(`\x1b[33m[Plugin] 飞书插件加载失败: ${e.message}\x1b[0m`);
  }
  
  // 可以添加更多插件...
}

// ============================================================================
// 主入口
// ============================================================================

async function main() {
  // 注册插件
  await registerPlugins();

  // 分离的对话历史：控制台和各渠道独立
  const consoleHistory: Anthropic.MessageParam[] = [];
  const channelHistories: Map<string, Anthropic.MessageParam[]> = new Map();

  // 获取或创建渠道会话历史
  function getChannelHistory(chatId: string): Anthropic.MessageParam[] {
    if (!channelHistories.has(chatId)) {
      channelHistories.set(chatId, []);
    }
    return channelHistories.get(chatId)!;
  }

  // 当前回复目标（用于飞书回复）
  let currentReplyTarget: { channel: string; chatId: string } | null = null;

  // 统一消息去重器
  const dedup = new MessageDeduplicator({ ttl: 60000 });

  // 处理输入的统一函数
  async function processInput(input: string, source: string, history: Anthropic.MessageParam[]): Promise<string> {
    console.log(`\x1b[35m[${source}] >> ${input}\x1b[0m`);

    try {
      const response = await chat(input, history);

      // 更新历史
      history.push({ role: "user", content: input });
      history.push({ role: "assistant", content: response });

      // 限制历史长度
      if (history.length > 40) {
        history.splice(0, 2);
      }

      return response;
    } catch (e: any) {
      const errorMsg = `错误: ${e.message}`;
      console.error(`\x1b[31m${errorMsg}\x1b[0m`);
      return errorMsg;
    }
  }

  // 直接绑定渠道消息处理（不使用 Router，直接进入主循环）
  channelManager.onMessage(async (ctx) => {
    // 使用统一去重器检查并获取锁
    const msgKey = MessageDeduplicator.generateKey(ctx);
    if (!dedup.acquire(msgKey)) {
      console.log(`\x1b[90m[去重] 跳过消息: ${msgKey.slice(0, 50)}\x1b[0m`);
      return;
    }

    try {
      const source = `${ctx.channel}:${ctx.userName || ctx.userId}`;
      currentReplyTarget = { channel: ctx.channel, chatId: ctx.chatId };

      // 使用该 chatId 独立的历史
      const history = getChannelHistory(ctx.chatId);
      const response = await processInput(ctx.text, source, history);

      // 自动回复到飞书
      if (response && response.trim() && response !== 'HEARTBEAT_OK') {
        try {
          await channelManager.send(ctx.channel, ctx.chatId, response);
          console.log(`\x1b[32m[${ctx.channel}] << ${response.slice(0, 100)}...\x1b[0m`);
        } catch (e: any) {
          console.error(`\x1b[31m[${ctx.channel}] 回复失败: ${e.message}\x1b[0m`);
        }
      }

      currentReplyTarget = null;
    } finally {
      dedup.release(msgKey);
    }
  });
  
  // 启动已启用的渠道
  const startResult = await channelManager.startAll();
  if (startResult !== '没有已启用的渠道') {
    console.log(`\x1b[32m[Channel] 启动结果:\n${startResult}\x1b[0m`);
  }
  
  // 交互式 REPL
  if (process.argv[2]) {
    // 单次执行模式
    const result = await processInput(process.argv[2], 'cli', consoleHistory);
    console.log(result);
  } else {
    // REPL 模式
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    console.log(`\nOpenClaw V11 - 模块化 Agent (${identitySystem.getName()})`);
    console.log(`${memoryManager.stats()} | ${sessionManager.stats()} | Claw: ${clawLoader.count} 个`);
    console.log(`控制台和飞书会话已分离，各自独立上下文`);
    console.log(`输入 'q' 退出 | '/stats' 查看 Token 统计\n`);

    const prompt = () => {
      rl.question("\x1b[36m>> \x1b[0m", async (input) => {
        const q = input.trim();

        if (q === "q" || q === "exit" || q === "quit") {
          console.log("再见！");
          console.log(getTokenStatsReport());
          await channelManager.stopAll();
          rl.close();
          return;
        }

        if (q === "/stats" || q === "/tokens") {
          console.log(getTokenStatsReport());
          prompt();
          return;
        }

        if (q === "") {
          prompt();
          return;
        }

        // 控制台使用独立的 consoleHistory
        const response = await processInput(q, 'console', consoleHistory);
        console.log(response);

        prompt();
      });
    };
    
    rl.on("close", () => {
      process.exit(0);
    });
    
    prompt();
  }
}

// 启动
main().catch(console.error);

// 导出供外部使用
export {
  chat,
  memoryManager,
  sessionManager,
  channelManager,
  identitySystem,
  introspection,
  clawLoader,
  config,
  tokenStats,
  getTokenStatsReport,
};
