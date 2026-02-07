#!/usr/bin/env tsx
/**
 * v0_openclaw_agent.ts - OpenClaw 极简实现 (~80行核心)
 *
 * 核心哲学: "Bash 即一切"
 * ====================
 * 这是 OpenClaw 的终极简化版本。问题：Agent 的本质是什么？
 *
 * 答案: 一个工具 (bash) + 一个循环 = 完整的 Agent 能力
 *
 * 为什么 Bash 足够:
 * ----------------
 * Unix 哲学：一切皆文件，一切皆可管道。Bash 是通往这个世界的入口:
 *
 *     | 你需要      | Bash 命令                              |
 *     |-------------|----------------------------------------|
 *     | 读取文件    | cat, head, tail, grep                  |
 *     | 写入文件    | echo '...' > file, cat << 'EOF'        |
 *     | 搜索        | find, grep, rg, ls                     |
 *     | 执行        | python, npm, make, 任何命令            |
 *     | **子代理**  | npx tsx v0_openclaw_agent.ts "task"    |
 *
 * 最后一行是关键洞察: 通过 bash 调用自身来实现子代理！
 * 不需要 Task 工具，不需要 Agent Registry - 只是简单的进程递归。
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as readline from "readline";
import * as path from "path";

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

// 唯一的工具 - 通过 bash 完成所有操作
const TOOLS: Anthropic.Tool[] = [{
  name: "bash",
  description: `执行 shell 命令。常用模式:
- 读取: cat/grep/find/ls/head/tail
- 写入: echo 'content' > file
- 子代理: npx tsx v0_openclaw_agent.ts "任务描述" (生成隔离子代理)`,
  input_schema: {
    type: "object" as const,
    properties: { command: { type: "string" as const } },
    required: ["command"]
  }
}];

// 系统提示 - 教导模型如何有效使用 bash
const SYSTEM = `你是 OpenClaw V0 - 极简 Agent。使用 bash 命令解决问题。

规则:
- 工具优先于解释。先行动，后简要说明。
- 子代理: 复杂子任务生成子代理以保持上下文清洁:
  npx tsx v0_openclaw_agent.ts "分析 src/ 目录架构"

子代理在隔离进程中运行，仅返回最终摘要。`;

// 核心 Agent 循环 - 与 OpenClaw 的 attempt.ts 中的 activeSession.prompt() 等价
async function chat(prompt: string, history: Anthropic.MessageParam[] = []): Promise<string> {
  history.push({ role: "user", content: prompt });

  while (true) {
    // 1. 调用模型
    const response = await client.messages.create({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM }, ...history],
      tools: TOOLS,
      max_tokens: 8000
    } as any);

    // 2. 构建助手消息内容
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

    // 3. 如果没有工具调用，直接返回结果
    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("");
    }

    // 4. 执行每个工具调用并收集结果
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const cmd = (block.input as { command: string }).command;
        console.log(`\x1b[33m$ ${cmd}\x1b[0m`); // 黄色显示命令

        try {
          const output = execSync(cmd, { encoding: "utf-8", timeout: 300000 });
          console.log(output || "(empty)");
          results.push({ type: "tool_result", tool_use_id: block.id, content: output.slice(0, 50000) });
        } catch (e: any) {
          const err = e.stderr || e.message || String(e);
          console.log(`\x1b[31m${err}\x1b[0m`); // 红色显示错误
          results.push({ type: "tool_result", tool_use_id: block.id, content: err, is_error: true });
        }
      }
    }

    // 5. 追加结果并继续循环
    history.push({ role: "user", content: results });
  }
}

// 主入口: argv[2] ? 子代理模式 : REPL 交互模式
if (process.argv[2]) {
  // 子代理模式: 执行任务并输出结果
  chat(process.argv[2]).then(console.log).catch(console.error);
} else {
  // REPL 交互模式
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history: Anthropic.MessageParam[] = [];

  const ask = () => rl.question("\x1b[36m>> \x1b[0m", async (q) => {
    if (q === "q" || q === "exit" || q === "") return rl.close();
    console.log(await chat(q, history));
    ask();
  });

  console.log("OpenClaw V0 - 输入 'q' 或空行退出");
  ask();
}
