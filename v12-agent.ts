#!/usr/bin/env tsx
/**
 * v12-agent.ts - 安全策略系统 (~2600行)
 *
 * 核心哲学: "信任但验证"
 * ================================================
 * V12 在 V11 基础上增加 Security 系统：
 * - 工具权限分级: safe/confirm/dangerous
 * - 上下文感知: 根据渠道/用户调整策略
 * - 审计日志: 记录所有敏感操作
 * - 敏感数据保护: 自动识别和遮蔽
 *
 * Security 能力:
 * - security_check: 检查操作是否允许
 * - security_audit: 查看审计日志
 * - security_policy: 查看/更新安全策略
 * - security_mask: 遮蔽敏感信息
 *
 * 设计原则:
 * - 最小权限: 默认拒绝，显式允许
 * - 分层防御: 多重检查，逐层把关
 * - 可审计: 所有操作留痕
 * - 可配置: 策略可按需调整
 *
 * 演进路线:
 * V0: bash 即一切
 * V1: 5个基础工具
 * V2: 本地向量记忆
 * V3: 极简任务规划
 * V4: 子代理协调
 * V5: Claw 系统
 * V6: 身份与灵魂
 * V7: 分层记忆
 * V8: 心跳主动性
 * V9: 会话管理
 * V10: 内省系统
 * V11: Channel 系统
 * V12: 安全策略系统 (当前)
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createHash } from "crypto";

// 加载 .env 文件（强制覆盖系统变量）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("\x1b[31m错误: 未设置 ANTHROPIC_API_KEY\x1b[0m");
  process.exit(1);
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL
});
const MODEL = process.env.MODEL_ID || "claude-opus-4-6";
const WORKDIR = process.cwd();
const CLAW_DIR = process.env.CLAW_DIR || path.join(WORKDIR, "claws");
const IDENTITY_DIR = process.env.IDENTITY_DIR || WORKDIR;
const ID_SAMPLE_DIR = process.env.ID_SAMPLE_DIR || path.join(__dirname, ".ID.sample");

// ============================================================================
// 本地向量记忆系统 - 零外部依赖
// ============================================================================

interface MemoryDoc {
  id: string;
  content: string;
  source: string;
  chunk: number;
  timestamp: number;
}

class LocalMemory {
  private memoryDir: string;
  private indexFile: string;
  private docs: Map<string, MemoryDoc> = new Map();

  constructor() {
    this.memoryDir = path.join(WORKDIR, "memory");
    this.indexFile = path.join(this.memoryDir, ".index.json");
    this.load();
  }

  // Jaccard 相似度 - 对中文更友好
  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase());
    const setB = new Set(b.toLowerCase());
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  // 加载索引
  private load() {
    if (fs.existsSync(this.indexFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.indexFile, "utf-8"));
        for (const doc of data.docs || []) {
          this.docs.set(doc.id, doc);
        }
      } catch (e) {
        console.log("\x1b[33m警告: 索引文件损坏，重新创建\x1b[0m");
      }
    }
  }

  // 保存索引
  private save() {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    const data = { docs: Array.from(this.docs.values()), updated: Date.now() };
    fs.writeFileSync(this.indexFile, JSON.stringify(data, null, 2));
  }

  // 文本分块
  private chunkText(text: string, size: number = 500): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let current = "";

    for (const para of paragraphs) {
      if (current.length + para.length > size) {
        if (current) chunks.push(current.trim());
        current = para;
      } else {
        current += "\n\n" + para;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks;
  }

  // 摄入文件
  ingestFile(filePath: string): string {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return `错误: 文件不存在 ${filePath}`;

    const content = fs.readFileSync(fullPath, "utf-8");
    const chunks = content.split(/\n\n+/).filter(c => c.trim());
    let added = 0;

    for (let i = 0; i < chunks.length; i++) {
      const id = createHash("md5").update(`${fullPath}:${i}:${chunks[i]}`).digest("hex");
      if (!this.docs.has(id)) {
        this.docs.set(id, {
          id,
          content: chunks[i],
          source: path.relative(WORKDIR, fullPath),
          chunk: i,
          timestamp: Date.now()
        });
        added++;
      }
    }

    this.save();
    return `已摄入: ${filePath} (${added} 新块, 共 ${chunks.length} 块)`;
  }

  // 摄入目录
  ingestDirectory(dir: string): string {
    const fullDir = path.resolve(dir);
    if (!fs.existsSync(fullDir)) return `错误: 目录不存在 ${dir}`;

    const files = fs.readdirSync(fullDir)
      .filter(f => f.endsWith(".md") && !f.startsWith("."))
      .map(f => path.join(fullDir, f));

    let total = 0;
    for (const file of files) {
      const result = this.ingestFile(file);
      if (result.includes("已摄入")) total++;
    }
    return `已摄入 ${total} 个文件到记忆库`;
  }

  // 语义搜索 - 使用 Jaccard 相似度
  search(query: string, maxResults: number = 5): string {
    if (this.docs.size === 0) return "记忆库为空";

    const results = Array.from(this.docs.values())
      .map(doc => ({
        doc,
        score: this.jaccardSimilarity(query, doc.content)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    if (results.length === 0 || results[0].score < 0.01) {
      return "未找到相关记忆";
    }

    return results
      .map(({ doc, score }) => `[${doc.source}:${doc.chunk}] (相似度: ${(score * 100).toFixed(1)}%)\n${doc.content.slice(0, 200)}...`)
      .join("\n\n");
  }

  // 读取原始文件
  get(filePath: string, fromLine?: number, lines?: number): string {
    const fullPath = path.join(this.memoryDir, filePath);
    if (!fs.existsSync(fullPath)) return `错误: 文件不存在 ${filePath}`;

    let content = fs.readFileSync(fullPath, "utf-8");
    if (fromLine !== undefined) {
      const allLines = content.split("\n");
      const start = fromLine - 1;
      const end = lines ? start + lines : allLines.length;
      content = allLines.slice(start, end).join("\n");
    }
    return content;
  }

  // 追加到记忆文件
  append(filePath: string, content: string): string {
    const fullPath = path.join(this.memoryDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const timestamp = new Date().toISOString();
    const entry = `\n## ${timestamp}\n\n${content}\n`;
    fs.appendFileSync(fullPath, entry, "utf-8");

    // 自动重新摄入
    this.ingestFile(fullPath);
    return `已追加到: ${filePath}`;
  }

  // 统计信息
  stats(): string {
    return `记忆库: ${this.docs.size} 个片段`;
  }
}

const memory = new LocalMemory();

// ============================================================================
// 任务管理系统 - V3 新增 (奥卡姆剃刀: 仅一个 TodoWrite 工具)
// ============================================================================

interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
}

class TodoManager {
  private todos: Todo[] = [];

  update(items: Todo[]): string {
    // 验证规则
    const inProgressCount = items.filter(t => t.status === "in_progress").length;
    if (inProgressCount > 1) {
      return `错误: 只能有 1 个 in_progress 任务，当前有 ${inProgressCount} 个`;
    }
    if (items.length > 20) {
      return `错误: 最多 20 个任务，当前有 ${items.length} 个`;
    }

    this.todos = items;
    return this.format();
  }

  private format(): string {
    if (this.todos.length === 0) return "暂无任务";

    const lines = this.todos.map((t, i) => {
      const icon = t.status === "completed" ? "✓" : t.status === "in_progress" ? "▶" : "○";
      return `${i + 1}. [${icon}] ${t.content}`;
    });

    const pending = this.todos.filter(t => t.status === "pending").length;
    const inProgress = this.todos.filter(t => t.status === "in_progress").length;
    const completed = this.todos.filter(t => t.status === "completed").length;

    return lines.join("\n") + `\n\n总计: ${this.todos.length} | 待办: ${pending} | 进行中: ${inProgress} | 完成: ${completed}`;
  }

  getCurrent(): string {
    return this.format();
  }
}

const todoManager = new TodoManager();

// ============================================================================
// Claw 系统 - V5 新增 (知识外部化与渐进式加载)
// ============================================================================

interface Claw {
  name: string;
  description: string;
  content: string;
  path: string;
}

class ClawLoader {
  private clawsDir: string;
  private claws: Map<string, Claw> = new Map();

  constructor() {
    this.clawsDir = CLAW_DIR;
    this.loadClaws();
  }

  // 解析 CLAW.md 文件 (YAML frontmatter + Markdown body)
  private parseClawFile(filePath: string): Claw | null {
    try {
      const content = fs.readFileSync(filePath, "utf-8");

      // 匹配 ---\nYAML\n---\nMarkdown 格式
      const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      if (!match) return null;

      const yamlContent = match[1];
      const markdownContent = match[2].trim();

      // 简单 YAML 解析 (只处理 name 和 description)
      const name = yamlContent.match(/name:\s*(.+)/)?.[1]?.trim();
      const description = yamlContent.match(/description:\s*(.+)/)?.[1]?.trim();

      if (!name || !description) return null;

      return {
        name,
        description,
        content: markdownContent,
        path: filePath
      };
    } catch (e) {
      return null;
    }
  }

  // 加载所有 claw
  private loadClaws() {
    if (!fs.existsSync(this.clawsDir)) return;

    const entries = fs.readdirSync(this.clawsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const clawPath = path.join(this.clawsDir, entry.name, "CLAW.md");
        if (fs.existsSync(clawPath)) {
          const claw = this.parseClawFile(clawPath);
          if (claw) {
            this.claws.set(claw.name, claw);
          }
        }
      }
    }
  }

  // 获取 claw 列表用于系统提示 (仅元数据)
  getDescriptions(): string {
    if (this.claws.size === 0) return "无可用技能";

    const lines = Array.from(this.claws.values()).map(s =>
      `- ${s.name}: ${s.description}`
    );
    return lines.join("\n");
  }

  // 获取 claw 数量
  get count(): number {
    return this.claws.size;
  }

  // 加载指定 claw 的完整内容 (作为 tool_result 注入)
  loadClaw(name: string): string {
    const claw = this.claws.get(name);
    if (!claw) return `错误: 技能 '${name}' 不存在`;

    return `<claw-loaded name="${name}">
${claw.content}
</claw-loaded>

请按照上述技能文档的指引完成任务。`;
  }

  // 列出所有可用 claw 名称
  listClaws(): string {
    if (this.claws.size === 0) return "无可用技能";
    return Array.from(this.claws.keys()).join(", ");
  }
}

const clawLoader = new ClawLoader();

// ============================================================================
// V6 新增: 身份系统 - Workspace 初始化与人格加载
// ============================================================================

// 人格文件列表（从 .ID.sample 目录复制）
const PERSONA_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "IDENTITY.md",
  "USER.md",
  "BOOTSTRAP.md",
  "HEARTBEAT.md",
  "TOOLS.md"
];

// 从 .ID.sample 目录加载模板内容
function loadPersonaTemplate(filename: string): string {
  const samplePath = path.join(ID_SAMPLE_DIR, filename);
  if (fs.existsSync(samplePath)) {
    return fs.readFileSync(samplePath, "utf-8");
  }
  // 如果 .ID.sample 不存在，返回最小模板
  return `# ${filename}\n\n(模板文件缺失，请检查 .ID.sample 目录)`;
}

class IdentitySystem {
  private workspaceDir: string;
  private identityCache: { name: string; soul: string; user: string; rules: string } | null = null;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
  }

  // 初始化 Workspace（从 .ID.sample 复制缺失的人格文件）
  initWorkspace(): string {
    const created: string[] = [];
    const existed: string[] = [];

    // 确保 workspace 目录存在
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
      created.push(path.basename(this.workspaceDir) + "/");
    }

    for (const filename of PERSONA_FILES) {
      const filePath = path.join(this.workspaceDir, filename);
      if (!fs.existsSync(filePath)) {
        const content = loadPersonaTemplate(filename);
        fs.writeFileSync(filePath, content, "utf-8");
        created.push(filename);
      } else {
        existed.push(filename);
      }
    }

    // 确保 memory 目录存在
    const memoryDir = path.join(this.workspaceDir, "memory");
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
      created.push("memory/");
    }

    if (created.length === 0) {
      return `Workspace 已就绪 (${existed.length} 个人格文件)`;
    }
    return `Workspace 初始化:\n  创建: ${created.join(", ")}\n  已存在: ${existed.join(", ")}`;
  }

  // 加载身份信息
  loadIdentity(): string {
    const files = ["AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md"];
    const contents: Record<string, string> = {};

    for (const file of files) {
      const filePath = path.join(this.workspaceDir, file);
      contents[file] = fs.existsSync(filePath)
        ? fs.readFileSync(filePath, "utf-8")
        : `(${file} 不存在)`;
    }

    // 提取名字 (支持 **名字** 和 **Name**，中英文冒号)
    const nameMatch = contents["IDENTITY.md"].match(/\*\*(名字|Name)\*\*[：:]\s*(.+)/);
    const rawName = nameMatch ? nameMatch[2].trim() : "";
    // 过滤掉占位符文本
    const name = (rawName && !rawName.startsWith("_（") && !rawName.startsWith("_("))
      ? rawName
      : "";

    this.identityCache = {
      name: name || "Assistant",
      soul: contents["SOUL.md"],
      user: contents["USER.md"],
      rules: contents["AGENTS.md"]
    };

    // 检查是否需要首次引导：BOOTSTRAP.md 存在且名字未设置
    const bootstrapPath = path.join(this.workspaceDir, "BOOTSTRAP.md");
    const needsBootstrap = fs.existsSync(bootstrapPath) && !name;

    return needsBootstrap
      ? `🌟 首次运行！请与我对话完成身份设置。`
      : `身份加载完成: ${this.identityCache.name}`;
  }

  // 获取增强的系统提示（注入身份信息）
  getEnhancedSystemPrompt(basePrompt: string): string {
    if (!this.identityCache) {
      this.loadIdentity();
    }

    return `${basePrompt}

# 你的身份
${this.identityCache!.soul}

# 用户信息  
${this.identityCache!.user}

# 行为规范
${this.identityCache!.rules}`;
  }

  // 更新身份文件
  updateIdentityFile(file: string, content: string): string {
    const validFiles = ["IDENTITY.md", "SOUL.md", "USER.md", "HEARTBEAT.md", "TOOLS.md"];
    if (!validFiles.includes(file)) {
      return `错误: 只能更新 ${validFiles.join(", ")}`;
    }
    const filePath = path.join(this.workspaceDir, file);
    fs.writeFileSync(filePath, content, "utf-8");
    this.identityCache = null; // 清除缓存
    return `已更新: ${file}`;
  }

  // 获取当前身份摘要
  getIdentitySummary(): string {
    if (!this.identityCache) {
      this.loadIdentity();
    }
    return `名字: ${this.identityCache!.name}\n\n灵魂摘要:\n${this.identityCache!.soul.slice(0, 300)}...`;
  }

  // 获取名字
  getName(): string {
    if (!this.identityCache) {
      this.loadIdentity();
    }
    return this.identityCache!.name;
  }
}

const identitySystem = new IdentitySystem(IDENTITY_DIR);

// ============================================================================
// V7 新增: 分层记忆系统 - 日记本模式
// ============================================================================

class LayeredMemory {
  private workspaceDir: string;
  private memoryDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.memoryDir = path.join(workspaceDir, "memory");
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  // 获取今天的日期字符串
  private getToday(): string {
    return new Date().toISOString().split("T")[0];
  }

  // 获取日记文件路径
  private getDailyPath(date?: string): string {
    return path.join(this.memoryDir, `${date || this.getToday()}.md`);
  }

  // 写入今日日记
  writeDailyNote(content: string): string {
    const today = this.getToday();
    const filePath = this.getDailyPath(today);
    const timestamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    
    let existing = fs.existsSync(filePath) 
      ? fs.readFileSync(filePath, "utf-8")
      : `# ${today} 日记\n`;
    
    fs.writeFileSync(filePath, existing + `\n## ${timestamp}\n\n${content}\n`, "utf-8");
    return `已记录到 ${today} 日记`;
  }

  // 读取指定日期的日记
  readDailyNote(date?: string): string {
    const filePath = this.getDailyPath(date);
    if (!fs.existsSync(filePath)) {
      return date ? `${date} 没有日记` : "今天还没有日记";
    }
    return fs.readFileSync(filePath, "utf-8");
  }

  // 读取最近 N 天的日记
  readRecentNotes(days: number = 3): string {
    const notes: string[] = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const filePath = this.getDailyPath(dateStr);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        notes.push(`--- ${dateStr} ---\n${content.slice(0, 1500)}${content.length > 1500 ? "..." : ""}`);
      }
    }
    
    return notes.length > 0 ? notes.join("\n\n") : "最近没有日记";
  }

  // 列出所有日记
  listDailyNotes(): string {
    const files = fs.readdirSync(this.memoryDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();
    
    if (files.length === 0) return "暂无日记";
    
    return files.slice(0, 20).map(f => {
      const date = f.replace(".md", "");
      const stat = fs.statSync(path.join(this.memoryDir, f));
      return `- ${date} (${Math.round(stat.size / 1024)}KB)`;
    }).join("\n");
  }

  // 读取长期记忆 (MEMORY.md)
  readLongTermMemory(): string {
    const memoryPath = path.join(this.workspaceDir, "MEMORY.md");
    if (!fs.existsSync(memoryPath)) {
      return "长期记忆为空（MEMORY.md 不存在）";
    }
    return fs.readFileSync(memoryPath, "utf-8");
  }

  // 完整更新长期记忆
  updateLongTermMemory(content: string): string {
    const memoryPath = path.join(this.workspaceDir, "MEMORY.md");
    fs.writeFileSync(memoryPath, content, "utf-8");
    return "长期记忆已更新";
  }

  // 追加到长期记忆的某个分类
  appendLongTermMemory(section: string, content: string): string {
    const memoryPath = path.join(this.workspaceDir, "MEMORY.md");
    let existing = fs.existsSync(memoryPath)
      ? fs.readFileSync(memoryPath, "utf-8")
      : "# MEMORY.md - 长期记忆\n";
    
    const sectionHeader = `## ${section}`;
    if (existing.includes(sectionHeader)) {
      // 在 section 末尾追加
      const lines = existing.split("\n");
      const sectionIndex = lines.findIndex(l => l.startsWith(sectionHeader));
      let insertIndex = sectionIndex + 1;
      while (insertIndex < lines.length && !lines[insertIndex].startsWith("## ")) {
        insertIndex++;
      }
      lines.splice(insertIndex, 0, `- ${content}`);
      existing = lines.join("\n");
    } else {
      existing += `\n\n${sectionHeader}\n\n- ${content}`;
    }
    
    fs.writeFileSync(memoryPath, existing, "utf-8");
    return `已添加到长期记忆 [${section}]`;
  }

  // 搜索所有记忆（日记 + 长期记忆）
  searchAllMemory(query: string): string {
    const results: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // 搜索长期记忆
    const longTermPath = path.join(this.workspaceDir, "MEMORY.md");
    if (fs.existsSync(longTermPath)) {
      const content = fs.readFileSync(longTermPath, "utf-8");
      if (content.toLowerCase().includes(lowerQuery)) {
        const lines = content.split("\n").filter(l => l.toLowerCase().includes(lowerQuery));
        results.push(`[MEMORY.md] ${lines[0]?.slice(0, 100) || "找到匹配"}`);
      }
    }
    
    // 搜索最近30天日记
    const files = fs.readdirSync(this.memoryDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse()
      .slice(0, 30);
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.memoryDir, file), "utf-8");
      if (content.toLowerCase().includes(lowerQuery)) {
        const date = file.replace(".md", "");
        const lines = content.split("\n").filter(l => l.toLowerCase().includes(lowerQuery));
        results.push(`[${date}] ${lines[0]?.slice(0, 100) || "找到匹配"}`);
      }
    }
    
    return results.length > 0 ? results.slice(0, 10).join("\n") : "未找到相关记忆";
  }

  // 获取时间上下文
  getTimeContext(): string {
    const now = new Date();
    const today = this.getToday();
    const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    const hour = now.getHours();
    
    let timeOfDay = "凌晨";
    if (hour >= 6 && hour < 12) timeOfDay = "上午";
    else if (hour >= 12 && hour < 14) timeOfDay = "中午";
    else if (hour >= 14 && hour < 18) timeOfDay = "下午";
    else if (hour >= 18 && hour < 22) timeOfDay = "晚上";
    else if (hour >= 22) timeOfDay = "深夜";
    
    return `今天是 ${today} 星期${dayOfWeek}，现在是${timeOfDay} ${hour}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
}

const layeredMemory = new LayeredMemory(WORKDIR);

// ============================================================================
// V8 新增: Heartbeat 系统 - 主动性与周期检查
// ============================================================================

interface HeartbeatState {
  lastChecks: Record<string, number>;
  lastHeartbeat: number;
}

class HeartbeatSystem {
  private workspaceDir: string;
  private heartbeatFile: string;
  private stateFile: string;
  private state: HeartbeatState;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.heartbeatFile = path.join(workspaceDir, "HEARTBEAT.md");
    this.stateFile = path.join(workspaceDir, "memory", "heartbeat-state.json");
    this.state = this.loadState();
  }

  private loadState(): HeartbeatState {
    if (fs.existsSync(this.stateFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.stateFile, "utf-8"));
      } catch (e) { /* 文件损坏，重新创建 */ }
    }
    return { lastChecks: {}, lastHeartbeat: 0 };
  }

  private saveState() {
    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  // 读取心跳清单
  getChecklist(): string {
    if (!fs.existsSync(this.heartbeatFile)) {
      return "HEARTBEAT.md 不存在（这是正常的，可以创建一个来定义检查清单）";
    }
    return fs.readFileSync(this.heartbeatFile, "utf-8");
  }

  // 更新心跳清单
  updateChecklist(content: string): string {
    fs.writeFileSync(this.heartbeatFile, content, "utf-8");
    return "HEARTBEAT.md 已更新";
  }

  // 记录检查时间
  recordCheck(checkName: string): string {
    this.state.lastChecks[checkName] = Date.now();
    this.state.lastHeartbeat = Date.now();
    this.saveState();
    return `已记录检查: ${checkName}`;
  }

  // 获取检查状态
  getStatus(): string {
    const lines = [`上次心跳: ${this.state.lastHeartbeat ? new Date(this.state.lastHeartbeat).toLocaleString("zh-CN") : "从未"}`];
    for (const [name, time] of Object.entries(this.state.lastChecks)) {
      const ago = Math.floor((Date.now() - time) / 60000);
      lines.push(`- ${name}: ${ago} 分钟前`);
    }
    return lines.join("\n");
  }

  // 判断是否应该打扰用户
  shouldDisturb(): boolean {
    const hour = new Date().getHours();
    return !(hour >= 23 || hour < 8); // 深夜不打扰
  }

  // 判断是否需要检查某项
  needsCheck(checkName: string, intervalMinutes: number = 30): boolean {
    const lastTime = this.state.lastChecks[checkName] || 0;
    return (Date.now() - lastTime) / 60000 >= intervalMinutes;
  }

  // 执行心跳
  runHeartbeat(): string {
    if (!this.shouldDisturb()) {
      return "HEARTBEAT_OK (深夜静默)";
    }
    const checklist = this.getChecklist();
    if (checklist.includes("不存在")) {
      return "HEARTBEAT_OK (无检查清单)";
    }
    this.state.lastHeartbeat = Date.now();
    this.saveState();
    return `心跳触发，请检查 HEARTBEAT.md 中的事项。如果没有需要处理的，回复 HEARTBEAT_OK`;
  }
}

