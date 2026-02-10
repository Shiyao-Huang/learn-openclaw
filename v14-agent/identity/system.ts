/**
 * v11-agent/identity/system.ts - 身份系统
 * 
 * 管理 Agent 的身份文件：SOUL.md, USER.md, AGENTS.md 等
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { IdentityFiles } from "../core/types.js";

export class IdentitySystem {
  private identityDir: string;
  private sampleDir: string;
  private cache: IdentityFiles = {};

  constructor(identityDir: string, sampleDir?: string) {
    this.identityDir = identityDir;
    this.sampleDir = sampleDir || path.join(identityDir, ".ID.sample");
  }

  // 初始化身份文件（从样本复制）
  async init(): Promise<string> {
    const files = ["AGENTS.md", "SOUL.md", "USER.md", "IDENTITY.md"];
    const created: string[] = [];

    for (const file of files) {
      const targetPath = path.join(this.identityDir, file);
      const samplePath = path.join(this.sampleDir, file);

      if (!fs.existsSync(targetPath)) {
        if (fs.existsSync(samplePath)) {
          await fsp.copyFile(samplePath, targetPath);
          created.push(file);
        } else {
          // 创建空文件
          await fsp.writeFile(targetPath, `# ${file.replace(".md", "")}\n\n`);
          created.push(file);
        }
      }
    }

    this.load(); // 重新加载
    return created.length > 0
      ? `已创建: ${created.join(", ")}`
      : "身份文件已存在";
  }

  // 加载所有身份文件（同步，用于启动时）
  load(): IdentityFiles {
    const files: Record<string, string> = {
      agents: "AGENTS.md",
      soul: "SOUL.md",
      user: "USER.md",
      memory: "MEMORY.md",
      heartbeat: "HEARTBEAT.md",
      tools: "TOOLS.md",
    };

    this.cache = {};
    for (const [key, filename] of Object.entries(files)) {
      const filePath = path.join(this.identityDir, filename);
      if (fs.existsSync(filePath)) {
        this.cache[key] = fs.readFileSync(filePath, "utf-8");
      }
    }

    return this.cache;
  }

  // 异步加载所有身份文件
  async loadAsync(): Promise<IdentityFiles> {
    const files: Record<string, string> = {
      agents: "AGENTS.md",
      soul: "SOUL.md",
      user: "USER.md",
      memory: "MEMORY.md",
      heartbeat: "HEARTBEAT.md",
      tools: "TOOLS.md",
    };

    this.cache = {};
    for (const [key, filename] of Object.entries(files)) {
      const filePath = path.join(this.identityDir, filename);
      if (fs.existsSync(filePath)) {
        this.cache[key] = await fsp.readFile(filePath, "utf-8");
      }
    }

    return this.cache;
  }

  // 获取身份摘要（用于 system prompt）
  getSummary(): string {
    const parts: string[] = [];

    if (this.cache.soul) {
      parts.push(`# 你的灵魂\n${this.cache.soul}`);
    }
    if (this.cache.user) {
      parts.push(`# 用户信息\n${this.cache.user}`);
    }
    if (this.cache.agents) {
      parts.push(`# 行为规范\n${this.cache.agents}`);
    }

    return parts.join("\n\n");
  }

  // 获取单个文件
  getFile(name: keyof IdentityFiles): string | undefined {
    return this.cache[name];
  }

  // 更新身份文件
  async update(name: string, content: string): Promise<string> {
    const validFiles = ["IDENTITY.md", "SOUL.md", "USER.md", "HEARTBEAT.md", "TOOLS.md"];
    if (!validFiles.includes(name)) {
      return `错误: 不允许更新 ${name}`;
    }

    const filePath = path.join(this.identityDir, name);
    await fsp.writeFile(filePath, content);

    // 更新缓存
    const key = name.replace(".md", "").toLowerCase();
    this.cache[key] = content;

    return `已更新 ${name}`;
  }

  // 获取 Agent 名称
  getName(): string {
    // 尝试从 SOUL.md 或 IDENTITY.md 提取名称
    const soul = this.cache.soul || "";
    const match = soul.match(/name[:\s]+([^\n]+)/i);
    return match ? match[1].trim() : "OpenClaw";
  }

  // 检查是否已初始化
  isInitialized(): boolean {
    return fs.existsSync(path.join(this.identityDir, "SOUL.md")) ||
           fs.existsSync(path.join(this.identityDir, "AGENTS.md"));
  }

  // 获取身份目录
  getDir(): string {
    return this.identityDir;
  }
}

export default IdentitySystem;
