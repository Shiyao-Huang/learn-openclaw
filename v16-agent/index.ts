#!/usr/bin/env tsx
/**
 * v16-agent/index.ts - OpenClaw V16 模块化入口
 * 
 * V16 新增：DAG 工作流引擎
 * - Mermaid → DAG 解析
 * - 并行执行识别
 * - 条件分支支持
 * - 错误恢复机制
 * 
 * 继承 V15: 多模型协作
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
import { createSessionLogger } from "./utils/logger.js";

// V12 安全模块
import { SecuritySystem, getSecurityTools, createSecurityHandlers, TrustLevel } from "./security/index.js";

// V13 进化模块
import { EvolutionSystem, getEvolutionTools, createEvolutionHandlers } from "./evolution/index.js";

// V14 插件模块
import { PluginManager, getPluginTools, createPluginHandlers } from "./plugin/index.js";

// V15 多模型模块
import { ModelRouter, getMultiModelTools, createMultiModelHandlers, DEFAULT_MODELS } from "./multimodel/index.js";

// V16 新增：工作流模块
import { WorkflowManager, getWorkflowTools, createWorkflowHandlers, DAGNode } from "./workflow/index.js";

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
  smartRouting: process.env.SMART_ROUTING !== 'false',
};

// ============================================================================
// 初始化系统组件
// ============================================================================

const client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseURL });
const logger = createSessionLogger(config.workDir, 60000);

// V11 核心模块
const memoryManager = new MemoryManager(config.workDir);
const sessionManager = new SessionManager(config.workDir);
const channelManager = new ChannelManager(config.workDir);
const identitySystem = new IdentitySystem(config.identityDir, config.idSampleDir);
const introspection = new IntrospectionTracker(config.workDir);
const skillLoader = new SkillLoader(config.clawDir);

// V12-V15 模块
const securitySystem = new SecuritySystem(config.workDir);
const evolutionSystem = new EvolutionSystem(config.workDir);
const pluginManager = new PluginManager(config.workDir);
const modelRouter = new ModelRouter(DEFAULT_MODELS);

// V16 新增：工作流管理器
const workflowManager = new WorkflowManager();

// 加载身份
identitySystem.load();

// 创建处理器
const securityHandlers = createSecurityHandlers(securitySystem);
const evolutionHandlers = createEvolutionHandlers(evolutionSystem);
const pluginHandlers = createPluginHandlers(pluginManager);
const modelHandlers = createMultiModelHandlers(modelRouter);

// V16 新增：工作流任务执行器（集成 Agent 能力）
const workflowTaskExecutor = async (node: DAGNode, context: Record<string, any>) => {
  // 将任务节点转换为 Agent 可执行的指令
  const taskPrompt = `执行任务: ${node.label}\n上下文: ${JSON.stringify(context)}`;
  
  // 简化执行：直接返回任务信息
  // 实际生产环境可以调用 chat() 让 Agent 执行
  console.log(`\x1b[36m[工作流] 执行节点 ${node.id}: ${node.label}\x1b[0m`);
  
  // 模��执行延迟
  await new Promise(resolve => setTimeout(resolve, 200));
  
  return {
    nodeId: node.id,
    label: node.label,
    executed: true,
    timestamp: Date.now()
  };
};

const workflowHandlers = createWorkflowHandlers(workflowManager, workflowTaskExecutor);

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
    ...getMultiModelTools(),
    ...getWorkflowTools()  // V16 新增
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
  if (hookResult.block) return `[插件拦截] ${hookResult.blockReason}`;
  
  // 检查各类处理器
  if (name in securityHandlers) return (securityHandlers as any)[name](args);
  if (name in evolutionHandlers) return (evolutionHandlers as any)[name](args);
  if (name in pluginHandlers) return await (pluginHandlers as any)[name](args);
  if (name in modelHandlers) return (modelHandlers as any)[name](args);
  if (name in workflowHandlers) return await (workflowHandlers as any)[name](args);  // V16 新增
  
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

  // V16 新增：工作流状态
  const workflows = workflowManager.list();
  if (workflows.length > 0) {
    parts.push(`## 活跃工作流
${workflows.slice(0, 3).map(w => `- ${w.name}: ${w.status}`).join('\n')}`);
  }

  parts.push(`## 系统能力 (V16)
- V12 安全: 工具权限分级、审计日志
- V13 进化: 行为分析、优化建议
- V14 插件: 热插拔工具
- V15 多模型: 智能路由、成本优化
- V16 工作流: DAG 任务图、并行执行

## 工作流使用
1. workflow_create: 从 Mermaid 创建工作流
2. workflow_plan: 查看执行计划
3. workflow_run: 执行工作流
4. workflow_visualize: 可视化 DAG

示例 Mermaid:
\`\`\`
flowchart TD
    A[获取数据] --> B[处理数据]
    B --> C{验证}
    C -->|yes| D[保存]
    C -->|no| E[报错]
\`\`\``);

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
  channel: string = "console"
): Promise<string> {
  securitySystem.setContext({
    channel,
    trustLevel: channel === 'console' ? 'owner' : 'trusted',
  });

  await pluginManager.triggerHook('message_received', { input, channel });
  skillLoader.autoLoad(input);

  // V15 智能模型选择
  let selectedModel = config.defaultModel;
  if (config.smartRouting) {
    const selection = modelRouter.selectModel(input);
    const modelMap: Record<string, string> = {
      'claude-sonnet': 'claude-sonnet-4-20250514',
      'claude-haiku': 'claude-3-5-haiku-20241022',
      'claude-opus': 'claude-opus-4-20250514'
    };
    selectedModel = modelMap[selection.modelId] || config.defaultModel;
    console.log(`\x1b[90m[路由] ${selection.modelId}\x1b[0m`);
  }

  const systemPrompt = buildSystemPrompt(selectedModel);
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: input }];
  const tools = getAllTools();

  const startTime = Date.now();
  let response = await client.messages.create({
    model: selectedModel,
    max_tokens: config.maxTokens,
    system: [{ type: "text" as const, text: systemPrompt }],
    tools,
    messages,
  });
  logger.updateTokens(response.usage);

  // 记录模型使用
  modelRouter.recordUsage(
    selectedModel.includes('haiku') ? 'claude-haiku' : 
    selectedModel.includes('opus') ? 'claude-opus' : 'claude-sonnet',
    response.usage.input_tokens,
    response.usage.output_tokens,
    Date.now() - startTime
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

  await pluginManager.triggerHook('message_sending', { response: responseText, channel });

  return responseText;
}

// ============================================================================
// 主入口
// ============================================================================

async function main() {
  console.log('\x1b[36m╔════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║     OpenClaw V16 - DAG 工作流引擎      ║\x1b[0m');
  console.log('\x1b[36m║     (V15 多模型 + V14 插件 + ...)      ║\x1b[0m');
  console.log('\x1b[36m╚════════════════════════════════════════╝\x1b[0m');

  // 加载内置插件
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
  console.log('V16 命令: /workflows (列出工作流), /demo (演示工作流)\n');

  const prompt = () => {
    rl.question("\x1b[32m你: \x1b[0m", async (input) => {
      input = input.trim();
      if (!input) { prompt(); return; }
      
      if (input === "/quit") {
        console.log("\n再见！");
        rl.close();
        process.exit(0);
      }
      
      // V16 新增快捷命令
      if (input === "/workflows") {
        const workflows = workflowManager.list();
        console.log('\n工作流列表:');
        if (workflows.length === 0) {
          console.log('  无工作流');
        } else {
          workflows.forEach(w => console.log(`  [${w.status}] ${w.id}: ${w.name}`));
        }
        prompt(); return;
      }
      
      if (input === "/demo") {
        console.log('\n创建演示工作流...');
        const dag = workflowManager.createFromMermaid('演示流程', `
          flowchart TD
            A[获取数据] --> B[处理数据]
            B --> C[验证结果]
            C --> D[保存数据]
        `);
        console.log(workflowManager.visualize(dag.id));
        console.log('\n执行工作流...');
        const result = await workflowManager.run(dag.id, workflowTaskExecutor, {
          onNodeStart: (n) => console.log(`  开始: ${n.label}`),
          onNodeComplete: (n) => console.log(`  完成: ${n.label}`),
        });
        console.log(`\n结果: ${result?.status}, 耗时 ${result?.totalTime}ms`);
        prompt(); return;
      }
      
      // V15 命令
      if (input === "/models") {
        modelRouter.getModels().forEach(m => 
          console.log(`  [${m.enabled ? '✓' : '✗'}] ${m.id}`)
        );
        prompt(); return;
      }
      
      if (input === "/stats") {
        modelRouter.getStats().filter(s => s.calls > 0).forEach(s => 
          console.log(`  ${s.modelId}: ${s.calls}次, $${s.totalCost.toFixed(4)}`)
        );
        prompt(); return;
      }
      
      // V14 命令
      if (input === "/plugins") {
        pluginManager.list().forEach(p => console.log(`  ${p.id}: ${p.tools.join(', ')}`));
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
