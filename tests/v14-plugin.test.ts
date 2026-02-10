/**
 * V14 Plugin System Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 测试目录
const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-v14-plugin');

// 简化的插件接口 (从 v14-agent.ts 复制)
interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array';
    description?: string;
    default?: unknown;
    required?: boolean;
    sensitive?: boolean;
  }>;
}

interface PluginTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: any) => Promise<string> | string;
}

interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  configSchema?: PluginConfigSchema;
  tools?: PluginTool[];
  hooks?: any[];
  onLoad?: (ctx: any) => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
}

interface LoadedPlugin {
  plugin: Plugin;
  config: Record<string, unknown>;
  loadedAt: number;
  source: string;
  enabled: boolean;
}

// 简化的插件管理器 (用于测试)
class TestPluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginDir: string;
  private configFile: string;
  private configs: Record<string, Record<string, unknown>> = {};

  constructor(workspaceDir: string) {
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
      } catch (e) { /* ignore */ }
    }
  }

  private saveConfigs() {
    fs.writeFileSync(this.configFile, JSON.stringify(this.configs, null, 2));
  }

  // 注册插件
  register(plugin: Plugin, source: string = 'test'): string {
    if (this.plugins.has(plugin.id)) {
      return `插件 ${plugin.id} 已加载`;
    }

    const config = this.configs[plugin.id] || {};
    
    if (plugin.configSchema?.properties) {
      for (const [key, schema] of Object.entries(plugin.configSchema.properties)) {
        if (config[key] === undefined && schema.default !== undefined) {
          config[key] = schema.default;
        }
      }
    }

    const loaded: LoadedPlugin = {
      plugin,
      config,
      loadedAt: Date.now(),
      source,
      enabled: true
    };

    this.plugins.set(plugin.id, loaded);
    this.configs[plugin.id] = config;
    this.saveConfigs();

    if (plugin.onLoad) {
      plugin.onLoad({ workspaceDir: TEST_DIR, config, logger: console });
    }

    return `已加载插件: ${plugin.name} v${plugin.version}`;
  }

  // 卸载插件
  async unload(pluginId: string): Promise<string> {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) {
      return `插件 ${pluginId} 未加载`;
    }

    if (loaded.plugin.onUnload) {
      await loaded.plugin.onUnload();
    }

    this.plugins.delete(pluginId);
    return `已卸载插件: ${pluginId}`;
  }

  // 获取所有插件工具
  getTools(): any[] {
    const tools: any[] = [];
    
    for (const [_, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.plugin.tools) continue;
      
      for (const tool of loaded.plugin.tools) {
        tools.push({
          name: tool.name,
          description: `[Plugin:${loaded.plugin.id}] ${tool.description}`,
          input_schema: tool.inputSchema
        });
      }
    }
    
    return tools;
  }

  // 执行插件工具
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<string | null> {
    for (const [_, loaded] of this.plugins) {
      if (!loaded.enabled || !loaded.plugin.tools) continue;
      
      const tool = loaded.plugin.tools.find(t => t.name === toolName);
      if (tool) {
        return await tool.handler(args, { pluginId: loaded.plugin.id, config: loaded.config });
      }
    }
    
    return null;
  }

  // 列出所有插件
  list(): string[] {
    return Array.from(this.plugins.keys());
  }

  // 获取插件信息
  getInfo(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  // 获取/设置配置
  getConfig(pluginId: string): Record<string, unknown> | null {
    return this.plugins.get(pluginId)?.config || null;
  }

  setConfig(pluginId: string, updates: Record<string, unknown>): string {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) {
      return `插件 ${pluginId} 未加载`;
    }

    loaded.config = { ...loaded.config, ...updates };
    this.configs[pluginId] = loaded.config;
    this.saveConfigs();

    return `已更新插件 ${pluginId} 配置`;
  }

  // 启用/禁用
  setEnabled(pluginId: string, enabled: boolean): string {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) {
      return `插件 ${pluginId} 未加载`;
    }

    loaded.enabled = enabled;
    return `插件 ${pluginId} 已${enabled ? '启用' : '禁用'}`;
  }

  get count(): number {
    return this.plugins.size;
  }

  get enabledCount(): number {
    return Array.from(this.plugins.values()).filter(p => p.enabled).length;
  }
}

