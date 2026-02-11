/**
 * v11-agent/skill/loader.ts - Skill 技能加载器
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { SkillMetadata, LoadedSkill } from "../core/types.js";

export class SkillLoader {
  private skillsDir: string;
  private loaded: Map<string, LoadedSkill> = new Map();
  private available: Map<string, SkillMetadata> = new Map();

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
    this.scan();
  }

  // 扫描可用的 Skill（同步，用于构造函数）
  scan(): void {
    this.available.clear();

    if (!fs.existsSync(this.skillsDir)) {
      return;
    }

    const dirs = fs.readdirSync(this.skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const dir of dirs) {
      const skillPath = path.join(this.skillsDir, dir, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, "utf-8");
        const metadata = this.parseMetadata(content, dir);
        this.available.set(dir, metadata);
      }
    }
  }

  // 异步扫描可用的 Skill
  async scanAsync(): Promise<void> {
    this.available.clear();

    if (!fs.existsSync(this.skillsDir)) {
      return;
    }

    const entries = await fsp.readdir(this.skillsDir, { withFileTypes: true });
    const dirs = entries.filter(d => d.isDirectory()).map(d => d.name);

    for (const dir of dirs) {
      const skillPath = path.join(this.skillsDir, dir, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const content = await fsp.readFile(skillPath, "utf-8");
        const metadata = this.parseMetadata(content, dir);
        this.available.set(dir, metadata);
      }
    }
  }

  // 解析 SKILL.md 中的元数据
  private parseMetadata(content: string, name: string): SkillMetadata {
    const metadata: SkillMetadata = { name, description: "" };

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

  // 加载 Skill（同步，用于 autoLoad）
  load(name: string): string {
    if (this.loaded.has(name)) {
      return `Skill "${name}" 已加载`;
    }

    const skillPath = path.join(this.skillsDir, name, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      return `错误: Skill "${name}" 不存在`;
    }

    const content = fs.readFileSync(skillPath, "utf-8");
    const metadata = this.available.get(name) || this.parseMetadata(content, name);

    this.loaded.set(name, { name, content, metadata });
    return `已加载 Skill: ${name}\n${metadata.description}`;
  }

  // 异步加载 Skill
  async loadAsync(name: string): Promise<string> {
    if (this.loaded.has(name)) {
      return `Skill "${name}" 已加载`;
    }

    const skillPath = path.join(this.skillsDir, name, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      return `错误: Skill "${name}" 不存在`;
    }

    const content = await fsp.readFile(skillPath, "utf-8");
    const metadata = this.available.get(name) || this.parseMetadata(content, name);

    this.loaded.set(name, { name, content, metadata });
    return `已加载 Skill: ${name}\n${metadata.description}`;
  }

  // 卸载 Skill
  unload(name: string): string {
    if (this.loaded.delete(name)) {
      return `已卸载 Skill: ${name}`;
    }
    return `Skill "${name}" 未加载`;
  }

  // 获取已加载的 Skill 内容（用于 system prompt）
  getLoadedContent(): string {
    if (this.loaded.size === 0) return "";

    const parts: string[] = ["# 已加载的技能\n"];
    for (const [name, skill] of this.loaded) {
      parts.push(`## ${name}\n${skill.content}\n`);
    }
    return parts.join("\n");
  }

  // 列出可用的 Skill
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

  // 获取可用 Skill 数量
  get count(): number {
    return this.available.size;
  }

  // 获取已加载 Skill 数量
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

export default SkillLoader;
