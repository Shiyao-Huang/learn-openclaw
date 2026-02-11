#!/usr/bin/env tsx
/**
 * v18-agent/index.ts - OpenClaw V18 模块化入口
 * 
 * V18 新增：团队协作系统
 * - Sub-agent 管理: 创建、监控、销毁子代理
 * - Agent 注册表: 发现和管理可用代理
 * - 任务分配: 智能分配任务给合适的代理
 * 
 * 继承 V17: 外部集成
 * 继承 V16: DAG 工作流引擎
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

// V16 工作流模块
import { WorkflowManager, getWorkflowTools, createWorkflowHandlers, DAGNode } from "./workflow/index.js";

// V17 外部集成模块
import { getWebTools, createWebHandlers } from "./external/index.js";

// V18 新增：团队协作模块
import { 
  SubAgentManager, 
  AgentRegistry, 
  TaskDistributor,
  getCollaborationTools, 
  createCollaborationHandlers 
} from "./collaboration/index.js";

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
  braveApiKey: process.env.BRAVE_API_KEY,
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

// V16 工作流管理器
const workflowManager = new WorkflowManager();

// V18 新增：协作模块
const subAgentManager = new SubAgentManager(config.workDir);
const agentRegistry = new AgentRegistry(config.workDir);
const taskDistributor = new TaskDistributor(subAgentManager, agentRegistry);

// 加载身份
identitySystem.load();

// 创建处理器
const securityHandlers = createSecurityHandlers(securitySystem);
const evolutionHandlers = createEvolutionHandlers(evolutionSystem);
const pluginHandlers = createPluginHandlers(pluginManager);
const modelHandlers = createMultiModelHandlers(modelRouter);
const collaborationHandlers = createCollaborationHandlers(subAgentManager, agentRegistry, taskDistributor);

// V16 工作流任务执行器
const workflowTaskExecutor = async (node: DAGNode, context: Record<string, any>) => {
  const taskPrompt = `执行任务: ${node.label}\n上下文: ${JSON.stringify(context)}`;
  console.log(`\x1b[36m[工作流] 执行节点 ${node.id}: ${node.label}\x1b[0m`);
  
  // V18: 使用子代理执行工作流任务
  if (node.type === "task") {
    try {
      const subAgent = await subAgentManager.create({
        name: `WF-${node.id}`,
        task: taskPrompt,
        timeout: 60000,
      });
      
      const completed = await subAgentManager.waitFor(subAgent.id, 60000);
      return {
        nodeId: node.id,
        label: node.label,
        executed: true,
        result: completed.result,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        nodeId: node.id,
        label: node.label,
        executed: false,
        error: String(error),
        timestamp: Date.now()
      };
    }
  }
  
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
  braveApiKey: config.braveApiKey,
});

// 获取动态工具列表
function getAllTools(): Anthropic.Tool[] {
  const staticTools = [
    ...baseTools, 
    ...getSecurityTools(),
    ...getEvolutionTools(),
    ...getPluginTools(),
    ...getMultiModelTools(),
    ...getWorkflowTools(),
    ...getWebTools(),
    ...getCollaborationTools(),  // V18 新增
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
  if (name in workflowHandlers) return await (workflowHandlers as any)[name](args);
  if (name in collaborationHandlers) return await (collaborationHandlers as any)[name](args);  // V18 新增
  
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
  
  const skillContent = skillLoader.getLoadedContent();
  if (skillContent) parts.push(skillContent);
  
  const now = new Date();
  parts.push(`当前时间: ${now.toLocaleString("zh-CN", { 
    timeZone: "Asia/Shanghai",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  })}`);

  // V16 工作流状态
  const workflows = workflowManager.list();
  if (workflows.length > 0) {
    parts.push(`## 活跃工作流
${workflows.slice(0, 3).map(w => `- ${w.name}: ${w.status}`).join('\n')}`);
  }

  parts.push(`## 系统能力 (V18)
- V12 安全: 工具权限分级、审计日志
- V13 进化: 行为分析、优化建议
- V14 插件: 热插拔工具
- V15 多模型: 智能路由、成本优化
- V16 工作流: DAG 任务图、并行执行
- V17 外部集成: Web 抓取、网页搜索
- V18 团队协作: Sub-agent、任务分配、Agent 发现

## Sub-agent 使用
- subagent_create: 创建子代理执行独立任务
- subagent_list: 查看所有子代理
- subagent_wait: 等待子代理完成并获取结果

## Agent 注册与发现
- agent_register: 注册新 Agent
- agent_list: 列出所有 Agent
- agent_find: 按能力查找 Agent

## 任务分配
- task_submit: 提交任务自动分配
- task_status: 查看任务状态

## Web 工具
- web_fetch: 抓取网页内容
- web_search: Brave 搜索

## 工作流
- workflow_create: 从 Mermaid 创建工作流
- workflow_run: 执行工作流`);

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
  console.log('\x1b[36m║     OpenClaw V18 - 团队协作系统      ║\x1b[0m');
  console.log('\x1b[36m║     (Sub-agent + 任务分配 + ...)       ║\x1b[0m');
  console.log('\x1b[36m╚════════════════════════════════════════╝\x1b[0m');

  // 加载内置插件
  await pluginManager.load('calculator');
  await pluginManager.load('timestamp');

  // 注册当前 Agent 到注册表
  agentRegistry.register({
    name: "MainAgent",
    description: "主代理 - V18 团队协作系统",
    capabilities: [
      { name: "chat", description: "对话处理", priority: 10 },
      { name: "task_delegation", description: "任务委托", priority: 9 },
      { name: "workflow", description: "工作流执行", priority: 8 },
      { name: "web_search", description: "网页搜索", priority: 7 },
    ],
  });

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
  console.log('V18 命令: /subagents, /agents, /tasks, /demo\n');

  const prompt = () => {
    rl.question("\x1b[32m你: \x1b[0m", async (input) => {
      input = input.trim();
      if (!input) { prompt(); return; }
      
      if (input === "/quit") {
        console.log("\n再见！");
        rl.close();
        process.exit(0);
      }
      
      // V18 新增命令
      if (input === "/subagents") {
        console.log('\n' + subAgentManager.generateReport());
        prompt(); return;
      }
      
      if (input === "/agents") {
        console.log('\n' + agentRegistry.generateReport());
        prompt(); return;
      }
      
      if (input === "/tasks") {
        console.log('\n' + taskDistributor.generateReport());
        prompt(); return;
      }
      
      if (input === "/collab") {
        console.log('\n' + collaborationHandlers.collaboration_report());
        prompt(); return;
      }
      
      // V16-V17 命令
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
        console.log('\n执行工作流 (使用 Sub-agent)...');
        const result = await workflowManager.run(dag.id, workflowTaskExecutor, {
          onNodeStart: (n) => console.log(`  开始: ${n.label}`),
          onNodeComplete: (n) => console.log(`  完成: ${n.label}`),
        });
        console.log(`\n结果: ${result?.status}, 耗时 ${result?.totalTime}ms`);
        prompt(); return;
      }
      
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
      
      if (input === "/plugins") {
        pluginManager.list().forEach(p => console.log(`  ${p.id}: ${p.tools.join(', ')}`));
        prompt(); return;
      }
      
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