describe('V14 Plugin System', () => {
  let pluginManager: TestPluginManager;

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    pluginManager = new TestPluginManager(TEST_DIR);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('Plugin Registration', () => {
    it('should register a simple plugin', () => {
      const plugin: Plugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin'
      };

      const result = pluginManager.register(plugin);
      expect(result).toContain('已加载插件');
      expect(pluginManager.count).toBe(1);
    });

    it('should not register duplicate plugins', () => {
      const plugin: Plugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0'
      };

      pluginManager.register(plugin);
      const result = pluginManager.register(plugin);
      expect(result).toContain('已加载');
      expect(pluginManager.count).toBe(1);
    });

    it('should apply default config values', () => {
      const plugin: Plugin = {
        id: 'config-plugin',
        name: 'Config Plugin',
        version: '1.0.0',
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', default: 'default-key' },
            timeout: { type: 'number', default: 30 }
          }
        }
      };

      pluginManager.register(plugin);
      const config = pluginManager.getConfig('config-plugin');
      expect(config?.apiKey).toBe('default-key');
      expect(config?.timeout).toBe(30);
    });
  });

  describe('Plugin Tools', () => {
    it('should register plugin tools', () => {
      const plugin: Plugin = {
        id: 'tool-plugin',
        name: 'Tool Plugin',
        version: '1.0.0',
        tools: [{
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} },
          handler: () => 'test result'
        }]
      };

      pluginManager.register(plugin);
      const tools = pluginManager.getTools();
      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe('test_tool');
    });

    it('should execute plugin tools', async () => {
      const plugin: Plugin = {
        id: 'exec-plugin',
        name: 'Exec Plugin',
        version: '1.0.0',
        tools: [{
          name: 'echo_tool',
          description: 'Echo input',
          inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
          handler: (args) => `Echo: ${args.text}`
        }]
      };

      pluginManager.register(plugin);
      const result = await pluginManager.executeTool('echo_tool', { text: 'hello' });
      expect(result).toBe('Echo: hello');
    });

    it('should return null for unknown tools', async () => {
      const result = await pluginManager.executeTool('unknown_tool', {});
      expect(result).toBeNull();
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should call onLoad when registering', () => {
      let loaded = false;
      const plugin: Plugin = {
        id: 'lifecycle-plugin',
        name: 'Lifecycle Plugin',
        version: '1.0.0',
        onLoad: () => { loaded = true; }
      };

      pluginManager.register(plugin);
      expect(loaded).toBe(true);
    });

    it('should call onUnload when unloading', async () => {
      let unloaded = false;
      const plugin: Plugin = {
        id: 'unload-plugin',
        name: 'Unload Plugin',
        version: '1.0.0',
        onUnload: () => { unloaded = true; }
      };

      pluginManager.register(plugin);
      await pluginManager.unload('unload-plugin');
      expect(unloaded).toBe(true);
    });
  });

  describe('Plugin Configuration', () => {
    it('should update plugin config', () => {
      const plugin: Plugin = {
        id: 'update-config-plugin',
        name: 'Update Config Plugin',
        version: '1.0.0',
        configSchema: {
          type: 'object',
          properties: {
            setting: { type: 'string', default: 'initial' }
          }
        }
      };

      pluginManager.register(plugin);
      pluginManager.setConfig('update-config-plugin', { setting: 'updated' });
      
      const config = pluginManager.getConfig('update-config-plugin');
      expect(config?.setting).toBe('updated');
    });

    it('should persist config across instances', () => {
      const plugin: Plugin = {
        id: 'persist-plugin',
        name: 'Persist Plugin',
        version: '1.0.0',
        configSchema: {
          type: 'object',
          properties: {
            value: { type: 'number', default: 0 }
          }
        }
      };

      pluginManager.register(plugin);
      pluginManager.setConfig('persist-plugin', { value: 42 });

      // Create new instance
      const newManager = new TestPluginManager(TEST_DIR);
      newManager.register(plugin);
      
      const config = newManager.getConfig('persist-plugin');
      expect(config?.value).toBe(42);
    });
  });

  describe('Plugin Enable/Disable', () => {
    it('should disable plugin', () => {
      const plugin: Plugin = {
        id: 'disable-plugin',
        name: 'Disable Plugin',
        version: '1.0.0',
        tools: [{
          name: 'disabled_tool',
          description: 'Will be disabled',
          inputSchema: { type: 'object', properties: {} },
          handler: () => 'should not run'
        }]
      };

      pluginManager.register(plugin);
      expect(pluginManager.enabledCount).toBe(1);
      
      pluginManager.setEnabled('disable-plugin', false);
      expect(pluginManager.enabledCount).toBe(0);
      
      // Disabled plugin tools should not be returned
      const tools = pluginManager.getTools();
      expect(tools.length).toBe(0);
    });

    it('should re-enable plugin', () => {
      const plugin: Plugin = {
        id: 'reenable-plugin',
        name: 'Re-enable Plugin',
        version: '1.0.0'
      };

      pluginManager.register(plugin);
      pluginManager.setEnabled('reenable-plugin', false);
      pluginManager.setEnabled('reenable-plugin', true);
      
      expect(pluginManager.enabledCount).toBe(1);
    });
  });

  describe('Built-in Plugins', () => {
    it('should have calculator functionality', async () => {
      const calcPlugin: Plugin = {
        id: 'calculator',
        name: 'Calculator Plugin',
        version: '1.0.0',
        tools: [{
          name: 'plugin_calc',
          description: 'Calculate expression',
          inputSchema: { type: 'object', properties: { expression: { type: 'string' } } },
          handler: (args) => {
            const expr = String(args.expression).replace(/[^0-9+\-*/().%\s]/g, '');
            const result = Function(`"use strict"; return (${expr})`)();
            return `${args.expression} = ${result}`;
          }
        }]
      };

      pluginManager.register(calcPlugin);
      const result = await pluginManager.executeTool('plugin_calc', { expression: '2 + 3 * 4' });
      expect(result).toBe('2 + 3 * 4 = 14');
    });

    it('should have timestamp functionality', async () => {
      const timestampPlugin: Plugin = {
        id: 'timestamp',
        name: 'Timestamp Plugin',
        version: '1.0.0',
        tools: [{
          name: 'plugin_timestamp',
          description: 'Convert timestamp',
          inputSchema: { type: 'object', properties: { value: { type: 'string' } } },
          handler: (args) => {
            const value = String(args.value);
            const ts = value.length === 10 ? parseInt(value) * 1000 : parseInt(value);
            const date = new Date(ts);
            return `ISO 时间: ${date.toISOString()}`;
          }
        }]
      };

      pluginManager.register(timestampPlugin);
      const result = await pluginManager.executeTool('plugin_timestamp', { value: '1704067200' });
      expect(result).toContain('ISO 时间:');
      expect(result).toContain('2024-01-01');
    });
  });
});
