#!/usr/bin/env tsx
/**
 * v8-agent.ts - 心跳与主动性 (~1350行)
 *
 * 核心哲学: "Agent 不只是被动响应，还能主动维护"
 * ================================================
 * V8 在 V7 基础上增加 Heartbeat 系统：
 * - HEARTBEAT.md: 定义周期性检查清单
 * - 心跳状态: 记录上次检查时间，避免重复
 * - 主动维护: 整理记忆、检查任务、更新状态
 *
 * Heartbeat 规则:
 * - 读取 HEARTBEAT.md 获取检查清单
 * - 深夜 (23:00-08:00) 静默模式
 * - 有重要事项时才主动通知
import * as net from "net"; *
 * 演进路线:
 * V0: bash 即一切
 * V1: 5个基础工具
 * V2: 本地向量记忆
 * V3: 极简任务规划
 * V4: 子代理协调
 * V5: Skill 系统
 * V6: 身份与灵魂
 * V7: 分层记忆
 * V8: 心跳主动性 (当前)
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
const SKILL_DIR = process.env.SKILL_DIR || path.join(WORKDIR, "skills");
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
    this.memoryDir = path.join(IDENTITY_DIR, "memory");
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
// Skill 系统 - V5 新增 (知识外部化与渐进式加载)
// ============================================================================

interface Skill {
  name: string;
  description: string;
  content: string;
  path: string;
}

class SkillLoader {
  private skillsDir: string;
  private skills: Map<string, Skill> = new Map();

  constructor() {
    this.skillsDir = SKILL_DIR;
    this.loadSkills();
  }

  // 解析 SKILL.md 文件 (YAML frontmatter + Markdown body)
  private parseSkillFile(filePath: string): Skill | null {
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

  // 加载所有 skill
  private loadSkills() {
    if (!fs.existsSync(this.skillsDir)) return;

    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(this.skillsDir, entry.name, "SKILL.md");
        if (fs.existsSync(skillPath)) {
          const skill = this.parseSkillFile(skillPath);
          if (skill) {
            this.skills.set(skill.name, skill);
          }
        }
      }
    }
  }

  // 获取 skill 列表用于系统提示 (仅元数据)
  getDescriptions(): string {
    if (this.skills.size === 0) return "无可用技能";

    const lines = Array.from(this.skills.values()).map(s =>
      `- ${s.name}: ${s.description}`
    );
    return lines.join("\n");
  }

  // 获取 skill 数量
  get count(): number {
    return this.skills.size;
  }

  // 加载指定 skill 的完整内容 (作为 tool_result 注入)
  loadSkill(name: string): string {
    const skill = this.skills.get(name);
    if (!skill) return `错误: 技能 '${name}' 不存在`;

    return `<skill-loaded name="${name}">
${skill.content}
</skill-loaded>

请按照上述技能文档的指引完成任务。`;
  }

  // 列出所有可用 skill 名称
  listSkills(): string {
    if (this.skills.size === 0) return "无可用技能";
    return Array.from(this.skills.keys()).join(", ");
  }
}

const skillLoader = new SkillLoader();

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
  private identityCache: { name: string; identity: string; soul: string; user: string; rules: string } | null = null;

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

    const coreFiles = PERSONA_FILES.filter(f => f !== "BOOTSTRAP.md");
    const isBrandNewWorkspace = coreFiles.every(filename => {
      const filePath = path.join(this.workspaceDir, filename);
      return !fs.existsSync(filePath);
    });

    for (const filename of PERSONA_FILES) {
      if (filename === "BOOTSTRAP.md" && !isBrandNewWorkspace) {
        continue;
      }

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

    this.identityCache = {
      name: "Agent", // 仅用于 REPL 显示，AI 从 IDENTITY.md 自己理解身份
      identity: contents["IDENTITY.md"],
      soul: contents["SOUL.md"],
      user: contents["USER.md"],
      rules: contents["AGENTS.md"]
    };

    // 检查是否需要首次引导：只看 BOOTSTRAP.md 是否存在
    const bootstrapPath = path.join(this.workspaceDir, "BOOTSTRAP.md");
    const needsBootstrap = fs.existsSync(bootstrapPath);

    return needsBootstrap
      ? `🌟 首次运行！请与我对话完成身份设置。`
      : `身份加载完成`;
  }

  // 获取增强的系统提示（注入身份信息）
  getEnhancedSystemPrompt(basePrompt: string): string {
    if (!this.identityCache) {
      this.loadIdentity();
    }

    return `${basePrompt}

如果 IDENTITY.md 定义了角色，你就是那个角色。用角色的语气、口头禅、思维方式说话。
如果 SOUL.md 存在，体现其人格和语气。

# 你的身份
${this.identityCache!.identity}

# 你的灵魂
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
    return `灵魂摘要:\n${this.identityCache!.soul.slice(0, 300)}...`;
  }

  // 获取名字（仅用于 REPL 显示）
  getName(): string {
    return "Agent";
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

const layeredMemory = new LayeredMemory(IDENTITY_DIR);

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

const heartbeatSystem = new HeartbeatSystem(IDENTITY_DIR);

// ============================================================================
// 系统提示
// ============================================================================

const BASE_SYSTEM = `你是 OpenClaw V8 - 有主动性的 Agent。

## 工作循环
heartbeat -> recall -> identify -> plan -> (load skill) -> (delegate -> collect) -> execute -> track -> remember

## 心跳系统 (V8 核心)
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

## Skill 系统 (继承 V5)
工具: Skill
- 任务匹配 skill 描述时，立即加载
- 可用 Skills:\n${skillLoader.getDescriptions()}

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
  // V5 Skill 工具（新增）
  {
    name: "Skill",
    description: "加载领域技能以获得专业知识。当任务涉及特定领域时立即调用",
    input_schema: {
      type: "object" as const,
      properties: {
        skill: { type: "string" as const, description: "技能名称" }
      },
      required: ["skill"]
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
  {
    name: "bootstrap_complete",
    description: "完成首次引导后删除 BOOTSTRAP.md",
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
  }
];

// ============================================================================
// 工具实现
// ============================================================================

function safePath(p: string): string {
  if (typeof p !== "string" || p.trim() === "") {
    throw new Error("参数错误: path 必须是非空字符串");
  }
  const resolved = path.resolve(WORKDIR, p);
  const relative = path.relative(WORKDIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`路径超出工作区: ${p}`);
  }
  return resolved;
}

function pickStringArg(args: Record<string, any>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args?.[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return undefined;
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
    if (typeof content !== "string") {
      throw new Error("参数错误: content 必须是字符串");
    }
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
        const toolName = block.name;
        const args = block.input as Record<string, any>;
        console.log(`\x1b[33m[${toolName}] ${JSON.stringify(args)}\x1b[0m`);

        let output: string;
        switch (toolName) {
          case "bash": output = runBash(args.command); break;
          case "read_file": output = runRead(args.path, args.limit); break;
          case "write_file": {
            const writePath = pickStringArg(args, ["path", "file_path", "filePath", "filename"]);
            const writeContent = pickStringArg(args, ["content", "text", "data"]);

            if (!writePath || writeContent === undefined) {
              const argKeys = Object.keys(args || {}).join(", ") || "(空对象)";
              output = `错误: write_file 参数不完整，需要 path 和 content。当前参数键: ${argKeys}`;
              break;
            }

            output = runWrite(writePath, writeContent);
            break;
          }
          case "edit_file": output = runEdit(args.path, args.old_text, args.new_text); break;
          case "grep": output = runGrep(args.pattern, args.path, args.recursive); break;
          case "TodoWrite": output = todoManager.update(args.items); break;
          case "subagent": output = runSubagent(args.task, args.context); break;
          case "Skill":
            const skillName = args.skill;
            output = skillLoader.loadSkill(skillName);
            console.log(`\x1b[36m[Skill 加载] ${skillName} (${output.length} 字符)\x1b[0m`);
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
          case "bootstrap_complete": {
            const bootstrapPath = path.join(IDENTITY_DIR, "BOOTSTRAP.md");
            if (fs.existsSync(bootstrapPath)) {
              fs.unlinkSync(bootstrapPath);
              output = "✅ 引导完成！BOOTSTRAP.md 已删除。你现在是完整的你了。";
            } else {
              output = "BOOTSTRAP.md 不存在，无需删除";
            }
            break;
          }
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
          default: output = `未知工具: ${toolName}`;
        }

        console.log(output.slice(0, 500) + (output.length > 500 ? "..." : ""));
        results.push({ type: "tool_result", tool_use_id: block.id, content: output.slice(0, 50000) });
      }
    }

    history.push({ role: "user", content: results });
  }
}

// ============================================================================
// V8 新增: 心跳检测与响应
// ============================================================================

const TRIGGER_FILE = path.join(WORKDIR, ".heartbeat.trigger");
const IS_HEARTBEAT_MODE = process.argv[2] === "HEARTBEAT_TRIGGER" || process.env.OPENCLAW_HEARTBEAT === "1";

// 检查是否是心跳触发
function isHeartbeatTrigger(): boolean {
  if (IS_HEARTBEAT_MODE) return true;
  if (!fs.existsSync(TRIGGER_FILE)) return false;
  
  try {
    const trigger = JSON.parse(fs.readFileSync(TRIGGER_FILE, "utf-8"));
    const age = Date.now() - trigger.timestamp;
    // 触发文件5分钟内有效
    return age < 5 * 60 * 1000;
  } catch {
    return false;
  }
}

// 执行心跳检查
async function runHeartbeatCheck(): Promise<string> {
  console.log("\n🫀 收到心跳信号，执行检查...\n");
  
  const history: Anthropic.MessageParam[] = [];
  const result = await chat(
    "HEARTBEAT_TRIGGER: 读取 HEARTBEAT.md 检查清单，执行必要的维护任务。如果没有需要处理的，回复 HEARTBEAT_OK。",
    history
  );
  
  return result;
}

// ============================================================================
// 主入口
// ============================================================================


// ============================================================================
// V8 新增: 常驻 Agent 核心 - 混合模式（交互 + 心跳）
// ============================================================================

import * as net from "net";

// IPC 配置（放在类外部）
const IPC_SOCKET_PATH = path.join(WORKDIR, ".openclaw.ipc");
const PID_FILE = path.join(WORKDIR, ".openclaw.pid");
const DEFAULT_HEARTBEAT_INTERVAL = 30 * 60 * 1000;

class ResidentAgent {
  private running = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private server: net.Server | null = null;
  private rl: readline.Interface | null = null;
  private history: Anthropic.MessageParam[] = [];
  private interactive = false;
  private heartbeatInterval: number;

  constructor(heartbeatIntervalMs: number = DEFAULT_HEARTBEAT_INTERVAL) {
    this.heartbeatInterval = heartbeatIntervalMs;
  }

  async start(options: { daemon?: boolean; interactive?: boolean } = {}) {
    this.interactive = options.interactive ?? !options.daemon;
    fs.writeFileSync(PID_FILE, process.pid.toString());
    await this.startIPCServer();
    this.scheduleHeartbeat();

    console.log(`\n🫀 OpenClaw V8 已启动 (PID: ${process.pid})`);
    console.log(`   模式: ${this.interactive ? "交互+心跳" : "后台常驻"}`);
    console.log(`   IPC: ${IPC_SOCKET_PATH}`);
    console.log(`   心跳间隔: ${this.heartbeatInterval / 60000} 分钟\n`);

    if (this.interactive) {
      await this.startInteractiveMode();
    } else {
      this.running = true;
      while (this.running) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  stop() {
    console.log("\n🫀 正在停止 Agent...");
    this.running = false;
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    if (this.server) this.server.close();
    if (this.rl) this.rl.close();
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    if (fs.existsSync(IPC_SOCKET_PATH)) fs.unlinkSync(IPC_SOCKET_PATH);
    console.log("再见！");
    process.exit(0);
  }

  private async startIPCServer() {
    if (fs.existsSync(IPC_SOCKET_PATH)) {
      try { fs.unlinkSync(IPC_SOCKET_PATH); } catch {}
    }

    this.server = net.createServer((socket) => {
      socket.on("data", (data) => {
        const msg = data.toString().trim();
        if (msg === "HEARTBEAT") {
          console.log("\n🫀 [IPC] 收到外部心跳信号");
          this.executeHeartbeat();
        } else if (msg === "STATUS") {
          socket.write(`OK|PID:${process.pid}|Heartbeat:${heartbeatSystem.getStatus()}`);
        } else if (msg === "STOP") {
          socket.write("OK|Stopping");
          setTimeout(() => this.stop(), 100);
        }
      });
    });

    return new Promise<void>((resolve) => {
      this.server!.listen(IPC_SOCKET_PATH, () => {
        console.log(`[IPC] 服务器已启动: ${IPC_SOCKET_PATH}`);
        resolve();
      });
    });
  }

  private scheduleHeartbeat() {
    const run = async () => {
      if (!heartbeatSystem.shouldDisturb()) {
        console.log("\n🫀 [定时] 深夜静默，跳过心跳");
      } else {
        await this.executeHeartbeat();
      }
      this.heartbeatTimer = setTimeout(run, this.heartbeatInterval);
    };
    this.heartbeatTimer = setTimeout(run, 10000);
  }

  private async executeHeartbeat() {
    console.log("\n🫀 执行心跳检查...");
    try {
      const result = await runHeartbeatCheck();
      console.log(`   结果: ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`);
      if (this.interactive && !result.includes("HEARTBEAT_OK") && !result.includes("静默")) {
        console.log("\n⚠️  心跳发现需要处理的事项！");
        console.log(result);
      }
    } catch (e: any) {
      console.error("   错误:", e.message);
    }
  }

  private async startInteractiveMode() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    console.log(`OpenClaw V8 - 交互模式`);
    console.log(`命令: 'q' 退出 | 'heartbeat' 手动心跳 | 'status' 查看状态`);
    console.log(`输入你的问题开始对话\n`);

    const ask = () => {
      this.rl!.question("\x1b[36m>> \x1b[0m", async (input) => {
        const q = input.trim();
        if (q === "q" || q === "exit" || q === "quit") { this.stop(); return; }
        if (q === "heartbeat" || q === "hb") { await this.executeHeartbeat(); ask(); return; }
        if (q === "status" || q === "st") {
          console.log(`PID: ${process.pid}`);
          console.log(heartbeatSystem.getStatus());
          console.log(`记忆: ${memory.stats()}`);
          ask(); return;
        }
        if (q === "") { ask(); return; }
        try {
          const response = await chat(q, this.history);
          console.log(response);
        } catch (e: any) { console.error(`\x1b[31m错误: ${e.message}\x1b[0m`); }
        ask();
      });
    };
    ask();
    process.on("SIGINT", () => this.stop());
    process.on("SIGTERM", () => this.stop());
  }
}

function isAgentRunning(): boolean {
  if (!fs.existsSync(PID_FILE) || !fs.existsSync(IPC_SOCKET_PATH)) return false;
  try {
    const pid = fs.readFileSync(PID_FILE, "utf-8").trim();
    process.kill(Number(pid), 0);
    return true;
  } catch {
    try { fs.unlinkSync(PID_FILE); } catch {}
    try { fs.unlinkSync(IPC_SOCKET_PATH); } catch {}
    return false;
  }
}

function showHelp() {
  console.log(`
OpenClaw V8 - 心跳主动性 Agent

用法:
  tsx v8-agent.ts [选项] [查询]

选项:
  --daemon, -d       后台常驻模式（无交互，仅心跳）
  --interactive, -i  交互模式（默认，带后台心跳）
  --once             单次心跳执行后退出
  --status, -s       查看运行中的 Agent 状态
  --stop             停止运行中的 Agent
  --interval MIN     设置心跳间隔（分钟，默认30）
  --help, -h         显示帮助

示例:
  tsx v8-agent.ts                    # 启动交互模式
  tsx v8-agent.ts --daemon           # 后台常驻
  tsx v8-agent.ts "查询"              # 单次查询
  tsx v8-agent.ts --once             # 单次心跳
  tsx v8-agent.ts --status           # 查看状态
  tsx v8-agent.ts --stop             # 停止 Agent
`);
}

async function sendIPCCommand(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(IPC_SOCKET_PATH, () => { client.write(cmd); });
    let response = "";
    client.on("data", (data) => { response += data.toString(); client.end(); });
    client.on("end", () => resolve(response));
    client.on("error", (err) => reject(err));
    setTimeout(() => reject(new Error("IPC 超时")), 5000);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const hasFlag = (flags: string[]) => flags.some(f => args.includes(f));
  const getValue = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx < args.length - 1 ? args[idx + 1] : undefined;
  };
  const getQuery = () => args.filter(a => !a.startsWith("-")).join(" ");

  if (hasFlag(["--help", "-h"])) { showHelp(); return; }

  if (hasFlag(["--status", "-s"])) {
    if (!isAgentRunning()) { console.log("🫀 Agent 未运行"); return; }
    try {
      const status = await sendIPCCommand("STATUS");
      console.log("🫀 Agent 状态:", status);
    } catch (e: any) { console.error("无法获取状态:", e.message); }
    return;
  }

  if (hasFlag(["--stop"])) {
    if (!isAgentRunning()) { console.log("🫀 Agent 未运行"); return; }
    try {
      const response = await sendIPCCommand("STOP");
      console.log("🫀 停止命令已发送:", response);
    } catch (e: any) { console.error("无法停止:", e.message); }
    return;
  }

  if (hasFlag(["--once"])) {
    console.log("🫀 单次心跳模式\n");
    console.log(identitySystem.initWorkspace());
    console.log(identitySystem.loadIdentity());
    console.log(layeredMemory.getTimeContext());
    const result = await runHeartbeatCheck();
    console.log("\n🫀 心跳完成:", result);
    return;
  }

  const intervalMin = Number(getValue("--interval") || "30");
  const intervalMs = intervalMin * 60 * 1000;

  if (isAgentRunning()) {
    const pid = fs.readFileSync(PID_FILE, "utf-8").trim();
    console.log(`🫀 Agent 已在运行 (PID: ${pid})`);
    console.log(`   使用 'tsx v8-agent.ts --stop' 停止`);
    console.log(`   使用 'tsx v8-agent.ts --status' 查看状态`);
    return;
  }

  console.log(identitySystem.initWorkspace());
  console.log(identitySystem.loadIdentity());
  console.log(layeredMemory.getTimeContext());

  const query = getQuery();
  if (query && !hasFlag(["--daemon", "-d", "--interactive", "-i"])) {
    console.log(`\n[单次查询] ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}\n`);
    const history: Anthropic.MessageParam[] = [];
    const result = await chat(query, history);
    console.log(result);
    return;
  }

  const agent = new ResidentAgent(intervalMs);
  if (hasFlag(["--daemon", "-d"])) {
    await agent.start({ daemon: true });
  } else {
    await agent.start({ interactive: true });
  }
}

main().catch((e) => {
  console.error("\x1b[31m致命错误:", e.message, "\x1b[0m");
  process.exit(1);
});
