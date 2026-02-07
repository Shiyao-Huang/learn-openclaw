#!/usr/bin/env tsx
/**
 * v1_openclaw_agent.ts - 基础工具系统 (~300行)
 *
 * 核心哲学: "模型即代理"
 * ====================
 * V0 证明了单个 bash 工具足够。V1 展示更实用的设计:
 *
 * 五个核心工具覆盖 95% 的编码任务:
 *
 *     | 工具       | 用途                  | 示例                       |
 *     |------------|----------------------|----------------------------|
 *     | bash       | 执行任意命令          | npm install, git status    |
 *     | read_file  | 读取文件内容          | 查看 src/index.ts          |
 *     | write_file | 创建/覆盖文件         | 创建 README.md             |
 *     | edit_file  | 精确编辑文件          | 修改函数实现               |
 *     | grep       | 搜索文件内容          | 查找函数定义               |
 *
 * 与 V0 的区别:
 * - V0: 只有 bash，通过 echo/cat/grep 完成文件操作
 * - V1: 专用工具，更好的错误处理和安全性
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// 加载 .env 文件（强制覆盖系统变量）
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

// 系统提示
const SYSTEM = `你是 OpenClaw V1 - 编码 Agent。使用工具解决问题。

工作循环: 思考 -> 使用工具 -> 报告结果。

规则:
- 工具优先于解释。先行动，后简要说明。
- 不确定文件路径时，先用 bash ls/find 查找。
- 做最小修改，不要过度工程。
- 完成后总结变更内容。`;

// 工具定义 - 5 个核心工具
const TOOLS: Anthropic.Tool[] = [
  // Tool 1: bash - 执行任意命令
  {
    name: "bash",
    description: "执行 shell 命令。用于: ls, find, grep, git, npm, python 等",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string" as const, description: "要执行的 shell 命令" }
      },
      required: ["command"]
    }
  },

  // Tool 2: read_file - 读取文件
  {
    name: "read_file",
    description: "读取文件内容。支持可选的行数限制",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "文件路径（相对或绝对）" },
        limit: { type: "number" as const, description: "最大读取行数（可选）" }
      },
      required: ["path"]
    }
  },

  // Tool 3: write_file - 写入文件
  {
    name: "write_file",
    description: "写入文件内容。自动创建父目录",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "文件路径" },
        content: { type: "string" as const, description: "文件内容" }
      },
      required: ["path", "content"]
    }
  },

  // Tool 4: edit_file - 精确编辑文件
  {
    name: "edit_file",
    description: "精确替换文件中的文本。用于局部修改，保持文件其余部分不变",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "文件路径" },
        old_text: { type: "string" as const, description: "要替换的原文本（必须精确匹配）" },
        new_text: { type: "string" as const, description: "新文本" }
      },
      required: ["path", "old_text", "new_text"]
    }
  },

  // Tool 5: grep - 搜索文件
  {
    name: "grep",
    description: "在文件中搜索文本。支持正则表达式",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string" as const, description: "搜索模式" },
        path: { type: "string" as const, description: "搜索路径（文件或目录）" },
        recursive: { type: "boolean" as const, description: "是否递归搜索目录" }
      },
      required: ["pattern", "path"]
    }
  }
];

// ============================================================================
// 工具实现
// ============================================================================

/** 确保路径安全（允许任意目录，禁止系统目录） */
function safePath(p: string): string {
  const resolved = path.resolve(p);
  const dangerousPaths = ["/etc", "/usr", "/bin", "/sbin", "/lib", "/sys", "/dev", "/proc"];
  if (dangerousPaths.some(dp => resolved.startsWith(dp))) {
    throw new Error(`禁止访问系统目录: ${p}`);
  }
  return resolved;
}

/** 执行 bash 命令 */
function runBash(command: string): string {
  // 基础安全检查
  const dangerous = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];
  if (dangerous.some(d => command.includes(d))) {
    return "错误: 危险命令被阻止";
  }

  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: 60000,
      cwd: WORKDIR
    });
    return output.slice(0, 50000) || "(无输出)";
  } catch (e: any) {
    return `错误: ${e.stderr || e.message || String(e)}`;
  }
}

