/**
 * v17-agent.ts - OpenClaw V17: 外部集成系统
 * 
 * 此文件为 v17-agent/ 模块的入口点
 * V17 新增功能:
 * - web_fetch: 抓取网页内容
 * - web_search: 网页搜索 (Brave API)
 * 
 * 完整实现见 v17-agent/ 目录
 * 
 * 使用方法:
 *   npx tsx v17-agent/index.ts
 * 
 * 环境变量:
 *   - ANTHROPIC_API_KEY: Claude API Key
 *   - BRAVE_API_KEY: Brave Search API Key (可选，用于搜索功能)
 */

export { webFetch, webSearch, getWebTools, createWebHandlers } from "./v17-agent/external/index.js";
export type { WebFetchOptions, WebSearchOptions, WebSearchResult } from "./v17-agent/external/index.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║              OpenClaw V17 - 外部集成系统                  ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  新增工具:                                                ║
║    - web_fetch:  抓取网页内容 (HTML → Markdown/Text)     ║
║    - web_search: 网页搜索 (需 BRAVE_API_KEY)             ║
║                                                           ║
║  使用方法:                                                ║
║    npx tsx v17-agent/index.ts                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 如果直接运行此文件，提示用户使用 index.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("提示: 请运行 npx tsx v17-agent/index.ts 启动完整系统");
  process.exit(0);
}
