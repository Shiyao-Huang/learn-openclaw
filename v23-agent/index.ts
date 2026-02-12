/**
 * v23-agent/index.ts - OpenClaw V23 完整系统入口
 * 
 * V23: 图像理解 (Vision Understanding)
 * - 新增 5 个图像理解工具
 * - 支持多模态输入 (图像 + 文本)
 * - OCR 文字识别
 * - 图像对比分析
 * 
 * 继承 V11-V22 全部能力
 */

#!/usr/bin/env tsx

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// V11 模块
import { MemoryManager } from "../v11-agent/memory/index.js";
import { SessionManager } from "../v11-agent/session/manager.js";
import { ChannelManager } from "../v11-agent/channel/index.js";
import { IdentitySystem } from "../v11-agent/identity/system.js";
import { IntrospectionTracker } from "../v11-agent/introspect/tracker.js";
import { SkillLoader } from "../v11-agent/skills/loader.js";
import { tools as baseTools, createExecutor } from "../v11-agent/tools/index.js";
import { createSessionLogger } from "../v11-agent/utils/logger.js";

// V12-V15 模块
import { SecuritySystem, getSecurityTools, createSecurityHandlers } from "../v12-agent/security/index.js";
import { EvolutionSystem, getEvolutionTools, createEvolutionHandlers } from "../v13-agent/evolution/index.js";
import { PluginManager, getPluginTools, createPluginHandlers } from "../v14-agent/plugins/index.js";
import { ModelRouter, getMultiModelTools, createMultiModelHandlers } from "../v15-agent/multimodel/index.js";
import { WorkflowManager, getWorkflowTools, createWorkflowHandlers } from "../v16-agent/workflow/index.js";
import { getWebTools, createWebHandlers } from "../v17-agent/external/index.js";

// V18 团队协作模块
import { SubAgentManager, AgentRegistry, TaskDistributor, getCollaborationTools, createCollaborationHandlers } from "../v18-agent/collaboration/index.js";

// V19 持久化模块
import { PersistenceManager, RecoveryHandler, getPersistenceTools, createPersistenceHandlers } from "../v19-agent/persistence/index.js";

// V20 浏览器模块
import { BrowserController, getBrowserTools, createBrowserHandlers } from "../v20-agent/browser/index.js";

// V21 定时任务模块
import { CronManager, getCronTools, createCronHandlers } from "../v21-agent/cron/index.js";

// V22 代码沙箱模块
import { SandboxRunner, getSandboxTools, createSandboxHandlers } from "../v22-agent/sandbox/index.js";

// V23 新增：图像理解模块
import { VisionAnalyzer, getVisionTools, createVisionHandlers } from "./vision/index.js";

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

const logger = createSessionLogger(config.workDir, 60000);
const memoryManager = new MemoryManager(config.workDir);
const sessionManager = new SessionManager(config.workDir);
const channelManager = new ChannelManager(config.workDir);
const identitySystem = new IdentitySystem(config.identityDir, config.idSampleDir);
const introspection = new IntrospectionTracker(config.workDir);
const skillLoader = new SkillLoader(config.skillsDir);
const securitySystem = new SecuritySystem();
const evolutionSystem = new EvolutionSystem(config.workDir);
const pluginManager = new PluginManager();
const modelRouter = new ModelRouter({
  models: [
    { name: "claude", model: config.model },
    { name: "kimi", model: "kimi-for-coding" },
  ]
});
const workflowManager = new WorkflowManager();
const subAgentManager = new SubAgentManager(config.workDir);
const agentRegistry = new AgentRegistry();
const taskDistributor = new TaskDistributor(subAgentManager, agentRegistry);
const persistenceManager = new PersistenceManager(config.workDir);
const recoveryHandler = new RecoveryHandler(persistenceManager, config.workDir);
const browserController = new BrowserController();
const cronManager = new CronManager(config.workDir);
const sandboxRunner = new SandboxRunner({ workDir: config.workDir });

// V23 新增：图像理解分析器
const visionAnalyzer = new VisionAnalyzer(
  { 
    defaultPrompt: "描述这张图片的内容。",
    maxImageSize: 10 * 1024 * 1024,
    supportedFormats: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    enableOCR: true,
    enableObjectDetection: true,
  },
  {
    provider: "anthropic",
    model: config.model,
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  }
);

// 加载身份
identitySystem.load();

// ============================================================================
// 合并所有工具
// ============================================================================

