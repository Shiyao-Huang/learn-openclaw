#!/usr/bin/env tsx
/**
 * v3_todo_agent.ts - 任务规划系统 (~500行)
 *
 * 核心哲学: "Agent 需要任务规划"
 * =============================
 * V2 能记住知识，但缺乏任务管理能力。
 * V3 添加 Todo 系统，让 Agent 能分解复杂任务、跟踪进度。
 *
 * 工作流程:
 *   1. 复杂请求 -> 分解为子任务
 *   2. 执行任务 -> 更新状态
 *   3. 完成 -> 归档或删除
 *
 * 与 V2 的区别:
 * - V2: 被动响应，每次从零开始
 * - V3: 主动规划，能管理多步骤任务
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
// V3: 任务规划系统（新增）
// ============================================================================

type TodoStatus = "pending" | "in_progress" | "done" | "cancelled";
type TodoPriority = "high" | "medium" | "low";

interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  parentId?: string;  // 支持子任务
  tags?: string[];
}

class TodoManager {
  private todoFile: string;
  private todos: Map<string, Todo> = new Map();

  constructor() {
    this.todoFile = path.join(WORKDIR, "todos", "tasks.json");
    this.load();
  }

  private load() {
    if (fs.existsSync(this.todoFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.todoFile, "utf-8"));
        for (const todo of data.todos || []) this.todos.set(todo.id, todo);
      } catch (e) {}
    }
  }

  private save() {
    const dir = path.dirname(this.todoFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.todoFile, JSON.stringify({ todos: Array.from(this.todos.values()) }, null, 2));
  }

  create(title: string, options?: { description?: string; priority?: TodoPriority; parentId?: string; tags?: string[] }): string {
    const id = `todo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const todo: Todo = {
      id,
      title,
      description: options?.description,
      status: "pending",
      priority: options?.priority || "medium",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId: options?.parentId,
      tags: options?.tags
    };
    this.todos.set(id, todo);
    this.save();
    return `创建任务: ${id} - ${title}`;
  }

  list(filter?: { status?: TodoStatus; priority?: TodoPriority; tag?: string }): string {
    let todos = Array.from(this.todos.values());
    if (filter?.status) todos = todos.filter(t => t.status === filter.status);
    if (filter?.priority) todos = todos.filter(t => t.priority === filter.priority);
    if (filter?.tag) todos = todos.filter(t => t.tags?.includes(filter.tag));

    if (todos.length === 0) return "暂无任务";

    // 按状态分组
    const groups: Record<TodoStatus, Todo[]> = { pending: [], in_progress: [], done: [], cancelled: [] };
    todos.forEach(t => groups[t.status].push(t));

    const statusEmoji = { pending: "⏳", in_progress: "🔄", done: "✅", cancelled: "❌" };
    const statusText = { pending: "待处理", in_progress: "进行中", done: "已完成", cancelled: "已取消" };

    let result = "";
    (["in_progress", "pending", "done", "cancelled"] as TodoStatus[]).forEach(status => {
      if (groups[status].length > 0) {
        result += `\n${statusEmoji[status]} ${statusText[status]} (${groups[status].length}):\n`;
        groups[status].forEach(t => {
          const priorityEmoji = { high: "🔴", medium: "🟡", low: "🟢" }[t.priority];
          result += `  ${priorityEmoji} [${t.id}] ${t.title}\n`;
          if (t.description) result += `     ${t.description.slice(0, 60)}...\n`;
        });
      }
    });
    return result || "暂无任务";
  }

  update(id: string, updates: Partial<Pick<Todo, "title" | "description" | "priority" | "tags">>): string {
    const todo = this.todos.get(id);
    if (!todo) return `错误: 任务不存在 ${id}`;
    Object.assign(todo, updates, { updatedAt: Date.now() });
    this.save();
    return `更新任务: ${id}`;
  }

  start(id: string): string {
    const todo = this.todos.get(id);
    if (!todo) return `错误: 任务不存在 ${id}`;
    todo.status = "in_progress";
    todo.updatedAt = Date.now();
    this.save();
    return `开始任务: ${id} - ${todo.title}`;
  }

  complete(id: string): string {
    const todo = this.todos.get(id);
    if (!todo) return `错误: 任务不存在 ${id}`;
    todo.status = "done";
    todo.completedAt = Date.now();
    todo.updatedAt = Date.now();
    this.save();
    return `完成任务: ${id} - ${todo.title}`;
  }

  cancel(id: string): string {
    const todo = this.todos.get(id);
    if (!todo) return `错误: 任务不存在 ${id}`;
    todo.status = "cancelled";
    todo.updatedAt = Date.now();
    this.save();
    return `取消任务: ${id}`;
  }

  delete(id: string): string {
    if (!this.todos.has(id)) return `错误: 任务不存在 ${id}`;
    this.todos.delete(id);
    this.save();
    return `删除任务: ${id}`;
  }

  get(id: string): string {
    const todo = this.todos.get(id);
    if (!todo) return `错误: 任务不存在 ${id}`;
    return JSON.stringify(todo, null, 2);
  }

  stats(): string {
    const todos = Array.from(this.todos.values());
    const byStatus = { pending: 0, in_progress: 0, done: 0, cancelled: 0 };
    todos.forEach(t => byStatus[t.status]++);
    return `任务统计: 总计${todos.length} | 待处理${byStatus.pending} | 进行中${byStatus.in_progress} | 已完成${byStatus.done} | 已取消${byStatus.cancelled}`;
  }
}

const todoManager = new TodoManager();

// ============================================================================
// 系统提示和工具
// ============================================================================

const SYSTEM = `你是 OpenClaw V3 - 任务规划型 Agent。

工作循环: plan -> execute -> track -> (optional) remember

规划规则:
- 复杂任务先用 todo_create 分解为子任务
- 执行任务前用 todo_start 标记开始
- 完成任务后用 todo_complete 标记完成
- 定期用 todo_list 查看整体进度

记忆规则:
- 重要信息用 memory_append 记录
- 相关知识用 memory_search 查找`;

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
  // V3 任务工具（新增）
  { name: "todo_create", description: "创建新任务", input_schema: { type: "object" as const, properties: { title: { type: "string" as const }, description: { type: "string" as const }, priority: { type: "string" as const, enum: ["high", "medium", "low"] }, tags: { type: "array" as const, items: { type: "string" as const } } }, required: ["title"] } },
  { name: "todo_list", description: "列出任务", input_schema: { type: "object" as const, properties: { status: { type: "string" as const, enum: ["pending", "in_progress", "done", "cancelled"] }, priority: { type: "string" as const, enum: ["high", "medium", "low"] } } } },
  { name: "todo_start", description: "开始任务", input_schema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] } },
  { name: "todo_complete", description: "完成任务", input_schema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] } },
  { name: "todo_cancel", description: "取消任务", input_schema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] } },
  { name: "todo_delete", description: "删除任务", input_schema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] } },
  { name: "todo_get", description: "获取任务详情", input_schema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] } },
  { name: "todo_stats", description: "任务统计", input_schema: { type: "object" as const, properties: {} } }
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
    const response = await client.messages.create({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM }, ...history],
      tools: TOOLS,
      max_tokens: 8000
    } as any);

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
          // V3 任务工具
          case "todo_create": output = todoManager.create(args.title, { description: args.description, priority: args.priority, tags: args.tags }); break;
          case "todo_list": output = todoManager.list({ status: args.status, priority: args.priority }); break;
          case "todo_start": output = todoManager.start(args.id); break;
          case "todo_complete": output = todoManager.complete(args.id); break;
          case "todo_cancel": output = todoManager.cancel(args.id); break;
          case "todo_delete": output = todoManager.delete(args.id); break;
          case "todo_get": output = todoManager.get(args.id); break;
          case "todo_stats": output = todoManager.stats(); break;
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
    if (q === "q" || q === "" ) return rl.close();
    try { console.log(await chat(q, history)); } catch (e: any) { console.error(e.message); }
    ask();
  });

  console.log("OpenClaw V3 - 任务规划系统");
  console.log(`\n${memory.stats()} | ${todoManager.stats()}`);
  console.log("\n输入 'q' 退出\n");
  ask();
}
