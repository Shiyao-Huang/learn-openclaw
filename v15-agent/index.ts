#!/usr/bin/env tsx
/**
 * v15-agent/index.ts - OpenClaw V15 模块化入口
 * 
 * V15 新增：多模型协作系统
 * - 模型路由: 根据任务类型选择最优模型
 * - 成本优化: 简单任务用便宜模型，复杂任务用强模型
 * - 降级策略: 主模型失败时自动切换备用模型
 * 
 * 继承 V14: 插件系统
 * 继承 V13: 自进化系统
 * 继承 V12: 安全策略系统
 * 继承 V11: 模块化架构
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
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
import { SkillLoader } from "./claw/loader.js";
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

// V14 插件模块
import {
  PluginManager,
  getPluginTools,
  createPluginHandlers
} from "./plugin/index.js";

// V15 新增：多模型模块
import {
  ModelRouter,
  getMultiModelTools,
  createMultiModelHandlers,
  DEFAULT_MODELS
} from "./multimodel/index.js";

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
  defaultModel: process.env.MODEL_ID || "claude-sonnet-4-20250514",
  maxTokens: parseInt(process.env.MAX_TOKENS || "8192", 10),
  bashTimeout: parseInt(process.env.BASH_TIMEOUT || "30000", 10),
  workDir: process.env.WORK_DIR || rootDir,
  clawDir: process.env.CLAW_DIR || path.join(rootDir, "claws"),
  identityDir: process.env.IDENTITY_DIR || rootDir,
  idSampleDir: process.env.ID_SAMPLE_DIR || path.join(rootDir, ".ID.sample"),
  // V15 新增：智能路由开关
  smartRouting: process.env.SMART_ROUTING !== 'false',
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

// V13 进化系统
const evolutionSystem = new EvolutionSystem(config.workDir);

// V14 插件管理器
const pluginManager = new PluginManager(config.workDir);

// V15 新增：模型路由器
const modelRouter = new ModelRouter(DEFAULT_MODELS);

// 加载身份
identitySystem.load();

// 创建处理器
const securityHandlers = createSecurityHandlers(securitySystem);
const evolutionHandlers = createEvolutionHandlers(evolutionSystem);
const pluginHandlers = createPluginHandlers(pluginManager);
const modelHandlers = createMultiModelHandlers(modelRouter);  // V15 新增

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

// 获取动态工具列表
function getAllTools(): Anthropic.Tool[] {
  const staticTools = [
    ...baseTools, 
    ...getSecurityTools(),
    ...getEvolutionTools(),
    ...getPluginTools(),
    ...getMultiModelTools()  // V15 新增
  ];
  
  const pluginTools = pluginManager.getAllTools().map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as any
  }));
  
  return [...staticTools, ...pluginTools] as Anthropic.Tool[];
}

// 工具执行器
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  const startTime = Date.now();
  
  // V14 钩子
  const hookResult = await pluginManager.triggerHook('before_tool_call', { tool: name, args });
  if (hookResult.block) {
    return `[插件拦截] ${hookResult.blockReason || '操作被插件阻止'}`;
  }
  
  // 检查各类处理器
  if (name in securityHandlers) return (securityHandlers as any)[name](args);
  if (name in evolutionHandlers) return (evolutionHandlers as any)[name](args);
  if (name in pluginHandlers) return await (pluginHandlers as any)[name](args);
  if (name in modelHandlers) return (modelHandlers as any)[name](args);  // V15 新增
  
  // 插件工具
  const pluginResult = await pluginManager.executeTool(name, args);
  if (pluginResult !== null) {
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
      securitySystem.audit({ tool: name, args, decision: 'denied', reason: '用户拒绝' });
      return '[安全拒绝] 用户拒绝确认';
    }
    securitySystem.audit({ tool: name, args, decision: 'confirmed' });
  } else {
    securitySystem.audit({ tool: name, args, decision: 'allowed' });
  }
  
  const result = await baseExecutor(name, args);
  const duration = Date.now() - startTime;
  introspection.logToolCall(name, args, result, duration);
  await pluginManager.triggerHook('after_tool_call', { tool: name, args, result, duration });
  
  return result;
}

// ============================================================================
// 构建 System Prompt
// ============================================================================

function buildSystemPrompt(selectedModel?: string): string {
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
- 信任等级: ${securityContext.trustLevel}`);

  // V15 新增：当前模型
  if (selectedModel) {
    parts.push(`## 当前模型
- 模型: ${selectedModel}
- 智能路由: ${config.smartRouting ? '启用' : '禁用'}`);
  }

  // V14 已加载插件
  const plugins = pluginManager.list();
  if (plugins.length > 0) {
    parts.push(`## 已加载插件
${plugins.map(p => `- ${p.name}`).join('\n')}`);
  }

  parts.push(`## 系统能力
- V12 安全: 工具权限分级、审计日志
- V13 进化: 行为分析、优化建议
- V14 插件: 热插拔工具
- V15 多模型: 智能路由、成本优化`);

  const clawList = skillLoader.list();
  if (clawList !== "无可用技能") {
    parts.push(`\n## 可用技能\n${clawList}`);
  }
  
  return parts.join("\n\n");
}

// ============================================================================
// Chat 函数 (V15: 支持模型路由)
// ============================================================================

async function chat(
  input: string,
  history: Anthropic.MessageParam[] = [],
  channel: string = "console",
  chatId: string = "default",
  userId?: string,
  chatType?: 'direct' | 'group',
  forceModel?: string  // V15 新增：强制指定模型
): Promise<string> {
  securitySystem.setContext({
    channel, userId, chatType,
    trustLevel: determineTrustLevel(channel, userId, chatType),
  });

  await pluginManager.triggerHook('message_received', { input, channel, chatId, userId });
  skillLoader.autoLoad(input);

  // V15 新增：智能模型选择
  let selectedModel = config.defaultModel;
  if (config.smartRouting && !forceModel) {
    const selection = modelRouter.selectModel(input);
    // 映射到实际模型 ID
    const modelMap: Record<string, string> = {
      'claude-sonnet': 'claude-sonnet-4-20250514',
      'claude-haiku': 'claude-3-5-haiku-20241022',
      'claude-opus': 'claude-opus-4-20250514'
    };
    selectedModel = modelMap[selection.modelId] || config.defaultModel;
    console.log(`\x1b[90m[路由] ${selection.modelId} (${selection.reason})\x1b[0m`);
  } else if (forceModel) {
    selectedModel = forceModel;
  }

  const systemPrompt = buildSystemPrompt(selectedModel);
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: input }];
  const tools = getAllTools();

  const startTime = Date.now();
  let response: Anthropic.Message;
  let fallbackUsed = false;

  try {
    response = await client.messages.create({
      model: selectedModel,
      max_tokens: config.maxTokens,
      system: [{ type: "text" as const, text: systemPrompt }],
      tools,
      messages,
    });
  } catch (error: any) {
    // V15 新增：降级到备用模型
    console.log(`\x1b[33m[降级] ${selectedModel} 失败，尝试备用模型\x1b[0m`);
    selectedModel = config.defaultModel;
    fallbackUsed = true;
    response = await client.messages.create({
      model: selectedModel,
      max_tokens: config.maxTokens,
      system: [{ type: "text" as const, text: systemPrompt }],
      tools,
      messages,
    });
  }

  logger.updateTokens(response.usage);

  // V15 新增：记录模型使用
  const latency = Date.now() - startTime;
  modelRouter.recordUsage(
    selectedModel.includes('haiku') ? 'claude-haiku' : 
    selectedModel.includes('opus') ? 'claude-opus' : 'claude-sonnet',
    response.usage.input_tokens,
    response.usage.output_tokens,
    latency,
    fallbackUsed
  );

  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(toolUse.name, toolUse.input as Record<string, any>);
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: selectedModel,
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
  console.log('\x1b[36m║     OpenClaw V15 - 多模型协作          ║\x1b[0m');
  console.log('\x1b[36m║     (V14 插件 + V13 进化 + V12 安全)   ║\x1b[0m');
  console.log('\x1b[36m╚════════════════════════════════════════╝\x1b[0m');

  // 加载内置插件
  console.log('\n加载内置插件...');
  await pluginManager.load('calculator');
  await pluginManager.load('timestamp');

  const consoleHistory: Anthropic.MessageParam[] = [];

  async function processInput(input: string, history: Anthropic.MessageParam[]): Promise<string> {
    if (input.startsWith('confirm ')) {
      return securitySystem.handleConfirmation(input.slice(8).trim(), true) ? '已确认' : '无效ID';
    }
    if (input.startsWith('deny ')) {
      return securitySystem.handleConfirmation(input.slice(5).trim(), false) ? '已拒绝' : '无效ID';
    }

    const response = await chat(input, history, "console");
    history.push({ role: "user", content: input });
    history.push({ role: "assistant", content: response });
    return response;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n输入消息开始对话，输入 /quit 退出');
  console.log('V15 命令: /models (模型列表), /stats (使用统计), /routing on|off\n');

  const prompt = () => {
    rl.question("\x1b[32m你: \x1b[0m", async (input) => {
      input = input.trim();
      if (!input) { prompt(); return; }
      
      if (input === "/quit") {
        console.log("\n再见！");
        rl.close();
        process.exit(0);
      }
      
      // V15 新增快捷命令
      if (input === "/models") {
        const models = modelRouter.getModels();
        console.log('\n可用模型:');
        models.forEach(m => console.log(`  [${m.enabled ? '✓' : '✗'}] ${m.id} (${m.name}) - $${m.costPer1kInput}/1k`));
        prompt(); return;
      }
      
      if (input === "/stats") {
        const stats = modelRouter.getStats();
        console.log('\n模型使用统计:');
        stats.filter(s => s.calls > 0).forEach(s => 
          console.log(`  ${s.modelId}: ${s.calls}次, $${s.totalCost.toFixed(4)}, ${s.avgLatency.toFixed(0)}ms`)
        );
        if (stats.every(s => s.calls === 0)) console.log('  暂无使用记录');
        prompt(); return;
      }
      
      if (input === "/routing on") {
        config.smartRouting = true;
        console.log('\n智能路由已启用');
        prompt(); return;
      }
      
      if (input === "/routing off") {
        config.smartRouting = false;
        console.log('\n智能路由已禁用');
        prompt(); return;
      }
      
      // V14 命令
      if (input === "/plugins") {
        const plugins = pluginManager.list();
        console.log('\n已加载插件:');
        plugins.forEach(p => console.log(`  ${p.id}: ${p.tools.join(', ') || '无工具'}`));
        prompt(); return;
      }
      
      // V13 命令
      if (input === "/analyze") {
        console.log('\n' + evolutionSystem.generateReport(7));
        prompt(); return;
      }
      
      const response = await processInput(input, consoleHistory);
      console.log(`\n\x1b[34mAgent:\x1b[0m ${response}\n`);
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
