#!/usr/bin/env tsx
/**
 * v5-agent.ts - Skill 增强型 Agent (~650行)
 *
 * 核心哲学: "Agent 需要专业知识，但不需要重新训练"
 * ===================================================
 * V5 在 V4 基础上增加 Skill 系统：
 * - 知识外部化: SKILL.md 文件定义领域知识
 * - 渐进式加载: 按需加载，不污染系统提示
 * - 缓存友好: Skill 内容作为 tool_result 注入
 *
 * 演进路线:
 * V0: bash 即一切
 * V1: 5个基础工具
 * V2: 本地向量记忆
 * V3: 任务规划系统
 * V4: 子代理协调
 * V5: Skill 系统 (当前) - 在 V4 基础上增加 SkillLoader
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
// V3: 任务规划系统（简化设计 - 参考 learn-claude-code）
// ============================================================================
// 核心哲学: "Make Plans Visible" - 让计划可见
// 约束即赋能: 最多20项 + 只能1个in_progress = 聚焦 + 可追踪

type TodoStatus = "pending" | "in_progress" | "completed";

interface TodoItem {
  content: string;      // 任务描述
  status: TodoStatus;   // 状态
  activeForm: string;   // 进行时描述，如 "正在读取文件..."
}

class TodoManager {
  private items: TodoItem[] = [];

  update(newItems: TodoItem[]): string {
    // 验证
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
      // activeForm 只在 in_progress 时必填
      if (status === "in_progress" && !activeForm) {
        throw new Error(`Item ${i}: in_progress 状态必须提供 activeForm`);
      }

      if (status === "in_progress") inProgressCount++;

      validated.push({ content, status, activeForm });
    }

    // 约束检查
    if (validated.length > 20) throw new Error("最多 20 个任务");
    if (inProgressCount > 1) throw new Error("只能有 1 个 in_progress 任务");

    this.items = validated;
    return this.render();
  }

  render(): string {
    if (this.items.length === 0) return "暂无任务";

    const lines: string[] = [];
    for (const item of this.items) {
      if (item.status === "completed") {
        lines.push(`[x] ${item.content}`);
      } else if (item.status === "in_progress") {
        lines.push(`[>] ${item.content} <- ${item.activeForm}`);
      } else {
        lines.push(`[ ] ${item.content}`);
      }
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
    const fullPrompt = context
      ? `[任务] ${task}\n\n[上下文]\n${context}`
      : task;

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
// V5 新增: Skill 系统（知识外部化与渐进式加载）
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

  // 解析 SKILL.md 文件 (YAML frontmatter + Markdown body)
  private parseSkillFile(filePath: string): Skill | null {
    try {
      const content = fs.readFileSync(filePath, "utf-8");

      // 匹配 ---\nYAML\n---\nMarkdown 格式
      const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      if (!match) return null;

      const yamlContent = match[1];
      const markdownContent = match[2].trim();

      // 简单 YAML 解析
      const name = yamlContent.match(/name:\s*(.+)/)?.[1]?.trim();
      const description = yamlContent.match(/description:\s*(.+)/)?.[1]?.trim();

      if (!name || !description) return null;

      return { name, description, content: markdownContent, dir: path.dirname(filePath) };
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
          if (skill) this.skills.set(skill.name, skill);
        }
      }
    }
  }

  // Layer 1: 获取 skill 列表用于系统提示 (仅元数据 ~100 tokens/skill)
  getDescriptions(): string {
    if (this.skills.size === 0) return "无可用技能";
    return Array.from(this.skills.values()).map(s =>
      `- ${s.name}: ${s.description}`
    ).join("\n");
  }

  get count(): number { return this.skills.size; }

  // Layer 2 + Layer 3: 加载指定 skill 的完整内容 + 资源列表
  loadSkill(name: string): string {
    const skill = this.skills.get(name);
    if (!skill) {
      const available = this.listSkills();
      return `错误: 技能 '${name}' 不存在。可用技能: ${available}`;
    }

    let output = `<skill-loaded name="${name}">\n${skill.content}\n`;

    // Layer 3: 列出可用资源 (scripts/, references/, assets/)
    const resources: string[] = [];
    for (const [folder, label] of [["scripts", "脚本"], ["references", "参考文档"], ["assets", "资源文件"]] as const) {
      const folderPath = path.join(skill.dir, folder);
      if (fs.existsSync(folderPath)) {
        try {
          const files = fs.readdirSync(folderPath).filter(f => !f.startsWith("."));
          if (files.length > 0) {
            resources.push(`${label} (${folder}/): ${files.join(", ")}`);
          }
        } catch (e) {}
      }
    }

    if (resources.length > 0) {
      output += `\n**可用资源 (${skill.dir}):**\n${resources.map(r => `- ${r}`).join("\n")}\n`;
    }

    output += `</skill-loaded>\n\n请按照上述技能文档的指引完成任务。`;
    return output;
  }

  listSkills(): string {
    if (this.skills.size === 0) return "无可用技能";
    return Array.from(this.skills.keys()).join(", ");
  }
}

const skillLoader = new SkillLoader();

// ============================================================================
// 系统提示和工具定义
// ============================================================================

const SYSTEM = `你是 OpenClaw V5 - Skill 增强型 Agent，工作目录: ${WORKDIR}

## 🚨 第一优先级：Skill 加载

**可用 Skills:**
${skillLoader.getDescriptions()}

**强制规则：**
1. 收到任务后，**第一步必须**检查是否有匹配的 Skill
2. 如果任务涉及上述任何 Skill 的领域，**必须先调用 Skill 工具加载**
3. 只有加载 Skill 后，才能开始规划和执行
4. 不确定时，用 Skill({ skill: "list" }) 查看完整列表

**示例（必须遵守）：**
- 用户说"写剧本/漫剧/短剧" → 第一步: Skill({ skill: "manju-writing" })
- 用户说"代码审查/review" → 第一步: Skill({ skill: "code-review" })
- 用户说"你好/打招呼" → 第一步: Skill({ skill: "hello" })

⚠️ 违反此规则 = 任务失败。必须先 Skill 工具，再 TodoWrite。

## 工作循环
1. **identify** - 识别任务类型
2. **load skill** - 🚨 加载匹配的 Skill（必须！）
3. **plan** - 用 TodoWrite 规划任务
4. **execute** - 按 Skill 指引执行
5. **track** - 更新任务状态

## 其他工具
- TodoWrite: 任务规划（最多20项，1个in_progress）
- subagent: 委托子任务
- memory_*: 长期记忆
- bash/read_file/write_file/edit_file/grep: 基础操作

## 行为规则
- 🚨 任务匹配 Skill 时，**必须先加载 Skill 再做其他事**
- 优先用工具行动，不要只解释`;

const TOOLS: Anthropic.Tool[] = [
  // V1 基础工具
  { name: "bash", description: "执行 shell 命令", input_schema: { type: "object" as const, properties: { command: { type: "string" as const } }, required: ["command"] } },
  { name: "read_file", description: "读取文件内容", input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, limit: { type: "number" as const } }, required: ["path"] } },
  { name: "write_file", description: "写入文件内容", input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, content: { type: "string" as const } }, required: ["path", "content"] } },
  { name: "edit_file", description: "精确编辑文件", input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, old_text: { type: "string" as const }, new_text: { type: "string" as const } }, required: ["path", "old_text", "new_text"] } },
  { name: "grep", description: "搜索文件内容", input_schema: { type: "object" as const, properties: { pattern: { type: "string" as const }, path: { type: "string" as const } }, required: ["pattern", "path"] } },
  // V2 记忆工具
  { name: "memory_search", description: "语义搜索长期记忆", input_schema: { type: "object" as const, properties: { query: { type: "string" as const }, max_results: { type: "number" as const } }, required: ["query"] } },
  { name: "memory_get", description: "读取记忆文件", input_schema: { type: "object" as const, properties: { path: { type: "string" as const } }, required: ["path"] } },
  { name: "memory_append", description: "追加到记忆", input_schema: { type: "object" as const, properties: { path: { type: "string" as const }, content: { type: "string" as const } }, required: ["path", "content"] } },
  { name: "memory_ingest", description: "摄入文件到记忆", input_schema: { type: "object" as const, properties: { path: { type: "string" as const } }, required: ["path"] } },
  // V3 任务工具（简化版 - 单一 TodoWrite）
  {
    name: "TodoWrite",
    description: "更新任务列表。用于规划和追踪进度。每次发送完整列表（替换式）",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array" as const,
          description: "完整任务列表（替换现有）",
          items: {
            type: "object" as const,
            properties: {
              content: { type: "string" as const, description: "任务描述" },
              status: { type: "string" as const, enum: ["pending", "in_progress", "completed"], description: "任务状态" },
              activeForm: { type: "string" as const, description: "进行时描述，如 '正在读取文件...'" }
            },
            required: ["content", "status", "activeForm"]
          }
        }
      },
      required: ["items"]
    }
  },
  // V4 子代理工具
  { name: "subagent", description: "委托子任务给隔离的Agent进程执行", input_schema: { type: "object" as const, properties: { task: { type: "string" as const, description: "子任务描述" }, context: { type: "string" as const, description: "可选的上下文信息" } }, required: ["task"] } },
  // V5 新增: Skill 工具
  { name: "Skill", description: "加载领域技能以获得专业知识。使用 skill='list' 查看所有可用技能，或指定技能名称加载", input_schema: { type: "object" as const, properties: { skill: { type: "string" as const, description: "技能名称，或 'list' 列出所有可用技能" } }, required: ["skill"] } }
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
    // 构建请求
    const request = {
      model: MODEL,
      system: [{ type: "text", text: SYSTEM }],
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
          // V1 工具
          case "bash": output = runBash(args.command); break;
          case "read_file": output = runRead(args.path, args.limit); break;
          case "write_file": output = runWrite(args.path, args.content); break;
          case "edit_file": output = runEdit(args.path, args.old_text, args.new_text); break;
          case "grep": output = runGrep(args.pattern, args.path); break;
          // V2 记忆工具
          case "memory_search": output = memory.search(args.query, args.max_results || 5); break;
          case "memory_get": output = memory.get(args.path); break;
          case "memory_append": output = memory.append(args.path, args.content); break;
          case "memory_ingest": output = memory.ingestFile(safePath(args.path)); break;
          // V3 任务工具（简化版）
          case "TodoWrite":
            try {
              output = todoManager.update(args.items);
            } catch (e: any) {
              output = `错误: ${e.message}`;
            }
            break;
          // V4 子代理
          case "subagent": output = runSubagent(args.task, args.context); break;
          // V5 新增: Skill
          case "Skill":
            // 支持 "list" 特殊命令列出所有可用技能
            if (args.skill === "list") {
              const skills = skillLoader.listSkills();
              output = `可用技能:\n${skillLoader.getDescriptions()}\n\n使用 Skill 工具加载具体技能，如: Skill({ skill: "pdf" })`;
            } else {
              output = skillLoader.loadSkill(args.skill);
            }
            console.log(`\x1b[36m[Skill 加载] ${args.skill} (${output.length} 字符)\x1b[0m`);
            break;
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

if (process.argv[2]) {
  chat(process.argv[2]).then(console.log).catch(console.error);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history: Anthropic.MessageParam[] = [];

  const ask = () => rl.question("\x1b[36m>> \x1b[0m", async (q) => {
    if (q === "q" || q === "exit" || q === "quit") return rl.close();
    if (q === "") { ask(); return; }  // 空输入继续等待
    try { console.log(await chat(q, history)); } catch (e: any) { console.error(e.message); }
    ask();
  });

  console.log("OpenClaw V5 - Skill 增强型 Agent (V4 + SkillLoader)");
  console.log(`\n${memory.stats()} | ${todoManager.stats()} | Skill 库: ${skillLoader.count} 个技能`);
  if (skillLoader.count > 0) console.log(`可用技能: ${skillLoader.listSkills()}`);
  console.log("\n输入 'q' 退出\n");
  ask();
}
