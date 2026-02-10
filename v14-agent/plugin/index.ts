/**
 * plugin/index.ts - V14 插件系统
 * 
 * 核心功能:
 * - 插件接口: 统一的插件定义规范
 * - 工具热插拔: 运行时加载/卸载工具
 * - 配置 Schema: 插件配置验证
 * - 生命周期钩子: 插件可以响应 Agent 事件
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array';
    description?: string;
    default?: unknown;
    required?: boolean;
    sensitive?: boolean;
  }>;
}

export interface PluginTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: PluginToolContext) => Promise<string> | string;
}

export interface PluginToolContext {
  pluginId: string;
  config: Record<string, unknown>;
  workspaceDir: string;
}

export type PluginHookName = 
  | 'before_agent_start'
  | 'after_agent_end'
  | 'before_tool_call'
  | 'after_tool_call'
  | 'message_received'
  | 'message_sending';

export interface PluginHookEvent {
  hookName: PluginHookName;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface PluginHookResult {
  modified?: boolean;
  data?: Record<string, unknown>;
  block?: boolean;
  blockReason?: string;
}

export interface PluginHook {
  name: PluginHookName;
  priority?: number;
  handler: (event: PluginHookEvent) => Promise<PluginHookResult | void> | PluginHookResult | void;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  
  configSchema?: PluginConfigSchema;
  tools?: PluginTool[];
  hooks?: PluginHook[];
  
  onLoad?: (ctx: PluginContext) => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
}

export interface PluginContext {
  workspaceDir: string;
  config: Record<string, unknown>;
  logger: PluginLogger;
}

export interface PluginLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface LoadedPlugin {
  plugin: Plugin;
  config: Record<string, unknown>;
  loadedAt: number;
  source: string;
  enabled: boolean;
}

// ============================================================================
// 内置插件
// ============================================================================

const BUILTIN_PLUGINS: Record<string, Plugin> = {
  weather: {
    id: 'weather',
    name: 'Weather Plugin',
    version: '1.0.0',
    description: '获取天气信息',
    tools: [{
      name: 'weather_get',
      description: '获取指定城市的天气',
      inputSchema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名' }
        },
        required: ['city']
      },
      handler: async (args) => {
        const city = args.city as string;
        // 简化实现：返回模拟数据
        return `${city} 天气: 晴，温度 22°C，湿度 45%`;
      }
    }]
  },
  
  calculator: {
    id: 'calculator',
    name: 'Calculator Plugin',
    version: '1.0.0',
    description: '数学计算',
    tools: [{
      name: 'calc',
      description: '计算数学表达式',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: '数学表达式' }
        },
        required: ['expression']
      },
      handler: (args) => {
        try {
          const expr = args.expression as string;
          // 安全的数学计算（只允许数字和基本运算符）
          if (!/^[\d\s+\-*/().]+$/.test(expr)) {
            return '错误: 不支持的表达式';
          }
          const result = Function(`"use strict"; return (${expr})`)();
          return `${expr} = ${result}`;
        } catch (e: any) {
          return `计算错误: ${e.message}`;
        }
      }
    }]
  },
  
  timestamp: {
    id: 'timestamp',
    name: 'Timestamp Plugin',
    version: '1.0.0',
    description: '时间戳转换',
    tools: [{
      name: 'timestamp_convert',
      description: '时间戳和日期互转',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'string', description: '时间戳或日期字符串' },
          format: { type: 'string', description: '输出格式', enum: ['timestamp', 'iso', 'local'] }
        },
        required: ['value']
      },
      handler: (args) => {
        const value = args.value as string;
        const format = (args.format as string) || 'local';
        
        let date: Date;
        if (/^\d+$/.test(value)) {
          // 时间戳
          const ts = parseInt(value);
          date = new Date(ts > 1e12 ? ts : ts * 1000);
        } else {
          date = new Date(value);
        }
        
        if (isNaN(date.getTime())) {
          return '错误: 无效的时间值';
        }
        
        switch (format) {
          case 'timestamp':
            return `${Math.floor(date.getTime() / 1000)}`;
          case 'iso':
            return date.toISOString();
          default:
            return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        }
      }
    }]
  }
};

// ============================================================================
// 插件管理器
// ============================================================================

