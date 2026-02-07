#!/usr/bin/env tsx
/**
 * v2_memory_fetch.ts - 使用原生 fetch 的向量记忆系统
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { createHash } from "crypto";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// 强制使用 .env 文件
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const API_KEY = process.env.ANTHROPIC_API_KEY;
const BASE_URL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
const MODEL = process.env.MODEL_ID || "claude-opus-4-6";
const WORKDIR = process.cwd();

if (!API_KEY) {
  console.error("\x1b[31m错误: 未设置 ANTHROPIC_API_KEY\x1b[0m");
  process.exit(1);
}

// ============================================================================
// 本地向量记忆系统
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
      } catch (e) {
        console.log("\x1b[33m警告: 索引文件损坏\x1b[0m");
      }
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
// 系统提示和工具定义
// ============================================================================

const SYSTEM = `你是 OpenClaw V2 - 记忆型 Agent。工作循环: recall -> think -> act -> remember

规则:
- 回答前先用 memory_search 查找相关知识
- 重要决策用 memory_append 记录
- 可用工具: bash, read_file, write_file, edit_file, grep, memory_search, memory_get, memory_append, memory_ingest, memory_stats`;

const TOOLS = [
  { name: "bash", description: "执行 shell 命令", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "读取文件", input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "number" } }, required: ["path"] } },
  { name: "write_file", description: "写入文件", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "精确编辑", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  { name: "grep", description: "搜索文件", input_schema: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" } }, required: ["pattern", "path"] } },
  { name: "memory_search", description: "语义搜索记忆", input_schema: { type: "object", properties: { query: { type: "string" }, max_results: { type: "number" } }, required: ["query"] } },
  { name: "memory_get", description: "读取记忆文件", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "memory_append", description: "追加到记忆", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "memory_ingest", description: "摄入文件到记忆", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "memory_stats", description: "记忆库统计", input_schema: { type: "object", properties: {} } }
];

// ============================================================================
// 工具实现
// ============================================================================

function safePath(p: string): string {
  const resolved = path.resolve(p);
  const dangerousPaths = ["/etc", "/usr", "/bin", "/sbin", "/lib", "/sys", "/dev", "/proc"];
  if (dangerousPaths.some(dp => resolved.startsWith(dp))) {
    throw new Error(`禁止访问系统目录: ${p}`);
  }
  return resolved;
}

function runBash(cmd: string): string {
  if (["rm -rf /", "sudo", "shutdown"].some(d => cmd.includes(d))) return "错误: 危险命令";
  try { return execSync(cmd, { encoding: "utf-8", timeout: 60000, cwd: WORKDIR }).slice(0, 50000) || "(无输出)"; }
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
    fs.writeFileSync(fullPath, content.replace(oldText, newText), "utf-8");
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
// LLM 调用 (fetch)
// ============================================================================

async function callLLM(messages: any[], tools: any[]): Promise<any> {
  const response = await fetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY!
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      tools
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API 错误: ${response.status} ${error}`);
  }

  return await response.json();
}

// ============================================================================
// Agent 循环
// ============================================================================

async function chat(prompt: string, history: any[] = []): Promise<string> {
  history.push({ role: "user", content: prompt });

  while (true) {
    const response = await callLLM(history, TOOLS);

    const content = response.content;
    history.push({ role: "assistant", content });

    const toolUses = content.filter((c: any) => c.type === "tool_use");
    if (toolUses.length === 0) {
      return content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    }

    const results: any[] = [];
    for (const tool of toolUses) {
      const { name, input } = tool;
      console.log(`\x1b[33m[${name}] ${JSON.stringify(input)}\x1b[0m`);

      let output: string;
      switch (name) {
        case "bash": output = runBash(input.command); break;
        case "read_file": output = runRead(input.path, input.limit); break;
        case "write_file": output = runWrite(input.path, input.content); break;
        case "edit_file": output = runEdit(input.path, input.old_text, input.new_text); break;
        case "grep": output = runGrep(input.pattern, input.path); break;
        case "memory_search": output = memory.search(input.query, input.max_results || 5); break;
        case "memory_get": output = memory.get(input.path); break;
        case "memory_append": output = memory.append(input.path, input.content); break;
        case "memory_ingest":
          const fp = safePath(input.path);
          output = fs.statSync(fp).isDirectory() ? "暂不支持目录" : memory.ingestFile(fp);
          break;
        case "memory_stats": output = memory.stats(); break;
        default: output = `未知工具: ${name}`;
      }

      console.log(output.slice(0, 300) + (output.length > 300 ? "..." : ""));
      results.push({ type: "tool_result", tool_use_id: tool.id, content: output });
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
  const history: any[] = [];

  const ask = () => rl.question("\x1b[36m>> \x1b[0m", async (q) => {
    if (q === "q" || q === "" ) return rl.close();
    try { console.log(await chat(q, history)); } catch (e: any) { console.error(e.message); }
    ask();
  });

  console.log("OpenClaw V2 (fetch) - 本地向量记忆系统");
  console.log(`\n${memory.stats()} | 输入 'q' 退出`);
  ask();
}