/** 读取文件 */
function runRead(filePath: string, limit?: number): string {
  try {
    const fullPath = safePath(filePath);
    let content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    if (limit && limit < lines.length) {
      const truncated = lines.slice(0, limit).join("\n");
      return truncated + `\n... (${lines.length - limit} 行更多)`;
    }

    return content.slice(0, 50000);
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

/** 写入文件 */
function runWrite(filePath: string, content: string): string {
  try {
    const fullPath = safePath(filePath);
    const dir = path.dirname(fullPath);

    // 自动创建父目录
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf-8");
    return `已写入: ${filePath}`;
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

/** 精确编辑文件 */
function runEdit(filePath: string, oldText: string, newText: string): string {
  try {
    const fullPath = safePath(filePath);
    const content = fs.readFileSync(fullPath, "utf-8");

    // 精确匹配替换
    if (!content.includes(oldText)) {
      return `错误: 未找到匹配的文本。请确保 old_text 与文件内容完全一致`;
    }

    const newContent = content.replaceAll(oldText, newText);
    fs.writeFileSync(fullPath, newContent, "utf-8");

    // 计算行数变化
    const oldLines = oldText.split("\n").length;
    const newLines = newText.split("\n").length;
    return `已编辑: ${filePath} (${oldLines} 行 → ${newLines} 行)`;
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

/** 搜索文件 */
function runGrep(pattern: string, searchPath: string, recursive?: boolean): string {
  try {
    const fullPath = safePath(searchPath);
    const isDir = fs.statSync(fullPath).isDirectory();

    if (isDir) {
      // 目录搜索 - 使用 find + grep
      const cmd = recursive !== false
        ? `find "${fullPath}" -type f -exec grep -l "${pattern.replace(/"/g, '\\"')}" {} + 2>/dev/null | head -20`
        : `grep -l "${pattern.replace(/"/g, '\\"')}" "${fullPath}"/* 2>/dev/null | head -20`;

      const output = execSync(cmd, { encoding: "utf-8", timeout: 30000 });
      const files = output.trim().split("\n").filter(Boolean);

      if (files.length === 0) return "未找到匹配文件";
      if (files.length >= 20) return files.join("\n") + "\n... (更多结果省略)";
      return files.join("\n");
    } else {
      // 单文件搜索
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      const matches: string[] = [];

      lines.forEach((line, idx) => {
        if (line.includes(pattern)) {
          matches.push(`${idx + 1}: ${line}`);
        }
      });

      if (matches.length === 0) return "未找到匹配";
      return matches.slice(0, 50).join("\n");
    }
  } catch (e: any) {
    return `错误: ${e.message}`;
  }
}

// ============================================================================
// 核心 Agent 循环
// ============================================================================

async function chat(prompt: string, history: Anthropic.MessageParam[] = []): Promise<string> {
  history.push({ role: "user", content: prompt });

  while (true) {
    // 调用模型
    const response = await client.messages.create({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM }, ...history],
      tools: TOOLS,
      max_tokens: 8000
    } as any);

    // 构建助手消息
    const content: Anthropic.ContentBlockParam[] = response.content.map(block => {
      if (block.type === "text") {
        return { type: "text" as const, text: block.text };
      } else if (block.type === "tool_use") {
        return {
          type: "tool_use" as const,
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>
        };
      }
      return { type: "text" as const, text: "" };
    });
    history.push({ role: "assistant", content });

    // 如果没有工具调用，直接返回
    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("");
    }

    // 执行工具调用
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const toolName = block.name;
        const args = block.input as Record<string, any>;

        console.log(`\x1b[33m[${toolName}] ${JSON.stringify(args)}\x1b[0m`);

        let output: string;
        switch (toolName) {
          case "bash":
            output = runBash(args.command);
            break;
          case "read_file":
            output = runRead(args.path, args.limit);
            break;
          case "write_file":
            output = runWrite(args.path, args.content);
            break;
          case "edit_file":
            output = runEdit(args.path, args.old_text, args.new_text);
            break;
          case "grep":
            output = runGrep(args.pattern, args.path, args.recursive);
            break;
          default:
            output = `未知工具: ${toolName}`;
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

  console.log("OpenClaw V1 - 基础工具系统 - 输入 'q' 或空行退出");
  ask();
}