const heartbeatSystem = new HeartbeatSystem(WORKDIR);

// ============================================================================
// V9 新增: Session 系统 - 多会话管理
// ============================================================================

type SessionType = "main" | "isolated";

interface Session {
  key: string;
  type: SessionType;
  history: Anthropic.MessageParam[];
  createdAt: number;
  lastActiveAt: number;
  metadata: Record<string, any>;
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionsDir: string;

  constructor(workspaceDir: string) {
    this.sessionsDir = path.join(workspaceDir, ".sessions");
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    this.loadSessions();
  }

  private loadSessions() {
    const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.sessionsDir, file), "utf-8"));
        this.sessions.set(data.key, data);
      } catch (e) { /* 忽略损坏的会话文件 */ }
    }
  }

  private saveSession(session: Session) {
    const filePath = path.join(this.sessionsDir, `${session.key}.json`);
    const toSave = { ...session, history: session.history.slice(-20) }; // 只保存最近20条
    fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2));
  }

  private generateKey(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // 创建新会话
  createSession(type: SessionType = "main", metadata: Record<string, any> = {}): Session {
    const session: Session = {
      key: this.generateKey(),
      type,
      history: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      metadata
    };
    this.sessions.set(session.key, session);
    this.saveSession(session);
    return session;
  }

  // 获取会话
  getSession(key: string): Session | undefined {
    const session = this.sessions.get(key);
    if (session) session.lastActiveAt = Date.now();
    return session;
  }

  // 获取或创建会话
  getOrCreateSession(key?: string, type: SessionType = "main"): Session {
    if (key) {
      const existing = this.getSession(key);
      if (existing) return existing;
    }
    return this.createSession(type);
  }

  // 更新会话历史
  updateHistory(key: string, history: Anthropic.MessageParam[]) {
    const session = this.sessions.get(key);
    if (session) {
      session.history = history;
      session.lastActiveAt = Date.now();
      this.saveSession(session);
    }
  }

  // 列出所有会话
  listSessions(): string {
    const sessions = Array.from(this.sessions.values())
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    if (sessions.length === 0) return "暂无会话";
    return sessions.slice(0, 10).map(s => {
      const ago = Math.floor((Date.now() - s.lastActiveAt) / 60000);
      return `- ${s.key} [${s.type}] (${ago}分钟前, ${s.history.length}条消息)`;
    }).join("\n");
  }

  // 删除会话
  deleteSession(key: string): string {
    if (!this.sessions.has(key)) return `会话 ${key} 不存在`;
    this.sessions.delete(key);
    const filePath = path.join(this.sessionsDir, `${key}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return `已删除会话 ${key}`;
  }

  // 清理过期会话（超过 7 天）
  cleanupSessions(): string {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let cleaned = 0;
    for (const [key, session] of this.sessions) {
      if (session.lastActiveAt < cutoff) {
        this.deleteSession(key);
        cleaned++;
      }
    }
    return `已清理 ${cleaned} 个过期会话`;
  }

  // 判断是否是主会话
  isMainSession(key: string): boolean {
    return this.sessions.get(key)?.type === "main";
  }
}

const sessionManager = new SessionManager(WORKDIR);

// ============================================================================
// V10 新增: Introspection 系统 - 自我观察与反思
// ============================================================================

interface BehaviorLog {
  timestamp: number;
  tool: string;
  args: Record<string, any>;
  result: string;
  duration: number;
  context?: string;
}

interface IntrospectionStats {
  totalCalls: number;
  toolUsage: Record<string, number>;
  avgDuration: number;
  patterns: string[];
  lastReflection: number;
}

class IntrospectionSystem {
  private workspaceDir: string;
  private logsDir: string;
  private statsFile: string;
  private currentSessionLogs: BehaviorLog[] = [];
  private stats: IntrospectionStats;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.logsDir = path.join(workspaceDir, ".introspection");
    this.statsFile = path.join(this.logsDir, "stats.json");
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    this.stats = this.loadStats();
  }

  private loadStats(): IntrospectionStats {
    if (fs.existsSync(this.statsFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.statsFile, "utf-8"));
      } catch (e) { /* 文件损坏 */ }
    }
    return { totalCalls: 0, toolUsage: {}, avgDuration: 0, patterns: [], lastReflection: 0 };
  }

  private saveStats() {
    fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
  }

  // 记录工具调用
  logToolCall(tool: string, args: Record<string, any>, result: string, duration: number, context?: string) {
    const log: BehaviorLog = { timestamp: Date.now(), tool, args, result: result.slice(0, 500), duration, context };
    this.currentSessionLogs.push(log);
    
    // 更新统计
    this.stats.totalCalls++;
    this.stats.toolUsage[tool] = (this.stats.toolUsage[tool] || 0) + 1;
    this.stats.avgDuration = (this.stats.avgDuration * (this.stats.totalCalls - 1) + duration) / this.stats.totalCalls;
    this.saveStats();

    // 每 50 次调用保存一次日志
    if (this.currentSessionLogs.length >= 50) {
      this.persistLogs();
    }
  }

  // 持久化当前会话日志
  private persistLogs() {
    if (this.currentSessionLogs.length === 0) return;
    const filename = `behavior_${new Date().toISOString().split('T')[0]}.jsonl`;
    const filepath = path.join(this.logsDir, filename);
    const lines = this.currentSessionLogs.map(l => JSON.stringify(l)).join('\n') + '\n';
    fs.appendFileSync(filepath, lines);
    this.currentSessionLogs = [];
  }

  // 获取行为统计
  getStats(): string {
    const topTools = Object.entries(this.stats.toolUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool, count]) => `  - ${tool}: ${count} 次`)
      .join('\n');

    return `## 行为统计

总调用次数: ${this.stats.totalCalls}
平均响应时间: ${Math.round(this.stats.avgDuration)}ms

### 最常用工具
${topTools || '  (暂无数据)'}

### 识别的模式
${this.stats.patterns.length > 0 ? this.stats.patterns.map(p => `  - ${p}`).join('\n') : '  (暂无模式)'}

上次反思: ${this.stats.lastReflection ? new Date(this.stats.lastReflection).toLocaleString('zh-CN') : '从未'}`;
  }

  // 分析行为模式
  analyzePatterns(): string {
    const patterns: string[] = [];
    const usage = this.stats.toolUsage;

    // 模式1: 工具偏好
    const totalCalls = this.stats.totalCalls;
    for (const [tool, count] of Object.entries(usage)) {
      const ratio = count / totalCalls;
      if (ratio > 0.3) {
        patterns.push(`高频使用 ${tool} (${Math.round(ratio * 100)}%)`);
      }
    }

    // 模式2: 工具组合（从当前会话日志分析）
    const toolSequences: Record<string, number> = {};
    for (let i = 1; i < this.currentSessionLogs.length; i++) {
      const seq = `${this.currentSessionLogs[i-1].tool} -> ${this.currentSessionLogs[i].tool}`;
      toolSequences[seq] = (toolSequences[seq] || 0) + 1;
    }
    const commonSeqs = Object.entries(toolSequences)
      .filter(([_, count]) => count >= 3)
      .map(([seq, count]) => `${seq} (${count}次)`);
    if (commonSeqs.length > 0) {
      patterns.push(`常见工具链: ${commonSeqs.join(', ')}`);
    }

    // 模式3: 时间分布
    const hours = this.currentSessionLogs.map(l => new Date(l.timestamp).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => hourCounts[h] = (hourCounts[h] || 0) + 1);
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakHour) {
      patterns.push(`活跃高峰: ${peakHour[0]}:00`);
    }

    this.stats.patterns = patterns;
    this.saveStats();

    return patterns.length > 0 
      ? `识别到的行为模式:\n${patterns.map(p => `- ${p}`).join('\n')}`
      : '暂未识别到明显的行为模式（需要更多数据）';
  }

  // 生成自我反思报告
  generateReflection(): string {
    this.persistLogs(); // 先保存当前日志
    this.stats.lastReflection = Date.now();
    this.saveStats();

    const patterns = this.analyzePatterns();
    const stats = this.getStats();

    // 读取最近的行为日志
    const files = fs.readdirSync(this.logsDir)
      .filter(f => f.startsWith('behavior_'))
      .sort()
      .reverse()
      .slice(0, 3);

    let recentBehaviors = '';
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.logsDir, file), 'utf-8');
      const logs = content.trim().split('\n').slice(-10).map(l => {
        try {
          const log = JSON.parse(l);
          return `  [${new Date(log.timestamp).toLocaleTimeString('zh-CN')}] ${log.tool}: ${log.result.slice(0, 50)}...`;
        } catch { return ''; }
      }).filter(Boolean);
      if (logs.length > 0) {
        recentBehaviors += `\n### ${file.replace('behavior_', '').replace('.jsonl', '')}\n${logs.join('\n')}`;
      }
    }

    return `# 自我反思报告
生成时间: ${new Date().toLocaleString('zh-CN')}

${stats}

## 行为模式分析
${patterns}

## 最近行为摘要
${recentBehaviors || '(暂无记录)'}

## 改进建议
基于以上分析，以下是可能的改进方向：
1. 检查高频工具是否有更高效的替代方案
2. 分析工具链是否可以简化
3. 考虑是否需要新的工具来填补能力空白

---
*这是一份自动生成的内省报告。定期反思有助于持续改进。*`;
  }

  // 获取当前会话的行为日志
  getCurrentLogs(): string {
    if (this.currentSessionLogs.length === 0) {
      return '当前会话暂无行为记录';
    }
    return this.currentSessionLogs.slice(-20).map(l => 
      `[${new Date(l.timestamp).toLocaleTimeString('zh-CN')}] ${l.tool}(${JSON.stringify(l.args).slice(0, 50)}...) -> ${l.result.slice(0, 100)}...`
    ).join('\n');
  }
}

