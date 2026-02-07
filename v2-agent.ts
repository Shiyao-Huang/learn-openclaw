#!/usr/bin/env tsx
/**
 * v2-agent.ts - 本地向量记忆系统 (~450行)
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
import * as readline from "readline";
import * as path from "path";
import * as fs from "fs";

// 加载 .env 文件（强制覆盖系统变量）
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createHash } from "crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

// 检查 API Key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("\x1b[31m错误: 未设置 ANTHROPIC_API_KEY 环境变量\x1b[0m");
  process.exit(1);
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL
});
const MODEL = process.env.MODEL_ID || "claude-opus-4-6";
const WORKDIR = process.cwd();

// ============================================================================
// V1 新增: 路径安全检查
// ============================================================================

function safePath(p: string): string {
  const resolved = path.resolve(WORKDIR, p);
  const relative = path.relative(WORKDIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`路径超出工作区: ${p}`);
  }
  return resolved;
}

// ============================================================================
// V2 新增: 本地向量记忆系统 - 零外部依赖
// ============================================================================

interface MemoryChunk {
  id: string;
  content: string;
  source: string;
  tokens: Set<string>;
}

class LocalMemory {
  private chunks: MemoryChunk[] = [];
  private memoryDir: string;
  private indexFile: string;

  constructor() {
    this.memoryDir = path.join(WORKDIR, ".memory");
    this.indexFile = path.join(this.memoryDir, "index.json");
    if (!fs.existsSync(this.memoryDir)) fs.mkdirSync(this.memoryDir, { recursive: true });
    this.loadIndex();
  }

  private loadIndex() {
    if (fs.existsSync(this.indexFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.indexFile, "utf-8"));
        this.chunks = data.map((c: any) => ({ ...c, tokens: new Set(c.tokens) }));
      } catch (e) {
        this.chunks = [];
      }
    }
  }

  private saveIndex() {
    const data = this.chunks.map(c => ({ ...c, tokens: Array.from(c.tokens) }));
    fs.writeFileSync(this.indexFile, JSON.stringify(data, null, 2));
  }

  private tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    // 中文分词: 2-gram
    for (let i = 0; i < text.length - 1; i++) {
      tokens.add(text.slice(i, i + 2));
    }
    // 英文分词: 单词
    text.toLowerCase().match(/\b\w+\b/g)?.forEach(w => tokens.add(w));
    return tokens;
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  search(query: string, maxResults: number = 5): string {
    const queryTokens = this.tokenize(query);
    const scored = this.chunks.map(c => ({
      chunk: c,
      score: this.jaccard(queryTokens, c.tokens)
    })).filter(s => s.score > 0.05).sort((a, b) => b.score - a.score).slice(0, maxResults);

    if (scored.length === 0) return "未找到相关记忆";
    return scored.map(s => `[${s.chunk.source}] (${(s.score * 100).toFixed(0)}%)\n${s.chunk.content.slice(0, 300)}`).join("\n\n");
  }

  get(filePath: string, fromLine?: number, lines?: number): string {
    const full = path.join(this.memoryDir, filePath);
    if (!fs.existsSync(full)) return `文件不存在: ${filePath}`;
    let content = fs.readFileSync(full, "utf-8");
    if (fromLine !== undefined) {
      const allLines = content.split("\n");
      content = allLines.slice(fromLine - 1, fromLine - 1 + (lines || 50)).join("\n");
    }
    return content;
  }

  append(filePath: string, content: string): string {
    const full = path.join(this.memoryDir, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.appendFileSync(full, content + "\n");
    // 自动索引
    const id = createHash("md5").update(content).digest("hex").slice(0, 8);
    this.chunks.push({ id, content, source: filePath, tokens: this.tokenize(content) });
    this.saveIndex();
    return `已追加到 ${filePath}`;
  }

  ingestFile(filePath: string): string {
    const content = fs.readFileSync(filePath, "utf-8");
    const chunkSize = 500;
    const lines = content.split("\n");
    let added = 0;

    for (let i = 0; i < lines.length; i += chunkSize / 2) {
      const chunk = lines.slice(i, i + chunkSize).join("\n");
      if (chunk.trim().length < 50) continue;
      const id = createHash("md5").update(chunk).digest("hex").slice(0, 8);
      if (!this.chunks.find(c => c.id === id)) {
        this.chunks.push({ id, content: chunk, source: path.basename(filePath), tokens: this.tokenize(chunk) });
        added++;
      }
    }
    this.saveIndex();
    return `已摄入 ${filePath}: ${added} 个新片段`;
  }

  ingestDirectory(dirPath: string): string {
    const files = fs.readdirSync(dirPath).filter(f => /\.(md|txt|ts|js|py)$/.test(f));
    let total = 0;
    for (const file of files) {
      const result = this.ingestFile(path.join(dirPath, file));
      total += parseInt(result.match(/(\d+) 个/)?.[1] || "0");
    }
    return `已摄入目录 ${dirPath}: ${total} 个新片段`;
  }

  stats(): string {
    return `记忆库: ${this.chunks.length} 个片段`;
  }
}

const memory = new LocalMemory();

// ============================================================================
// 工具定义 - V0 的 bash + V1 的 4 个工具 + V2 的记忆工具
// ============================================================================

const TOOLS: Anthropic.Tool[] = [
  // V0: bash 工具
  {
    name: "bash",
    description: `执行 shell 命令。常用模式:
- 读取: cat/grep/find/ls/head/tail
- 写入: echo 'content' > file
- 子代理: npx tsx v1-agent.ts "任务描述"`,
    input_schema: {
      type: "object" as const,
      properties: { command: { type: "string" as const } },
      required: ["command"]
    }
  },
  // V1 新增: read_file
  {
    name: "read_file",
    description: "安全读取文件内容，支持行数限制",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "文件路径" },
        limit: { type: "number" as const, description: "最大行数（可选）" }
      },
      required: ["path"]
    }
  },
  // V1 新增: write_file
  {
    name: "write_file",
    description: "安全写入文件，自动创建目录",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "文件路径" },
        content: { type: "string" as const, description: "文件内容" }
      },
      required: ["path", "content"]
    }
  },
  // V1 新增: edit_file
  {
    name: "edit_file",
    description: "精确编辑文件（查找替换）",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "文件路径" },
        old_text: { type: "string" as const, description: "要替换的文本" },
        new_text: { type: "string" as const, description: "新文本" }
      },
      required: ["path", "old_text", "new_text"]
    }
  },
  // V1 新增: grep
  {
    name: "grep",
    description: "搜索文件内容",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string" as const, description: "搜索模式" },
        path: { type: "string" as const, description: "文件或目录路径" },
        recursive: { type: "boolean" as const, description: "是否递归搜索" }
      },
      required: ["pattern", "path"]
    }
  },
  // V2 新增: 记忆工具
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
// V1 新增: 工具实现函数
// ============================================================================

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
    const full = safePath(filePath);
    let content = fs.readFileSync(full, "utf-8");
    if (limit) {
      const lines = content.split("\n");
      content = lines.slice(0, limit).join("\n");
      if (lines.length > limit) content += `\n... (还有 ${lines.length - limit} 行)`;
    }
    return content;
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

function runWrite(filePath: string, content: string): string {
  try {
    const full = safePath(filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf-8");
    return `已写入: ${filePath} (${content.length} 字符)`;
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

function runEdit(filePath: string, oldText: string, newText: string): string {
  try {
    const full = safePath(filePath);
    const content = fs.readFileSync(full, "utf-8");
    if (!content.includes(oldText)) return "错误: 未找到要替换的文本";
    const newContent = content.replace(oldText, newText);
    fs.writeFileSync(full, newContent, "utf-8");
    return `已编辑: ${filePath}`;
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

function runGrep(pattern: string, filePath: string, recursive?: boolean): string {
  try {
    const full = safePath(filePath);
    const flags = recursive ? "-rn" : "-n";
    const output = execSync(`grep ${flags} "${pattern}" "${full}" 2>/dev/null || true`, { encoding: "utf-8" });
    return output || "(无匹配)";
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

// ============================================================================
// 系统提示
// ============================================================================

const SYSTEM = `你是 OpenClaw V2 - 有记忆的 Agent。

## 工作循环
recall -> 思考 -> 使用工具 -> remember

## 记忆系统 (V2 核心)
可用工具:
- memory_search: 语义搜索记忆库（Jaccard 相似度）
- memory_get: 读取记忆文件原始内容
- memory_append: 追加内容到记忆文件（自动索引）
- memory_ingest: 摄入文件/目录到记忆库
- memory_stats: 查看记忆库统计

记忆策略:
- 开始任务前，先用 memory_search 查找相关知识
- 重要发现用 memory_append 记录到 notes.md
- 新文档用 memory_ingest 摄入以便后续检索
- 记忆存储在 .memory/ 目录，跨会话持久化

## 工具系统 (继承 V1)
文件操作:
- read_file/write_file/edit_file: 安全文件操作（路径沙箱）
- grep: 搜索文件内容
- bash: 系统命令（受安全限制）

工具选择策略:
- 知识检索优先使用 memory_search
- 文件操作优先使用专用工具而非 bash

## 安全边界 (继承 V1)
- 路径沙箱: 文件操作限制在工作目录 (${WORKDIR}) 内
- 危险命令阻止: rm -rf /、sudo 等被阻止

## 行为规则
- 工具优先于解释。先行动，后简要说明
- 不确定文件路径时，先用 bash ls/find 查找
- 做最小修改，不要过度工程
- 完成后总结变更内容`;

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
          // V2 新增: 记忆工具
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

  console.log("OpenClaw V2 - 有记忆的 Agent - 输入 'q' 退出");
  console.log(memory.stats());
  ask();
}
