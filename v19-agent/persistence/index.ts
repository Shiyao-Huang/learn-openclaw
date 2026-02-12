/**
 * persistence/index.ts - V19 持久化与恢复系统
 * 
 * 核心功能:
 * - 状态快照: 完整 Agent 状态的保存与恢复
 * - 检查点: 任务级别的断点续传
 * - 自动快照: 定期自动保存状态
 * - 崩溃恢复: 从故障中自动恢复
 */

export { PersistenceManager, DEFAULT_CONFIG } from "./manager.js";
export type { PersistenceConfig } from "./manager.js";
export { RecoveryHandler } from "./recovery.js";
export type { RecoveryHandlerOptions } from "./recovery.js";
export { getPersistenceTools, createPersistenceHandlers } from "./tools.js";
export * from "./types.js";
