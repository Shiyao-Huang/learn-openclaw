#!/usr/bin/env tsx
/**
 * v13-agent/index.ts - OpenClaw V13 模块化入口
 * 
 * V13 新增：自进化系统
 * - 行为模式分析: 从内省日志识别工具调用模式
 * - 策略自动调整: 根据使用情况优化安全策略
 * - 建议生成: 基于分析结果提出优化建议
 * 
 * 继承 V12: 安全策略系统
 * 继承 V11: 模块化架构
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// V11 模块
import { MemoryManager } from "./memory/index.js";
import { SessionManager } from "./session/manager.js";
import { ChannelManager } from "./channel/index.js";
import { IdentitySystem } from "./identity/system.js";
import { IntrospectionTracker } from "./introspect/tracker.js";
import { SkillLoader } from "./skills/index.js";
import { tools as baseTools, createExecutor } from "./tools/index.js";
import { MessageDeduplicator } from "./utils/dedup.js";
import { createSessionLogger } from "./utils/logger.js";

// V12 安全模块
import { 
  SecuritySystem, 
  getSecurityTools, 
  createSecurityHandlers,
  TrustLevel 
} from "./security/index.js";

// V13 新增：进化模块
import {
  EvolutionSystem,
  getEvolutionTools,
  createEvolutionHandlers
} from "./evolution/index.js";

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

const logger = createSessionLogger(config.workDir, 60000);

// V11 核心模块
const memoryManager = new MemoryManager(config.workDir);
const sessionManager = new SessionManager(config.workDir);
const channelManager = new ChannelManager(config.workDir);
const identitySystem = new IdentitySystem(config.identityDir, config.idSampleDir);
const introspection = new IntrospectionTracker(config.workDir);
const skillLoader = new SkillLoader(config.clawDir);

// V12 安全系统
const securitySystem = new SecuritySystem(config.workDir);

// V13 新增：进化系统
const evolutionSystem = new EvolutionSystem(config.workDir);

// 加载身份
identitySystem.load();

// 合并工具列表: V11 基础 + V12 安全 + V13 进化
const tools = [
  ...baseTools, 
  ...getSecurityTools(),
  ...getEvolutionTools()  // V13 新增
];

// 创建处理器
const securityHandlers = createSecurityHandlers(securitySystem);
const evolutionHandlers = createEvolutionHandlers(evolutionSystem);  // V13 新增

// 基础执行器
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

// 带安全检查的执行器 (V12) + 进化追踪 (V13)
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  const startTime = Date.now();
  
  // 检查是否是安全工具
  if (name in securityHandlers) {
    return (securityHandlers as any)[name](args);
  }
  
  // V13 新增：检查是否是进化工具
  if (name in evolutionHandlers) {
    return (evolutionHandlers as any)[name](args);
  }
  
  // V12 安全检查
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
  
  if (permission.needsConfirm) {
    const confirmed = await securitySystem.requestConfirmation(name, args);
    if (!confirmed) {
      securitySystem.audit({
        tool: name,
        args,
        decision: 'denied',
        reason: '用户拒绝确认',
      });
      return '[安全拒绝] 用户���绝确认危险操作';
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
  const result = await baseExecutor(name, args);
  
  // V13 新增：记录到内省系统供进化分析
  const duration = Date.now() - startTime;
  introspection.logToolCall(name, args, result, duration);
  
  return result;
}

// ============================================================================
// 构建 System Prompt
// ============================================================================

function buildSystemPrompt(): string {
  const parts: string[] = [];
  
  const identity = identitySystem.getSummary();
  if (identity) parts.push(identity);
  
  const skillContent = skillLoader.getLoadedContent();
  if (skillContent) parts.push(skillContent);
  
  const now = new Date();
  parts.push(`当前时间: ${now.toLocaleString("zh-CN", { 
    timeZone: "Asia/Shanghai",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`);

  // V12 安全上下文
  const securityContext = securitySystem.getContext();
  parts.push(`## 安全上下文
- 信任等级: ${securityContext.trustLevel}
- 渠道: ${securityContext.channel || '控制台'}
- 聊天类型: ${securityContext.chatType || '直接对话'}`);

  // V13 新增：进化状态
  const patterns = evolutionSystem.getPatterns();
  if (patterns.length > 0) {
    parts.push(`## 行为模式 (自动识别)
${patterns.slice(0, 3).map(p => `- ${p.sequence.join(' → ')}`).join('\n')}`);
  }

  // 自动加载长期记忆关键信息
  const longTermMemory = memoryManager.longterm.read();
  if (longTermMemory && longTermMemory !== '长期记忆为空' && longTermMemory.length > 0) {
    const truncatedMemory = longTermMemory.length > 2000 
      ? longTermMemory.slice(0, 2000) + '\n\n...(记忆已截断，使用 longterm_read 查看完整内容)'
      : longTermMemory;
    parts.push(`## 长期记忆摘要\n${truncatedMemory}`);
  }

    parts.push(`## 重要提醒
- macOS 环境：grep 不支持 -P，用 grep -E
- 记忆工具：用 daily_write 或 longterm_append
- 安全系统：危险操作需要确认
- 进化系统：使用 evolution_analyze 分析行为模式

## 任务规划
- 复杂任务先用 TodoWrite 创建任务列表`);

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
  securitySystem.setContext({
    channel,
    userId,
    chatType,
    trustLevel: determineTrustLevel(channel, userId, chatType),
  });

  const convIndex = logger.startConversation(channel, chatId, input);
  skillLoader.autoLoad(input);

  const systemPrompt = buildSystemPrompt();
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: input }
  ];

  const request: Anthropic.MessageCreateParamsNonStreaming = {
    model: config.model,
    max_tokens: config.maxTokens,
    system: [{ type: "text" as const, text: systemPrompt }],
    tools: tools as Anthropic.Tool[],
    messages,
  };

  let response = await client.messages.create(request);
  logger.updateTokens(response.usage);

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

      if (toolUse.name === "TodoWrite" && toolArgs.todos) {
        logger.updateTodos(toolArgs.todos.map((t: any, i: number) => ({
          id: String(i + 1),
          content: t.content || t.task || "",
          status: t.status || "pending",
        })));
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
  
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );

  return textBlocks.map(b => b.text).join("\n");
}

function determineTrustLevel(channel: string, userId?: string, chatType?: 'direct' | 'group'): TrustLevel {
  if (channel === 'console') return 'owner';
  if (chatType === 'group') return 'normal';
  return 'trusted';
}

// ============================================================================
// 主入口
// ============================================================================

async function main() {
  console.log('\x1b[36m╔════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║     OpenClaw V13 - 自进化系统          ║\x1b[0m');
  console.log('\x1b[36m║     (继承 V12 安全 + V11 模块化)       ║\x1b[0m');
  console.log('\x1b[36m╚════════════════════════════════════════╝\x1b[0m');

  const consoleHistory: Anthropic.MessageParam[] = [];
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
      // V12 安全确认命令
      if (input.startsWith('confirm ')) {
        const id = input.slice(8).trim();
        return securitySystem.handleConfirmation(id, true) ? '已确认' : '无效ID';
      }
      if (input.startsWith('deny ')) {
        const id = input.slice(5).trim();
        return securitySystem.handleConfirmation(id, false) ? '已拒绝' : '无效ID';
      }
    }

    const response = await chat(input, history, channel, chatId, userId, chatType);
    
    if (source === "console") {
      history.push({ role: "user", content: input });
      history.push({ role: "assistant", content: response });
    }
    
    return response;
  }

  // 控制台交互
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n输入消息开始对话，输入 /quit 退出');
  console.log('V13 命令: /analyze (分析行为), /suggest (生成建议)\n');

  const prompt = () => {
    rl.question("\x1b[32m你: \x1b[0m", async (input) => {
      input = input.trim();
      if (!input) { prompt(); return; }
      
      if (input === "/quit" || input === "/exit") {
        console.log("\n再见！");
        logger.save();
        rl.close();
        process.exit(0);
      }
      
      // V12 快捷命令
      if (input === "/audit") {
        const logs = securitySystem.getAuditLogs({ limit: 10 });
        console.log('\n最近审计日志:');
        logs.forEach(log => console.log(`  [${new Date(log.timestamp).toLocaleString()}] ${log.tool}: ${log.decision}`));
        prompt(); return;
      }
      
      // V13 新增快捷命令
      if (input === "/analyze") {
        console.log('\n' + evolutionSystem.generateReport(7));
        prompt(); return;
      }
      
      if (input === "/suggest") {
        const suggestions = evolutionSystem.suggest();
        console.log('\n优化建议:');
        if (suggestions.length === 0) {
          console.log('  暂无建议');
        } else {
          suggestions.forEach(s => console.log(`  [${s.id}] ${s.type}: ${s.reason}`));
        }
        prompt(); return;
      }
      
      const response = await processInput(input, "console", consoleHistory);
      console.log(`\n\x1b[34mAgent:\x1b[0m ${response}\n`);
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