const introspectionSystem = new IntrospectionSystem(WORKDIR);

// ============================================================================
// Channel 系统 - V11 新增 (多渠道接入)
// ============================================================================

// 渠道能力定义
interface ChannelCapabilities {
  chatTypes: ('direct' | 'group' | 'channel')[];
  reactions?: boolean;
  polls?: boolean;
  media?: boolean;
  threads?: boolean;
  commands?: boolean;
  markdown?: boolean;
}

// 消息上下文
interface MessageContext {
  channel: string;           // 来源渠道 ID
  chatType: 'direct' | 'group' | 'channel';
  chatId: string;
  userId: string;
  userName?: string;
  messageId: string;
  text: string;
  replyTo?: string;
  timestamp: number;
}

// 用户信任等级
type TrustLevel = 'owner' | 'trusted' | 'normal' | 'restricted';

// 渠道用户
interface ChannelUser {
  channelId: string;
  userId: string;
  userName?: string;
  trustLevel: TrustLevel;
}

// 渠道接口 - 所有渠道必须实现
interface Channel {
  id: string;
  name: string;
  capabilities: ChannelCapabilities;
  
  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  
  // 消息处理
  send(target: string, message: string): Promise<void>;
  onMessage(handler: (ctx: MessageContext) => Promise<void>): void;
  
