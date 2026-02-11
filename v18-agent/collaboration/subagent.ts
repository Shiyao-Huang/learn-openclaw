/**
 * collaboration/subagent.ts - 子代理管理器
 * 
 * 管理子代理的生命周期:
 * - 创建/启动子代理
 * - 监控子代理状态
 * - 收集子代理结果
 * - 优雅关闭子代理
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type SubAgentStatus = 
  | "pending"    // 等待启动
  | "starting"   // 启动中
  | "running"    // 运行中
  | "completed"  // 已完成
  | "failed"     // 失败
  | "stopped";   // 已停止

export interface SubAgent {
  id: string;
  name: string;
  task: string;
  status: SubAgentStatus;
  pid?: number;
  startTime: number;
  endTime?: number;
  result?: string;
  error?: string;
  logs: string[];
  maxLines?: number;
  workDir: string;
  model?: string;
  timeout?: number;
}

export interface SubAgentOptions {
  name?: string;
  task: string;
  workDir?: string;
  model?: string;
  timeout?: number;     // 毫秒
  maxLines?: number;    // 最大输出行数
}

export class SubAgentManager {
  private agents: Map<string, SubAgent> = new Map();
  private workDir: string;
  private logsDir: string;

  constructor(workDir: string) {
    this.workDir = workDir;
    this.logsDir = path.join(workDir, "subagents");
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * 创建并启动子代理
   */
  async create(options: SubAgentOptions): Promise<SubAgent> {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const agentDir = path.join(this.logsDir, id);
    fs.mkdirSync(agentDir, { recursive: true });

    const agent: SubAgent = {
      id,
      name: options.name || `SubAgent-${id.slice(-5)}`,
      task: options.task,
      status: "pending",
      startTime: Date.now(),
      logs: [],
      workDir: options.workDir || agentDir,
      model: options.model,
      timeout: options.timeout || 300000, // 默认5分钟
      maxLines: options.maxLines || 100,
    };

    this.agents.set(id, agent);
    
    // 异步启动
    this.startAgent(agent);
    
    return agent;
  }

  /**
   * 启动子代理进程
   */
  private async startAgent(agent: SubAgent): Promise<void> {
    agent.status = "starting";
    
    try {
      // 创建子代理的入口脚本
      const entryScript = this.createEntryScript(agent);
      const scriptPath = path.join(agent.workDir, "entry.ts");
      fs.writeFileSync(scriptPath, entryScript);

      // 启动子进程
      const child = spawn("npx", ["tsx", scriptPath], {
        cwd: this.workDir,
        env: { ...process.env, SUBAGENT_ID: agent.id },
        detached: false,
      });

      agent.pid = child.pid;
      agent.status = "running";

      // 收集输出
      let output = "";
      let lineCount = 0;

      child.stdout?.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (lineCount < (agent.maxLines || 100)) {
            output += line + "\n";
            agent.logs.push(line);
            lineCount++;
          }
        }
      });

      child.stderr?.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            agent.logs.push(`[ERR] ${line}`);
          }
        }
      });

      // 超时处理
      const timeoutId = setTimeout(() => {
        if (agent.status === "running") {
          child.kill("SIGTERM");
          agent.error = "Timeout";
          agent.status = "failed";
        }
      }, agent.timeout);

      // 进程结束处理
      child.on("close", (code) => {
        clearTimeout(timeoutId);
        agent.endTime = Date.now();
        
        if (code === 0) {
          agent.status = "completed";
          agent.result = output.trim();
        } else {
          agent.status = "failed";
          agent.error = agent.error || `Exit code: ${code}`;
        }

        // 保存完整日志
        this.saveAgentLog(agent);
      });

    } catch (error) {
      agent.status = "failed";
      agent.error = error instanceof Error ? error.message : String(error);
      agent.endTime = Date.now();
    }
  }

  /**
   * 创建子代理入口脚本
   */
  private createEntryScript(agent: SubAgent): string {
    return `#!/usr/bin/env tsx
/**
 * SubAgent Entry - ${agent.name}
 * Task: ${agent.task.slice(0, 100)}...
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const task = ${JSON.stringify(agent.task)};
const model = ${JSON.stringify(agent.model || "claude-3-5-haiku-20241022")};

async function main() {
  const client = new Anthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY 
  });

  console.log("[SubAgent] Starting task...");
  
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: task }],
    });

    const result = response.content
      .filter((b): b is any => b.type === "text")
      .map(b => b.text)
      .join("\\n");

    console.log(result);
    console.log("[SubAgent] Task completed successfully");
  } catch (error) {
    console.error("[SubAgent] Error:", error);
    process.exit(1);
  }
}

main();
`;
  }

  /**
   * 保存代理日志
   */
  private saveAgentLog(agent: SubAgent): void {
    const logPath = path.join(agent.workDir, "output.log");
    const logData = {
      ...agent,
      logs: agent.logs.slice(-100), // 只保留最后100行
    };
    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
  }

  /**
   * 获取子代理状态
   */
  get(id: string): SubAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * 列出所有子代理
   */
  list(): SubAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 列出运行中的子代理
   */
  listRunning(): SubAgent[] {
    return this.list().filter(a => a.status === "running");
  }

  /**
   * 等待子代理完成
   */
  async waitFor(id: string, timeoutMs?: number): Promise<SubAgent> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`SubAgent not found: ${id}`);
    }

    const startTime = Date.now();
    const maxWait = timeoutMs || 60000;

    while (agent.status === "pending" || agent.status === "starting" || agent.status === "running") {
      if (Date.now() - startTime > maxWait) {
        throw new Error(`Timeout waiting for subagent ${id}`);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    return agent;
  }

  /**
   * 停止子代理
   */
  async stop(id: string): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent || agent.status !== "running" || !agent.pid) {
      return false;
    }

    try {
      process.kill(agent.pid, "SIGTERM");
      agent.status = "stopped";
      agent.endTime = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 删除子代理
   */
  delete(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;

    if (agent.status === "running") {
      this.stop(id);
    }

    this.agents.delete(id);
    
    // 清理目录
    try {
      fs.rmSync(agent.workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    return true;
  }

  /**
   * 获取子代理结果
   */
  getResult(id: string): { status: SubAgentStatus; result?: string; error?: string } {
    const agent = this.agents.get(id);
    if (!agent) {
      return { status: "failed", error: "Not found" };
    }

    return {
      status: agent.status,
      result: agent.result,
      error: agent.error,
    };
  }

  /**
   * 清理已完成的代理
   */
  cleanup(): number {
    let count = 0;
    for (const [id, agent] of this.agents) {
      if (["completed", "failed", "stopped"].includes(agent.status)) {
        this.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * 生成状态报告
   */
  generateReport(): string {
    const all = this.list();
    const running = all.filter(a => a.status === "running").length;
    const completed = all.filter(a => a.status === "completed").length;
    const failed = all.filter(a => a.status === "failed").length;

    return `## SubAgent 状态报告

总计: ${all.length} 个子代理
- 运行中: ${running}
- 已完成: ${completed}
- 失败: ${failed}
- 其他: ${all.length - running - completed - failed}

${all.slice(0, 10).map(a => `- ${a.name}: ${a.status} (${a.result ? a.result.slice(0, 50) + "..." : "无结果"})`).join("\n")}
${all.length > 10 ? `\n... 还有 ${all.length - 10} 个子代理` : ""}
`;
  }
}
