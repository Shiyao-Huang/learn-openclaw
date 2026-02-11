/**
 * v14-agent/plugins/types.ts - 插件系统类型
 *
 * V14 新增: 动态加载外部能力
 */

// 插件定义
export interface Plugin {
  id: string;                    // 唯一标识
  name: string;                  // 显示名称
  version: string;               // 版本号
  description?: string;          // 描述
  author?: string;               // 作者

  // 配置
  configSchema?: PluginConfigSchema;

  // 能力
  tools?: PluginTool[];          // 提供的工具
  hooks?: PluginHook[];          // 生命周期钩子

  // 生命周期
  onLoad?: (ctx: PluginContext) => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
}

// 插件配置 Schema
export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array';
    description?: string;
    default?: unknown;
    required?: boolean;
    sensitive?: boolean;    // 敏感信息（如 API key）
    uiHint?: string;        // UI 提示
  }>;
}

// 插件工具
export interface PluginTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string> | string;
}

// 工具上下文
export interface ToolContext {
  config: Record<string, unknown>;
  plugin: Plugin;
}

// 插件上下文
export interface PluginContext {
  config: Record<string, unknown>;
  workDir: string;
}

// 生命周期钩子
export type PluginHookName =
  | 'before_agent_start'
  | 'after_agent_end'
  | 'before_tool_call'
  | 'after_tool_call'
  | 'message_received'
  | 'message_sending';

export interface PluginHook {
  name: PluginHookName;
  priority?: number;        // 执行优先级 (默认 100)
  handler: (event: HookEvent) => Promise<HookResult | void> | HookResult | void;
}

// 钩子事件
export interface HookEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

// 钩子结果
export interface HookResult {
  handled: boolean;
  data?: unknown;
}

// 已加载的插件
export interface LoadedPlugin {
  plugin: Plugin;
  config: Record<string, unknown>;
  loadedAt: number;
}
