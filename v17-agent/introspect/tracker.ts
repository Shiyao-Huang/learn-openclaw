/**
 * v11-agent/introspect/tracker.ts - 内省追踪器
 *
 * 记录和分析 Agent 的行为模式
 * 支持跨会话持久化统计
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { ToolCall, IntrospectionStats } from "../core/types.js";

interface PersistentStats {
  totalCalls: number;
  toolUsage: Record<string, number>;
  avgDuration: number;
  patterns: string[];
  lastReflection: number;
}

export class IntrospectionTracker {
  private logDir: string;
  private statsFile: string;
  private currentSession: ToolCall[] = [];
  private sessionId: string;
  private persistentStats: PersistentStats;

  constructor(workDir: string) {
    this.logDir = path.join(workDir, ".introspection");
    this.statsFile = path.join(this.logDir, "stats.json");
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    this.sessionId = Date.now().toString(36);
    this.persistentStats = this.loadPersistentStats();
  }

  // 加载持久化统计
  private loadPersistentStats(): PersistentStats {
    if (fs.existsSync(this.statsFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.statsFile, "utf-8"));
      } catch (e) { /* 文件损坏 */ }
    }
    return { totalCalls: 0, toolUsage: {}, avgDuration: 0, patterns: [], lastReflection: 0 };
  }

  // 保存持久化统计
  private async savePersistentStats(): Promise<void> {
    await fsp.writeFile(this.statsFile, JSON.stringify(this.persistentStats, null, 2));
  }

  // 持久化当前会话日志
  private async persistLogs(): Promise<void> {
    if (this.currentSession.length === 0) return;
    const filename = `behavior_${new Date().toISOString().split('T')[0]}.jsonl`;
    const filepath = path.join(this.logDir, filename);
    const lines = this.currentSession.map(l => JSON.stringify(l)).join('\n') + '\n';
    await fsp.appendFile(filepath, lines);
  }

  // 记录工具调用
  record(tool: string, args: Record<string, any>, result?: string, duration?: number): void {
    const call: ToolCall = {
      tool,
      args,
      result: result?.slice(0, 500), // 限制结果长度
      duration,
      timestamp: Date.now(),
    };
    this.currentSession.push(call);

    // 更新持久化统计
    this.persistentStats.totalCalls++;
    this.persistentStats.toolUsage[tool] = (this.persistentStats.toolUsage[tool] || 0) + 1;
    if (duration) {
      const prevTotal = this.persistentStats.avgDuration * (this.persistentStats.totalCalls - 1);
      this.persistentStats.avgDuration = (prevTotal + duration) / this.persistentStats.totalCalls;
    }
    this.savePersistentStats().catch(e => console.error(`保存统计失败: ${e.message}`));

    // 每 50 次调用保存一次日志
    if (this.currentSession.length >= 50) {
      this.persistLogs().catch(e => console.error(`保存日志失败: ${e.message}`));
      this.currentSession = [];
    }
  }

  // 获取当前会话的调用日志
  getLogs(): ToolCall[] {
    return this.currentSession;
  }

  // 获取统计信息（合并持久化和会话内）
  getStats(): IntrospectionStats {
    return {
      totalCalls: this.persistentStats.totalCalls,
      toolUsage: { ...this.persistentStats.toolUsage },
      avgDuration: this.persistentStats.avgDuration,
      patterns: this.detectPatterns(),
    };
  }

  // 检测行为模式
  private detectPatterns(): string[] {
    const patterns: string[] = [];
    const calls = this.currentSession;

    // 模式1: 工具偏好（从持久化统计）
    const totalCalls = this.persistentStats.totalCalls;
    for (const [tool, count] of Object.entries(this.persistentStats.toolUsage)) {
      const ratio = count / totalCalls;
      if (ratio > 0.3) {
        patterns.push(`高频使用 ${tool} (${Math.round(ratio * 100)}%)`);
      }
    }

    if (calls.length < 3) return patterns;

    // 模式2: 检测重复工具链（从当前会话）
    const chains: string[] = [];
    for (let i = 0; i < calls.length - 1; i++) {
      chains.push(`${calls[i].tool}->${calls[i + 1].tool}`);
    }

    const chainCounts: Record<string, number> = {};
    for (const chain of chains) {
      chainCounts[chain] = (chainCounts[chain] || 0) + 1;
    }

    for (const [chain, count] of Object.entries(chainCounts)) {
      if (count >= 2) {
        patterns.push(`重复链: ${chain} (${count}次)`);
      }
    }

    // 模式3: 时间分布
    const hours = calls.map(l => new Date(l.timestamp).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => hourCounts[h] = (hourCounts[h] || 0) + 1);
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakHour && parseInt(peakHour[0]) >= 0) {
      patterns.push(`活跃高峰: ${peakHour[0]}:00`);
    }

    // 更新持久化模式
    this.persistentStats.patterns = patterns;
    this.savePersistentStats().catch(e => console.error(`保存统计失败: ${e.message}`));

    return patterns;
  }

  // 生成反思报告
  async reflect(): Promise<string> {
    await this.persistLogs(); // 先保存当前日志
    this.persistentStats.lastReflection = Date.now();
    await this.savePersistentStats();

    const stats = this.getStats();
    const lines: string[] = [
      "# 自我反思报告",
      `生成时间: ${new Date().toLocaleString('zh-CN')}`,
      "",
      `## 会话统计`,
      `- 总调用次数: ${stats.totalCalls}`,
      `- 平均耗时: ${stats.avgDuration.toFixed(0)}ms`,
      `- 上次反思: ${this.persistentStats.lastReflection ? new Date(this.persistentStats.lastReflection).toLocaleString('zh-CN') : '从未'}`,
      "",
      "## 工具使用分布",
    ];

    const sorted = Object.entries(stats.toolUsage)
      .sort((a, b) => b[1] - a[1]);

    for (const [tool, count] of sorted.slice(0, 10)) {
      const bar = "█".repeat(Math.min(Math.ceil(count / Math.max(...sorted.map(s => s[1])) * 20), 20));
      lines.push(`- ${tool}: ${bar} (${count})`);
    }

    if (stats.patterns.length > 0) {
      lines.push("", "## 检测到的模式");
      for (const pattern of stats.patterns) {
        lines.push(`- ${pattern}`);
      }
    }

    // 改进建议
    lines.push("", "## 改进建议");

    if (stats.toolUsage["bash"] > 10) {
      lines.push("- 考虑使用更专用的工具替代频繁的 bash 调用");
    }
    if (stats.toolUsage["read_file"] > 5 && (stats.toolUsage["grep"] || 0) < 2) {
      lines.push("- 可以用 grep 替代多次 read_file 来搜索内容");
    }
    if (stats.avgDuration > 5000) {
      lines.push("- 响应时间较长，考虑优化工具调用链");
    }

    // 读取最近的行为日志
    const files = (await fsp.readdir(this.logDir))
      .filter(f => f.startsWith('behavior_'))
      .sort()
      .reverse()
      .slice(0, 3);

    if (files.length > 0) {
      lines.push("", "## 最近行为摘要");
      for (const file of files) {
        try {
          const content = await fsp.readFile(path.join(this.logDir, file), 'utf-8');
          const logs = content.trim().split('\n').slice(-5).map(l => {
            try {
              const log = JSON.parse(l);
              return `  [${new Date(log.timestamp).toLocaleTimeString('zh-CN')}] ${log.tool}: ${(log.result || '').slice(0, 50)}...`;
            } catch { return ''; }
          }).filter(Boolean);
          if (logs.length > 0) {
            lines.push(`\n### ${file.replace('behavior_', '').replace('.jsonl', '')}`);
            lines.push(...logs);
          }
        } catch { /* 忽略读取错误 */ }
      }
    }

    lines.push("", "---", "*这是一份自动生成的内省报告。定期反思有助于持续改进。*");

    return lines.join("\n");
  }

  // 保存会话日志
  async save(): Promise<void> {
    await this.persistLogs();
    const filename = `${new Date().toISOString().split("T")[0]}-${this.sessionId}.json`;
    const filePath = path.join(this.logDir, filename);
    await fsp.writeFile(filePath, JSON.stringify({
      sessionId: this.sessionId,
      calls: this.currentSession,
      stats: this.getStats(),
    }, null, 2));
  }

  // 清空当前会话
  async clear(): Promise<void> {
    await this.persistLogs(); // 保存前先持久化
    this.currentSession = [];
    this.sessionId = Date.now().toString(36);
  }

  // 格式化统计输出
  formatStats(): string {
    const stats = this.getStats();
    const topTools = Object.entries(stats.toolUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool, count]) => `  - ${tool}: ${count} 次`)
      .join('\n');

    return `## 行为统计

总调用次数: ${stats.totalCalls}
平均响应时间: ${Math.round(stats.avgDuration)}ms

### 最常用工具
${topTools || '  (暂无数据)'}

### 识别的模式
${stats.patterns.length > 0 ? stats.patterns.map(p => `  - ${p}`).join('\n') : '  (暂无模式)'}

上次反思: ${this.persistentStats.lastReflection ? new Date(this.persistentStats.lastReflection).toLocaleString('zh-CN') : '从未'}`;
  }

  // 格式化模式输出
  formatPatterns(): string {
    const patterns = this.detectPatterns();
    if (patterns.length === 0) {
      return "未检测到明显模式（需要更多数据）";
    }
    return `识别到的行为模式:\n${patterns.map(p => `- ${p}`).join('\n')}`;
  }
}

export default IntrospectionTracker;
