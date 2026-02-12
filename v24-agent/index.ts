/**
 * v24-agent/index.ts - OpenClaw V24 完整系统入口
 * 
 * V24: 语音能力 (Audio/Voice Capabilities)
 * - 新增 6 个语音工具
 * - 文字转语音 (TTS)
 * - 音频播放控制
 * - 支持多语言语音
 * 
 * 继承 V11-V23 全部能力
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

// V23 图像理解模块
import { VisionAnalyzer, getVisionTools, createVisionHandlers } from "../v23-agent/vision/index.js";

// V24 新增：语音能力模块
import { TTSEngine, AudioPlayer, getAudioTools, createAudioHandlers, createDefaultConfig } from "./audio/index.js";

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
  audioOutputDir: process.env.AUDIO_OUTPUT_DIR || path.join(rootDir, "output", "audio"),
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

// V15+ 模块
const evolutionSystem = new EvolutionSystem(config.workDir);
const pluginManager = new PluginManager(path.join(config.workDir, "plugins"));
const modelRouter = new ModelRouter({ anthropic: client });
const workflowManager = new WorkflowManager();

// V18 协作模块
const agentRegistry = new AgentRegistry();
const subAgentManager = new SubAgentManager(agentRegistry, config.workDir);
const taskDistributor = new TaskDistributor(subAgentManager);

// V19 持久化
const persistenceManager = new PersistenceManager(config.workDir);

// V20 浏览器
const browserController = new BrowserController();

// V21 定时任务
const cronManager = new CronManager(config.workDir);
cronManager.loadFromDisk();

// V22 代码沙箱
const sandboxRunner = new SandboxRunner(config.workDir);

// V23 图像理解
const visionAnalyzer = new VisionAnalyzer({ 
  workDir: config.workDir,
  defaultPrompt: "描述这张图片的内容。",
});

// V24 新增：语音能力
const audioConfig = createDefaultConfig(config.audioOutputDir);
const ttsEngine = new TTSEngine(audioConfig);
const audioPlayer = new AudioPlayer();

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
  ...getWebTools(),
  ...getCollaborationTools(),
  ...getPersistenceTools(),
  ...getBrowserTools(),
  ...getCronTools(),
  ...getSandboxTools(),
  ...getVisionTools(),
  ...getAudioTools(), // V24 新增
];

// ============================================================================
// 工具处理器映射
// ============================================================================

const baseExecutor = createExecutor({
  workDir: config.workDir,
  bashTimeout: config.bashTimeout,
  memoryManager,
  channelManager,
  sessionManager,
  identitySystem,
  introspection,
  skillLoader,
  securitySystem,
});

const securityHandlers = createSecurityHandlers(securitySystem, baseExecutor);
const evolutionHandlers = createEvolutionHandlers(evolutionSystem, baseExecutor);
const pluginHandlers = createPluginHandlers(pluginManager, baseExecutor);
const multiModelHandlers = createMultiModelHandlers(modelRouter, config.workDir);
const workflowHandlers = createWorkflowHandlers(workflowManager, baseExecutor);
const webHandlers = createWebHandlers();
const collaborationHandlers = createCollaborationHandlers(subAgentManager, taskDistributor, agentRegistry, baseExecutor);
const persistenceHandlers = createPersistenceHandlers(persistenceManager, baseExecutor);
const browserHandlers = createBrowserHandlers(browserController);
const cronHandlers = createCronHandlers(cronManager);
const sandboxHandlers = createSandboxHandlers(sandboxRunner);
const visionHandlers = createVisionHandlers(visionAnalyzer);
const audioHandlers = createAudioHandlers(audioConfig); // V24 新增

const toolHandlers: Record<string, Function> = {
  ...baseExecutor,
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
  ...sandboxHandlers,
  ...visionHandlers,
  ...audioHandlers, // V24 新增
};

// ============================================================================
// V24 欢迎信息
// ============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V24 - 语音能力                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - tts_synthesize:    文字转语音 (TTS)                ║
║    - tts_list_voices:   获取可用语音列表                ║
║    - tts_history:       TTS 历史记录                    ║
║    - tts_delete:        删除音频文件                    ║
║    - audio_play:        播放音频                        ║
║    - audio_volume:      音量控制                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// ============================================================================
// 主循环
// ============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: any[] = [];

async function main() {
  console.log("\n🎙️ V24 语音能力系统已就绪");
  console.log(`📊 工具总数: ${allTools.length} 个`);
  console.log("\n输入 'exit' 退出，'help' 查看帮助\n");

  const ask = () => {
    rl.question("\n👤 用户: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      if (input.toLowerCase() === "help") {
        console.log(`
🎙️ V24 语音能力命令:
  - tts <文本>        文字转语音
  - voices             列出可用语音
  - play <文件路径>   播放音频
  - volume [0-100]     查看/设置音量
  - tts-history        查看 TTS 历史
        `);
        ask();
        return;
      }

      messages.push({ role: "user", content: input });

      try {
        const response = await client.messages.create({
          model: config.model,
          max_tokens: config.maxTokens,
          system: await buildSystemPrompt(),
          messages,
          tools: allTools as any,
        });

        // 处理工具调用
        for (const content of response.content) {
          if (content.type === "text") {
            console.log(`\n🤖 Agent: ${content.text}`);
            messages.push({ role: "assistant", content: content.text });
          } else if (content.type === "tool_use") {
            console.log(`\n🔧 执行工具: ${content.name}`);
            const handler = toolHandlers[content.name];
            
            if (handler) {
              try {
                const result = await handler(content.input);
                messages.push({
                  role: "user",
                  content: [{ type: "tool_result", tool_use_id: content.id, ...result }],
                });
                
                if (result.type === "result" && result.content?.[0]?.text) {
                  console.log(`✅ 结果: ${result.content[0].text.slice(0, 200)}...`);
                }
              } catch (error) {
                console.error(`❌ 工具执行失败: ${error}`);
                messages.push({
                  role: "user",
                  content: [{ type: "tool_result", tool_use_id: content.id, error: String(error) }],
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("❌ 请求失败:", error);
      }

      ask();
    });
  };

  ask();
}

async function buildSystemPrompt(): Promise<string> {
  const identity = await identitySystem.getIdentity();
  const user = await identitySystem.getUser();
  
  return `# 你的灵魂
${identity}

# 用户信息
${user}

# 语音能力
你现在拥有语音能力:
- tts_synthesize: 将文字转换为语音
- tts_list_voices: 获取可用语音列表
- audio_play: 播放音频文件
- audio_volume: 控制音量

常用语音: zh-CN-XiaoxiaoNeural (中文女声), zh-CN-YunxiNeural (中文男声)
`;
}

main().catch(console.error);
