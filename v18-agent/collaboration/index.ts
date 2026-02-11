/**
 * collaboration/index.ts - V18 团队协作系统
 * 
 * 核心功能:
 * - Sub-agent 管理: 创建、监控、销毁子代理
 * - Agent 间通信: 消息传递、状态同步
 * - 任务分配: 智能分配任务给合适的子代理
 * - Agent 发现: 查找和注册可用的代理
 */

export { SubAgentManager, type SubAgent, type SubAgentStatus } from "./subagent.js";
export { AgentRegistry, type AgentInfo, type AgentCapability } from "./registry.js";
export { TaskDistributor, type TaskAssignment, type TaskResult } from "./distributor.js";
export { getCollaborationTools, createCollaborationHandlers } from "./tools.js";
