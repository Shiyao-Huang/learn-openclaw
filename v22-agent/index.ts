/**
 * v22-agent/index.ts - OpenClaw V22 完整系统入口
 * 
 * V22: 代码执行沙箱
 * - 新增 5 个沙箱工具
 * - 支持 Python、JavaScript、TypeScript、Bash
 * - 代码安全扫描
 * - 资源限制管理
 * 
 * 继承 V11-V21 全部能力
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
import { SecuritySystem, getSecurityTools, createSecurityHandlers, TrustLevel } from "../v12-agent/security/index.js";
import { EvolutionSystem, getEvolutionTools, createEvolutionHandlers } from "../v13-agent/evolution/index.js";
import { PluginManager, getPluginTools, createPluginHandlers } from "../v14-agent/plugins/index.js";
import { ModelRouter, getMultiModelTools, createMultiModelHandlers, DEFAULT_MODELS } from "../v15-agent/multimodel/index.js";
import { WorkflowManager, getWorkflowTools, createWorkflowHandlers, DAGNode } from "../v16-agent/workflow/index.js";
import { getWebTools, createWebHandlers } from "../v17-agent/external/index.js";

// V18 团队协作模块
import { 
  SubAgentManager, 
  AgentRegistry, 
  TaskDistributor,
  getCollaborationTools, 
  createCollaborationHandlers 
} from "../v18-agent/collaboration/index.js";

// V19 持久化模块
import { 
  PersistenceManager,
  RecoveryHandler,
  getPersistenceTools, 
  createPersistenceHandlers,
} from "../v19-agent/persistence/index.js";

// V20 浏览器模块
import { 
  BrowserController,
  getBrowserTools, 
  createBrowserHandlers,
} from "../v20-agent/browser/index.js";

// V21 定时任务模块
import { 
  CronManager,
  getCronTools, 
  createCronHandlers,
} from "../v21-agent/cron/index.js";

// V22 新增：代码沙箱模块
import { 
  SandboxRunner,
  getSandboxTools, 
  createSandboxHandlers,
} from "./sandbox/index.js";

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
  clawDir: process.env.CLAW_DIR || path.join(rootDir, "skills"),
  identityDir: process.env.IDENTITY_DIR || rootDir,
  idSampleDir: process.env.ID_SAMPLE_DIR || path.join(rootDir, ".ID.sample"),
  smartRouting: process.env.SMART_ROUTING !== 'false',
  braveApiKey: process.env.BRAVE_API_KEY,
  autoSnapshotMinutes: parseInt(process.env.AUTO_SNAPSHOT_MINUTES || "0", 10),
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

// V18 协作模块
const subAgentManager = new SubAgentManager(config.workDir);
const agentRegistry = new AgentRegistry(config.workDir);
const taskDistributor = new TaskDistributor(subAgentManager, agentRegistry);

// V19 持久化管理器
const persistenceManager = new PersistenceManager(config.workDir, {
  maxSnapshots: 10,
  maxCheckpointsPerTask: 5,
  autoSnapshotIntervalMs: config.autoSnapshotMinutes > 0 
    ? config.autoSnapshotMinutes * 60 * 1000 
    : 0,
});
const recoveryHandler = new RecoveryHandler(persistenceManager);

// V20 浏览器控制器
const browserController = new BrowserController(path.join(config.workDir, ".browser"));

// V21 定时任务管理器
const cronManager = new CronManager(config.workDir);

// V22 新增：代码沙箱运行器
const sandboxRunner = new SandboxRunner(config.workDir);

// 加载身份
identitySystem.load();

// ============================================================================
// 工具合并
// ============================================================================

const allTools = [
  ...baseTools,
  ...getSecurityTools(),
  ...getEvolutionTools(),
  ...getPluginTools(),
  ...getMultiModelTools(),
  ...getWorkflowTools(),
  ...getWebTools(),
  ...getCollaborationTools(),
  ...getPersistenceTools(),
  ...getBrowserTools(),
  ...getCronTools(),     // V21
  ...getSandboxTools(),  // V22 新增
];

// ============================================================================
// 处理器合并
// ============================================================================

const stateProvider = () => ({
  agent: {
    id: "v22-agent",
    name: "OpenClaw V22",
    status: "running" as const,
    trustLevel: "owner" as const,
    config: {},
    stats: { tasksCompleted: 0, tasksFailed: 0, uptime: Date.now() },
  },
  session: {
    id: "main",
    channel: "console",
    userId: "owner",
    messages: [],
    context: {},
  },
  tasks: [],
  subagents: [],
  memory: { shortTerm: [], longTerm: [], dailyNotes: {}, sessionContext: {} },
  workflow: { activeWorkflows: [], completedWorkflows: [] },
});

const securityHandlers = createSecurityHandlers(securitySystem, TrustLevel.OWNER);
const evolutionHandlers = createEvolutionHandlers(evolutionSystem);
const pluginHandlers = createPluginHandlers(pluginManager);
const multiModelHandlers = createMultiModelHandlers(modelRouter, client, config.defaultModel);
const workflowHandlers = createWorkflowHandlers(workflowManager);
const webHandlers = createWebHandlers(config.braveApiKey);
const collaborationHandlers = createCollaborationHandlers(subAgentManager, agentRegistry, taskDistributor, config.workDir);
const persistenceHandlers = createPersistenceHandlers(persistenceManager, recoveryHandler, stateProvider);
const browserHandlers = createBrowserHandlers(browserController);
const cronHandlers = createCronHandlers(cronManager);
const sandboxHandlers = createSandboxHandlers(sandboxRunner);  // V22 新增

// 处理器映射
const toolHandlers: Record<string, (args: any) => any> = {
  ...securityHandlers,
  ...evolutionHandlers,
  ...pluginHandlers,
  ...multiModelHandlers,
  ...workflowHandlers,
  ...webHandlers,
  ...collaborationHandlers,
  ...persistenceHandlers,
  ...browserHandlers,
  ...cronHandlers,
  ...sandboxHandlers,  // V22 新增
};

// ============================================================================
// 主循环
// ============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                  OpenClaw V22 - 代码执行沙箱                     ║
╠══════════════════════════════════════════════════════════════════╣
║  版本: V22 (继承 V11-V21 全部能力)                               ║
║  模型: ${config.defaultModel.padEnd(50)} ║
╠══════════════════════════════════════════════════════════════════╣
║  可用工具: ${String(allTools.length).padEnd(53)} ║
║  - 基础工具: 21个                                                ║
║  - 安全工具: 5个                                                 ║
║  - 进化工具: 5个                                                 ║
║  - 插件工具: 5个                                                 ║
║  - 多模型工具: 5个                                               ║
║  - 工作流工具: 6个                                               ║
║  - 外部工具: 2个                                                 ║
║  - 协作工具: 10个                                                ║
║  - 持久化工具: 11个                                              ║
║  - 浏览器工具: 9个                                               ║
║  - 定时任务工具: 9个                                             ║
║  - 沙箱工具: 5个  ← V22 新增                                     ║
╠══════════════════════════════════════════════════════════════════╣
║  V22 新增命令:                                                   ║
║    sandbox_execute - 安全执行代码 (Python/JS/TS/Bash)            ║
║    sandbox_scan    - 代码安全扫描                                ║
║    sandbox_install - 安装依赖                                    ║
║    sandbox_history - 执行历史                                    ║
║    sandbox_status  - 沙箱状态                                    ║
╚══════════════════════════════════════════════════════════════════╝
`);

// 启动时检查恢复
const recoveryCheck = recoveryHandler.checkRecoveryNeeded();
if (recoveryCheck.needed) {
  console.log(`\x1b[33m[恢复检测] ${recoveryCheck.reason}\x1b[0m`);
}

// 显示定时任务统计
const cronStats = cronManager.getStats();
console.log(`\x1b[36m[定时任务] ${cronStats.jobs} 个任务, ${cronStats.activeReminders} 个活跃提醒\x1b[0m`);

// 显示沙箱状态
const sandboxStatus = sandboxRunner.getStatus();
console.log(`\x1b[36m[代码沙箱] Python: ${sandboxStatus.config.pythonPath}, Node: ${sandboxStatus.config.nodePath}\x1b[0m\n`);

async function main() {
  const userInput = await new Promise<string>((resolve) => {
    rl.question("\x1b[36mYou:\x1b[0m ", resolve);
  });

  if (userInput.trim().toLowerCase() === "exit") {
    // 清理
    await browserController.cleanup();
    cronManager.stop();
    await sandboxRunner.terminateAll();
    rl.close();
    return;
  }

  if (userInput.trim().toLowerCase() === "snapshot") {
    const snapshot = persistenceManager.createSnapshot(
      stateProvider().agent,
      stateProvider().session,
      stateProvider().tasks,
      stateProvider().subagents,
      stateProvider().memory,
      stateProvider().workflow,
      "User requested snapshot"
    );
    console.log(`\x1b[32m[快照] 已创建: ${snapshot.metadata.id}\x1b[0m`);
    main();
    return;
  }

  // 记录到内省
  introspection.recordToolUse("user_message", "success", { length: userInput.length });

  try {
    const response = await client.messages.create({
      model: config.defaultModel,
      max_tokens: config.maxTokens,
      system: identitySystem.getSystemPrompt() || "You are OpenClaw V22 with sandbox code execution capabilities.",
      messages: [{ role: "user", content: userInput }],
      tools: allTools as any,
    });

    for (const content of response.content) {
      if (content.type === "text") {
        console.log(`\x1b[32mAgent:\x1b[0m ${content.text}`);
      } else if (content.type === "tool_use") {
        console.log(`\x1b[33m[Tool] ${content.name}\x1b[0m`);
        
        const handler = toolHandlers[content.name];
        if (handler) {
          try {
            const result = await handler(content.input);
            console.log(`\x1b[32m[Result]\x1b[0m ${result}`);
          } catch (error: any) {
            console.log(`\x1b[31m[Error]\x1b[0m ${error.message}`);
          }
        } else {
          console.log(`\x1b[31m[Error]\x1b[0m No handler for tool: ${content.name}`);
        }
      }
    }
  } catch (error: any) {
    console.error(`\x1b[31mError:\x1b[0m ${error.message}`);
  }

  main();
}

main();
