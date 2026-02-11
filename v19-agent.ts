/**
 * v19-agent.ts - OpenClaw V19: 持久化与恢复系统
 * 
 * 此文件为 v19-agent/ 模块的入口点
 * V19 新增功能:
 * - snapshot_create/list/restore/delete: 状态快照管理
 * - checkpoint_create/get: 任务检查点
 * - auto_snapshot_config: 自动快照配置
 * - recovery_check/execute: 崩溃恢复
 * - crash_history: 崩溃历史查看
 * 
 * 完整实现见 v19-agent/ 目录
 * 
 * 使用方法:
 *   npx tsx v19-agent/index.ts
 * 
 * 环境变量:
 *   - ANTHROPIC_API_KEY: Claude API Key
 *   - BRAVE_API_KEY: Brave Search API Key (可选)
 */

export { 
  PersistenceManager, 
  RecoveryHandler,
  type StateSnapshot,
  type TaskCheckpoint,
  type RecoveryResult,
  type PersistenceConfig,
} from "./v19-agent/persistence/index.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║           OpenClaw V19 - 持久化与恢复系统                 ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - snapshot_create:    创建状态快照                   ║
║    - snapshot_list:      列出所有快照                   ║
║    - snapshot_restore:   从快照恢复状态                 ║
║    - snapshot_delete:    删除快照                       ║
║    - checkpoint_create:  创建任务检查点                 ║
║    - checkpoint_get:     获取检查点数据                 ║
║    - auto_snapshot_config: 配置自动快照                 ║
║    - recovery_check:     检查恢复需求                   ║
║    - recovery_execute:   执行恢复                       ║
║    - crash_history:      查看崩溃历史                   ║
║    - persistence_report: 生成持久化报告                 ║
║                                                           ║
║  核心能力:                                                ║
║    ✅ 状态快照 - 完整 Agent 状态保存                    ║
║    ✅ 检查点 - 任务级断点续传                           ║
║    ✅ 自动快照 - 定期自动保存                           ║
║    ✅ 崩溃恢复 - 从故障自动恢复                         ║
║    ✅ 磁盘持久化 - 重启后状态不丢失                     ║
║                                                           ║
║  使用方法:                                                ║
║    npx tsx v19-agent/index.ts                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v19-agent/index.ts 启动完整系统");
  process.exit(0);
}
