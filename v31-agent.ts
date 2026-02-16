/**
 * v31-agent.ts - OpenClaw V31: 投票系统
 *
 * V31 新增功能:
 * - poll_create: 创建投票
 * - poll_vote: 投票
 * - poll_get: 获取投票详情
 * - poll_result: 获取投票结果
 * - poll_close: 关闭投票
 * - poll_cancel: 取消投票
 * - poll_list: 列出投票
 * - poll_stats: 获取统计
 * - poll_delete: 删除投票
 * - poll_check_expired: 检查过期投票
 *
 * 完整实现见 v31-agent/poll/ 目录
 */

export {
  PollEngine,
  getPollEngine,
  closePollEngine,
  POLL_TOOLS,
  POLL_TOOL_COUNT,
  pollHandlers,
  closePollHandlers,
  type Poll,
  type PollOption,
  type PollStatus,
  type PollConfig,
  type PollResult,
  type PollFilter,
  type PollStats,
  type PollEngineConfig,
  type UserVote,
} from "./v31-agent/poll/index.js";

// 继承 V30 混合搜索系统
export {
  HybridSearchEngine,
  getHybridEngine,
  closeHybridEngine,
  FTSEngine,
  getFTSEngine,
  closeFTSEngine,
  mergeHybridResults,
  adjustWeights,
  rerankResults,
  HYBRID_TOOLS,
  HYBRID_TOOL_COUNT,
  hybridHandlers,
  closeHybridHandlers,
  type HybridSearchResult,
  type HybridSearchOptions,
  type HybridEngineConfig,
  type IndexDocument,
  type IndexStatus,
  type SearchStats,
  type FTSResult,
} from "./v30-agent/hybrid/index.js";

// 版本信息
export const VERSION = "v31";
export const VERSION_NAME = "投票系统";
export const TOOL_COUNT = 187; // V30 的 177 + V31 的 10

console.log(`
╔═══════════════════════════════════════════════════════════╗
║            OpenClaw V31 - 投票系统                        ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (Poll):                                         ║
║    - poll_create:              创建投票                  ║
║    - poll_vote:                投票                      ║
║    - poll_get:                 获取详情                  ║
║    - poll_result:              获取结果                  ║
║    - poll_close:               关闭投票                  ║
║    - poll_cancel:              取消投票                  ║
║    - poll_list:                列出投票                  ║
║    - poll_stats:               统计信息                  ║
║    - poll_delete:              删除投票                  ║
║    - poll_check_expired:       检查过期                  ║
║                                                           ║
║  特性:                                                    ║
║    ✅ 单选/多选投票                                    ║
║    ✅ 限时投票                                         ║
║    ✅ 匿名投票                                         ║
║    ✅ 投票修改                                         ║
║    ✅ 结果统计                                         ║
║    ✅ 自动过期检测                                     ║
║                                                           ║
║  继承 V30 能力 (Hybrid Search):                           ║
║    ✅ 向量搜索                                         ║
║    ✅ 关键词搜索                                       ║
║    ✅ 智能权重调整                                     ║
║    ✅ 结果重排序                                       ║
║                                                           ║
║  工具总数: 187 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v31-agent/index.ts 启动完整系统");
  process.exit(0);
}
