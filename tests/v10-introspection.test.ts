/**
 * V10 内省系统测试
 * 测试 IntrospectionSystem 类的核心功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(process.cwd(), '.test-workspace-v10');

interface BehaviorLog {
  timestamp: number;
  tool: string;
  args: Record<string, any>;
  result: string;
  duration: number;
  context?: string;
}

interface IntrospectionStats {
  totalCalls: number;
  toolUsage: Record<string, number>;
  avgDuration: number;
  patterns: string[];
  lastReflection: number;
}

// 从 v10-agent.ts 提取的 IntrospectionSystem 类
class IntrospectionSystem {
  private workspaceDir: string;
  private logsDir: string;
  private statsFile: string;
  private currentSessionLogs: BehaviorLog[] = [];
  private stats: IntrospectionStats;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.logsDir = path.join(workspaceDir, ".introspection");
    this.statsFile = path.join(this.logsDir, "stats.json");
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    this.stats = this.loadStats();
  }

  private loadStats(): IntrospectionStats {
    if (fs.existsSync(this.statsFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.statsFile, "utf-8"));
      } catch (e) { /* 文件损坏 */ }
    }
    return { totalCalls: 0, toolUsage: {}, avgDuration: 0, patterns: [], lastReflection: 0 };
  }

  private saveStats() {
    fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
  }

  logToolCall(tool: string, args: Record<string, any>, result: string, duration: number, context?: string) {
    const log: BehaviorLog = { timestamp: Date.now(), tool, args, result: result.slice(0, 500), duration, context };
    this.currentSessionLogs.push(log);
    
    this.stats.totalCalls++;
    this.stats.toolUsage[tool] = (this.stats.toolUsage[tool] || 0) + 1;
    this.stats.avgDuration = (this.stats.avgDuration * (this.stats.totalCalls - 1) + duration) / this.stats.totalCalls;
    this.saveStats();

    if (this.currentSessionLogs.length >= 50) {
      this.persistLogs();
    }
  }

  persistLogs() {
    if (this.currentSessionLogs.length === 0) return;
    const filename = `behavior_${new Date().toISOString().split('T')[0]}.jsonl`;
    const filepath = path.join(this.logsDir, filename);
    const lines = this.currentSessionLogs.map(l => JSON.stringify(l)).join('\n') + '\n';
    fs.appendFileSync(filepath, lines);
    this.currentSessionLogs = [];
  }

  getStats(): string {
    const topTools = Object.entries(this.stats.toolUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool, count]) => `  - ${tool}: ${count} 次`)
      .join('\n');

    return `## 行为统计

总调用次数: ${this.stats.totalCalls}
平均响应时间: ${Math.round(this.stats.avgDuration)}ms

### 最常用工具
${topTools || '  (暂无数据)'}

### 识别的模式
${this.stats.patterns.length > 0 ? this.stats.patterns.map(p => `  - ${p}`).join('\n') : '  (暂无模式)'}

上次反思: ${this.stats.lastReflection ? new Date(this.stats.lastReflection).toLocaleString('zh-CN') : '从未'}`;
  }

  analyzePatterns(): string {
    const patterns: string[] = [];
    const usage = this.stats.toolUsage;

    const totalCalls = this.stats.totalCalls;
    for (const [tool, count] of Object.entries(usage)) {
      const ratio = count / totalCalls;
      if (ratio > 0.3) {
        patterns.push(`高频使用 ${tool} (${Math.round(ratio * 100)}%)`);
      }
    }

    const toolSequences: Record<string, number> = {};
    for (let i = 1; i < this.currentSessionLogs.length; i++) {
      const seq = `${this.currentSessionLogs[i-1].tool} -> ${this.currentSessionLogs[i].tool}`;
      toolSequences[seq] = (toolSequences[seq] || 0) + 1;
    }
    const commonSeqs = Object.entries(toolSequences)
      .filter(([_, count]) => count >= 3)
      .map(([seq, count]) => `${seq} (${count}次)`);
    if (commonSeqs.length > 0) {
      patterns.push(`常见工具链: ${commonSeqs.join(', ')}`);
    }

    const hours = this.currentSessionLogs.map(l => new Date(l.timestamp).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => hourCounts[h] = (hourCounts[h] || 0) + 1);
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakHour) {
      patterns.push(`活跃高峰: ${peakHour[0]}:00`);
    }

    this.stats.patterns = patterns;
    this.saveStats();

    return patterns.length > 0 
      ? `识别到的行为模式:\n${patterns.map(p => `- ${p}`).join('\n')}`
      : '暂未识别到明显的行为模式（需要更多数据）';
  }

  generateReflection(): string {
    this.persistLogs();
    this.stats.lastReflection = Date.now();
    this.saveStats();

    const patterns = this.analyzePatterns();
    const stats = this.getStats();

    const files = fs.readdirSync(this.logsDir)
      .filter(f => f.startsWith('behavior_'))
      .sort()
      .reverse()
      .slice(0, 3);

    let recentBehaviors = '';
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.logsDir, file), 'utf-8');
      const logs = content.trim().split('\n').slice(-10).map(l => {
        try {
          const log = JSON.parse(l);
          return `  [${new Date(log.timestamp).toLocaleTimeString('zh-CN')}] ${log.tool}: ${log.result.slice(0, 50)}...`;
        } catch { return ''; }
      }).filter(Boolean);
      if (logs.length > 0) {
        recentBehaviors += `\n### ${file.replace('behavior_', '').replace('.jsonl', '')}\n${logs.join('\n')}`;
      }
    }

    return `# 自我反思报告
生成时间: ${new Date().toLocaleString('zh-CN')}

${stats}

## 行为模式分析
${patterns}

## 最近行为摘要
${recentBehaviors || '(暂无记录)'}

## 改进建议
基于以上分析，以下是可能的改进方向：
1. 检查高频工具是否有更高效的替代方案
2. 分析工具链是否可以简化
3. 考虑是否需要新的工具来填补能力空白

---
*这是一份自动生成的内省报告。定期反思有助于持续改进。*`;
  }

  getCurrentLogs(): BehaviorLog[] {
    return this.currentSessionLogs;
  }

  getRawStats(): IntrospectionStats {
    return this.stats;
  }
}

