/**
 * v18-agent.ts - OpenClaw V18: 团队协作系统
 * 
 * 此文件为 v18-agent/ 模块的入口点
 * V18 新增功能:
 * - subagent_create: 创建子代理
 * - subagent_list/status/wait/stop: 管理子代理
 * - agent_register/list/find: Agent 注册与发现
 * - task_submit/status: 任务分配
 * 
 * 完整实现见 v18-agent/ 目录
 * 
 * 使用方法:
 *   npx tsx v18-agent/index.ts
 * 
 * 环境变量:
 *   - ANTHROPIC_API_KEY: Claude API Key
 *   - BRAVE_API_KEY: Brave Search API Key (可选)
 */

export { 
  SubAgentManager, 
  AgentRegistry, 
  TaskDistributor,
  type SubAgent,
  type AgentInfo,
  type TaskAssignment
} from "./v18-agent/collaboration/index.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V18 - 团队协作系统                  ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - subagent_create:   创建子代理                        ║
║    - subagent_list:     列出所有子代理                    ║
║    - subagent_status:   查看子代理状态                    ║
║    - subagent_wait:     等待子代理完成                    ║
║    - subagent_stop:     停止子代理                        ║
║    - agent_register:    注册 Agent                        ║
║    - agent_list:        列出所有 Agent                    ║
║    - agent_find:        按能力查找 Agent                  ║
║    - task_submit:       提交任务                          ║
║    - task_status:       查看任务状态                      ║
║    - collaboration_report: 生成协作报告                   ║
║                                                           ║
║  使用方法:                                                ║
║    npx tsx v18-agent/index.ts                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v18-agent/index.ts 启动完整系统");
  process.exit(0);
}
