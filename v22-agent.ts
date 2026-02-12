/**
 * v22-agent.ts - OpenClaw V22: 代码执行沙箱
 * 
 * V22 新增功能:
 * - sandbox_execute: 安全执行代码
 * - sandbox_scan: 代码安全扫描
 * - sandbox_install: 安装依赖
 * - sandbox_history: 执行历史
 * - sandbox_status: 沙箱状态
 * 
 * 完整实现见 v22-agent/ 目录
 */

export {
  SandboxRunner,
  scanCode,
  createDefaultConfig,
  getSandboxTools,
  createSandboxHandlers,
  type SupportedLanguage,
  type ExecutionResult,
  type SecurityScanResult,
  type ExecutionRequest,
  type ResourceLimits,
} from "./v22-agent/sandbox/index.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V22 - 代码执行沙箱                  ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - sandbox_execute:    安全执行代码                   ║
║    - sandbox_scan:       代码安全扫描                   ║
║    - sandbox_install:    安装依赖包                     ║
║    - sandbox_history:    执行历史                       ║
║    - sandbox_status:     沙箱状态                       ║
║                                                           ║
║  支持语言:                                                ║
║    ✅ Python 3                                          ║
║    ✅ JavaScript (Node.js)                              ║
║    ✅ TypeScript (tsx)                                  ║
║    ✅ Bash                                              ║
║                                                           ║
║  安全特性:                                                ║
║    ✅ 自动代码扫描                                      ║
║    ✅ 危险导入检测                                      ║
║    ✅ eval/exec 拦截                                    ║
║    ✅ 资源限制 (时间/内存/输出)                         ║
║    ✅ 执行历史追踪                                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v22-agent/index.ts 启动完整系统");
  process.exit(0);
}
