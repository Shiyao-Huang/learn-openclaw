/**
 * v29-agent.ts - OpenClaw V29: 安全审计系统
 * 
 * V29 新增功能:
 * - security_audit: 执行完整安全审计
 * - security_check_permissions: 检查文件权限
 * - security_check_config: 检查配置安全
 * - security_check_secrets: 扫描密钥泄露
 * - security_status: 获取系统状态
 * - security_fix: 自动修复安全问题
 * - security_report: 生成安全报告
 * - security_history: 获取审计历史
 * 
 * 完整实现见 v29-agent/ 目录
 */

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

// 继承 V28 链接理解系统
export {
  LinkUnderstandingEngine,
  getLinkEngine,
  closeLinkEngine,
  LINK_TOOLS,
  LINK_TOOL_COUNT,
  linkHandlers,
  closeLinkHandlers,
  type LinkProviderConfig,
  type LinkEngineConfig,
  type LinkContentResult,
} from "./v28-agent/link/index.js";

// 版本信息
export const VERSION = "v29";
export const VERSION_NAME = "安全审计系统";
export const TOOL_COUNT = 167; // V28 的 159 + V29 的 8

console.log(`
╔═══════════════════════════════════════════════════════════╗
║            OpenClaw V29 - 安全审计系统                    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具 (Security Audit):                               ║
║    - security_audit:            执行完整安全审计         ║
║    - security_check_permissions: 检查文件权限           ║
║    - security_check_config:     检查配置安全            ║
║    - security_check_secrets:    扫描密钥泄露            ║
║    - security_status:           获取系统状态            ║
║    - security_fix:              自动修复安全问题         ║
║    - security_report:           生成安全报告            ║
║    - security_history:          获取审计历史            ║
║                                                           ║
║  特性:                                                    ║
║    ✅ 文件权限检查 (world-writable 检测)               ║
║    ✅ 配置安全检查 (gitignore, env 追踪)               ║
║    ✅ 密钥泄露扫描 (API Keys, Tokens 等)               ║
║    ✅ 自动修复 (权限修正)                              ║
║    ✅ 多格式报告 (text/json/markdown)                  ║
║    ✅ 审计历史追踪                                     ║
║                                                           ║
║  继承 V28 能力 (Link Understanding):                      ║
║    ✅ 智能链接提取                                     ║
║    ✅ 内容获取与缓存                                   ║
║    ✅ URL 安全验证                                     ║
║                                                           ║
║  工具总数: 167 个                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v29-agent/index.ts 启动完整系统");
  process.exit(0);
}
