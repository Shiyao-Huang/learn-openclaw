/**
 * v14-agent/plugins/index.ts - 插件系统
 *
 * V14 新增功能:
 * - 动态加载插件
 * - 工具热插拔
 * - 生命周期钩子
 * - 配置验证
 */

import * as fs from "fs";
import * as path from "path";
import type {
  Plugin,
  LoadedPlugin,
  PluginTool,
  PluginHook,
  PluginHookName,
  HookEvent,
} from "./types.js";

export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginDir: string;
  private hooks: Map<PluginHookName, PluginHook[]> = new Map();

  constructor(workDir: string) {
    this.pluginDir = path.join(workDir, "plugins");
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }
  }

  // 发现可用插件
  discover(): string[] {
    if (!fs.existsSync(this.pluginDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.pluginDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() || e.name.endsWith(".ts"))
      .map((e) => (e.isDirectory() ? e.name : e.name.replace(".ts", "")));
  }

  // 加载插件
  async load(source: string, config?: Record<string, unknown>): Promise<Plugin> {
    // 从目录加载
    const pluginPath = path.join(this.pluginDir, source, "index.ts");
    const singleFilePath = path.join(this.pluginDir, `${source}.ts`);

    let plugin: Plugin;

    if (fs.existsSync(pluginPath)) {
      // 目录形式
      const module = await import(pluginPath);
      plugin = module.default || module;
    } else if (fs.existsSync(singleFilePath)) {
      // 单文件形式
      const module = await import(singleFilePath);
      plugin = module.default || module;
    } else {
      throw new Error(`Plugin not found: ${source}`);
    }

    // 验证插件
    if (!plugin.id || !plugin.name || !plugin.version) {
      throw new Error(`Invalid plugin: missing required fields`);
    }

    // 检查是否已加载
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already loaded: ${plugin.id}`);
    }

    // 合并配置
    const finalConfig = { ...plugin.configSchema?.properties, ...config };

    // 调用 onLoad
    if (plugin.onLoad) {
      await plugin.onLoad({
        config: finalConfig,
        workDir: this.pluginDir,
      });
    }

    // 注册钩子
    if (plugin.hooks) {
      for (const hook of plugin.hooks) {
        this.registerHook(hook);
      }
    }

    // 保存
    this.plugins.set(plugin.id, {
      plugin,
      config: finalConfig,
      loadedAt: Date.now(),
    });

    return plugin;
  }

  // 卸载插件
  async unload(pluginId: string): Promise<void> {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) {
      throw new Error(`Plugin not loaded: ${pluginId}`);
    }

    // 调用 onUnload
    if (loaded.plugin.onUnload) {
      await loaded.plugin.onUnload();
    }

    // 移除钩子
    if (loaded.plugin.hooks) {
      for (const hook of loaded.plugin.hooks) {
        this.unregisterHook(hook);
      }
    }

    this.plugins.delete(pluginId);
  }

  // 获取所有工具
  getTools(): PluginTool[] {
    const tools: PluginTool[] = [];
    for (const loaded of this.plugins.values()) {
      if (loaded.plugin.tools) {
        tools.push(...loaded.plugin.tools);
      }
    }
    return tools;
  }

  // 注册钩子
  private registerHook(hook: PluginHook): void {
    if (!this.hooks.has(hook.name)) {
      this.hooks.set(hook.name, []);
    }
    const hooks = this.hooks.get(hook.name)!;
    hooks.push(hook);
    // 按优先级排序
    hooks.sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }

  // 注销钩子
  private unregisterHook(hook: PluginHook): void {
    const hooks = this.hooks.get(hook.name);
    if (hooks) {
      const index = hooks.indexOf(hook);
      if (index > -1) {
        hooks.splice(index, 1);
      }
    }
  }

  // 触发钩子
  async triggerHook(name: PluginHookName, event: HookEvent): Promise<void> {
    const hooks = this.hooks.get(name);
    if (!hooks) return;

    for (const hook of hooks) {
      try {
        await hook.handler(event);
      } catch (err) {
        console.error(`Hook error: ${hook.name}`, err);
      }
    }
  }

  // 列出已加载插件
  list(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  // 获取插件配置
  getConfig(pluginId: string): Record<string, unknown> | undefined {
    return this.plugins.get(pluginId)?.config;
  }

  // 更新插件配置
  setConfig(pluginId: string, config: Record<string, unknown>): void {
    const loaded = this.plugins.get(pluginId);
    if (loaded) {
      loaded.config = { ...loaded.config, ...config };
    }
  }
}

export default PluginManager;
