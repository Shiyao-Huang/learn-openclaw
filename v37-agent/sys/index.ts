/**
 * V37: 系统工具集 - 索引
 */

export { copyToClipboard, pasteFromClipboard } from "./clipboard.js";
export {
  getOsSummary,
  getPrimaryIPv4,
  formatMemory,
  formatUptime,
} from "./os-summary.js";
export {
  updateSystemPresence,
  upsertPresence,
  listSystemPresence,
  getPresence,
  clearPresence,
} from "./presence.js";
export {
  SYS_TOOLS,
  SYS_TOOL_COUNT,
} from "./tools.js";
export {
  createSysHandlers,
  closeSysHandlers,
  getSysConfig,
  updateSysConfig,
} from "./handlers.js";
export {
  type OsSummary,
  type SystemPresence,
  type SystemPresenceUpdate,
  type ClipboardResult,
  type SysToolsConfig,
  DEFAULT_SYS_TOOLS_CONFIG,
} from "./types.js";
