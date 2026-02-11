#!/usr/bin/env tsx
/**
 * v14-agent/index.ts - OpenClaw V14 模块化入口
 * 
 * V14 新增：插件系统
 * - 插件接口: 统一的插件定义规范
 * - 工具热插拔: 运行时加载/卸载工具
 * - 生命周期钩子: 插件可以响应 Agent 事件
 * 
 * 继承 V13: 自进化系统
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

// V13 进化模块
import {
  EvolutionSystem,
  getEvolutionTools,
  createEvolutionHandlers
} from "./evolution/index.js";

// V14 新增：插件模块
import {
  PluginManager,
  getPluginTools,
  createPluginHandlers
} from "./plugin/index.js";

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
const skillLoader = new SkillLoader(config.skillsDir);

// V12 安全系统
const securitySystem = new SecuritySystem(config.workDir);

// V13 进化系统
const evolutionSystem = new EvolutionSystem(config.workDir);

// V14 新增：插件管理器
const pluginManager = new PluginManager(config.workDir);

// 加载身份
identitySystem.load();

// 创建处理器
const securityHandlers = createSecurityHandlers(securitySystem);
const evolutionHandlers = createEvolutionHandlers(evolutionSystem);
const pluginHandlers = createPluginHandlers(pluginManager);  // V14 新增

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

// 获取动态工具列表（包含插件工具）
function getAllTools(): Anthropic.Tool[] {
  const staticTools = [
    ...baseTools, 
    ...getSecurityTools(),
    ...getEvolutionTools(),
    ...getPluginTools()  // V14 新增
  ];
  
  // V14 新增：添加插件提供的工具
  const pluginTools = pluginManager.getAllTools().map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as any
  }));
  
  return [...staticTools, ...pluginTools] as Anthropic.Tool[];
}

// 带安全检查的执行器 (V12) + 进化追踪 (V13) + 插件工具 (V14)
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  const startTime = Date.now();
  
  // V14 新增：触发 before_tool_call 钩子
  const hookResult = await pluginManager.triggerHook('before_tool_call', { tool: name, args });
  if (hookResult.block) {
    return `[插件拦截] ${hookResult.blockReason || '操作被插件阻止'}`;
  }
  if (hookResult.modified && hookResult.data) {
    args = hookResult.data.args as Record<string, any> || args;
  }
  
  // 检查是否是安全工具
  if (name in securityHandlers) {
    return (securityHandlers as any)[name](args);
  }
  
  // 检查是否是进化工具
  if (name in evolutionHandlers) {
    return (evolutionHandlers as any)[name](args);
  }
  
  // V14 新增：检查是否是插件管理工具
  if (name in pluginHandlers) {
    return await (pluginHandlers as any)[name](args);
  }
  
  // V14 新增：检查是否是插件提供的工具
  const pluginResult = await pluginManager.executeTool(name, args);
  if (pluginResult !== null) {
    // 触发 after_tool_call 钩子
    await pluginManager.triggerHook('after_tool_call', { tool: name, args, result: pluginResult });
    return pluginResult;
  }
  
  // V12 安全检查
  const permission = securitySystem.checkPermission(name, args);
  
  if (!permission.allowed) {
    securitySystem.audit({ tool: name, args, decision: 'denied', reason: permission.reason });
    return `[安全拒绝] ${permission.reason}`;
  }
  
  if (permission.needsConfirm) {
    const confirmed = await securitySystem.requestConfirmation(name, args);
    if (!confirmed) {
      securitySystem.audit({ tool: name, args, decision: 'denied', reason: '用户拒绝确认' });
      return '[安全拒绝] 用户拒绝确认危险操作';
    }
    securitySystem.audit({ tool: name, args, decision: 'confirmed' });
  } else {
    securitySystem.audit({ tool: name, args, decision: 'allowed' });
  }
  
  // 执行工具
  const result = await baseExecutor(name, args);
  
  // V13 进化追踪
  const duration = Date.now() - startTime;
  introspection.logToolCall(name, args, result, duration);
  
  // V14 新增：触发 after_tool_call 钩子
  await pluginManager.triggerHook('after_tool_call', { tool: name, args, result, duration });
  
  return result;
}

// ============================================================================
// 构建 System Prompt
// ============================================================================

function buildSystemPrompt(): string {
  const parts: string[] = [];
  
  const identity = identitySystem.getSummary();
  if (identity) parts.push(identity);
  
  const clawContent = skillLoader.getLoadedContent();
  if (clawContent) parts.push(clawContent);
  
  const now = new Date();
  parts.push(`当前时间: ${now.toLocaleString("zh-CN", { 
    timeZone: "Asia/Shanghai",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  })}`);

  // V12 安全上下文
  const securityContext = securitySystem.getContext();
  parts.push(`## 安全上下文
- 信任等级: ${securityContext.trustLevel}
- 渠道: ${securityContext.channel || '控制台'}`);

  // V13 进化状态
  const patterns = evolutionSystem.getPatterns();
  if (patterns.length > 0) {
    parts.push(`## 行为模式
${patterns.slice(0, 3).map(p => `- ${p.sequence.join(' → ')}`).join('\n')}`);
  }

  // V14 新增：已加载插件
  const plugins = pluginManager.list();
  if (plugins.length > 0) {
    parts.push(`## 已加载插件
${plugins.map(p => `- ${p.name}: ${p.tools.join(', ') || '无工具'}`).join('\n')}`);
  }

  parts.push(`## 重要提醒
- 安全系统：危险操作需要确认
- 进化系统：使用 evolution_analyze 分析行为
- 插件系统：使用 plugin_load 加载插件 (内置: weather, calculator, timestamp)`);

  const clawList = skillLoader.list();
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
  chatId: string = "default",
  userId?: string,
  chatType?: 'direct' | 'group'
): Promise<string> {
  securitySystem.setContext({
    channel, userId, chatType,
    trustLevel: determineTrustLevel(channel, userId, chatType),
  });

  // V14 新增：触发 message_received 钩子
  await pluginManager.triggerHook('message_received', { input, channel, chatId, userId });

  skillLoader.autoLoad(input);

  const systemPrompt = buildSystemPrompt();
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: input }];
  const tools = getAllTools();  // V14: 动态获取工具列表

  let response = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    system: [{ type: "text" as const, text: systemPrompt }],
    tools,
    messages,
  });
  logger.updateTokens(response.usage);

  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolArgs = toolUse.input as Record<string, any>;
      const result = await executeTool(toolUse.name, toolArgs);
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: [{ type: "text" as const, text: systemPrompt }],
      tools,
      messages,
    });
    logger.updateTokens(response.usage);
  }
  
  const responseText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text).join("\n");

  // V14 新增：触发 message_sending 钩子
  await pluginManager.triggerHook('message_sending', { response: responseText, channel, chatId });

  return responseText;
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
  console.log('\x1b[36m║     OpenClaw V14 - 插件系统            ║\x1b[0m');
  console.log('\x1b[36m║     (继承 V13 进化 + V12 安全)         ║\x1b[0m');
  console.log('\x1b[36m╚════════════════════════════════════════╝\x1b[0m');

  // V14 新增：自动加载内置插件
  console.log('\n加载内置插件...');
  await pluginManager.load('calculator');
  await pluginManager.load('timestamp');

  const consoleHistory: Anthropic.MessageParam[] = [];

  async function processInput(
    input: string, 
    source: string, 
    history: Anthropic.MessageParam[], 
    channel: string = "console"
  ): Promise<string> {
    if (source === "console") {
      if (input.startsWith('confirm ')) {
        return securitySystem.handleConfirmation(input.slice(8).trim(), true) ? '已确认' : '无效ID';
      }
      if (input.startsWith('deny ')) {
        return securitySystem.handleConfirmation(input.slice(5).trim(), false) ? '已拒绝' : '无效ID';
      }
    }

    const response = await chat(input, history, channel);
    
    if (source === "console") {
      history.push({ role: "user", content: input });
      history.push({ role: "assistant", content: response });
    }
    
    return response;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n输入消息开始对话，输入 /quit 退出');
  console.log('V14 命令: /plugins (列出插件), /load <name> (加载插件)\n');

  const prompt = () => {
    rl.question("\x1b[32m你: \x1b[0m", async (input) => {
      input = input.trim();
      if (!input) { prompt(); return; }
      
      if (input === "/quit") {
        console.log("\n再见！");
        rl.close();
        process.exit(0);
      }
      
      // V14 新增快捷命令
      if (input === "/plugins") {
        const plugins = pluginManager.list();
        console.log('\n已加载插件:');
        plugins.forEach(p => console.log(`  [${p.enabled ? '✓' : '✗'}] ${p.id}: ${p.tools.join(', ') || '无工具'}`));
        prompt(); return;
      }
      
      if (input.startsWith("/load ")) {
        const name = input.slice(6).trim();
        const result = await pluginManager.load(name);
        console.log(`\n${result}`);
        prompt(); return;
      }
      
      // V13 命令
      if (input === "/analyze") {
        console.log('\n' + evolutionSystem.generateReport(7));
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
