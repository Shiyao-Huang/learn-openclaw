#!/usr/bin/env tsx
/**
 * v6-agent.ts - 身份系统 (~930行)
 *
 * 核心哲学: "人格即配置"
 * ===================================================
 * V6 在 V5.5 基础上增加身份系统：
 * - 人格文件: AGENTS.md/SOUL.md/IDENTITY.md/USER.md
 * - Workspace 初始化: 从 .ID.sample 复制模板
 * - Soul Switch: 通过 Hook 动态切换人格
 * - 身份更新: identity_update 工具
 *
 * 演进路线:
 * V0: bash 即一切
 * V1: 5个基础工具
 * V2: 本地向量记忆
 * V3: 任务规划系统
 * V4: 子代理协调
 * V5: Skill 系统
 * V5.5: Hook 基础设施
 * V6: 身份系统 (当前) - 在 V5.5 基础上增加 IdentitySystem
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
const MODEL = process.env.MODEL_ID || "claude-sonnet-4-20250514";
const WORKDIR = process.cwd();
const SKILL_DIR = process.env.SKILL_DIR || path.join(WORKDIR, "skills");
const ID_SAMPLE_DIR = process.env.ID_SAMPLE_DIR || path.join(__dirname, ".ID.sample");

// 智能 workspace 检测：优先使用环境变量，否则检查当前目录是否已有身份文件
function detectWorkspace(): string {
  // 1. 环境变量优先
  if (process.env.IDENTITY_DIR) {
    return process.env.IDENTITY_DIR;
  }

  // 2. 检查当前目录是否已有 IDENTITY.md（说明这是一个已初始化的 workspace）
  const currentIdentity = path.join(WORKDIR, "IDENTITY.md");
  if (fs.existsSync(currentIdentity)) {
    return WORKDIR;
  }

  // 3. 检查是否有 .workspace 子目录（约定的 workspace 位置）
  const workspaceDir = path.join(WORKDIR, ".workspace");
  if (fs.existsSync(workspaceDir)) {
    return workspaceDir;
  }

  // 4. 默认在当前目录创建（首次运行）
  return WORKDIR;
}

const IDENTITY_DIR = detectWorkspace();

// ============================================================================
// V2: 本地向量记忆系统（保留）
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

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase());
    const setB = new Set(b.toLowerCase());
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  private load() {
    if (fs.existsSync(this.indexFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.indexFile, "utf-8"));
        for (const doc of data.docs || []) this.docs.set(doc.id, doc);
      } catch (e) {}
    }
  }

  private save() {
    if (!fs.existsSync(this.memoryDir)) fs.mkdirSync(this.memoryDir, { recursive: true });
    fs.writeFileSync(this.indexFile, JSON.stringify({ docs: Array.from(this.docs.values()) }, null, 2));
  }

  ingestFile(filePath: string): string {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return `错误: 文件不存在`;
    const content = fs.readFileSync(fullPath, "utf-8");
    const chunks = content.split(/\n\n+/).filter(c => c.trim());
    let added = 0;
    for (let i = 0; i < chunks.length; i++) {
      const id = createHash("md5").update(`${fullPath}:${i}:${chunks[i]}`).digest("hex");
      if (!this.docs.has(id)) {
        this.docs.set(id, { id, content: chunks[i], source: path.relative(WORKDIR, fullPath), chunk: i, timestamp: Date.now() });
        added++;
      }
    }
    this.save();
    return `已摄入: ${path.basename(filePath)} (${added} 块)`;
  }

  search(query: string, maxResults = 5): string {
    if (this.docs.size === 0) return "记忆库为空";
    const results = Array.from(this.docs.values())
      .map(doc => ({ doc, score: this.jaccardSimilarity(query, doc.content) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .filter(r => r.score > 0.01);
    if (results.length === 0) return "未找到相关记忆";
    return results.map(({ doc, score }) =>
      `[${doc.source}:${doc.chunk}] (${(score * 100).toFixed(0)}%) ${doc.content.slice(0, 100)}...`
    ).join("\n");
  }

  get(filePath: string): string {
    const fullPath = path.join(this.memoryDir, filePath);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf-8") : `错误: 文件不存在`;
  }

  append(filePath: string, content: string): string {
    const fullPath = path.join(this.memoryDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(fullPath, `\n## ${new Date().toISOString()}\n\n${content}\n`);
    this.ingestFile(fullPath);
    return `已追加: ${filePath}`;
  }

  stats(): string { return `记忆库: ${this.docs.size} 个片段`; }
}

const memory = new LocalMemory();

// ============================================================================
// V3: 任务规划系统（简化设计）
// ============================================================================

type TodoStatus = "pending" | "in_progress" | "completed";

interface TodoItem {
  content: string;
  status: TodoStatus;
  activeForm: string;
}

class TodoManager {
  private items: TodoItem[] = [];

  update(newItems: TodoItem[]): string {
    let inProgressCount = 0;
    const validated: TodoItem[] = [];

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const content = (item.content || "").trim();
      const status = (item.status || "pending") as TodoStatus;
      const activeForm = (item.activeForm || "").trim();

      if (!content) throw new Error(`Item ${i}: content 必填`);
      if (!["pending", "in_progress", "completed"].includes(status)) {
        throw new Error(`Item ${i}: 无效状态 '${status}'`);
      }
      if (status === "in_progress" && !activeForm) {
        throw new Error(`Item ${i}: in_progress 状态必须提供 activeForm`);
      }

      if (status === "in_progress") inProgressCount++;
      validated.push({ content, status, activeForm });
    }

    if (validated.length > 20) throw new Error("最多 20 个任务");
    if (inProgressCount > 1) throw new Error("只能有 1 个 in_progress 任务");

    this.items = validated;
    return this.render();
  }

  render(): string {
    if (this.items.length === 0) return "暂无任务";
    const lines: string[] = [];
    for (const item of this.items) {
      if (item.status === "completed") lines.push(`[x] ${item.content}`);
      else if (item.status === "in_progress") lines.push(`[>] ${item.content} <- ${item.activeForm}`);
      else lines.push(`[ ] ${item.content}`);
    }
    const completed = this.items.filter(t => t.status === "completed").length;
    lines.push(`\n(${completed}/${this.items.length} 已完成)`);
    return lines.join("\n");
  }

  stats(): string {
    const completed = this.items.filter(t => t.status === "completed").length;
    return `任务: ${completed}/${this.items.length}`;
  }
}

const todoManager = new TodoManager();

// ============================================================================
// V4: 子代理系统（保留）
// ============================================================================

function runSubagent(task: string, context?: string): string {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    const fullPrompt = context ? `[任务] ${task}\n\n[上下文]\n${context}` : task;
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
// V5: Skill 系统（保留）
// ============================================================================

interface Skill {
  name: string;
  description: string;
  content: string;
  dir: string;
}

class SkillLoader {
  private skillsDir: string;
  private skills: Map<string, Skill> = new Map();

  constructor() {
    this.skillsDir = SKILL_DIR;
    this.loadSkills();
  }

  private parseSkillFile(filePath: string): Skill | null {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      if (!match) return null;

      const yamlContent = match[1];
      const markdownContent = match[2].trim();
      const name = yamlContent.match(/name:\s*(.+)/)?.[1]?.trim();
      const description = yamlContent.match(/description:\s*(.+)/)?.[1]?.trim();

      if (!name || !description) return null;
      return { name, description, content: markdownContent, dir: path.dirname(filePath) };
    } catch (e) { return null; }
  }

  private loadSkills() {
    if (!fs.existsSync(this.skillsDir)) return;
    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(this.skillsDir, entry.name, "SKILL.md");
        if (fs.existsSync(skillPath)) {
          const skill = this.parseSkillFile(skillPath);
          if (skill) this.skills.set(skill.name, skill);
        }
      }
    }
  }

  getDescriptions(): string {
    if (this.skills.size === 0) return "无可用技能";
    return Array.from(this.skills.values()).map(s => `- ${s.name}: ${s.description}`).join("\n");
  }

  get count(): number { return this.skills.size; }

  loadSkill(name: string): string {
    const skill = this.skills.get(name);
    if (!skill) return `错误: 技能 '${name}' 不存在。可用: ${this.listSkills()}`;
    return `<skill-loaded name="${name}">\n${skill.content}\n</skill-loaded>`;
  }

  listSkills(): string {
    return this.skills.size === 0 ? "无" : Array.from(this.skills.keys()).join(", ");
  }
}

const skillLoader = new SkillLoader();

// ============================================================================
// V5.5: Hook 系统（保留，与 V5.5 兼容）
// ============================================================================

type HookType = "bootstrap:files" | "session:start" | "session:end";

interface HookEvent {
  type: HookType;
  context: Record<string, unknown>;
  prevented: boolean;
}

type HookHandler = (event: HookEvent) => Promise<void> | void;

class HookSystem {
  private handlers: Map<HookType, HookHandler[]> = new Map();

  register(type: HookType, handler: HookHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  async emit(type: HookType, context: Record<string, unknown> = {}): Promise<HookEvent> {
    const event: HookEvent = { type, context, prevented: false };
    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      await handler(event);
      if (event.prevented) break;
    }
    return event;
  }

  has(type: HookType): boolean {
    return (this.handlers.get(type)?.length || 0) > 0;
  }
}

const hooks = new HookSystem();

// ============================================================================
// V6 新增: 身份系统
// ============================================================================

// 人格文件定义（V6 扩展：新增 BOOTSTRAP.md, HEARTBEAT.md, TOOLS.md）
const PERSONA_FILES = [
  "AGENTS.md",      // 行为规范
  "SOUL.md",        // 性格价值观
  "IDENTITY.md",    // 名字角色
  "USER.md",        // 用户画像
  "BOOTSTRAP.md",   // 首次引导配置
  "HEARTBEAT.md",   // 心跳/定时任务配置
  "TOOLS.md"        // 工具扩展配置
];

interface PersonaFile {
  name: string;
  path: string;
  content: string;
  exists: boolean;
}

class IdentitySystem {
  private workspaceDir: string;
  private sampleDir: string;
  private identityCache: { name: string; soul: string; user: string; rules: string } | null = null;

  constructor(workspaceDir: string, sampleDir: string) {
    this.workspaceDir = workspaceDir;
    this.sampleDir = sampleDir;
  }

  // 从 sample 目录加载模板
  private loadTemplate(filename: string): string {
    const samplePath = path.join(this.sampleDir, filename);
    if (fs.existsSync(samplePath)) {
      return fs.readFileSync(samplePath, "utf-8");
    }
    // 默认模板
    const defaults: Record<string, string> = {
      "AGENTS.md": "# 行为规范\n\n- 专业、高效、有帮助",
      "SOUL.md": "# 性格\n\n- 冷静、理性、友善",
      "IDENTITY.md": "# 身份\n\n**Name:** _（请设置你的名字）_\n**Creature:** AI 助手\n**Vibe:** 专业、有帮助",
      "USER.md": "# 用户\n\n- 开发者",
      "BOOTSTRAP.md": "# 首次引导\n\n欢迎！这是你的第一次对话。\n\n请告诉我：\n1. 你希望我叫什么名字？\n2. 你希望我是什么角色/生物？\n3. 你的名字叫什么？\n\n例如：\"你是瑞克，我是莫蒂\"",
      "HEARTBEAT.md": "# 心跳配置\n\n## 定时任务\n\n暂无配置",
      "TOOLS.md": "# 工具扩展\n\n## 自定义工具\n\n暂无配置"
    };
    return defaults[filename] || `# ${filename}\n\n(模板缺失)`;
  }

  // 初始化 Workspace
  initWorkspace(): string {
    const created: string[] = [];
    const existed: string[] = [];

    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
    }

    // 检查是否是全新 workspace（除了 BOOTSTRAP.md 外的所有核心文件都不存在）
    const coreFiles = PERSONA_FILES.filter(f => f !== "BOOTSTRAP.md");
    const isBrandNewWorkspace = coreFiles.every(filename => {
      const filePath = path.join(this.workspaceDir, filename);
      return !fs.existsSync(filePath);
    });

    for (const filename of PERSONA_FILES) {
      // BOOTSTRAP.md 只在全新 workspace 时创建
      if (filename === "BOOTSTRAP.md" && !isBrandNewWorkspace) {
        continue;
      }

      const filePath = path.join(this.workspaceDir, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, this.loadTemplate(filename), "utf-8");
        created.push(filename);
      } else {
        existed.push(filename);
      }
    }

    // 确保 memory 目录
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

  // 加载所有人格文件（供 Hook 修改）
  loadPersonaFiles(): PersonaFile[] {
    return PERSONA_FILES.map(filename => {
      const filePath = path.join(this.workspaceDir, filename);
      const exists = fs.existsSync(filePath);
      return {
        name: filename,
        path: filePath,
        content: exists ? fs.readFileSync(filePath, "utf-8") : "",
        exists
      };
    });
  }

  // 设置人格文件（Hook 修改后）
  setPersonaFiles(files: PersonaFile[]): void {
    // 仅用于 Hook 修改内存中的内容
    // V7 会使用此方法来应用 Hook 修改
  }

  // 加载身份信息（简化版：不再提取名字，AI 直接读文件内容理解）
  loadIdentity(): string {
    const files = this.loadPersonaFiles();
    const contents: Record<string, string> = {};

    for (const file of files) {
      contents[file.name] = file.content || `(${file.name} 不存在)`;
    }

    this.identityCache = {
      name: "Agent", // 仅用于 REPL 显示，AI 从 IDENTITY.md 自己理解身份
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

  // 获取增强的系统提示（简化版：直接注入文件内容，让 AI 自己理解）
  async buildSystemPrompt(basePrompt: string): Promise<string> {
    if (!this.identityCache) this.loadIdentity();

    // 加载人格文件
    let personaFiles = this.loadPersonaFiles();

    // 触发 bootstrap:files Hook（V5.5 兼容）
    if (hooks.has("bootstrap:files")) {
      const event = await hooks.emit("bootstrap:files", { files: personaFiles });
      if (event.context.files) {
        personaFiles = event.context.files as PersonaFile[];
      }
    }

    // 提取文件内容
    const getContent = (name: string) => personaFiles.find(f => f.name === name)?.content || "";

    const identityContent = getContent("IDENTITY.md");
    const soulContent = getContent("SOUL.md");
    const userContent = getContent("USER.md");
    const agentsContent = getContent("AGENTS.md");
    const bootstrapContent = getContent("BOOTSTRAP.md");

    // 检查是否需要首次引导：只看 BOOTSTRAP.md 是否存在
    const bootstrapPath = path.join(this.workspaceDir, "BOOTSTRAP.md");
    const needsBootstrap = fs.existsSync(bootstrapPath);

    // 首次引导指令
    let bootstrapDirective = "";
    if (needsBootstrap && bootstrapContent) {
      bootstrapDirective = `
## 🌟 首次引导模式 (当前激活)

${bootstrapContent}

完成身份设置后，使用 identity_update 工具更新 IDENTITY.md 和 USER.md，然后调用 bootstrap_complete 删除此文件。
`;
    }

    return `${basePrompt}
${bootstrapDirective}
## 身份与人格

如果 IDENTITY.md 定义了角色，你就是那个角色。用角色的语气、口头禅、思维方式说话。
如果 SOUL.md 存在，体现其人格和语气。

### IDENTITY.md
${identityContent || "(未配置)"}

### SOUL.md
${soulContent || "(未配置)"}

### USER.md
${userContent || "(未配置)"}

### AGENTS.md
${agentsContent || "(未配置)"}`;
  }

  // 更新人格文件
  updateFile(filename: string, content: string): string {
    const validFiles = ["IDENTITY.md", "SOUL.md", "USER.md", "AGENTS.md", "HEARTBEAT.md", "TOOLS.md"];
    if (!validFiles.includes(filename)) {
      return `错误: 只能更新 ${validFiles.join(", ")}`;
    }
    const filePath = path.join(this.workspaceDir, filename);
    fs.writeFileSync(filePath, content, "utf-8");
    this.identityCache = null; // 清除缓存
    return `已更新: ${filename}`;
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

  get stats(): string {
    const files = this.loadPersonaFiles();
    const exists = files.filter(f => f.exists).length;
    return `人格文件: ${exists}/${files.length}`;
  }
}

const identitySystem = new IdentitySystem(IDENTITY_DIR, ID_SAMPLE_DIR);

// ============================================================================
// V6: Soul Switch Hook（可选）
// ============================================================================

function registerSoulSwitchHook() {
  const configPath = path.join(IDENTITY_DIR, "SOUL_SWITCH.json");

  hooks.register("bootstrap:files", async (event) => {
    if (!fs.existsSync(configPath)) return;

    let config: { chance?: number; file?: string };
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch { return; }

    const files = event.context.files as PersonaFile[];
    const altSoulFile = config.file || "SOUL_EVIL.md";
    const altSoulPath = path.join(IDENTITY_DIR, altSoulFile);

    if (!fs.existsSync(altSoulPath)) return;

    // 随机触发
    if (config.chance && Math.random() < config.chance) {
      const altContent = fs.readFileSync(altSoulPath, "utf-8");
      event.context.files = files.map(f =>
        f.name === "SOUL.md" ? { ...f, content: altContent, exists: true } : f
      );
      console.log(`\x1b[35m🔮 Soul Switch 激活: ${altSoulFile}\x1b[0m`);
    }
  });
}

// 默认注册 Soul Switch Hook
registerSoulSwitchHook();

// ============================================================================
// 系统提示和工具定义
// ============================================================================

const BASE_SYSTEM = `你是 OpenClaw V6 - 身份增强型 Agent，工作目录: ${WORKDIR}

## 🚨 第一优先级：Skill 加载

**可用 Skills:**
${skillLoader.getDescriptions()}

**强制规则：**
1. 收到任务后，**第一步必须**检查是否有匹配的 Skill
2. 如果任务涉及上述任何 Skill 的领域，**必须先调用 Skill 工具加载**
3. 只有加载 Skill 后，才能开始规划和执行

## 工作循环
1. **identify** - 识别任务类型
2. **load skill** - 🚨 加载匹配的 Skill（必须！）
3. **plan** - 用 TodoWrite 规划任务
4. **execute** - 按 Skill 指引执行
5. **track** - 更新任务状态

## 其他工具
- TodoWrite: 任务规划
- subagent: 委托子任务
- memory_*: 长期记忆
- identity_update: 更新人格文件
- bash/read/write/edit/grep: 基础操作`;

// 动态系统提示（由 IdentitySystem 构建）
let SYSTEM = "";

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "执行 shell 命令", input_schema: { type: "object" as const, properties: { command: { type: "string" as const } }, required: ["command"] } },
  { name: "read_file", description: "读取文件内容", input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, limit: { type: "number" as const } }, required: ["path"] } },
  { name: "write_file", description: "写入文件内容", input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, content: { type: "string" as const } }, required: ["path", "content"] } },
  { name: "edit_file", description: "精确编辑文件", input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, old_text: { type: "string" as const }, new_text: { type: "string" as const } }, required: ["path", "old_text", "new_text"] } },
  { name: "grep", description: "搜索文件内容", input_schema: { type: "object" as const, properties: { pattern: { type: "string" as const }, path: { type: "string" as const } }, required: ["pattern", "path"] } },
  { name: "memory_search", description: "语义搜索长期记忆", input_schema: { type: "object" as const, properties: { query: { type: "string" as const }, max_results: { type: "number" as const } }, required: ["query"] } },
  { name: "memory_get", description: "读取记忆文件", input_schema: { type: "object" as const, properties: { path: { type: "string" as const } }, required: ["path"] } },
  { name: "memory_append", description: "追加到记忆", input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, content: { type: "string" as const } }, required: ["path", "content"] } },
  { name: "memory_ingest", description: "摄入文件到记忆", input_schema: { type: "object" as const, properties: { path: { type: "string" as const } }, required: ["path"] } },
  {
    name: "TodoWrite",
    description: "更新任务列表",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              content: { type: "string" as const },
              status: { type: "string" as const, enum: ["pending", "in_progress", "completed"] },
              activeForm: { type: "string" as const }
            },
            required: ["content", "status", "activeForm"]
          }
        }
      },
      required: ["items"]
    }
  },
  { name: "subagent", description: "委托子任务", input_schema: { type: "object" as const, properties: { task: { type: "string" as const }, context: { type: "string" as const } }, required: ["task"] } },
  { name: "Skill", description: "加载领域技能。使用 skill='list' 查看所有可用技能，或指定技能名称加载", input_schema: { type: "object" as const, properties: { skill: { type: "string" as const } }, required: ["skill"] } },
  {
    name: "identity_update",
    description: "更新人格文件 (IDENTITY.md/SOUL.md/USER.md/AGENTS.md/HEARTBEAT.md/TOOLS.md)",
    input_schema: {
      type: "object" as const,
      properties: {
        file: { type: "string" as const, enum: ["IDENTITY.md", "SOUL.md", "USER.md", "AGENTS.md", "HEARTBEAT.md", "TOOLS.md"], description: "要更新的文件" },
        content: { type: "string" as const, description: "新内容" }
      },
      required: ["file", "content"]
    }
  },
  {
    name: "bootstrap_complete",
    description: "完成首次引导后调用，删除 BOOTSTRAP.md 文件",
    input_schema: { type: "object" as const, properties: {} }
  }
];

// ============================================================================
// 工具实现
// ============================================================================

function safePath(p: string): string {
  const resolved = path.resolve(p);
  const dangerousPaths = ["/etc", "/usr", "/bin", "/sbin", "/lib", "/sys", "/dev", "/proc"];
  if (dangerousPaths.some(dp => resolved.startsWith(dp))) throw new Error(`禁止访问系统目录: ${p}`);
  return resolved;
}

function runBash(command: string): string {
  if (["rm -rf /", "sudo", "shutdown"].some(d => command.includes(d))) return "错误: 危险命令";
  try { return execSync(command, { encoding: "utf-8", timeout: 60000, cwd: WORKDIR }).slice(0, 50000) || "(无输出)"; }
  catch (e: any) { return `错误: ${e.message}`; }
}

function runRead(filePath: string, limit?: number): string {
  try {
    const fullPath = safePath(filePath);
    let content = fs.readFileSync(fullPath, "utf-8");
    if (limit) { const lines = content.split("\n"); content = lines.slice(0, limit).join("\n") + `\n... (${lines.length - limit} 行更多)`; }
    return content.slice(0, 50000);
  } catch (e: any) { return `错误: ${e.message}`; }
}

function runWrite(filePath: string, content: string): string {
  try {
    const fullPath = safePath(filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
    return `已写入: ${filePath}`;
  } catch (e: any) { return `错误: ${e.message}`; }
}

function runEdit(filePath: string, oldText: string, newText: string): string {
  try {
    const fullPath = safePath(filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    if (!content.includes(oldText)) return "错误: 未找到匹配文本";
    fs.writeFileSync(fullPath, content.replaceAll(oldText, newText), "utf-8");
    return `已编辑: ${filePath}`;
  } catch (e: any) { return `错误: ${e.message}`; }
}

function runGrep(pattern: string, searchPath: string): string {
  try {
    const fullPath = safePath(searchPath);
    const isDir = fs.statSync(fullPath).isDirectory();
    if (isDir) {
      const output = execSync(`grep -rl "${pattern.replace(/"/g, '\\"')}" "${fullPath}" 2>/dev/null | head -20`, { encoding: "utf-8" });
      return output.trim() || "未找到匹配";
    } else {
      const content = fs.readFileSync(fullPath, "utf-8");
      const matches = content.split("\n").map((line, idx) => line.includes(pattern) ? `${idx + 1}: ${line}` : null).filter(Boolean) as string[];
      return matches.length === 0 ? "未找到匹配" : matches.slice(0, 50).join("\n");
    }
  } catch (e: any) { return `错误: ${e.message}`; }
}

// ============================================================================
// Agent 循环
// ============================================================================

async function chat(prompt: string, history: Anthropic.MessageParam[] = []): Promise<string> {
  history.push({ role: "user", content: prompt });

  while (true) {
    const request = {
      model: MODEL,
      system: [{ type: "text" as const, text: SYSTEM }],
      messages: history,
      tools: TOOLS,
      max_tokens: 8000
    };

    // 记录请求日志
    const logDir = path.join(WORKDIR, "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(path.join(logDir, `request-${timestamp}.json`), JSON.stringify(request, null, 2));

    const response = await client.messages.create(request as any);

    const content: Anthropic.ContentBlockParam[] = response.content.map(block => {
      if (block.type === "text") return { type: "text" as const, text: block.text };
      if (block.type === "tool_use") return { type: "tool_use" as const, id: block.id, name: block.name, input: block.input as Record<string, unknown> };
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
          case "write_file": output = runWrite(args.path, args.content); break;
          case "edit_file": output = runEdit(args.path, args.old_text, args.new_text); break;
          case "grep": output = runGrep(args.pattern, args.path); break;
          case "memory_search": output = memory.search(args.query, args.max_results || 5); break;
          case "memory_get": output = memory.get(args.path); break;
          case "memory_append": output = memory.append(args.path, args.content); break;
          case "memory_ingest": output = memory.ingestFile(safePath(args.path)); break;
          case "TodoWrite":
            try { output = todoManager.update(args.items); }
            catch (e: any) { output = `错误: ${e.message}`; }
            break;
          case "subagent": output = runSubagent(args.task, args.context); break;
          case "Skill":
            const skillName = args.skill;
            if (skillName === "list") {
              output = `可用技能:\n${skillLoader.getDescriptions()}`;
            } else {
              output = skillLoader.loadSkill(skillName);
            }
            console.log(`\x1b[36m[Skill 加载] ${skillName} (${output.length} 字符)\x1b[0m`);
            break;
          case "identity_update":
            output = identitySystem.updateFile(args.file, args.content);
            // 更新后刷新系统提示
            SYSTEM = await identitySystem.buildSystemPrompt(BASE_SYSTEM);
            break;
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
          default: output = `未知工具: ${toolName}`;
        }

        console.log(output.slice(0, 400) + (output.length > 400 ? "..." : ""));
        results.push({ type: "tool_result", tool_use_id: block.id, content: output.slice(0, 50000) });
      }
    }
    history.push({ role: "user", content: results });
  }
}

// ============================================================================
// 主入口
// ============================================================================

async function initialize(): Promise<void> {
  // 初始化 Workspace
  const initResult = identitySystem.initWorkspace();
  console.log(`\x1b[90m[Identity] ${initResult}\x1b[0m`);

  // 加载身份
  identitySystem.loadIdentity();

  // 触发 bootstrap:files Hook
  const personaFiles = identitySystem.loadPersonaFiles();
  if (hooks.has("bootstrap:files")) {
    const event = await hooks.emit("bootstrap:files", { files: personaFiles });
    if (event.context.files) {
      identitySystem.setPersonaFiles(event.context.files as PersonaFile[]);
    }
  }

  // 构建系统提示
  SYSTEM = await identitySystem.buildSystemPrompt(BASE_SYSTEM);
}

async function main() {
  await initialize();
  await hooks.emit("session:start", { sessionId: Date.now().toString() });

  // 检测是否需要首次引导
  const isBootstrapMode = identitySystem.loadIdentity().includes("首次运行");

  if (process.argv[2]) {
    const result = await chat(process.argv[2]);
    console.log(result);
    await hooks.emit("session:end", { sessionId: Date.now().toString() });
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const history: Anthropic.MessageParam[] = [];

    const ask = () => rl.question("\x1b[36m>> \x1b[0m", async (q) => {
      if (q === "q" || q === "exit" || q === "quit") {
        await hooks.emit("session:end", { sessionId: Date.now().toString() });
        return rl.close();
      }
      if (q === "") { ask(); return; }
      try { console.log(await chat(q, history)); } catch (e: any) { console.error(e.message); }
      ask();
    });

    console.log(`\x1b[90mWorkspace: ${IDENTITY_DIR}\x1b[0m`);
    console.log(`OpenClaw V6 - 身份增强型 Agent (${identitySystem.getName()})`);
    console.log(`\n${memory.stats()} | ${todoManager.stats()} | Skill 库: ${skillLoader.count} 个`);
    console.log("\n输入 'q' 或 'exit' 退出，空行继续等待输入\n");

    // 首次引导模式：自动开始对话
    if (isBootstrapMode) {
      console.log("\x1b[33m[首次引导模式] 正在初始化身份...\x1b[0m\n");
      chat("(系统触发：这是首次运行，请按照 BOOTSTRAP.md 的指引主动开始对话，引导用户完成身份设置。不要等待用户输入，直接开始！)", history)
        .then(response => {
          console.log(response);
          ask();
        })
        .catch(e => {
          console.error(`\x1b[31m错误: ${e.message}\x1b[0m`);
          ask();
        });
    } else {
      ask();
    }

    // 处理 Ctrl+C
    rl.on("close", () => {
      process.exit(0);
    });
  }
}

main().catch(console.error);
