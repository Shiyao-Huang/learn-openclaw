/**
 * v11-agent/claw/loader.ts - Claw 技能加载器
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { ClawMetadata, LoadedClaw } from "../core/types.js";

export class ClawLoader {
  private clawDir: string;
  private loaded: Map<string, LoadedClaw> = new Map();
  private available: Map<string, ClawMetadata> = new Map();

  constructor(clawDir: string) {
    this.clawDir = clawDir;
    this.scan();
  }

  // 扫描可用的 Claw（同步，用于构造函数）
  scan(): void {
    this.available.clear();

    if (!fs.existsSync(this.clawDir)) {
      return;
    }

    const dirs = fs.readdirSync(this.clawDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const dir of dirs) {
      const skillPath = path.join(this.clawDir, dir, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, "utf-8");
        const metadata = this.parseMetadata(content, dir);
        this.available.set(dir, metadata);
      }
    }
  }

  // 异步扫描可用的 Claw
  async scanAsync(): Promise<void> {
    this.available.clear();

    if (!fs.existsSync(this.clawDir)) {
      return;
    }

    const entries = await fsp.readdir(this.clawDir, { withFileTypes: true });
    const dirs = entries.filter(d => d.isDirectory()).map(d => d.name);

    for (const dir of dirs) {
      const skillPath = path.join(this.clawDir, dir, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const content = await fsp.readFile(skillPath, "utf-8");
        const metadata = this.parseMetadata(content, dir);
        this.available.set(dir, metadata);
      }
    }
  }

  // 解析 SKILL.md 中的元数据
  private parseMetadata(content: string, name: string): ClawMetadata {
    const metadata: ClawMetadata = { name, description: "" };

    // 提取描述（第一个段落）
    const descMatch = content.match(/^#[^\n]+\n+([^\n#]+)/);
    if (descMatch) {
      metadata.description = descMatch[1].trim();
    }

    // 提取版本
    const versionMatch = content.match(/version[:\s]+([^\n]+)/i);
    if (versionMatch) {
      metadata.version = versionMatch[1].trim();
    }

    // 提取触发词
    const triggerMatch = content.match(/triggers?[:\s]+([^\n]+)/i);
    if (triggerMatch) {
      metadata.triggers = triggerMatch[1].split(/[,，]/).map(t => t.trim());
    }

    return metadata;
  }

  // 加载 Claw（同步，用于 autoLoad）
  load(name: string): string {
    if (this.loaded.has(name)) {
      return `Claw "${name}" 已加载`;
    }

    const skillPath = path.join(this.clawDir, name, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      return `错误: Claw "${name}" 不存在`;
    }

    const content = fs.readFileSync(skillPath, "utf-8");
    const metadata = this.available.get(name) || this.parseMetadata(content, name);

    this.loaded.set(name, { name, content, metadata });
    return `已加载 Claw: ${name}\n${metadata.description}`;
  }

  // 异步加载 Claw
  async loadAsync(name: string): Promise<string> {
    if (this.loaded.has(name)) {
      return `Claw "${name}" 已加载`;
    }

    const skillPath = path.join(this.clawDir, name, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      return `错误: Claw "${name}" 不存在`;
    }

    const content = await fsp.readFile(skillPath, "utf-8");
    const metadata = this.available.get(name) || this.parseMetadata(content, name);

    this.loaded.set(name, { name, content, metadata });
    return `已加载 Claw: ${name}\n${metadata.description}`;
  }

  // 卸载 Claw
  unload(name: string): string {
    if (this.loaded.delete(name)) {
      return `已卸载 Claw: ${name}`;
    }
    return `Claw "${name}" 未加载`;
  }

  // 获取已加载的 Claw 内容（用于 system prompt）
  getLoadedContent(): string {
    if (this.loaded.size === 0) return "";

    const parts: string[] = ["# 已加载的技能\n"];
    for (const [name, claw] of this.loaded) {
      parts.push(`## ${name}\n${claw.content}\n`);
    }
    return parts.join("\n");
  }

  // 列出可用的 Claw
  list(): string {
    if (this.available.size === 0) {
      return "无可用技能";
    }

    const lines: string[] = ["可用技能:"];
    for (const [name, meta] of this.available) {
      const loaded = this.loaded.has(name) ? " [已加载]" : "";
      lines.push(`- ${name}: ${meta.description}${loaded}`);
    }
    return lines.join("\n");
  }

  // 获取可用 Claw 数量
  get count(): number {
    return this.available.size;
  }

  // 获取已加载 Claw 数量
  get loadedCount(): number {
    return this.loaded.size;
  }

  // 检查是否已加载
  isLoaded(name: string): boolean {
    return this.loaded.has(name);
  }

  // 根据触发词自动加载
  autoLoad(text: string): string[] {
    const loaded: string[] = [];
    
    for (const [name, meta] of this.available) {
      if (this.loaded.has(name)) continue;
      
      const triggers = meta.triggers || [name];
      for (const trigger of triggers) {
        if (text.toLowerCase().includes(trigger.toLowerCase())) {
          this.load(name);
          loaded.push(name);
          break;
        }
      }
    }
    
    return loaded;
  }
}

export default ClawLoader;
