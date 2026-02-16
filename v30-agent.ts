/**
 * v30-agent.ts - OpenClaw V30: 混合搜索系统
 *
 * V30 新增功能:
 * - hybrid_search: 混合搜索 (向量 + 关键词)
 * - hybrid_vector_search: 仅向量搜索
 * - hybrid_keyword_search: 仅关键词搜索
 * - hybrid_index: 索引文档
 * - hybrid_index_batch: 批量索引
 * - hybrid_delete: 删除文档
 * - hybrid_status: 获取引擎状态
 * - hybrid_stats: 搜索统计
 * - hybrid_history: 搜索历史
 * - hybrid_clear: 清空索引
 *
 * 完整实现见 v30-agent/hybrid/ 目录
 */

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

// 继承 V29 安全审计系统
export {
  SecurityEngine,
  getSecurityEngine,
  closeSecurityEngine,
  SECURITY_TOOLS,
  SECURITY_TOOL_COUNT,
  securityHandlers,
  closeSecurityHandlers,
  type SecurityAuditSeverity,
  type SecurityAuditFinding,
  type SecurityAuditSummary,
  type SecurityAuditReport,
  type SecurityFixAction,
  type SecurityFixResult,
  type SecurityStatus,
  type SecurityEngineConfig,
} from "./v29-agent/security/index.js";

// 版本信息
export const VERSION = "v30";
export const VERSION_NAME = "混合搜索系统";
export const TOOL_COUNT = 177; // V29 的 167 + V30 的 10

console.log(`
╔═══════════════════════════════════════════════════════════╗
║            OpenClaw V30 - 混合搜索系统                    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (Hybrid Search):                                ║
║    - hybrid_search:             混合搜索                 ║
║    - hybrid_vector_search:      向量搜索                 ║
║    - hybrid_keyword_search:     关键词搜索               ║
║    - hybrid_index:              索引文档                 ║
║    - hybrid_index_batch:        批量索引                 ║
║    - hybrid_delete:             删除文档                 ║
║    - hybrid_status:             引擎状态                 ║
║    - hybrid_stats:              搜索统计                 ║
║    - hybrid_history:            搜索历史                 ║
║    - hybrid_clear:              清空索引                 ║
║                                                           ║
║  特性:                                                    ║
║    ✅ 向量搜索 (V27 Embedding 集成)                    ║
║    ✅ 关键词搜索 (SQLite FTS5)                         ║
║    ✅ 智能权重调整 (基于查询特征)                      ║
║    ✅ 结果重排序 (多样性优化)                          ║
║    ✅ 批量索引支持                                     ║
║    ✅ 搜索历史追踪                                     ║
║                                                           ║
║  继承 V29 能力 (Security Audit):                          ║
║    ✅ 文件权限检查                                     ║
║    ✅ 配置安全检查                                     ║
║    ✅ 密钥泄露扫描                                     ║
║    ✅ 自动修复                                         ║
║                                                           ║
║  工具总数: 177 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v30-agent/index.ts 启动完整系统");
  process.exit(0);
}
