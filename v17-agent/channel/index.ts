/**
 * v11-agent/channel/index.ts - 渠道系统统一导出
 */

export { ChannelManager } from "./manager.js";
export type {
  Channel,
  ChannelCapabilities,
  ChannelConfig,
  MessageContext,
  TrustLevel,
  GroupPolicy,
  DmPolicy,
} from "./types.js";