export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginDir: string;
  private configFile: string;
  private configs: Record<string, Record<string, unknown>> = {};
  private workspaceDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.pluginDir = path.join(workspaceDir, 'plugins');
    this.configFile = path.join(workspaceDir, '.plugins.json');
    
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }
    
    this.loadConfigs();
  }

  private loadConfigs() {
    if (fs.existsSync(this.configFile)) {
      try {
        this.configs = JSON.parse(fs.readFileSync(this.configFile, 'utf-8'));
      } catch (e) {
        console.log('\x1b[33m警告: 插件配置文件损坏\x1b[0m');
      }
    }
  }

  private saveConfigs() {
    fs.writeFileSync(this.configFile, JSON.stringify(this.configs, null, 2));
  }

  private createLogger(pluginId: string): PluginLogger {
    return {
      info: (msg) => console.log(`\x1b[36m[Plugin:${pluginId}]\x1b[0m ${msg}`),
      warn: (msg) => console.log(`\x1b[33m[Plugin:${pluginId}]\x1b[0m ${msg}`),
      error: (msg) => console.log(`\x1b[31m[Plugin:${pluginId}]\x1b[0m ${msg}`)
    };
  }

  // 获取内置插件
  private getBuiltinPlugin(name: string): Plugin | null {
    return BUILTIN_PLUGINS[name] || null;
  }

  // 发现插件
  async discover(): Promise<string[]> {
    const candidates: string[] = [];
    
    // 内置插件
    candidates.push(...Object.keys(BUILTIN_PLUGINS).map(k => `builtin:${k}`));
    
    // 目录插件
    if (fs.existsSync(this.pluginDir)) {
      const entries = fs.readdirSync(this.pluginDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const indexPath = path.join(this.pluginDir, entry.name, 'index.ts');
          if (fs.existsSync(indexPath)) {
            candidates.push(entry.name);
          }
        }
      }
    }

    return candidates;
  }

  // 加载插件
  async load(source: string): Promise<string> {
    try {
      let plugin: Plugin | null = null;
      let actualSource = source;

      // 检查是否是内置插件
      if (source.startsWith('builtin:')) {
        const name = source.slice(8);
        plugin = this.getBuiltinPlugin(name);
        if (!plugin) {
          return `错误: 内置插件不存在 ${name}`;
        }
      } else {
        plugin = this.getBuiltinPlugin(source);
        if (plugin) {
          actualSource = `builtin:${source}`;
        }
      }

      if (!plugin) {
        return `错误: 插件不存在 ${source}`;
      }

      // 检查是否已加载
      if (this.plugins.has(plugin.id)) {
        return `插件已加载: ${plugin.id}`;
      }

      // 获取配置
      const config = this.configs[plugin.id] || {};

      // 创建上下文
      const ctx: PluginContext = {
        workspaceDir: this.workspaceDir,
        config,
        logger: this.createLogger(plugin.id)
      };

      // 调用 onLoad
      if (plugin.onLoad) {
        await plugin.onLoad(ctx);
      }

      // 注册插件
      this.plugins.set(plugin.id, {
        plugin,
        config,
        loadedAt: Date.now(),
        source: actualSource,
        enabled: true
      });

      return `已加载插件: ${plugin.name} v${plugin.version}`;
    } catch (e: any) {
      return `加载插件失败: ${e.message}`;
    }
  }

  // 卸载插件
  async unload(pluginId: string): Promise<string> {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) {
      return `插件未加载: ${pluginId}`;
    }

    try {
      if (loaded.plugin.onUnload) {
        await loaded.plugin.onUnload();
      }
      this.plugins.delete(pluginId);
      return `已卸载插件: ${pluginId}`;
    } catch (e: any) {
      return `卸载插件失败: ${e.message}`;
    }
  }

  // 获取所有工具
  getAllTools(): PluginTool[] {
    const tools: PluginTool[] = [];
    for (const [_, loaded] of this.plugins) {
      if (loaded.enabled && loaded.plugin.tools) {
        tools.push(...loaded.plugin.tools);
      }
    }
    return tools;
  }

  // 执行工具
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<string | null> {
    for (const [pluginId, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.plugin.tools) continue;
      
      const tool = loaded.plugin.tools.find(t => t.name === toolName);
      if (tool) {
        const ctx: PluginToolContext = {
          pluginId,
          config: loaded.config,
          workspaceDir: this.workspaceDir
        };
        return await tool.handler(args, ctx);
      }
    }
    return null;
  }

  // 触发钩子
  async triggerHook(hookName: PluginHookName, data: Record<string, unknown>): Promise<PluginHookResult> {
    const event: PluginHookEvent = {
      hookName,
      data,
      timestamp: Date.now()
    };

    let result: PluginHookResult = {};

    // 收集所有钩子并按优先级排序
    const hooks: Array<{ pluginId: string; hook: PluginHook }> = [];
    for (const [pluginId, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.plugin.hooks) continue;
      for (const hook of loaded.plugin.hooks) {
        if (hook.name === hookName) {
          hooks.push({ pluginId, hook });
        }
      }
    }
    hooks.sort((a, b) => (b.hook.priority || 0) - (a.hook.priority || 0));

    // 执行钩子
    for (const { hook } of hooks) {
      try {
        const hookResult = await hook.handler(event);
        if (hookResult) {
          if (hookResult.block) {
            return hookResult;
          }
          if (hookResult.modified && hookResult.data) {
            event.data = { ...event.data, ...hookResult.data };
            result = { ...result, modified: true, data: event.data };
          }
        }
      } catch (e: any) {
        console.error(`钩子执行错误: ${e.message}`);
      }
    }

    return result;
  }

  // 列出插件
  list(): Array<{ id: string; name: string; version: string; enabled: boolean; tools: string[] }> {
    return Array.from(this.plugins.values()).map(loaded => ({
      id: loaded.plugin.id,
      name: loaded.plugin.name,
      version: loaded.plugin.version,
      enabled: loaded.enabled,
      tools: loaded.plugin.tools?.map(t => t.name) || []
    }));
  }

  // 获取插件信息
  getInfo(pluginId: string): LoadedPlugin | null {
    return this.plugins.get(pluginId) || null;
  }

  // 更新配置
  updateConfig(pluginId: string, config: Record<string, unknown>): string {
    this.configs[pluginId] = { ...this.configs[pluginId], ...config };
    this.saveConfigs();
    
    const loaded = this.plugins.get(pluginId);
    if (loaded) {
      loaded.config = this.configs[pluginId];
    }
    
    return '配置已更新';
  }

  // 启用/禁用插件
  setEnabled(pluginId: string, enabled: boolean): string {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) {
      return `插件未加载: ${pluginId}`;
    }
    loaded.enabled = enabled;
    return `插件 ${pluginId} 已${enabled ? '启用' : '禁用'}`;
  }
}