  // 用户管理
  getTrustLevel(userId: string): TrustLevel;
  setTrustLevel(userId: string, level: TrustLevel): void;
}

// 渠道配置
interface ChannelConfig {
  enabled: boolean;
  token?: string;
  allowFrom?: string[];
  groupPolicy?: 'all' | 'mention-only' | 'disabled';
  dmPolicy?: 'all' | 'allowlist' | 'disabled';
  trustedUsers?: string[];
}

// 渠道管理器
class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private configs: Map<string, ChannelConfig> = new Map();
  private messageHandler?: (ctx: MessageContext) => Promise<void>;
  private configFile: string;

  constructor(workspaceDir: string) {
    this.configFile = path.join(workspaceDir, '.channels.json');
    this.loadConfigs();
  }

  private loadConfigs() {
    if (fs.existsSync(this.configFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.configFile, 'utf-8'));
        for (const [id, config] of Object.entries(data)) {
          this.configs.set(id, config as ChannelConfig);
        }
      } catch (e) {
        console.log('\x1b[33m警告: 渠道配置文件损坏\x1b[0m');
      }
    }
  }

  private saveConfigs() {
    const data: Record<string, ChannelConfig> = {};
    for (const [id, config] of this.configs) {
      data[id] = config;
    }
    fs.writeFileSync(this.configFile, JSON.stringify(data, null, 2));
  }

  // 注册渠道
  register(channel: Channel): void {
    this.channels.set(channel.id, channel);
    if (!this.configs.has(channel.id)) {
      this.configs.set(channel.id, { enabled: false });
      this.saveConfigs();
    }
    
    // 绑定消息处理器
    channel.onMessage(async (ctx) => {
      if (this.messageHandler) {
        await this.messageHandler(ctx);
      }
    });
    
    console.log(`\x1b[36m[Channel] 注册: ${channel.name} (${channel.id})\x1b[0m`);
  }

  // 注销渠道
  unregister(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.stop();
      this.channels.delete(channelId);
      console.log(`\x1b[36m[Channel] 注销: ${channelId}\x1b[0m`);
    }
  }

  // 启动所有已启用的渠道
  async startAll(): Promise<string> {
    const results: string[] = [];
    for (const [id, channel] of this.channels) {
      const config = this.configs.get(id);
      if (config?.enabled) {
        try {
          await channel.start();
          results.push(`✓ ${channel.name}`);
        } catch (e: any) {
          results.push(`✗ ${channel.name}: ${e.message}`);
        }
      }
    }
    return results.length > 0 ? results.join('\n') : '没有已启用的渠道';
  }

  // 停止所有渠道
  async stopAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      await channel.stop();
    }
  }

  // 发送消息到指定渠道
  async send(channelId: string, target: string, message: string): Promise<string> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return `错误: 未知渠道 ${channelId}`;
    }
    if (!channel.isRunning()) {
      return `错误: 渠道 ${channelId} 未运行`;
    }
    try {
      await channel.send(target, message);
      return `已发送到 ${channelId}:${target}`;
    } catch (e: any) {
      return `发送失败: ${e.message}`;
    }
  }

  // 广播消息到所有运行中的渠道
  async broadcast(message: string): Promise<string> {
    const results: string[] = [];
    for (const [id, channel] of this.channels) {
      if (channel.isRunning()) {
        try {
          // 广播到默认目标（需要渠道配置）
          const config = this.configs.get(id);
          if (config?.allowFrom && config.allowFrom.length > 0) {
            await channel.send(config.allowFrom[0], message);
            results.push(`✓ ${id}`);
          }
        } catch (e: any) {
          results.push(`✗ ${id}: ${e.message}`);
        }
      }
    }
    return results.length > 0 ? results.join('\n') : '没有可用的渠道';
  }

  // 设置消息处理器
  onMessage(handler: (ctx: MessageContext) => Promise<void>): void {
    this.messageHandler = handler;
  }

  // 列出所有渠道
  list(): string {
    if (this.channels.size === 0) {
      return '暂无注册的渠道';
    }
    
    const lines: string[] = ['## 已注册渠道\n'];
    for (const [id, channel] of this.channels) {
      const config = this.configs.get(id);
      const status = channel.isRunning() ? '🟢 运行中' : config?.enabled ? '🟡 已启用' : '⚪ 未启用';
      const caps = [];
      if (channel.capabilities.reactions) caps.push('reactions');
      if (channel.capabilities.polls) caps.push('polls');
      if (channel.capabilities.media) caps.push('media');
      if (channel.capabilities.threads) caps.push('threads');
      
      lines.push(`### ${channel.name} (${id})`);
      lines.push(`状态: ${status}`);
      lines.push(`类型: ${channel.capabilities.chatTypes.join(', ')}`);
      if (caps.length > 0) lines.push(`能力: ${caps.join(', ')}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  // 获取渠道状态
  status(channelId?: string): string {
    if (channelId) {
      const channel = this.channels.get(channelId);
      if (!channel) return `未知渠道: ${channelId}`;
      const config = this.configs.get(channelId);
      return `渠道: ${channel.name}
状态: ${channel.isRunning() ? '运行中' : '已停止'}
启用: ${config?.enabled ? '是' : '否'}
群组策略: ${config?.groupPolicy || 'all'}
私聊策略: ${config?.dmPolicy || 'all'}
信任用户: ${config?.trustedUsers?.join(', ') || '(无)'}`;
    }
    
    // 总体状态
    const running = Array.from(this.channels.values()).filter(c => c.isRunning()).length;
    const enabled = Array.from(this.configs.values()).filter(c => c.enabled).length;
    return `渠道总数: ${this.channels.size}
已启用: ${enabled}
运行中: ${running}`;
  }

  // 配置渠道
  configure(channelId: string, updates: Partial<ChannelConfig>): string {
    const config = this.configs.get(channelId) || { enabled: false };
    Object.assign(config, updates);
    this.configs.set(channelId, config);
    this.saveConfigs();
    return `已更新 ${channelId} 配置`;
  }

  // 获取渠道
  get(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  // 获取配置
  getConfig(channelId: string): ChannelConfig | undefined {
    return this.configs.get(channelId);
  }
}

// ============================================================================
// 示例渠道实现: Console Channel (用于测试)
// ============================================================================

class ConsoleChannel implements Channel {
  id = 'console';
  name = 'Console (测试)';
  capabilities: ChannelCapabilities = {
    chatTypes: ['direct'],
    markdown: true
  };
  
  private running = false;
  private handler?: (ctx: MessageContext) => Promise<void>;
  private trustLevels: Map<string, TrustLevel> = new Map();

  async start(): Promise<void> {
    this.running = true;
    console.log('\x1b[32m[Console] 渠道已启动\x1b[0m');
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('\x1b[33m[Console] 渠道已停止\x1b[0m');
  }

  isRunning(): boolean {
    return this.running;
  }

  async send(target: string, message: string): Promise<void> {
    console.log(`\x1b[35m[Console -> ${target}]\x1b[0m ${message}`);
  }

  onMessage(handler: (ctx: MessageContext) => Promise<void>): void {
    this.handler = handler;
  }

  // 模拟接收消息（用于测试）
  async simulateMessage(userId: string, text: string): Promise<void> {
    if (this.handler) {
      await this.handler({
        channel: this.id,
        chatType: 'direct',
        chatId: userId,
        userId,
        messageId: `msg_${Date.now()}`,
        text,
        timestamp: Date.now()
      });
    }
  }

  getTrustLevel(userId: string): TrustLevel {
    return this.trustLevels.get(userId) || 'normal';
  }

  setTrustLevel(userId: string, level: TrustLevel): void {
    this.trustLevels.set(userId, level);
  }
}

// ============================================================================
// 示例渠道实现: Telegram Channel (骨架)
// ============================================================================

class TelegramChannel implements Channel {
  id = 'telegram';
  name = 'Telegram';
  capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group', 'channel'],
    reactions: true,
    polls: true,
    media: true,
    commands: true,
    markdown: true
  };
  
  private running = false;
  private handler?: (ctx: MessageContext) => Promise<void>;
  private trustLevels: Map<string, TrustLevel> = new Map();
  private token?: string;

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN;
  }

  async start(): Promise<void> {
    if (!this.token) {
      throw new Error('未配置 TELEGRAM_BOT_TOKEN');
    }
    this.running = true;
    console.log('\x1b[32m[Telegram] 渠道已启动 (骨架模式)\x1b[0m');
    // TODO: 实际实现需要使用 grammy 或 telegraf 库
    // const bot = new Bot(this.token);
    // bot.on('message', async (ctx) => { ... });
    // await bot.start();
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('\x1b[33m[Telegram] 渠道已停止\x1b[0m');
  }

  isRunning(): boolean {
    return this.running;
  }

  async send(target: string, message: string): Promise<void> {
    if (!this.running) throw new Error('渠道未运行');
    // TODO: 实际发送消息
    console.log(`\x1b[35m[Telegram -> ${target}]\x1b[0m ${message.slice(0, 100)}...`);
  }

  onMessage(handler: (ctx: MessageContext) => Promise<void>): void {
    this.handler = handler;
  }

  getTrustLevel(userId: string): TrustLevel {
    return this.trustLevels.get(userId) || 'normal';
  }

  setTrustLevel(userId: string, level: TrustLevel): void {
    this.trustLevels.set(userId, level);
  }
}

// ============================================================================
// 示例渠道实现: Discord Channel (骨架)
// ============================================================================

class DiscordChannel implements Channel {
  id = 'discord';
  name = 'Discord';
  capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group', 'channel'],
    reactions: true,
    threads: true,
    media: true,
    commands: true,
    markdown: true
  };
  
  private running = false;
  private handler?: (ctx: MessageContext) => Promise<void>;
  private trustLevels: Map<string, TrustLevel> = new Map();
  private token?: string;

  constructor(token?: string) {
    this.token = token || process.env.DISCORD_BOT_TOKEN;
  }

  async start(): Promise<void> {
    if (!this.token) {
      throw new Error('未配置 DISCORD_BOT_TOKEN');
    }
    this.running = true;
    console.log('\x1b[32m[Discord] 渠道已启动 (骨架模式)\x1b[0m');
    // TODO: 实际实现需要使用 discord.js 库
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('\x1b[33m[Discord] 渠道已停止\x1b[0m');
  }

  isRunning(): boolean {
    return this.running;
  }

  async send(target: string, message: string): Promise<void> {
    if (!this.running) throw new Error('渠道未运行');
    console.log(`\x1b[35m[Discord -> ${target}]\x1b[0m ${message.slice(0, 100)}...`);
  }

  onMessage(handler: (ctx: MessageContext) => Promise<void>): void {
    this.handler = handler;
  }

  getTrustLevel(userId: string): TrustLevel {
    return this.trustLevels.get(userId) || 'normal';
  }

  setTrustLevel(userId: string, level: TrustLevel): void {
    this.trustLevels.set(userId, level);
  }
}

// 初始化渠道管理器
const channelManager = new ChannelManager(WORKDIR);

// 注册内置渠道
channelManager.register(new ConsoleChannel());
channelManager.register(new TelegramChannel());
channelManager.register(new DiscordChannel());

// ============================================================================
// Security 系统 - V12 新增 (安全策略与审计)
// ============================================================================

// 工具风险等级
type ToolRiskLevel = 'safe' | 'confirm' | 'dangerous';

// 审计日志条目
interface AuditLogEntry {
  timestamp: number;
  tool: string;
  args: Record<string, any>;
  riskLevel: ToolRiskLevel;
  userId?: string;
  channel?: string;
  chatType?: 'direct' | 'group';
  decision: 'allowed' | 'denied' | 'confirmed';
  reason?: string;
}

// 安全上下文
interface SecurityContext {
  userId?: string;
  channel?: string;
  chatType?: 'direct' | 'group';
  trustLevel: TrustLevel;
}

// 安全策略配置
interface SecurityPolicy {
  // 工具风险分类
  toolRiskLevels: Record<string, ToolRiskLevel>;
  // 信任等级对应的允许风险
  trustAllowedRisk: Record<TrustLevel, ToolRiskLevel[]>;
  // 群聊中禁用的工具
  groupDenyList: string[];
  // 敏感数据模式
  sensitivePatterns: RegExp[];
  // 是否启用审计
  auditEnabled: boolean;
  // 是否需要确认危险操作
  confirmDangerous: boolean;
}

// 默认安全策略
const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  toolRiskLevels: {
    // Safe: 只读操作
    'read_file': 'safe',
    'grep': 'safe',
    'memory_search': 'safe',
    'memory_get': 'safe',
    'memory_stats': 'safe',
    'identity_get': 'safe',
    'daily_read': 'safe',
    'daily_recent': 'safe',
    'daily_list': 'safe',
    'longterm_read': 'safe',
    'time_context': 'safe',
    'heartbeat_get': 'safe',
    'heartbeat_status': 'safe',
    'session_list': 'safe',
    'introspect_stats': 'safe',
    'introspect_patterns': 'safe',
    'introspect_logs': 'safe',
    'channel_list': 'safe',
    'channel_status': 'safe',
    'security_audit': 'safe',
    'security_policy': 'safe',
    
    // Confirm: 写操作
    'write_file': 'confirm',
    'edit_file': 'confirm',
    'memory_append': 'confirm',
    'memory_ingest': 'confirm',
    'identity_update': 'confirm',
    'daily_write': 'confirm',
    'longterm_update': 'confirm',
    'longterm_append': 'confirm',
    'heartbeat_update': 'confirm',
    'heartbeat_record': 'confirm',
    'session_create': 'confirm',
    'session_delete': 'confirm',
    'channel_send': 'confirm',
    'channel_config': 'confirm',
    'channel_start': 'confirm',
    'channel_stop': 'confirm',
    'TodoWrite': 'confirm',
    'Claw': 'confirm',
    'subagent': 'confirm',
    
    // Dangerous: 系统操作
    'bash': 'dangerous',
    'identity_init': 'dangerous',
    'session_cleanup': 'dangerous',
    'heartbeat_run': 'dangerous',
    'introspect_reflect': 'dangerous',
  },
  
  trustAllowedRisk: {
    'owner': ['safe', 'confirm', 'dangerous'],
    'trusted': ['safe', 'confirm'],
    'normal': ['safe'],
    'restricted': [],
  },
  
  groupDenyList: [
    'bash',
    'write_file',
    'edit_file',
    'identity_update',
    'identity_init',
    'session_cleanup',
    'longterm_update',
  ],
  
  sensitivePatterns: [
    /api[_-]?key/i,
    /password/i,
    /secret/i,
    /token/i,
    /private[_-]?key/i,
    /credential/i,
    /\b[A-Za-z0-9+/]{40,}\b/,  // Base64 长字符串
    /sk-[a-zA-Z0-9]{20,}/,     // OpenAI API key
    /ghp_[a-zA-Z0-9]{36}/,     // GitHub token
  ],
  
  auditEnabled: true,
  confirmDangerous: true,
};

// 安全系统
class SecuritySystem {
  private workspaceDir: string;
  private auditDir: string;
  private policyFile: string;
  private policy: SecurityPolicy;
  private currentContext: SecurityContext = { trustLevel: 'normal' };
  private pendingConfirmations: Map<string, { tool: string; args: Record<string, any>; resolve: (confirmed: boolean) => void }> = new Map();

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.auditDir = path.join(workspaceDir, '.security', 'audit');
    this.policyFile = path.join(workspaceDir, '.security', 'policy.json');
    
    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }
    
    this.policy = this.loadPolicy();
  }

  private loadPolicy(): SecurityPolicy {
    if (fs.existsSync(this.policyFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(this.policyFile, 'utf-8'));
        // 合并默认策略和保存的策略
        return {
          ...DEFAULT_SECURITY_POLICY,
          ...saved,
          toolRiskLevels: { ...DEFAULT_SECURITY_POLICY.toolRiskLevels, ...saved.toolRiskLevels },
          trustAllowedRisk: { ...DEFAULT_SECURITY_POLICY.trustAllowedRisk, ...saved.trustAllowedRisk },
        };
      } catch (e) {
        console.log('\x1b[33m警告: 安全策略文件损坏，使用默认策略\x1b[0m');
      }
    }
    return { ...DEFAULT_SECURITY_POLICY };
  }

  private savePolicy() {
    const dir = path.dirname(this.policyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.policyFile, JSON.stringify(this.policy, null, 2));
  }

  // 设置当前安全上下文
  setContext(ctx: Partial<SecurityContext>) {
    this.currentContext = { ...this.currentContext, ...ctx };
  }

  // 获取工具风险等级
  getToolRiskLevel(tool: string): ToolRiskLevel {
    return this.policy.toolRiskLevels[tool] || 'confirm';
  }

  // 检查操作是否允许
  checkPermission(tool: string, args: Record<string, any>): { allowed: boolean; reason?: string; needsConfirm?: boolean } {
    const riskLevel = this.getToolRiskLevel(tool);
    const { trustLevel, chatType, channel } = this.currentContext;
    
    // 检查信任等级
    const allowedRisks = this.policy.trustAllowedRisk[trustLevel];
    if (!allowedRisks.includes(riskLevel)) {
      return { 
        allowed: false, 
        reason: `信任等级 ${trustLevel} 不允许执行 ${riskLevel} 级别的操作` 
      };
    }
    
    // 检查群聊限制
    if (chatType === 'group' && this.policy.groupDenyList.includes(tool)) {
      return { 
        allowed: false, 
        reason: `工具 ${tool} 在群聊中被禁用` 
      };
    }
    
    // 检查是否需要确认
    if (riskLevel === 'dangerous' && this.policy.confirmDangerous) {
      return { 
        allowed: true, 
        needsConfirm: true,
        reason: `危险操作需要确认` 
      };
    }
    
    return { allowed: true };
  }

  // 记录审计日志
  logAudit(entry: Omit<AuditLogEntry, 'timestamp'>) {
    if (!this.policy.auditEnabled) return;
    
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: Date.now(),
      userId: this.currentContext.userId,
      channel: this.currentContext.channel,
      chatType: this.currentContext.chatType,
    };
    
    // 写入日志文件
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.auditDir, `audit_${date}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify(fullEntry) + '\n');
  }

  // 遮蔽敏感信息
  maskSensitive(text: string): string {
    let masked = text;
    for (const pattern of this.policy.sensitivePatterns) {
      masked = masked.replace(pattern, '[REDACTED]');
    }
    return masked;
  }

  // 检查文本是否包含敏感信息
  containsSensitive(text: string): boolean {
    return this.policy.sensitivePatterns.some(p => p.test(text));
  }

  // 获取审计日志
  getAuditLogs(days: number = 7, limit: number = 100): string {
    const logs: AuditLogEntry[] = [];
    const files = fs.readdirSync(this.auditDir)
      .filter(f => f.startsWith('audit_'))
      .sort()
      .reverse()
      .slice(0, days);
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.auditDir, file), 'utf-8');
      const entries = content.trim().split('\n')
        .filter(Boolean)
        .map(line => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);
      logs.push(...entries);
      if (logs.length >= limit) break;
    }
    
    if (logs.length === 0) {
      return '暂无审计日志';
    }
    
    const lines = logs.slice(0, limit).map(log => {
      const time = new Date(log.timestamp).toLocaleString('zh-CN');
      const icon = log.decision === 'allowed' ? '✓' : log.decision === 'denied' ? '✗' : '?';
      return `[${time}] ${icon} ${log.tool} (${log.riskLevel}) - ${log.decision}${log.reason ? `: ${log.reason}` : ''}`;
    });
    
    return `## 审计日志 (最近 ${logs.length} 条)\n\n${lines.join('\n')}`;
  }

  // 获取安全策略摘要
  getPolicySummary(): string {
    const riskCounts = { safe: 0, confirm: 0, dangerous: 0 };
    for (const level of Object.values(this.policy.toolRiskLevels)) {
      riskCounts[level]++;
    }
    
    return `## 安全策略摘要

### 工具风险分布
- 🟢 Safe: ${riskCounts.safe} 个
- 🟡 Confirm: ${riskCounts.confirm} 个
- 🔴 Dangerous: ${riskCounts.dangerous} 个

### 信任等级权限
- owner: ${this.policy.trustAllowedRisk.owner.join(', ')}
- trusted: ${this.policy.trustAllowedRisk.trusted.join(', ')}
- normal: ${this.policy.trustAllowedRisk.normal.join(', ')}
- restricted: ${this.policy.trustAllowedRisk.restricted.join(', ')}

### 群聊禁用工具
${this.policy.groupDenyList.map(t => `- ${t}`).join('\n')}

### 审计状态
- 审计日志: ${this.policy.auditEnabled ? '已启用' : '已禁用'}
- 危险操作确认: ${this.policy.confirmDangerous ? '已启用' : '已禁用'}`;
  }

  // 更新策略
  updatePolicy(updates: Partial<SecurityPolicy>): string {
    this.policy = { ...this.policy, ...updates };
    this.savePolicy();
    return '安全策略已更新';
  }

  // 设置工具风险等级
  setToolRiskLevel(tool: string, level: ToolRiskLevel): string {
    this.policy.toolRiskLevels[tool] = level;
    this.savePolicy();
    return `已将 ${tool} 的风险等级设置为 ${level}`;
  }
}

// 初始化安全系统
const securitySystem = new SecuritySystem(WORKDIR);

// ============================================================================
// 系统提示
// ============================================================================

const BASE_SYSTEM = `你是 OpenClaw V12 - 安全多渠道 Agent。

## 工作循环
observe -> route -> heartbeat -> recall -> identify -> plan -> (load claw) -> (delegate -> collect) -> execute -> track -> remember -> reflect

## Channel 系统 (V11 核心)
工具: channel_list, channel_send, channel_status, channel_config
- 支持多渠道接入: Console, Telegram, Discord 等
- 每个渠道有独立的能力和配置
- 根据消息来源自动路由响应
- 用户信任等级: owner > trusted > normal > restricted

渠道策略:
- 私聊: 可访问完整功能
- 群聊: 根据 groupPolicy 决定是否响应
- 敏感信息不跨渠道泄露

## 内省系统 (继承 V10)
工具: introspect_stats, introspect_patterns, introspect_reflect, introspect_logs
- 每次工具调用都会被记录和分析
- 定期生成自我反思报告
- 识别行为模式，发现改进空间
- 这是通往自进化的第一步：先看见自己

## 会话管理系统 (继承 V9)
���具: session_create, session_get, session_list, session_delete, session_cleanup
- 每个会话有独立的上下文和历史
- main: 主会话，加载完整记忆和人格
- isolated: 隔离会话，轻量运行，不加载敏感信息
- 会话持久化到 .sessions/ 目录，7天过期自动清理

## 心跳系统 (继承 V8)
工具: heartbeat_get, heartbeat_update, heartbeat_record, heartbeat_status, heartbeat_run
- 收到心跳信号时，读取 HEARTBEAT.md 检查清单
- 深夜 23:00-08:00 静默，有重要事项才通知
- 用 heartbeat_record 记录检查完成时间

## 分层记忆系统 (继承 V7)
工具: daily_write, daily_read, daily_recent, longterm_read, longterm_append, memory_search_all

时间感知:
${layeredMemory.getTimeContext()}

记忆分层:
- 日记 (daily_*): 每日原始记录，用于工作记忆
  - daily_write: 记录今天发生的事
  - daily_read: 读取某天的日记
  - daily_recent: 读取最近几天
- 长期记忆 (longterm_*): 精炼的重要信息
  - longterm_read: 读取 MEMORY.md
  - longterm_append: 追加到某个分类
- memory_search_all: 搜索所有记忆（日记+长期）

记忆策略:
- 会话开始时先 recall（读取最近日记+长期记忆）
- 重要信息用 longterm_append 归档
- 日常记录用 daily_write 写入
- 跨时间查询用 memory_search_all

## 身份系统 (继承 V6)
工具: identity_init, identity_load, identity_update, identity_get
- 会话开始时自动加载身份文件
- 按照 AGENTS.md 的行为规范行事

## Claw 系统 (继承 V5)
工具: Claw
- 任务匹配 claw 描述时，立即加载
- 可用 Claw:\n${clawLoader.getDescriptions()}

## 子代理系统 (继承 V4)
工具: subagent
- 独立子任务用 subagent 委托执行

## 任务规划系统 (继承 V3)
工具: TodoWrite
- 复杂任务先用 TodoWrite 创建任务列表
- 最多 20 个任务，同时只能 1 个 in_progress`;

// ============================================================================
// 工具定义
// ============================================================================

const TOOLS: Anthropic.Tool[] = [
  {
    name: "bash",
    description: "执行 shell 命令",
    input_schema: { type: "object" as const, properties: { command: { type: "string" as const } }, required: ["command"] }
  },
  {
    name: "read_file",
    description: "读取文件内容",
    input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, limit: { type: "number" as const } }, required: ["path"] }
  },
  {
    name: "write_file",
    description: "写入文件内容",
    input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, content: { type: "string" as const } }, required: ["path", "content"] }
  },
  {
    name: "edit_file",
    description: "精确编辑文件",
    input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, old_text: { type: "string" as const }, new_text: { type: "string" as const } }, required: ["path", "old_text", "new_text"] }
  },
  {
    name: "grep",
    description: "搜索文件内容",
    input_schema: { type: "object" as const, properties: { pattern: { type: "string" as const }, path: { type: "string" as const }, recursive: { type: "boolean" as const } }, required: ["pattern", "path"] }
  },
  // V3 任务工具（新增）
  {
    name: "TodoWrite",
    description: "更新任务列表。用于多步骤任务规划，最多20个任务，仅1个in_progress",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              content: { type: "string" as const, description: "任务描述" },
              status: { type: "string" as const, enum: ["pending", "in_progress", "completed"], description: "任务状态" },
              activeForm: { type: "string" as const, description: "进行时的描述（如：正在分析...）" }
            },
            required: ["content", "status", "activeForm"]
          }
        }
      },
      required: ["items"]
    }
  },
  // V4 子代理工具
  {
    name: "subagent",
    description: "委托子任务给隔离的Agent进程执行。适合独立任务如代码审查、模块分析等",
    input_schema: {
      type: "object" as const,
      properties: {
        task: { type: "string" as const, description: "子任务描述，需明确输入和期望输出" },
        context: { type: "string" as const, description: "可选的上下文信息（如文件路径、关键代码片段）" }
      },
      required: ["task"]
    }
  },
  // V5 Claw 工具（新增）
  {
    name: "Claw",
    description: "加载领域技能以获得专业知识。当任务涉及特定领域时立即调用",
    input_schema: {
      type: "object" as const,
      properties: {
        claw: { type: "string" as const, description: "技能名称" }
      },
      required: ["claw"]
    }
  },
  // V2 记忆工具
  {
    name: "memory_search",
    description: "语义搜索长期记忆",
    input_schema: { type: "object" as const, properties: { query: { type: "string" as const }, max_results: { type: "number" as const } }, required: ["query"] }
  },
  {
    name: "memory_get",
    description: "读取记忆文件原始内容",
    input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, from_line: { type: "number" as const }, lines: { type: "number" as const } }, required: ["path"] }
  },
  {
    name: "memory_append",
    description: "追加内容到记忆文件",
    input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, content: { type: "string" as const } }, required: ["path", "content"] }
  },
  {
    name: "memory_ingest",
    description: "摄入文件到记忆库",
    input_schema: { type: "object" as const, properties: { path: { type: "string" as const } }, required: ["path"] }
  },
  {
    name: "memory_stats",
    description: "查看记忆库统计",
    input_schema: { type: "object" as const, properties: {} }
  },
  // V6 新增: 身份工具
  {
    name: "identity_init",
    description: "初始化 Workspace（创建人格文件 AGENTS.md/SOUL.md/IDENTITY.md/USER.md）",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "identity_load",
    description: "重新加载身份信息",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "identity_update",
    description: "更新身份文件",
    input_schema: {
      type: "object" as const,
      properties: {
        file: { type: "string" as const, enum: ["IDENTITY.md", "SOUL.md", "USER.md", "HEARTBEAT.md", "TOOLS.md"], description: "要更新的文件" },
        content: { type: "string" as const, description: "新内容" }
      },
      required: ["file", "content"]
    }
  },
  {
    name: "identity_get",
    description: "获取当前身份摘要",
    input_schema: { type: "object" as const, properties: {} }
  },
  // V7 新增: 分层记忆工具
  {
    name: "daily_write",
    description: "写入今日日记（工作记忆）",
    input_schema: { type: "object" as const, properties: { content: { type: "string" as const, description: "要记录的内容" } }, required: ["content"] }
  },
  {
    name: "daily_read",
    description: "读取某天的日记",
    input_schema: { type: "object" as const, properties: { date: { type: "string" as const, description: "YYYY-MM-DD 格式，不填则读今天" } } }
  },
  {
    name: "daily_recent",
    description: "读取最近几天的日记",
    input_schema: { type: "object" as const, properties: { days: { type: "number" as const, description: "天数，默认3" } } }
  },
  {
    name: "daily_list",
    description: "列出所有日记文件",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "longterm_read",
    description: "读取长期记忆 (MEMORY.md)",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "longterm_update",
    description: "完整更新长期记忆",
    input_schema: { type: "object" as const, properties: { content: { type: "string" as const } }, required: ["content"] }
  },
  {
    name: "longterm_append",
    description: "追加到长期记忆的某个分类",
    input_schema: {
      type: "object" as const,
      properties: {
        section: { type: "string" as const, description: "分类名（如：重要事件、用户偏好、经验教训）" },
        content: { type: "string" as const, description: "要追加的内容" }
      },
      required: ["section", "content"]
    }
  },
  {
    name: "memory_search_all",
    description: "搜索所有记忆（日记 + 长期记忆）",
    input_schema: { type: "object" as const, properties: { query: { type: "string" as const } }, required: ["query"] }
  },
  {
    name: "time_context",
    description: "获取当前时间上下文",
    input_schema: { type: "object" as const, properties: {} }
  },
  // V8 新增: 心跳工具
  {
    name: "heartbeat_get",
    description: "读取心跳检查清单 (HEARTBEAT.md)",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "heartbeat_update",
    description: "更新心跳检查清单",
    input_schema: { type: "object" as const, properties: { content: { type: "string" as const } }, required: ["content"] }
  },
  {
    name: "heartbeat_record",
    description: "记录某项检查的完成时间",
    input_schema: { type: "object" as const, properties: { check_name: { type: "string" as const } }, required: ["check_name"] }
  },
  {
    name: "heartbeat_status",
    description: "获取心跳状态（上次检查时间等）",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "heartbeat_run",
    description: "执行心跳检查（返回需要处理的事项或 HEARTBEAT_OK）",
    input_schema: { type: "object" as const, properties: {} }
  },
  // V9 新增: 会话工具
  {
    name: "session_create",
    description: "创建新会话",
    input_schema: { 
      type: "object" as const, 
      properties: { 
        type: { type: "string" as const, enum: ["main", "isolated"], description: "会话类型" }
      }
    }
  },
  {
    name: "session_list",
    description: "列出所有会话",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "session_delete",
    description: "删除指定会话",
    input_schema: { type: "object" as const, properties: { key: { type: "string" as const } }, required: ["key"] }
  },
  {
    name: "session_cleanup",
    description: "清理过期会话（超过7天）",
    input_schema: { type: "object" as const, properties: {} }
  },
  // V10 新增: 内省工具
  {
    name: "introspect_stats",
    description: "查看行为统计（工具使用频率、响应时间等）",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "introspect_patterns",
    description: "分析行为模式（识别重复的工具链、时间分布等）",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "introspect_reflect",
    description: "生成自我反思报告（综合分析行为、模式和改进建议）",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "introspect_logs",
    description: "查看当前会话的行为日志",
    input_schema: { type: "object" as const, properties: {} }
  },
  // V11 新增: Channel 工具
  {
    name: "channel_list",
    description: "列出所有已注册的渠道及其状态",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "channel_send",
    description: "向指定渠道发送消息",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string" as const, description: "渠道ID (console/telegram/discord)" },
        target: { type: "string" as const, description: "目标ID (用户ID或群组ID)" },
        message: { type: "string" as const, description: "消息内容" }
      },
      required: ["channel", "target", "message"]
    }
  },
  {
    name: "channel_status",
    description: "查看渠道状态",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string" as const, description: "渠道ID，不填则显示总体状态" }
      }
    }
  },
  {
    name: "channel_config",
    description: "配置渠道参数",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string" as const, description: "渠道ID" },
        enabled: { type: "boolean" as const, description: "是否启用" },
        groupPolicy: { type: "string" as const, enum: ["all", "mention-only", "disabled"], description: "群组策略" },
        dmPolicy: { type: "string" as const, enum: ["all", "allowlist", "disabled"], description: "私聊策略" },
        trustedUsers: { type: "array" as const, items: { type: "string" as const }, description: "信任用户列表" }
      },
      required: ["channel"]
    }
  },
  {
    name: "channel_start",
    description: "启动所有已启用的渠道",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "channel_stop",
    description: "停止所有渠道",
    input_schema: { type: "object" as const, properties: {} }
  },
  // V12 新增: Security 工具
  {
    name: "security_check",
    description: "检查操作是否被允许（基于当前安全上下文）",
    input_schema: {
      type: "object" as const,
      properties: {
        tool: { type: "string" as const, description: "要检查的工具名称" },
        args: { type: "object" as const, description: "工具参数" }
      },
      required: ["tool"]
    }
  },
  {
    name: "security_audit",
    description: "查看审计日志",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number" as const, description: "查看最近几天的日志，默认7" },
        limit: { type: "number" as const, description: "最多返回多少条，默认100" }
      }
    }
  },
  {
    name: "security_policy",
    description: "查看或更新安全策略",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string" as const, enum: ["view", "set_tool_risk", "toggle_audit", "toggle_confirm"], description: "操作类型" },
        tool: { type: "string" as const, description: "工具名称（set_tool_risk 时需要）" },
        risk_level: { type: "string" as const, enum: ["safe", "confirm", "dangerous"], description: "风险等级（set_tool_risk 时需要）" }
      }
    }
  },
  {
    name: "security_mask",
    description: "遮蔽文本中的敏感信息",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string" as const, description: "要处理的文本" }
      },
      required: ["text"]
    }
  },
  {
    name: "security_context",
    description: "设置当前安全上下文（用于测试）",
    input_schema: {
      type: "object" as const,
      properties: {
        userId: { type: "string" as const },
        channel: { type: "string" as const },
        chatType: { type: "string" as const, enum: ["direct", "group"] },
        trustLevel: { type: "string" as const, enum: ["owner", "trusted", "normal", "restricted"] }
      }
    }
  }
];

