#!/usr/bin/env tsx
/**
 * v1-agent.ts - 基础工具系统 (~250行)
 *
 * 核心哲学: "专用工具比通用 bash 更安全"
 * ======================================
 * V1 在 V0 基础上增加 4 个专用工具：
 * - read_file: 安全读取文件（带路径检查）
 * - write_file: 安全写入文件（自动创建目录）
 * - edit_file: 精确编辑（避免全文件重写）
 * - grep: 搜索文件内容
 *
 * 与 V0 的区别:
 * - V0: 只有 bash，通过 echo/cat/grep 完成文件操作
 * - V1: 专用工具，更好的错误处理和安全性
 *
 * 演进路线:
 * V0: bash 即一切
 * V1: 5个基础工具 (当前)
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as readline from "readline";
import * as path from "path";
import * as fs from "fs";

// 加载 .env 文件（强制覆盖系统变量）
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
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
// 工具定义 - V0 的 bash + V1 新增的 4 个工具
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

const SYSTEM = `你是 OpenClaw V1 - 安全工具型 Agent。

## 工作循环
思考 -> 安全检查 -> 使用工具 -> 报告结果

## 工具系统 (V1 核心)
可用工具:
- bash: 执行 shell 命令（受安全限制）
- read_file: 安全读取文件（路径沙箱保护）
- write_file: 安全写入文件（自动创建目录）
- edit_file: 精确编辑（查找替换，避免全文件重写）
- grep: 搜索文件内容

工具选择策略:
- 文件操作优先使用专用工具（read_file/write_file/edit_file）而非 bash
- 专用工具提供更好的错误处理和安全边界
- bash 用于系统命令（ls/find/git 等）

## 安全边界 (V1 新增)
路径沙箱:
- 所有文件操作限制在工作目录 (${WORKDIR}) 内
- 禁止访问父目录 (..) 或绝对路径
- 违规路径会被拒绝

危险命令阻止:
- rm -rf /、sudo、shutdown、reboot、> /dev/ 等被阻止
- 这是最后一道防线，不要依赖它

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

  console.log("OpenClaw V1 - 5个基础工具 - 输入 'q' 退出");
  ask();
}
