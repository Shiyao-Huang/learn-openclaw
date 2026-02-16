/**
 * v34-agent.ts - OpenClaw V34: 去重缓存系统
 *
 * V34 新增功能:
 * - dedupe_check: 检查键是否重复
 * - dedupe_batch: 批量检查多个键
 * - dedupe_create: 创建新的去重缓存
 * - dedupe_get: 获取键的详情
 * - dedupe_delete: 从缓存中删除键
 * - dedupe_clear: 清空缓存
 * - dedupe_list: 列出所有缓存或缓存中的键
 * - dedupe_stats: 获取缓存统计信息
 * - dedupe_status: 获取去重系统状态
 * - dedupe_presets: 获取预设配置列表
 * - dedupe_config: 获取或更新缓存配置
 *
 * 完整实现见 v34-agent/dedupe/ 目录
 */

export {
  DedupeCache,
  DedupeCacheManager,
  getDedupeManager,
  closeDedupeManager,
  DEDUPE_TOOLS,
  DEDUPE_TOOL_COUNT,
  createDedupeHandlers,
  closeDedupeHandlers,
  DEDUPE_PRESETS,
  type DedupeCacheConfig,
  type DedupeCacheStats,
  type CacheEntry,
  type DedupeResult,
  type BatchDedupeResult,
} from "./v34-agent/dedupe/index.js";

// 继承 V33 安全扫描系统
export {
  SkillScanner,
  getSkillScanner,
  closeSkillScanner,
  SCANNER_TOOLS,
  SCANNER_TOOL_COUNT,
  createScannerHandlers,
  LINE_RULES,
  SOURCE_RULES,
  getAllRuleIds,
  getRuleStats,
  type ScanSeverity,
  type ScanRuleId,
  type ScanFinding,
  type ScanSummary,
  type ScanOptions,
  type ScanResult,
  type ScannerConfig,
  type LineRule,
  type SourceRule,
} from "./v33-agent/scanner/index.js";

// 版本信息
export const VERSION = "v34";
export const VERSION_NAME = "去重缓存系统";
export const TOOL_COUNT = 219; // V33 的 208 + V34 的 11

console.log(`
╔═══════════════════════════════════════════════════════════╗
║            OpenClaw V34 - 去重缓存系统                    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (Dedupe):                                       ║
║    - dedupe_check:        检查键是否重复                ║
║    - dedupe_batch:        批量检查                     ║
║    - dedupe_create:       创建缓存                     ║
║    - dedupe_get:          获取键详情                   ║
║    - dedupe_delete:       删除键                       ║
║    - dedupe_clear:        清空缓存                     ║
║    - dedupe_list:         列出缓存/键                  ║
║    - dedupe_stats:        获取统计                     ║
║    - dedupe_status:       系统状态                     ║
║    - dedupe_presets:      预设配置                     ║
║    - dedupe_config:       更新配置                     ║
║                                                           ║
║  预设配置:                                                ║
║    ✅ short      - 1 分钟 TTL                          ║
║    ✅ medium     - 5 分钟 TTL                          ║
║    ✅ long       - 1 小时 TTL                          ║
║    ✅ permanent  - 永不过期                            ║
║    ✅ message    - 10 分钟 TTL (消息去重)             ║
║    ✅ action     - 5 分钟 TTL (操作去重)              ║
║                                                           ║
║  特性:                                                    ║
║    ✅ TTL 自动过期                                     ║
║    ✅ 最大容量限制                                     ║
║    ✅ 多缓存实例                                       ║
║    ✅ 批量检查                                         ║
║    ✅ 命中率统计                                       ║
║                                                           ║
║  继承 V33 能力 (Scanner):                                 ║
║    ✅ 代码安全扫描                                     ║
║    ✅ 恶意代码检测                                     ║
║                                                           ║
║  工具总数: 219 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v34-agent/index.ts 启动完整系统");
  process.exit(0);
}