const allTools = [
  ...baseTools,
  ...getSecurityTools(),
  ...getEvolutionTools(),
  ...getPluginTools(),
  ...getMultiModelTools(),
  ...getWorkflowTools(),
  { name: "web_search", description: "搜索网页", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "web_fetch", description: "获取网页内容", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  ...getCollaborationTools(),
  ...getPersistenceTools(),
  ...getBrowserTools(),
  ...getCronTools(),
  ...getSandboxTools(),
  ...getVisionTools(), // V23 新增
];

// ============================================================================
// 创建工具执行器
// ============================================================================

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

const securityHandlers = createSecurityHandlers({ securitySystem });
const evolutionHandlers = createEvolutionHandlers({ evolutionSystem, workDir: config.workDir });
const pluginHandlers = createPluginHandlers({ pluginManager });
const multiModelHandlers = createMultiModelHandlers({ modelRouter, apiKey: config.apiKey, baseURL: config.baseURL });
const workflowHandlers = createWorkflowHandlers({ workflowManager });
const webHandlers = createWebHandlers();
const collaborationHandlers = createCollaborationHandlers({ subAgentManager, agentRegistry, taskDistributor });
const persistenceHandlers = createPersistenceHandlers({ persistenceManager, recoveryHandler });
const browserHandlers = createBrowserHandlers({ browserController });
const cronHandlers = createCronHandlers({ cronManager });
const sandboxHandlers = createSandboxHandlers({ sandboxRunner, workDir: config.workDir });
const visionHandlers = createVisionHandlers({ workDir: config.workDir, analyzer: visionAnalyzer }); // V23 新增

// ============================================================================
// 工具路由
// ============================================================================

async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  const startTime = Date.now();
  let result: string;

  try {
    // V23 新增：Vision 工具
    if (name.startsWith("vision_")) {
      const handler = (visionHandlers as any)[name];
      if (handler) {
        result = await handler(args);
      } else {
        result = `未知 Vision 工具: ${name}`;
      }
    }
    // V22 沙箱工具
    else if (name.startsWith("sandbox_")) {
      const handler = (sandboxHandlers as any)[name];
      result = handler ? await handler(args) : `未知沙箱工具: ${name}`;
    }
    // V21 定时任务工具
    else if (name.startsWith("cron_") || name.startsWith("reminder_")) {
      const handler = (cronHandlers as any)[name];
      result = handler ? await handler(args) : `未知 Cron 工具: ${name}`;
    }
    // V20 浏览器工具
    else if (name.startsWith("browser_")) {
      const handler = (browserHandlers as any)[name];
      result = handler ? await handler(args) : `未知浏览器工具: ${name}`;
    }
    // V19 持久化工具
    else if (name.startsWith("persistence_") || name.startsWith("snapshot_") || name.startsWith("recovery_")) {
      const handler = (persistenceHandlers as any)[name];
      result = handler ? await handler(args) : `未知持久化工具: ${name}`;
    }
    // V18 协作工具
    else if (["subagent", "agent_register", "agent_list", "agent_status", "task_distribute", "task_status", "collaboration_chat"].includes(name)) {
      const handler = (collaborationHandlers as any)[name];
      result = handler ? await handler(args) : `未知协作工具: ${name}`;
    }
    // V17 Web 工具
    else if (["web_search", "web_fetch"].includes(name)) {
      const handler = (webHandlers as any)[name];
      result = handler ? await handler(args) : `未知 Web 工具: ${name}`;
    }
    // V16 工作流工具
    else if (["workflow_create", "workflow_execute", "workflow_status", "workflow_list"].includes(name)) {
      const handler = (workflowHandlers as any)[name];
      result = handler ? await handler(args) : `未知工作流工具: ${name}`;
    }
    // V15 多模型工具
    else if (["model_switch", "model_list", "model_route"].includes(name)) {
      const handler = (multiModelHandlers as any)[name];
      result = handler ? await handler(args) : `未知多模型工具: ${name}`;
    }
    // V14 插件工具
    else if (["plugin_install", "plugin_list", "plugin_enable", "plugin_disable"].includes(name)) {
      const handler = (pluginHandlers as any)[name];
      result = handler ? await handler(args) : `未知插件工具: ${name}`;
    }
    // V13 进化工具
    else if (["evolution_start", "evolution_status", "evolution_adapt"].includes(name)) {
      const handler = (evolutionHandlers as any)[name];
      result = handler ? await handler(args) : `未知进化工具: ${name}`;
    }
    // V12 安全工具
    else if (["security_check", "security_policy", "security_trust"].includes(name)) {
      const handler = (securityHandlers as any)[name];
      result = handler ? await handler(args) : `未知安全工具: ${name}`;
    }
    // 基础工具
    else {
      result = await baseExecutor(name, args);
    }
  } catch (e: any) {
    result = `错误: ${e.message}`;
  }

  // 记录内省
  const duration = Date.now() - startTime;
  introspection.record(name, args, result, duration);

  return result;
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
  const convIndex = logger.startConversation(channel, chatId, input);

  // 自动加载相关 Skills
  skillLoader.autoLoad(input);

  // 构建 System Prompt
  const parts: string[] = [];
  const identity = identitySystem.getSummary();
  if (identity) parts.push(identity);
  
  const skillContent = skillLoader.getLoadedContent();
  if (skillContent) parts.push(skillContent);

  const now = new Date();
  parts.push(`当前时间: ${now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  
  // V23 新增：多模态支持说明
  parts.push(`## 多模态能力\n- 支持图像分析: 提供图像路径、URL 或 base64 数据\n- OCR 文字识别: 从图像中提取文字\n- 图像对比: 对比两张图像的差异\n- 使用 vision_analyze 工具进行图像理解`);

  const systemPrompt = parts.join("\n\n");

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: input }
  ];

  const request = {
    model: config.model,
    max_tokens: config.maxTokens,
    system: [{ type: "text" as const, text: systemPrompt }],
    tools: allTools as Anthropic.Tool[],
    messages,
  };

  // 记录请求日志
  const logDir = path.join(config.workDir, "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(logDir, `request-${timestamp}.json`);
  fs.writeFileSync(logFile, JSON.stringify(request, null, 2));
  logger.logRequestLog(logFile);

  let response = await client.messages.create(request);
  logger.updateTokens(response.usage);

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
      tools: allTools as Anthropic.Tool[],
      messages,
    });
    logger.updateTokens(response.usage);
  }

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
  await registerPlugins();

  const consoleHistory: Anthropic.MessageParam[] = [];
  const channelHistories: Map<string, Anthropic.MessageParam[]> = new Map();

  function getChannelHistory(chatId: string): Anthropic.MessageParam[] {
    if (!channelHistories.has(chatId)) {
      channelHistories.set(chatId, []);
    }
    return channelHistories.get(chatId)!;
  }

  let currentReplyTarget: { channel: string; chatId: string } | null = null;

  async function processInput(
    input: string, 
    source: string, 
    history: Anthropic.MessageParam[], 
    channel: string = "console", 
    chatId: string = "default"
  ): Promise<string> {
    if (source === "console") {
      logger.logConsoleInput(input);
    }

    try {
      const response = await chat(input, history, channel, chatId);
      history.push({ role: "user", content: input });
      history.push({ role: "assistant", content: response });

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

  // 启动渠道
  await channelManager.onMessage(async (ctx) => {
    logger.logChannelReceive(ctx.channel, ctx.userId, ctx.text);
    currentReplyTarget = { channel: ctx.channel, chatId: ctx.chatId };
    const history = getChannelHistory(ctx.chatId);
    const response = await processInput(ctx.text, `${ctx.channel}:${ctx.userName || ctx.userId}`, history, ctx.channel, ctx.chatId);

    if (response && response.trim() && response !== 'HEARTBEAT_OK') {
      try {
        await channelManager.send(ctx.channel, ctx.chatId, response);
        logger.logChannelSend(ctx.channel, ctx.chatId, response);
      } catch (e: any) {
        logger.logError(`[${ctx.channel}] 回复失败: ${e.message}`);
      }
    }

    currentReplyTarget = null;
  });

  const startResult = await channelManager.startAll();
  if (startResult !== '没有已启用的渠道') {
    console.log(`\x1b[32m[Channel] 启动结果:\n${startResult}\x1b[0m`);
  }

  // V23 显示启动信息
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V23 - 图像理解系统                  ║
╠═══════════════════════════════════════════════════════════╣
║  身份: ${identitySystem.getName().padEnd(47)} ║
║  模型: ${config.model.padEnd(47)} ║
║  工具: ${String(allTools.length).padEnd(47)} ║
╚═══════════════════════════════════════════════════════════╝
`);

  // REPL 模式
  if (process.argv[2]) {
    const result = await processInput(process.argv[2], 'cli', consoleHistory, 'console', 'cli');
    console.log(result);
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    console.log(`\nOpenClaw V23 (${identitySystem.getName()})`);
    console.log(`工具数: ${allTools.length} | 输入 'q' 退出 | '/vision' 图像菜单`);
    console.log();

    let isProcessing = false;
    
    function showPrompt() {
      process.stdout.write("\x1b[36m>> \x1b[0m");
    }

    rl.on('line', async (line: string) => {
      if (isProcessing) return;
      
      const trimmed = line.trim();
      
      if (trimmed === "q" || trimmed === "exit") {
        console.log(logger.getGoodbyeReport());
        await logger.dispose();
        await channelManager.stopAll();
        rl.close();
        return;
      }

      if (trimmed === "/vision" || trimmed === "/v") {
        console.log(`
🖼️  图像理解工具菜单

  vision_analyze  <图像> [提示词]  - 分析图像内容
  vision_ocr      <图像>          - OCR 文字识别
  vision_compare  <图1> <图2>    - 对比两张图像
  vision_history                 - 查看分析历史
  vision_status                  - 系统状态

示例:
  vision_analyze ./photo.jpg "描述这张图片"
  vision_ocr https://example.com/image.png
`);
        showPrompt();
        return;
      }

      if (trimmed === "") {
        showPrompt();
        return;
      }

      isProcessing = true;
      const response = await processInput(trimmed, 'console', consoleHistory, 'console', 'repl');
      console.log(response);
      isProcessing = false;
      showPrompt();
    });

    rl.on("close", () => process.exit(0));
    showPrompt();
  }
}

main().catch(console.error);

export { chat, executeTool, allTools, visionAnalyzer };
