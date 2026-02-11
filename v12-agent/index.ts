#!/usr/bin/env tsx
/**
 * v12-agent/index.ts - OpenClaw V12 模块化入口
 * 
 * V12 新增：安全策略系统
 * - 工具权限分级: safe/confirm/dangerous
 * - 上下文感知: 根据渠道/用户调整策略
 * - 审计日志: 记录所有敏感操作
 * - 敏感数据保护: 自动识别和遮蔽
 * 
 * 基于 V11 的模块化架构
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
import { tools as baseTools, createExecutor } from "./tools/index.js";
import { MessageDeduplicator } from "./utils/dedup.js";
import { createSessionLogger, SessionLogger } from "./utils/logger.js";

// V12 新增：安全模块
import { 
  SecuritySystem, 
  getSecurityTools, 
  createSecurityHandlers,
  TrustLevel 
} from "./security/index.js";

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

// 日志系统
const logger = createSessionLogger(config.workDir, 60000);

// 核心模块
const memoryManager = new MemoryManager(config.workDir);
const sessionManager = new SessionManager(config.workDir);
const channelManager = new ChannelManager(config.workDir);
const identitySystem = new IdentitySystem(config.identityDir, config.idSampleDir);
const introspection = new IntrospectionTracker(config.workDir);
const skillLoader = new SkillLoader(config.clawDir);

// V12 新增：安全系统
const securitySystem = new SecuritySystem(config.workDir);

// 加载身份
identitySystem.load();

// 合并工具列表
const tools = [...baseTools, ...getSecurityTools()];

// 创建安全工具处理器
const securityHandlers = createSecurityHandlers(securitySystem);

// 创建工具执行器（包装安全检查）
const baseExecutor = createExecutor({
  workDir: config.workDir,
  bashTimeout: config.bashTimeout,
  memoryManager,
  sessionManager,
  channelManager,
  identitySystem,
  introspection,
  skillLoader,
});

// 带安全检查的执行器
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  // 检查是否是安全工具
  if (name in securityHandlers) {
    return (securityHandlers as any)[name](args);
  }
  
  // 安全检查
  const permission = securitySystem.checkPermission(name, args);
  
  if (!permission.allowed) {
    securitySystem.audit({
      tool: name,
      args,
      decision: 'denied',
      reason: permission.reason,
    });
    return `[安全拒绝] ${permission.reason}`;
  }
  
  // 需要确认的操作
  if (permission.needsConfirm) {
    const confirmed = await securitySystem.requestConfirmation(name, args);
    if (!confirmed) {
      securitySystem.audit({
        tool: name,
        args,
        decision: 'denied',
        reason: '用户拒绝确认',
      });
      return '[安全拒绝] 用户拒绝确认危险操作';
    }
    securitySystem.audit({
      tool: name,
      args,
      decision: 'confirmed',
    });
  } else {
    securitySystem.audit({
      tool: name,
      args,
      decision: 'allowed',
    });
  }
  
  // 执行工具
  return baseExecutor(name, args);
}

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
  
  // 已加载的 Skills
  const skillContent = skillLoader.getLoadedContent();
  if (skillContent) {
    parts.push(skillContent);
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

  // V12 新增：安全上下文
  const securityContext = securitySystem.getContext();
  parts.push(`## 安全上下文
- 信任等级: ${securityContext.trustLevel}
- 渠道: ${securityContext.channel || '控制台'}
- 聊天类型: ${securityContext.chatType || '直接对话'}`);

  // 自动加载长期记忆关键信息
  const longTermMemory = memoryManager.longterm.read();
  if (longTermMemory && longTermMemory !== '长期记忆为空' && longTermMemory.length > 0) {
    const truncatedMemory = longTermMemory.length > 2000 
      ? longTermMemory.slice(0, 2000) + '\n\n...(记忆已截断，使用 longterm_read 查看完整内容)'
      : longTermMemory;
    parts.push(`## 长期记忆摘要\n${truncatedMemory}`);
  }

  // 系统注意事项
  parts.push(`## 重要提醒
- macOS 环境：grep 不支持 -P (Perl正则)，请用 grep -E 或 egrep
- 记忆工具：用户说"记住"时，使用 daily_write 或 longterm_append
- 搜索记忆：用 memory_search_all 搜索
- 安全系统：危险操作需要确认，群聊中部分工具被禁用
- 重要：读写大文件时，必须使用分段操作

## 任务规划
- 复杂任务先用 TodoWrite 创建任务列表
- 每完成一步更新任务状态`);

  // 可用 Skills
  const skillList = skillLoader.list();
  if (skillList !== "无可用技能") {
    parts.push(`\n## 可用技能\n${skillList}`);
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
  chatId: string = "default",
  userId?: string,
  chatType?: 'direct' | 'group'
): Promise<string> {
  // V12 新增：设置安全上下文
  securitySystem.setContext({
    channel,
    userId,
    chatType,
    trustLevel: determineTrustLevel(channel, userId, chatType),
  });

  // 开始对话日志
  const convIndex = logger.startConversation(channel, chatId, input);

  // 自动加载相关 Skills
  skillLoader.autoLoad(input);

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

  // 工具调用循環 (迭代上限防止无限循环)
  const MAX_TOOL_ITERATIONS = 50;
  let toolIterations = 0;

  while (response.stop_reason === "tool_use") {
    if (++toolIterations > MAX_TOOL_ITERATIONS) {
      console.warn(`\x1b[33m[安全] 工具调用次数超过 ${MAX_TOOL_ITERATIONS} 次上限，强制停止\x1b[0m`);
      break;
    }
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolArgs = toolUse.input as Record<string, any>;
      logger.logToolCall(toolUse.name, toolArgs);
      logger.addToolCall(convIndex, toolUse.name);
      logger.incrementToolCalls();

      // TodoWrite 追踪
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
// V12 新增：信任等级判断
// ============================================================================

function determineTrustLevel(
  channel: string, 
  userId?: string, 
  chatType?: 'direct' | 'group'
): TrustLevel {
  // 控制台 = owner
  if (channel === 'console') {
    return 'owner';
  }
  
  // 群聊 = normal
  if (chatType === 'group') {
    return 'normal';
  }
  
  // 私聊 = trusted（可以根据 userId 进一步细分）
  return 'trusted';
}

// ============================================================================
// 注册渠道插件
// ============================================================================

async function registerPlugins() {
  try {
    const { FeishuChannel } = await import('../plug/feishu/index.js');
    channelManager.register(new FeishuChannel());
    console.log('\x1b[32m[Plugin] 飞书插件已加载\x1b[0m');
  } catch (e: any) {
    console.log(`\x1b[33m[Plugin] 飞书插件加载失败: ${e.message}\x1b[0m`);
  }
}

// ============================================================================
// 主入口
// ============================================================================

async function main() {
  console.log('\x1b[36m╔════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║     OpenClaw V12 - 安全策略系统        ║\x1b[0m');
  console.log('\x1b[36m╚════════════════════════════════════════╝\x1b[0m');
  
  await registerPlugins();

  const consoleHistory: Anthropic.MessageParam[] = [];
  const channelHistories: Map<string, Anthropic.MessageParam[]> = new Map();

  function getChannelHistory(chatId: string): Anthropic.MessageParam[] {
    if (!channelHistories.has(chatId)) {
      channelHistories.set(chatId, []);
    }
    return channelHistories.get(chatId)!;
  }

  const dedup = new MessageDeduplicator({ ttl: 60000 });

  async function processInput(
    input: string, 
    source: string, 
    history: Anthropic.MessageParam[], 
    channel: string = "console", 
    chatId: string = "default",
    userId?: string,
    chatType?: 'direct' | 'group'
  ): Promise<string> {
    if (source === "console") {
      logger.logConsoleInput(input);
      
      // V12 新增：处理安全确认命令
      if (input.startsWith('confirm ')) {
        const id = input.slice(8).trim();
        if (securitySystem.handleConfirmation(id, true)) {
          return '已确认';
        }
        return '无效的确认 ID';
      }
      if (input.startsWith('deny ')) {
        const id = input.slice(5).trim();
        if (securitySystem.handleConfirmation(id, false)) {
          return '已拒绝';
        }
        return '无效的确认 ID';
      }
    }

    try {
      const response = await chat(input, history, channel, chatId, userId, chatType);
      
      if (source === "console") {
        history.push({ role: "user", content: input });
        history.push({ role: "assistant", content: response });
      }
      
      return response;
    } catch (error: any) {
      const errorMsg = `错误: ${error.message}`;
      console.error(`\x1b[31m${errorMsg}\x1b[0m`);
      return errorMsg;
    }
  }

  // 启动渠道监听
  channelManager.startAll(async (msg) => {
    if (dedup.isDuplicate(msg.id)) return;
    
    const history = getChannelHistory(msg.chatId);
    const response = await processInput(
      msg.content, 
      msg.channel, 
      history, 
      msg.channel, 
      msg.chatId,
      msg.userId,
      msg.chatType
    );
    
    if (response) {
      await channelManager.send(msg.channel, msg.chatId, response);
    }
  });

  // 控制台交互
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n输入消息开始对话，输入 /quit 退出');
  console.log('输入 /audit 查看审计日志，/policy 查看安全策略\n');

  const prompt = () => {
    rl.question("\x1b[32m你: \x1b[0m", async (input) => {
      input = input.trim();
      
      if (!input) {
        prompt();
        return;
      }
      
      if (input === "/quit" || input === "/exit") {
        console.log("\n再见！");
        logger.save();
        channelManager.stopAll();
        rl.close();
        process.exit(0);
      }
      
      // V12 新增：快捷命令
      if (input === "/audit") {
        const logs = securitySystem.getAuditLogs({ limit: 10 });
        console.log('\n最近审计日志:');
        logs.forEach(log => {
          console.log(`  [${new Date(log.timestamp).toLocaleString()}] ${log.tool}: ${log.decision}`);
        });
        console.log('');
        prompt();
        return;
      }
      
      if (input === "/policy") {
        const policy = securitySystem.getPolicy();
        console.log('\n当前安全策略:');
        console.log(`  审计: ${policy.auditEnabled ? '启用' : '禁用'}`);
        console.log(`  确认危险操作: ${policy.confirmDangerous ? '是' : '否'}`);
        console.log(`  群聊禁用工具: ${policy.groupDenyList.join(', ')}`);
        console.log('');
        prompt();
        return;
      }
      
      const response = await processInput(input, "console", consoleHistory);
      console.log(`\n\x1b[34mAgent:\x1b[0m ${response}\n`);
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
