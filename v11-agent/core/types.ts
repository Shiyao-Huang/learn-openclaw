/**
 * v11-agent/core/types.ts - 共享类型定义
 */

import type Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// 配置类型
// ============================================================================

export interface AgentConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  workDir: string;
  clawDir: string;
  identityDir: string;
}

// ============================================================================
// 记忆系统类型
// ============================================================================

export interface MemoryDoc {
  id: string;
  content: string;
  source: string;
  chunk: number;
  timestamp: number;
}

export interface MemorySearchResult {
  doc: MemoryDoc;
  score: number;
}

// ============================================================================
// 会话系统类型
// ============================================================================

export type SessionType = 'main' | 'isolated';

export interface Session {
  key: string;
  type: SessionType;
  history: Anthropic.MessageParam[];
  createdAt: number;
  lastActiveAt: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// 渠道系统类型
// ============================================================================

export interface ChannelCapabilities {
  chatTypes: ('direct' | 'group' | 'channel')[];
  reactions?: boolean;
  polls?: boolean;
  media?: boolean;
  threads?: boolean;
  commands?: boolean;
  markdown?: boolean;
}

export interface MessageContext {
  channel: string;
  chatType: 'direct' | 'group' | 'channel';
  chatId: string;
  userId: string;
  userName?: string;
  messageId: string;
  text: string;
  replyTo?: string;
  timestamp: number;
  mentioned?: boolean;  // 是否 @ 了机器人
  raw?: any;            // 原始消息数据
}

export type TrustLevel = 'owner' | 'trusted' | 'normal' | 'restricted';

export type GroupPolicy = 'all' | 'mention-only' | 'disabled';
export type DmPolicy = 'all' | 'allowlist' | 'disabled';

export interface ChannelConfig {
  enabled: boolean;
  groupPolicy: GroupPolicy;
  dmPolicy: DmPolicy;
  trustedUsers: string[];
  allowFrom?: string[];
}

export interface Channel {
  id: string;
  name: string;
  capabilities: ChannelCapabilities;
  
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  
  send(target: string, message: string): Promise<void>;
  onMessage(handler: (ctx: MessageContext) => Promise<void>): void;
  
  getTrustLevel(userId: string): TrustLevel;
  setTrustLevel(userId: string, level: TrustLevel): void;
}

// ============================================================================
// 身份系统类型
// ============================================================================

export interface IdentityFiles {
  agents?: string;
  soul?: string;
  user?: string;
  memory?: string;
  heartbeat?: string;
  tools?: string;
}

// ============================================================================
// 内省系统类型
// ============================================================================

export interface ToolCall {
  tool: string;
  args: Record<string, any>;
  result?: string;
  duration?: number;
  timestamp: number;
}

export interface IntrospectionStats {
  totalCalls: number;
  toolUsage: Record<string, number>;
  avgDuration: number;
  patterns: string[];
}

// ============================================================================
// Claw 系统类型
// ============================================================================

export interface ClawMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  triggers?: string[];
}

export interface LoadedClaw {
  name: string;
  content: string;
  metadata: ClawMetadata;
}

// ============================================================================
// 工具系统类型
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export type ToolExecutor = (args: Record<string, any>) => Promise<string> | string;