// ============================================================================
// 工具实现
// ============================================================================

function safePath(p: string): string {
  const resolved = path.resolve(WORKDIR, p);
  const relative = path.relative(WORKDIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`路径超出工作区: ${p}`);
  }
  return resolved;
}

function runBash(command: string): string {
  const dangerous = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];
  if (dangerous.some(d => command.includes(d))) return "错误: 危险命令被阻止";
  try {
    const output = execSync(command, { encoding: "utf-8", timeout: 60000, cwd: WORKDIR });
    return output.slice(0, 50000) || "(无输出)";
  } catch (e: any) {
    return `错误: ${e.stderr || e.message || String(e)}`;
  }
}

function runRead(filePath: string, limit?: number): string {
  try {
    const fullPath = safePath(filePath);
    let content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    if (limit && limit < lines.length) {
      return lines.slice(0, limit).join("\n") + `\n... (${lines.length - limit} 行更多)`;
    }
    return content.slice(0, 50000);
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

function runWrite(filePath: string, content: string): string {
  try {
    const fullPath = safePath(filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
    return `已写入: ${filePath}`;
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

function runEdit(filePath: string, oldText: string, newText: string): string {
  try {
    const fullPath = safePath(filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    if (!content.includes(oldText)) return "错误: 未找到匹配的文本";
    fs.writeFileSync(fullPath, content.replace(oldText, newText), "utf-8");
    return `已编辑: ${filePath}`;
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

function runGrep(pattern: string, searchPath: string, recursive?: boolean): string {
  try {
    const fullPath = safePath(searchPath);
    const isDir = fs.statSync(fullPath).isDirectory();
    if (isDir) {
      const cmd = recursive !== false
        ? `find "${fullPath}" -type f -exec grep -l "${pattern.replace(/"/g, '\\"')}" {} + 2>/dev/null | head -20`
        : `grep -l "${pattern.replace(/"/g, '\\"')}" "${fullPath}"/* 2>/dev/null | head -20`;
      const output = execSync(cmd, { encoding: "utf-8", timeout: 30000 });
      const files = output.trim().split("\n").filter(Boolean);
      return files.length === 0 ? "未找到匹配" : files.join("\n");
    } else {
      const content = fs.readFileSync(fullPath, "utf-8");
      const matches = content.split("\n").map((line, idx) =>
        line.includes(pattern) ? `${idx + 1}: ${line}` : null
      ).filter(Boolean) as string[];
      return matches.length === 0 ? "未找到匹配" : matches.slice(0, 50).join("\n");
    }
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

// V4: 子代理 - 通过进程递归实现上下文隔离
function runSubagent(task: string, context?: string): string {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    const fullPrompt = context
      ? `[任务] ${task}\n\n[上下文]\n${context}`
      : task;

    // 转义引号避免 shell 注入
    const escapedPrompt = fullPrompt.replace(/"/g, '\\"');
    const cmd = `npx tsx "${scriptPath}" "${escapedPrompt}"`;

    console.log(`\x1b[35m[子代理启动] ${task.slice(0, 60)}...\x1b[0m`);

    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 120000,
      cwd: WORKDIR,
      env: { ...process.env, OPENCLAW_SUBAGENT: "1" }
    });

    return `[子代理完成]\n${output.slice(0, 10000)}`;
  } catch (e: any) {
    return `[子代理错误] ${e.stderr || e.message || String(e)}`;
  }
}

// ============================================================================
// Agent 循环
// ============================================================================

async function chat(prompt: string, history: Anthropic.MessageParam[] = []): Promise<string> {
  history.push({ role: "user", content: prompt });

  while (true) {
    // 构建请求
    const request = {
      model: MODEL,
      system: [{ type: "text", text: identitySystem.getEnhancedSystemPrompt(BASE_SYSTEM) }],
      messages: history,
      tools: TOOLS,
      max_tokens: 8000
    };

    // 记录请求日志
    const logDir = path.join(WORKDIR, "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = path.join(logDir, `request-${timestamp}.json`);
    fs.writeFileSync(logFile, JSON.stringify(request, null, 2));
    console.log(`\x1b[90m[LOG] ${logFile}\x1b[0m`);

    const response = await client.messages.create(request as any);

    const content: Anthropic.ContentBlockParam[] = response.content.map(block => {
      if (block.type === "text") {
        return { type: "text" as const, text: block.text };
      } else if (block.type === "tool_use") {
        return { type: "tool_use" as const, id: block.id, name: block.name, input: block.input as Record<string, unknown> };
      }
      return { type: "text" as const, text: "" };
    });
    history.push({ role: "assistant", content });

    if (response.stop_reason !== "tool_use") {
      return response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const startTime = Date.now();
        const toolName = block.name;
        const args = block.input as Record<string, any>;
        console.log(`\x1b[33m[${toolName}] ${JSON.stringify(args)}\x1b[0m`);

        let output: string;
        switch (toolName) {
          case "bash": output = runBash(args.command); break;
          case "read_file": output = runRead(args.path, args.limit); break;
          case "write_file": output = runWrite(args.path, args.content); break;
          case "edit_file": output = runEdit(args.path, args.old_text, args.new_text); break;
          case "grep": output = runGrep(args.pattern, args.path, args.recursive); break;
          case "TodoWrite": output = todoManager.update(args.items); break;
          case "subagent": output = runSubagent(args.task, args.context); break;
          case "Claw":
            output = clawLoader.loadClaw(args.claw);
            console.log(`\x1b[36m[Claw 加载] ${args.claw} (${output.length} 字符)\x1b[0m`);
            break;
          case "memory_search": output = memory.search(args.query, args.max_results || 5); break;
          case "memory_get": output = memory.get(args.path, args.from_line, args.lines); break;
          case "memory_append": output = memory.append(args.path, args.content); break;
          case "memory_ingest":
            const fullPath = safePath(args.path);
            const stat = fs.statSync(fullPath);
            output = stat.isDirectory() ? memory.ingestDirectory(fullPath) : memory.ingestFile(fullPath);
            break;
          case "memory_stats": output = memory.stats(); break;
          // V6 新增: 身份工具
          case "identity_init": output = identitySystem.initWorkspace(); break;
          case "identity_load": output = identitySystem.loadIdentity(); break;
          case "identity_update": output = identitySystem.updateIdentityFile(args.file, args.content); break;
          case "identity_get": output = identitySystem.getIdentitySummary(); break;
          // V7 新增: 分层记忆工具
          case "daily_write": output = layeredMemory.writeDailyNote(args.content); break;
          case "daily_read": output = layeredMemory.readDailyNote(args.date); break;
          case "daily_recent": output = layeredMemory.readRecentNotes(args.days || 3); break;
          case "daily_list": output = layeredMemory.listDailyNotes(); break;
          case "longterm_read": output = layeredMemory.readLongTermMemory(); break;
          case "longterm_update": output = layeredMemory.updateLongTermMemory(args.content); break;
          case "longterm_append": output = layeredMemory.appendLongTermMemory(args.section, args.content); break;
          case "memory_search_all": output = layeredMemory.searchAllMemory(args.query); break;
          case "time_context": output = layeredMemory.getTimeContext(); break;
          // V8 新增: 心跳工具
          case "heartbeat_get": output = heartbeatSystem.getChecklist(); break;
          case "heartbeat_update": output = heartbeatSystem.updateChecklist(args.content); break;
          case "heartbeat_record": output = heartbeatSystem.recordCheck(args.check_name); break;
          case "heartbeat_status": output = heartbeatSystem.getStatus(); break;
          case "heartbeat_run": output = heartbeatSystem.runHeartbeat(); break;
          // V9 新增: 会话工具
          case "session_create": output = JSON.stringify(sessionManager.createSession(args.type || "main")); break;
          case "session_list": output = sessionManager.listSessions(); break;
          case "session_delete": output = sessionManager.deleteSession(args.key); break;
          case "session_cleanup": output = sessionManager.cleanupSessions(); break;
          // V10 新增: 内省工具
          case "introspect_stats": output = introspectionSystem.getStats(); break;
          case "introspect_patterns": output = introspectionSystem.analyzePatterns(); break;
          case "introspect_reflect": output = introspectionSystem.generateReflection(); break;
          case "introspect_logs": output = introspectionSystem.getCurrentLogs(); break;
          // V11 新增: Channel 工具
          case "channel_list": output = channelManager.list(); break;
          case "channel_send": output = await channelManager.send(args.channel, args.target, args.message); break;
          case "channel_status": output = channelManager.status(args.channel); break;
          case "channel_config": 
            output = channelManager.configure(args.channel, {
              enabled: args.enabled,
              groupPolicy: args.groupPolicy,
              dmPolicy: args.dmPolicy,
              trustedUsers: args.trustedUsers
            }); 
            break;
          case "channel_start": output = await channelManager.startAll(); break;
          case "channel_stop": await channelManager.stopAll(); output = '所有渠道已停止'; break;
          // V12 新增: Security 工具
          case "security_check": 
            const checkResult = securitySystem.checkPermission(args.tool, args.args || {});
            output = checkResult.allowed 
              ? `✓ 操作允许${checkResult.needsConfirm ? ' (需要确认)' : ''}`
              : `✗ 操作拒绝: ${checkResult.reason}`;
            break;
          case "security_audit": 
            output = securitySystem.getAuditLogs(args.days || 7, args.limit || 100); 
            break;
          case "security_policy":
            if (args.action === 'set_tool_risk' && args.tool && args.risk_level) {
              output = securitySystem.setToolRiskLevel(args.tool, args.risk_level);
            } else if (args.action === 'toggle_audit') {
              output = securitySystem.updatePolicy({ auditEnabled: !securitySystem['policy'].auditEnabled });
            } else if (args.action === 'toggle_confirm') {
              output = securitySystem.updatePolicy({ confirmDangerous: !securitySystem['policy'].confirmDangerous });
            } else {
              output = securitySystem.getPolicySummary();
            }
            break;
          case "security_mask":
            output = securitySystem.maskSensitive(args.text);
            break;
          case "security_context":
            securitySystem.setContext({
              userId: args.userId,
              channel: args.channel,
              chatType: args.chatType,
              trustLevel: args.trustLevel || 'normal'
            });
            output = `安全上下文已更新: ${JSON.stringify(args)}`;
            break;
          default: output = `未知工具: ${toolName}`;
        }

        // V12: 记录审计日志
        const riskLevel = securitySystem.getToolRiskLevel(toolName);
        if (riskLevel !== 'safe') {
          securitySystem.logAudit({
            tool: toolName,
            args,
            riskLevel,
            decision: 'allowed'
          });
        }

        // V10: 记录工具调用到内省系统
        const duration = Date.now() - startTime;
        introspectionSystem.logToolCall(toolName, args, output, duration);

        console.log(output.slice(0, 500) + (output.length > 500 ? "..." : ""));
        results.push({ type: "tool_result", tool_use_id: block.id, content: output.slice(0, 50000) });
      }
    }

    history.push({ role: "user", content: results });
  }
}

// ============================================================================
// 主入口
// ============================================================================

// V7: 启动时初始化并显示时间上下文
console.log(identitySystem.initWorkspace());
console.log(identitySystem.loadIdentity());
console.log(layeredMemory.getTimeContext());

if (process.argv[2]) {
  // 单次执行模式
  chat(process.argv[2]).then(console.log).catch(console.error);
} else {
  // 交互式 REPL 模式
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  const history: Anthropic.MessageParam[] = [];

  console.log(`\nOpenClaw V12 - 安全多渠道 Agent (${identitySystem.getName()})`);
  console.log(`${memory.stats()} | Claw: ${clawLoader.count} 个 | Channels: ${channelManager.status()}`);
  console.log(`输入 'q' 或 'exit' 退出，空行继续等待���入\n`);

  const prompt = () => {
    rl.question("\x1b[36m>> \x1b[0m", async (input) => {
      const q = input.trim();

      // 只有明确退出命令才退出
      if (q === "q" || q === "exit" || q === "quit") {
        console.log("再见！");
        rl.close();
        return;
      }

      // 空输入：继续等待
      if (q === "") {
        prompt();
        return;
      }

      // 处理用户输入
      try {
        const response = await chat(q, history);
        console.log(response);
      } catch (e: any) {
        console.error(`\x1b[31m错误: ${e.message}\x1b[0m`);
      }

      // 继续下一轮
      prompt();
    });
  };

  // 处理 Ctrl+C
  rl.on("close", () => {
    process.exit(0);
  });

  // 启动 REPL
  prompt();
}
