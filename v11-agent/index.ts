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
import { SkillLoader } from "./skills/index.js";
import { tools, createExecutor } from "./tools/index.js";
import { MessageDeduplicator } from "./utils/dedup.js";
import { createSessionLogger, SessionLogger } from "./utils/logger.js";

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
  skillsDir: process.env.SKILLS_DIR || path.join(rootDir, "skills"),
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
// 日志系统（包含 Token 统计）
// ============================================================================

const logger = createSessionLogger(config.workDir, 60000); // 每分钟自动保存

const memoryManager = new MemoryManager(config.workDir);
const sessionManager = new SessionManager(config.workDir);
const channelManager = new ChannelManager(config.workDir);
const identitySystem = new IdentitySystem(config.identityDir, config.idSampleDir);
const introspection = new IntrospectionTracker(config.workDir);
const skillLoader = new SkillLoader(config.skillsDir);

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
  skillLoader,
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
  history: Anthropic.MessageParam[] = [],
  channel: string = "console",
  chatId: string = "default"
): Promise<string> {
  // 开始对话日志
  const convIndex = logger.startConversation(channel, chatId, input);

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
  logger.logRequestLog(logFile);

  let response = await client.messages.create(request);
  logger.updateTokens(response.usage);
  logger.updateConversation(convIndex, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  // 工具调用循环
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolArgs = toolUse.input as Record<string, any>;
      logger.logToolCall(toolUse.name, toolArgs);
      logger.addToolCall(convIndex, toolUse.name);
      logger.incrementToolCalls();

      // 如果是 TodoWrite，更新 Todo 追踪
      if (toolUse.name === "TodoWrite" && toolArgs.todos) {
        logger.updateTodos(toolArgs.todos.map((t: any, i: number) => ({
          id: String(i + 1),
          content: t.content || t.task || "",
          status: t.status || "pending",
        })));
        logger.logTodoStatusBar();
      }

      const result = await executeTool(toolUse.name, toolArgs);
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
    logger.updateTokens(response.usage);
    logger.updateConversation(convIndex, {
      inputTokens: (logger.getTokenStats().inputTokens),
      outputTokens: (logger.getTokenStats().outputTokens),
    });
  }
  
  // 提取文本响应
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );

  const responseText = textBlocks.map(b => b.text).join("\n");
  logger.endConversation(convIndex, responseText);

  return responseText;
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
  async function processInput(input: string, source: string, history: Anthropic.MessageParam[], channel: string = "console", chatId: string = "default"): Promise<string> {
    if (source === "console") {
      logger.logConsoleInput(input);
    }

    try {
      const response = await chat(input, history, channel, chatId);

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
      logger.logError(errorMsg);
      return errorMsg;
    }
  }

  // 直接绑定渠道消息处理（不使用 Router，直接进入主循环）
  channelManager.onMessage(async (ctx) => {
    // 使用统一去重器检查并获取锁
    const msgKey = MessageDeduplicator.generateKey(ctx);
    if (!dedup.acquire(msgKey)) {
      logger.logDedup(msgKey);
      return;
    }

    try {
      // 记录接收消息
      logger.logChannelReceive(ctx.channel, ctx.userId, ctx.text);

      currentReplyTarget = { channel: ctx.channel, chatId: ctx.chatId };

      // 使用该 chatId 独立的历史
      const history = getChannelHistory(ctx.chatId);
      const response = await processInput(ctx.text, `${ctx.channel}:${ctx.userName || ctx.userId}`, history, ctx.channel, ctx.chatId);

      // 自动回复到飞书
      if (response && response.trim() && response !== 'HEARTBEAT_OK') {
        try {
          await channelManager.send(ctx.channel, ctx.chatId, response);
          logger.logChannelSend(ctx.channel, ctx.chatId, response);
        } catch (e: any) {
          logger.logError(`[${ctx.channel}] 回复失败: ${e.message}`);
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
    const result = await processInput(process.argv[2], 'cli', consoleHistory, 'console', 'cli');
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
    console.log(`输入 'q' 退出 | '/stats' Token | '/todo' 任务 | '/multi' 多行模式`);
    console.log(`提示: 粘贴多行内容时不会自动触发，按回车发送\n`);

    // 多行输入模式状态
    let multilineBuffer: string[] = [];
    let isMultilineMode = false;
    let isProcessing = false;
    
    // 处理输入的核心函数
    async function handleInput(rawInput: string): Promise<boolean> {
      const input = rawInput.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const trimmed = input.trim();
      
      // 多行模式：收集输入直到空行
      if (isMultilineMode) {
        if (trimmed === "" && multilineBuffer.length > 0) {
          // 空行结束多行模式
          const fullInput = multilineBuffer.join("\n").trim();
          multilineBuffer = [];
          isMultilineMode = false;
          
          if (fullInput) {
            isProcessing = true;
            const response = await processInput(fullInput, 'console', consoleHistory, 'console', 'repl');
            console.log(response);
            isProcessing = false;
          }
          return true; // 继续提示
        }
        
        multilineBuffer.push(input);
        return true; // 继续多行输入
      }
      
      // 检测是否开启多行模式（以 ``` 开头）
      if (trimmed.startsWith("```")) {
        isMultilineMode = true;
        multilineBuffer = [];
        const firstLine = trimmed.slice(3).trim();
        if (firstLine) {
          multilineBuffer.push(firstLine);
        }
        console.log("\x1b[33m[多行模式] 继续输入，空行结束\x1b[0m");
        return true;
      }
      
      // 命令处理
      if (trimmed === "q" || trimmed === "exit" || trimmed === "quit") {
        console.log(logger.getGoodbyeReport());
        await logger.dispose();
        await channelManager.stopAll();
        rl.close();
        return false;
      }

      if (trimmed === "/stats" || trimmed === "/tokens") {
        console.log(logger.getTokenStatsReport());
        return true;
      }

      if (trimmed === "/todo" || trimmed === "/todos") {
        logger.logTodoList();
        return true;
      }
      
      if (trimmed === "/multi" || trimmed === "/m") {
        isMultilineMode = true;
        multilineBuffer = [];
        console.log("\x1b[33m[多行模式] 输入你的内容，空行结束\x1b[0m");
        return true;
      }

      if (trimmed === "") {
        return true;
      }

      // 普通单行输入
      isProcessing = true;
      const response = await processInput(trimmed, 'console', consoleHistory, 'console', 'repl');
      console.log(response);
      isProcessing = false;
      return true;
    }
    
    // 显示提示符
    function showPrompt() {
      if (isMultilineMode) {
        process.stdout.write("\x1b[36m... \x1b[0m");
      } else {
        process.stdout.write("\x1b[36m>> \x1b[0m");
      }
    }
    
    // 使用 readline 的 'line' 事件，但添加一个防抖机制
    // 来检测粘贴的多行内容（快速连续的多行输入）
    let lineBuffer: string[] = [];
    let lineTimeout: NodeJS.Timeout | null = null;
    const PASTE_DELAY = 50; // 50ms 内连续输入视为粘贴
    
    rl.on('line', async (line: string) => {
      // 如果正在处理，直接添加到缓冲区
      if (isProcessing) {
        lineBuffer.push(line);
        return;
      }
      
      // 多行模式下，直接处理
      if (isMultilineMode) {
        const shouldContinue = await handleInput(line);
        if (shouldContinue) {
          showPrompt();
        }
        return;
      }
      
      // 添加到缓冲区
      lineBuffer.push(line);
      
      // 清除之前的定时器
      if (lineTimeout) {
        clearTimeout(lineTimeout);
      }
      
      // 设置新的定时器
      lineTimeout = setTimeout(async () => {
        // 检查是否是多行粘贴
        if (lineBuffer.length > 1) {
          // 多行粘贴，合并处理
          const fullInput = lineBuffer.join("\n").trim();
          lineBuffer = [];
          
          if (fullInput) {
            isProcessing = true;
            const response = await processInput(fullInput, 'console', consoleHistory, 'console', 'repl');
            console.log(response);
            isProcessing = false;
          }
        } else if (lineBuffer.length === 1) {
          // 单行输入
          const input = lineBuffer[0];
          lineBuffer = [];
          const shouldContinue = await handleInput(input);
          if (!shouldContinue) return;
        }
        
        showPrompt();
      }, PASTE_DELAY);
    });
    
    rl.on("close", () => {
      process.exit(0);
    });
    
    // 初始提示
    showPrompt();
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
  logger,
};