describe('V10 IntrospectionSystem - 内省系统', () => {
  let introspection: IntrospectionSystem;

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    introspection = new IntrospectionSystem(TEST_DIR);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('行为日志记录', () => {
    it('应该能记录工具调用', () => {
      introspection.logToolCall('bash', { command: 'ls' }, '文件列表', 100);
      const logs = introspection.getCurrentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].tool).toBe('bash');
    });

    it('应该更新统计数据', () => {
      introspection.logToolCall('read_file', { path: 'test.md' }, '内容', 50);
      introspection.logToolCall('read_file', { path: 'test2.md' }, '内容2', 60);
      
      const stats = introspection.getRawStats();
      expect(stats.totalCalls).toBe(2);
      expect(stats.toolUsage['read_file']).toBe(2);
    });

    it('应该计算平均响应时间', () => {
      introspection.logToolCall('tool1', {}, 'result', 100);
      introspection.logToolCall('tool2', {}, 'result', 200);
      
      const stats = introspection.getRawStats();
      expect(stats.avgDuration).toBe(150);
    });

    it('结果应截断到 500 字符', () => {
      const longResult = 'x'.repeat(1000);
      introspection.logToolCall('test', {}, longResult, 10);
      
      const logs = introspection.getCurrentLogs();
      expect(logs[0].result.length).toBe(500);
    });
  });

  describe('日志持久化', () => {
    it('应该能持久化日志到文件', () => {
      introspection.logToolCall('test', {}, 'result', 10);
      introspection.persistLogs();
      
      const files = fs.readdirSync(path.join(TEST_DIR, '.introspection'))
        .filter(f => f.startsWith('behavior_'));
      expect(files.length).toBeGreaterThan(0);
    });

    it('持久化后应清空当前会话日志', () => {
      introspection.logToolCall('test', {}, 'result', 10);
      introspection.persistLogs();
      
      expect(introspection.getCurrentLogs()).toHaveLength(0);
    });

    it('空日志不应创建文件', () => {
      const beforeFiles = fs.readdirSync(path.join(TEST_DIR, '.introspection'));
      introspection.persistLogs();
      const afterFiles = fs.readdirSync(path.join(TEST_DIR, '.introspection'));
      
      expect(afterFiles.length).toBe(beforeFiles.length);
    });
  });

  describe('统计报告', () => {
    it('应该生成格式化的统计报告', () => {
      introspection.logToolCall('bash', {}, 'ok', 100);
      introspection.logToolCall('read_file', {}, 'content', 50);
      
      const stats = introspection.getStats();
      expect(stats).toContain('## 行为统计');
      expect(stats).toContain('总调用次数: 2');
      expect(stats).toContain('bash');
    });

    it('空数据应显示暂无数据', () => {
      const stats = introspection.getStats();
      expect(stats).toContain('(暂无数据)');
    });
  });

  describe('模式分析', () => {
    it('应该识别高频工具', () => {
      // 让一个工具占比超过 30%
      for (let i = 0; i < 10; i++) {
        introspection.logToolCall('bash', {}, 'ok', 10);
      }
      introspection.logToolCall('other', {}, 'ok', 10);
      
      const patterns = introspection.analyzePatterns();
      expect(patterns).toContain('高频使用 bash');
    });

    it('应该识别工具链模式', () => {
      // 创建重复的工具调用序列
      for (let i = 0; i < 5; i++) {
        introspection.logToolCall('read_file', {}, 'ok', 10);
        introspection.logToolCall('write_file', {}, 'ok', 10);
      }
      
      const patterns = introspection.analyzePatterns();
      expect(patterns).toContain('read_file -> write_file');
    });

    it('数据不足时应返回提示', () => {
      const patterns = introspection.analyzePatterns();
      expect(patterns).toContain('暂未识别到明显的行为模式');
    });
  });

  describe('自我反思报告', () => {
    it('应该生成完整的反思报告', () => {
      introspection.logToolCall('bash', {}, 'ok', 100);
      introspection.logToolCall('read_file', {}, 'content', 50);
      
      const report = introspection.generateReflection();
      expect(report).toContain('# 自我反思报告');
      expect(report).toContain('## 行为统计');
      expect(report).toContain('## 行为模式分析');
      expect(report).toContain('## 改进建议');
    });

    it('生成报告后应更新 lastReflection', () => {
      const before = introspection.getRawStats().lastReflection;
      introspection.generateReflection();
      const after = introspection.getRawStats().lastReflection;
      
      expect(after).toBeGreaterThan(before);
    });

    it('生成报告应触发日志持久化', () => {
      introspection.logToolCall('test', {}, 'ok', 10);
      expect(introspection.getCurrentLogs()).toHaveLength(1);
      
      introspection.generateReflection();
      expect(introspection.getCurrentLogs()).toHaveLength(0);
    });
  });

  describe('统计持久化', () => {
    it('统计应该持久化到文件', () => {
      introspection.logToolCall('test', {}, 'ok', 100);
      
      // 创建新实例验证持久化
      const newIntrospection = new IntrospectionSystem(TEST_DIR);
      const stats = newIntrospection.getRawStats();
      expect(stats.totalCalls).toBe(1);
      expect(stats.toolUsage['test']).toBe(1);
    });
  });
});
