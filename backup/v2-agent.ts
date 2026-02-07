#!/usr/bin/env tsx
/**
 * v2-agent.ts - 本地向量记忆系统 (~420行)
 *
 * 核心哲学: "Agent 需要记忆，但不需要外部向量数据库"
 * ===================================================
 * V2 在 V1 基础上增加本地记忆系统：
 * - 零外部依赖: 不需要 ChromaDB/Pinecone
 * - Jaccard 相似度: 对中文友好的简单算法
 * - 文件分块: 自动将文档切分为可检索片段
 *
 * 记忆工具:
 * - memory_search: 语义搜索记忆库
 * - memory_get: 读取记忆文件原始内容
 * - memory_append: 追加内容到记忆文件
 * - memory_ingest: 摄入文件到记忆库
 * - memory_stats: 查看记忆库统计
 *
 * 演进路线:
 * V0: bash 即一切
 * V1: 5个基础工具
 * V2: 本地向量记忆 (当前)
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
      if (result.includes("已摄��")) total++;
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
// 系统提示
// ============================================================================

const SYSTEM = `你是 OpenClaw V2 - 记忆型 Agent。

工作循环: recall -> think -> act -> remember

记忆规则:
- 回答前先用 memory_search 查找相关知识
- 重要决策和发现用 memory_append 记录
- 新文档用 memory_ingest 摄入到记忆库`;

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
  // V2 记忆工具 (新增)
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
          case "write_file": output = runWrite(args.path, args.content); break;
          case "edit_file": output = runEdit(args.path, args.old_text, args.new_text); break;
          case "grep": output = runGrep(args.pattern, args.path, args.recursive); break;
          case "memory_search": output = memory.search(args.query, args.max_results || 5); break;
          case "memory_get": output = memory.get(args.path, args.from_line, args.lines); break;
          case "memory_append": output = memory.append(args.path, args.content); break;
          case "memory_ingest":
            const fullPath = safePath(args.path);
            const stat = fs.statSync(fullPath);
            output = stat.isDirectory() ? memory.ingestDirectory(fullPath) : memory.ingestFile(fullPath);
            break;
          case "memory_stats": output = memory.stats(); break;
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
// 主入口
// ============================================================================

if (process.argv[2]) {
  chat(process.argv[2]).then(console.log).catch(console.error);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history: Anthropic.MessageParam[] = [];

  const ask = () => rl.question("\x1b[36m>> \x1b[0m", async (q) => {
    if (q === "q" || q === "exit" || q === "") return rl.close();
    console.log(await chat(q, history));
    ask();
  });

  console.log("OpenClaw V2 - 记忆型 Agent (本地向量记忆) - 输入 'q' 或空行退出");
  console.log(`\n${memory.stats()}`);
  ask();
}