// ============================================================================
// 插件工具定义
// ============================================================================

export function getPluginTools() {
  return [
    {
      name: "plugin_list",
      description: "列出所有已加载的插件",
      input_schema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "plugin_load",
      description: "加载插件",
      input_schema: {
        type: "object" as const,
        properties: {
          source: { type: "string", description: "插件名或路径" },
        },
        required: ["source"],
      },
    },
    {
      name: "plugin_unload",
      description: "卸载插件",
      input_schema: {
        type: "object" as const,
        properties: {
          pluginId: { type: "string", description: "插件ID" },
        },
        required: ["pluginId"],
      },
    },
    {
      name: "plugin_config",
      description: "查看或更新插件配置",
      input_schema: {
        type: "object" as const,
        properties: {
          pluginId: { type: "string", description: "插件ID" },
          config: { type: "object", description: "新配置（可选）" },
        },
        required: ["pluginId"],
      },
    },
    {
      name: "plugin_info",
      description: "查看插件详情",
      input_schema: {
        type: "object" as const,
        properties: {
          pluginId: { type: "string", description: "插件ID" },
        },
        required: ["pluginId"],
      },
    },
  ];
}

// ============================================================================
// 工具处理器
// ============================================================================

export function createPluginHandlers(manager: PluginManager) {
  return {
    plugin_list: () => {
      const plugins = manager.list();
      if (plugins.length === 0) {
        return '无已加载插件';
      }
      return plugins.map(p => 
        `[${p.enabled ? '✓' : '✗'}] ${p.id} (${p.name} v${p.version})\n    工具: ${p.tools.join(', ') || '无'}`
      ).join('\n');
    },
    
    plugin_load: async (args: { source: string }) => {
      return await manager.load(args.source);
    },
    
    plugin_unload: async (args: { pluginId: string }) => {
      return await manager.unload(args.pluginId);
    },
    
    plugin_config: (args: { pluginId: string; config?: Record<string, unknown> }) => {
      if (args.config) {
        return manager.updateConfig(args.pluginId, args.config);
      }
      const info = manager.getInfo(args.pluginId);
      if (!info) {
        return `插件未加载: ${args.pluginId}`;
      }
      return JSON.stringify(info.config, null, 2);
    },
    
    plugin_info: (args: { pluginId: string }) => {
      const info = manager.getInfo(args.pluginId);
      if (!info) {
        return `插件未加载: ${args.pluginId}`;
      }
      return `插件: ${info.plugin.name}
版本: ${info.plugin.version}
描述: ${info.plugin.description || '无'}
作者: ${info.plugin.author || '未知'}
状态: ${info.enabled ? '启用' : '禁用'}
加载时间: ${new Date(info.loadedAt).toLocaleString()}
工具: ${info.plugin.tools?.map(t => t.name).join(', ') || '无'}`;
    },
  };
}
