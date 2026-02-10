/**
 * v11-agent/utils/logger.ts - 统一日志系统
 *
 * 功能：
 * - Session 日志：记录会话级别信息
 * - 对话日志：记录每次对话详情
 * - Token 统计：定期持久化统计数据
 * - 界面日志：美化控制台输出
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";

// ============================================================================
// 颜色常量
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

// ============================================================================
// Token 统计
// ============================================================================

export interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  toolCallCount: number;
  sessionStart: string;
  lastUpdate: string;
}

export interface ConversationStats {
  channel: string;
  chatId: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls: string[];
  startTime: string;
  endTime?: string;
  userInput: string;
  responsePreview: string;
}

export class SessionLogger {
  private logDir: string;
  private sessionId: string;
  private tokenStats: TokenStats;
  private conversations: ConversationStats[] = [];
  private saveInterval: ReturnType<typeof setInterval> | null = null;
  private saveIntervalMs: number;

  constructor(workDir: string, saveIntervalMs: number = 60000) {
    this.logDir = path.join(workDir, "session_logs");
    this.sessionId = new Date().toISOString().replace(/[:.]/g, "-");
    this.saveIntervalMs = saveIntervalMs;

    // 初始化 token 统计
    this.tokenStats = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requestCount: 0,
      toolCallCount: 0,
      sessionStart: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };

    // 确保目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // 启动定期保存
    this.startAutoSave();
  }

  // --------------------------------------------------------------------------
  // Token 统计
  // --------------------------------------------------------------------------

  updateTokens(usage: { input_tokens: number; output_tokens: number }): void {
    this.tokenStats.inputTokens += usage.input_tokens;
    this.tokenStats.outputTokens += usage.output_tokens;
    this.tokenStats.totalTokens += usage.input_tokens + usage.output_tokens;
    this.tokenStats.requestCount++;
    this.tokenStats.lastUpdate = new Date().toISOString();
  }

  incrementToolCalls(count: number = 1): void {
    this.tokenStats.toolCallCount += count;
  }

  getTokenStats(): TokenStats {
    return { ...this.tokenStats };
  }

  getTokenStatsReport(): string {
    const start = new Date(this.tokenStats.sessionStart);
    const elapsed = (Date.now() - start.getTime()) / 1000;
    const tokensPerSecond = elapsed > 0 ? (this.tokenStats.totalTokens / elapsed).toFixed(1) : "0";

    return `📊 Token 统计:
  - 输入: ${this.tokenStats.inputTokens.toLocaleString()} tokens
  - 输出: ${this.tokenStats.outputTokens.toLocaleString()} tokens
  - 总计: ${this.tokenStats.totalTokens.toLocaleString()} tokens
  - 请求数: ${this.tokenStats.requestCount}
  - 工具调用: ${this.tokenStats.toolCallCount}
  - 平均速率: ${tokensPerSecond} tokens/s
  - 会话时长: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`;
  }

  // --------------------------------------------------------------------------
  // 对话日志
  // --------------------------------------------------------------------------

  startConversation(channel: string, chatId: string, userInput: string): number {
    const conv: ConversationStats = {
      channel,
      chatId,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: [],
      startTime: new Date().toISOString(),
      userInput: userInput.slice(0, 200), // 截断长输入
      responsePreview: "",
    };
    this.conversations.push(conv);
    return this.conversations.length - 1;
  }

  updateConversation(
    index: number,
    updates: Partial<Pick<ConversationStats, "inputTokens" | "outputTokens" | "responsePreview">>
  ): void {
    if (index >= 0 && index < this.conversations.length) {
      Object.assign(this.conversations[index], updates);
    }
  }

  addToolCall(index: number, toolName: string): void {
    if (index >= 0 && index < this.conversations.length) {
      this.conversations[index].toolCalls.push(toolName);
    }
  }

  endConversation(index: number, responsePreview: string): void {
    if (index >= 0 && index < this.conversations.length) {
      this.conversations[index].endTime = new Date().toISOString();
      this.conversations[index].responsePreview = responsePreview.slice(0, 200);
    }
  }

  // --------------------------------------------------------------------------
  // 界面日志
  // --------------------------------------------------------------------------

  logChannelReceive(channel: string, userId: string, preview: string): void {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    console.log(
      `${colors.dim}[${time}]${colors.reset} ` +
        `${colors.cyan}[${channel} <- ${userId.slice(0, 16)}]${colors.reset} ` +
        `${preview.slice(0, 50)}${preview.length > 50 ? "..." : ""}`
    );
  }

  logChannelSend(channel: string, chatId: string, preview: string): void {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    console.log(
      `${colors.dim}[${time}]${colors.reset} ` +
        `${colors.green}[${channel} -> ${chatId.slice(0, 16)}]${colors.reset} ` +
        `${preview.slice(0, 50)}${preview.length > 50 ? "..." : ""}`
    );
  }

  logConsoleInput(input: string): void {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    console.log(
      `${colors.dim}[${time}]${colors.reset} ` +
        `${colors.magenta}[console] >> ${colors.reset}` +
        `${input.slice(0, 60)}${input.length > 60 ? "..." : ""}`
    );
  }

  logToolCall(toolName: string): void {
    console.log(`${colors.yellow}[Tool] ${toolName}${colors.reset}`);
  }

  logDedup(messageId: string): void {
    console.log(`${colors.dim}[去重] 跳过重复消息: ${messageId.slice(0, 30)}${colors.reset}`);
  }

  logError(message: string): void {
    console.log(`${colors.red}[Error] ${message}${colors.reset}`);
  }

  logInfo(message: string): void {
    console.log(`${colors.blue}[Info] ${message}${colors.reset}`);
  }

  logRequestLog(filePath: string): void {
    console.log(`${colors.dim}[LOG] ${filePath}${colors.reset}`);
  }

  // --------------------------------------------------------------------------
  // 持久化
  // --------------------------------------------------------------------------

  private startAutoSave(): void {
    this.saveInterval = setInterval(() => {
      this.save().catch((err) => {
        console.error(`${colors.red}[Logger] 自动保存失败: ${err.message}${colors.reset}`);
      });
    }, this.saveIntervalMs);
  }

  async save(): Promise<void> {
    const sessionFile = path.join(this.logDir, `session-${this.sessionId}.json`);
    const data = {
      sessionId: this.sessionId,
      tokenStats: this.tokenStats,
      conversationCount: this.conversations.length,
      conversations: this.conversations.slice(-50), // 只保留最近 50 条
    };
    await fsp.writeFile(sessionFile, JSON.stringify(data, null, 2));
  }

  async saveTokenStatsSnapshot(): Promise<void> {
    const statsDir = path.join(this.logDir, "token_stats");
    if (!fs.existsSync(statsDir)) {
      await fsp.mkdir(statsDir, { recursive: true });
    }

    const date = new Date().toISOString().split("T")[0];
    const statsFile = path.join(statsDir, `stats-${date}.jsonl`);

    const snapshot = {
      timestamp: new Date().toISOString(),
      ...this.tokenStats,
    };

    await fsp.appendFile(statsFile, JSON.stringify(snapshot) + "\n");
  }

  async dispose(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    await this.save();
    await this.saveTokenStatsSnapshot();
  }
}

// ============================================================================
// 导出单例工厂
// ============================================================================

let instance: SessionLogger | null = null;

export function createSessionLogger(workDir: string, saveIntervalMs?: number): SessionLogger {
  if (!instance) {
    instance = new SessionLogger(workDir, saveIntervalMs);
  }
  return instance;
}

export function getSessionLogger(): SessionLogger | null {
  return instance;
}
