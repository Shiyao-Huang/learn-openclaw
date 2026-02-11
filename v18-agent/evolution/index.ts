/**
 * evolution/index.ts - V13 自进化系统
 * 
 * 核心功能:
 * - 行为模式分析: 从内省日志识别工具调用模式
 * - 策略自动调整: 根据使用情况优化安全策略
 * - 建议生成: 基于分析结果提出优化建议
 * - 自动应用: 可选择自动应用建议
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export interface ToolCallPattern {
  sequence: string[];
  frequency: number;
  avgDuration: number;
  successRate: number;
  context?: string;
}

export interface BehaviorStats {
  totalCalls: number;
  uniqueTools: number;
  avgCallsPerSession: number;
  topPatterns: ToolCallPattern[];
  inefficientPatterns: ToolCallPattern[];
  errorPatterns: ToolCallPattern[];
}

export interface PolicySuggestion {
  id: string;
  type: 'security' | 'performance' | 'workflow';
  tool: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  evidence: string[];
  createdAt: number;
  applied: boolean;
}

export interface EvolutionHistory {
  timestamp: number;
  action: 'analyze' | 'suggest' | 'apply' | 'rollback';
  details: string;
  suggestionId?: string;
}

// ============================================================================
// 自进化系统类
// ============================================================================

export class EvolutionSystem {
  private workspaceDir: string;
  private evolutionDir: string;
  private patternsFile: string;
  private suggestionsFile: string;
  private historyFile: string;
  private patterns: ToolCallPattern[] = [];
  private suggestions: PolicySuggestion[] = [];

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.evolutionDir = path.join(workspaceDir, '.evolution');
    this.patternsFile = path.join(this.evolutionDir, 'patterns.json');
    this.suggestionsFile = path.join(this.evolutionDir, 'suggestions.json');
    this.historyFile = path.join(this.evolutionDir, 'history.jsonl');
    
    if (!fs.existsSync(this.evolutionDir)) {
      fs.mkdirSync(this.evolutionDir, { recursive: true });
    }
    
    this.loadState();
  }

  private loadState() {
    if (fs.existsSync(this.patternsFile)) {
      try {
        this.patterns = JSON.parse(fs.readFileSync(this.patternsFile, 'utf-8'));
      } catch (e) { /* ignore */ }
    }
    if (fs.existsSync(this.suggestionsFile)) {
      try {
        this.suggestions = JSON.parse(fs.readFileSync(this.suggestionsFile, 'utf-8'));
      } catch (e) { /* ignore */ }
    }
  }

  private saveState() {
    fs.writeFileSync(this.patternsFile, JSON.stringify(this.patterns, null, 2));
    fs.writeFileSync(this.suggestionsFile, JSON.stringify(this.suggestions, null, 2));
  }

  private logHistory(entry: Omit<EvolutionHistory, 'timestamp'>) {
    const fullEntry = { ...entry, timestamp: Date.now() };
    fs.appendFileSync(this.historyFile, JSON.stringify(fullEntry) + '\n');
  }

  // 分析行为模式
  analyze(days: number = 7): BehaviorStats {
    const introspectionDir = path.join(this.workspaceDir, '.introspection');
    if (!fs.existsSync(introspectionDir)) {
      return {
        totalCalls: 0,
        uniqueTools: 0,
        avgCallsPerSession: 0,
        topPatterns: [],
        inefficientPatterns: [],
        errorPatterns: []
      };
    }

    // 读取内省日志
    const toolCalls: Array<{ tool: string; duration: number; success: boolean; timestamp: number }> = [];
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    
    const files = fs.readdirSync(introspectionDir).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(introspectionDir, file), 'utf-8');
      for (const line of content.split('\n').filter(l => l.trim())) {
        try {
          const entry = JSON.parse(line);
          if (entry.timestamp >= cutoff && entry.tool) {
            toolCalls.push({
              tool: entry.tool,
              duration: entry.duration || 0,
              success: !entry.output?.includes('错误') && !entry.output?.includes('Error'),
              timestamp: entry.timestamp
            });
          }
        } catch (e) { /* ignore */ }
      }
    }

    // 统计工具使用
    const toolStats = new Map<string, { count: number; totalDuration: number; errors: number }>();
    for (const call of toolCalls) {
      const stat = toolStats.get(call.tool) || { count: 0, totalDuration: 0, errors: 0 };
      stat.count++;
      stat.totalDuration += call.duration;
      if (!call.success) stat.errors++;
      toolStats.set(call.tool, stat);
    }

    // 识别序列模式 (连续3个工具)
    const sequences = new Map<string, number>();
    for (let i = 0; i < toolCalls.length - 2; i++) {
      const seq = [toolCalls[i].tool, toolCalls[i+1].tool, toolCalls[i+2].tool].join(' -> ');
      sequences.set(seq, (sequences.get(seq) || 0) + 1);
    }

    // 找出高频模式
    const topPatterns = Array.from(sequences.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([seq, freq]) => ({
        sequence: seq.split(' -> '),
        frequency: freq,
        avgDuration: 0,
        successRate: 1
      }));

    this.patterns = topPatterns;
    this.saveState();

    const stats: BehaviorStats = {
      totalCalls: toolCalls.length,
      uniqueTools: toolStats.size,
      avgCallsPerSession: toolCalls.length / Math.max(1, days),
      topPatterns,
      inefficientPatterns: [],
      errorPatterns: []
    };

    // 识别低效模式 (重复调用同一工具)
    for (let i = 0; i < toolCalls.length - 2; i++) {
      if (toolCalls[i].tool === toolCalls[i+1].tool && toolCalls[i+1].tool === toolCalls[i+2].tool) {
        stats.inefficientPatterns.push({
          sequence: [toolCalls[i].tool, toolCalls[i].tool, toolCalls[i].tool],
          frequency: 1,
          avgDuration: 0,
          successRate: 1,
          context: '连续重复调用'
        });
      }
    }

    // 识别错误模式
    for (const [tool, stat] of toolStats) {
      if (stat.errors > 0 && stat.errors / stat.count > 0.3) {
        stats.errorPatterns.push({
          sequence: [tool],
          frequency: stat.errors,
          avgDuration: stat.totalDuration / stat.count,
          successRate: 1 - stat.errors / stat.count,
          context: `错误率 ${((stat.errors / stat.count) * 100).toFixed(1)}%`
        });
      }
    }

    this.logHistory({ action: 'analyze', details: `分析了 ${days} 天的数据，${toolCalls.length} 次调用` });

    return stats;
  }

  // 生成分析报告
  generateReport(days: number = 7): string {
    const stats = this.analyze(days);
    
    if (stats.totalCalls === 0) {
      return '无内省数据可分析';
    }

    return `## 行为分析报告 (最近 ${days} 天)

**总体统计**
- 工具调用: ${stats.totalCalls} 次
- 使用工具: ${stats.uniqueTools} 种
- 日均调用: ${stats.avgCallsPerSession.toFixed(1)} 次

**高频模式** (出现 ≥2 次)
${stats.topPatterns.length > 0 
  ? stats.topPatterns.map(p => `- ${p.sequence.join(' → ')} (${p.frequency}次)`).join('\n')
  : '- 无明显模式'}

**低效模式**
${stats.inefficientPatterns.length > 0
  ? stats.inefficientPatterns.map(p => `- ${p.sequence[0]} 连续调用 3+ 次`).join('\n')
  : '- 无低效模式'}

**错误模式**
${stats.errorPatterns.length > 0
  ? stats.errorPatterns.map(p => `- ${p.sequence[0]}: ${p.context}`).join('\n')
  : '- 无高错误率工具'}`;
  }

  // 生成优化建议
  suggest(focus?: 'security' | 'performance' | 'all'): PolicySuggestion[] {
    const newSuggestions: PolicySuggestion[] = [];
    const focusArea = focus || 'all';

    // 基于模式生成建议
    if (focusArea === 'all' || focusArea === 'performance') {
      // 检查是否有重复读取模式
      for (const pattern of this.patterns) {
        if (pattern.sequence[0] === pattern.sequence[1] && pattern.sequence[0] === 'read_file') {
          newSuggestions.push({
            id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'performance',
            tool: 'read_file',
            currentValue: '无缓存',
            suggestedValue: '启用文件缓存',
            reason: '检测到重复读取同一文件的模式',
            evidence: [`模式: ${pattern.sequence.join(' → ')}`, `频率: ${pattern.frequency} 次`],
            createdAt: Date.now(),
            applied: false
          });
        }
      }
    }

    if (focusArea === 'all' || focusArea === 'security') {
      // 检查高频危险工具
      const dangerousTools = ['bash', 'write_file', 'edit_file'];
      for (const pattern of this.patterns) {
        const dangerousCount = pattern.sequence.filter(t => dangerousTools.includes(t)).length;
        if (dangerousCount >= 2) {
          newSuggestions.push({
            id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'security',
            tool: pattern.sequence.find(t => dangerousTools.includes(t)) || 'bash',
            currentValue: 'dangerous',
            suggestedValue: 'confirm',
            reason: '高频使用危险工具组合',
            evidence: [`模式: ${pattern.sequence.join(' → ')}`, `频率: ${pattern.frequency} 次`],
            createdAt: Date.now(),
            applied: false
          });
        }
      }
    }

    // 保存建议
    this.suggestions = [...this.suggestions.filter(s => !s.applied), ...newSuggestions];
    this.saveState();
    this.logHistory({ action: 'suggest', details: `生成了 ${newSuggestions.length} 条建议` });

    return newSuggestions;
  }

  // 获取所有建议
  getSuggestions(includeApplied: boolean = false): PolicySuggestion[] {
    return includeApplied ? this.suggestions : this.suggestions.filter(s => !s.applied);
  }

  // 应用建议
  applySuggestion(suggestionId: string): { success: boolean; message: string } {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      return { success: false, message: '建议不存在' };
    }
    if (suggestion.applied) {
      return { success: false, message: '建议已应用' };
    }

    // 标记为已应用
    suggestion.applied = true;
    this.saveState();
    this.logHistory({ action: 'apply', details: `应用建议: ${suggestion.reason}`, suggestionId });

    return { 
      success: true, 
      message: `已应用建议: ${suggestion.tool} ${suggestion.currentValue} → ${suggestion.suggestedValue}` 
    };
  }

  // 回滚建议
  rollbackSuggestion(suggestionId: string): { success: boolean; message: string } {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      return { success: false, message: '建议不存在' };
    }
    if (!suggestion.applied) {
      return { success: false, message: '建议未应用' };
    }

    suggestion.applied = false;
    this.saveState();
    this.logHistory({ action: 'rollback', details: `回滚建议: ${suggestion.reason}`, suggestionId });

    return { success: true, message: `已回滚建议` };
  }

  // 获取进化历史
  getHistory(limit: number = 50): EvolutionHistory[] {
    if (!fs.existsSync(this.historyFile)) {
      return [];
    }
    
    const content = fs.readFileSync(this.historyFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    return lines
      .slice(-limit)
      .map(line => {
        try {
          return JSON.parse(line) as EvolutionHistory;
        } catch {
          return null;
        }
      })
      .filter((h): h is EvolutionHistory => h !== null)
      .reverse();
  }

  // 获取模式
  getPatterns(): ToolCallPattern[] {
    return [...this.patterns];
  }
}

// ============================================================================
// 进化工具定义
// ============================================================================

export function getEvolutionTools() {
  return [
    {
      name: "evolution_analyze",
      description: "分析行为模式，识别工具调用规律",
      input_schema: {
        type: "object" as const,
        properties: {
          days: { type: "number", description: "分析最近几天，默认7" },
        },
      },
    },
    {
      name: "evolution_suggest",
      description: "基于分析结果生成优化建议",
      input_schema: {
        type: "object" as const,
        properties: {
          focus: { 
            type: "string", 
            enum: ["security", "performance", "all"],
            description: "关注领域" 
          },
        },
      },
    },
    {
      name: "evolution_apply",
      description: "应用优化建议",
      input_schema: {
        type: "object" as const,
        properties: {
          suggestionId: { type: "string", description: "建议ID" },
        },
        required: ["suggestionId"],
      },
    },
    {
      name: "evolution_history",
      description: "查看进化历史",
      input_schema: {
        type: "object" as const,
        properties: {
          limit: { type: "number", description: "最大条数，默认50" },
        },
      },
    },
    {
      name: "evolution_patterns",
      description: "查看识别的行为模式",
      input_schema: {
        type: "object" as const,
        properties: {},
      },
    },
  ];
}

// ============================================================================
// 工具处理器
// ============================================================================

export function createEvolutionHandlers(evolution: EvolutionSystem) {
  return {
    evolution_analyze: (args: { days?: number }) => {
      return evolution.generateReport(args.days || 7);
    },
    
    evolution_suggest: (args: { focus?: 'security' | 'performance' | 'all' }) => {
      const suggestions = evolution.suggest(args.focus);
      if (suggestions.length === 0) {
        return '暂无新建议';
      }
      return suggestions.map(s => 
        `[${s.id}] ${s.type}: ${s.tool}\n  原因: ${s.reason}\n  建议: ${s.currentValue} → ${s.suggestedValue}`
      ).join('\n\n');
    },
    
    evolution_apply: (args: { suggestionId: string }) => {
      const result = evolution.applySuggestion(args.suggestionId);
      return result.message;
    },
    
    evolution_history: (args: { limit?: number }) => {
      const history = evolution.getHistory(args.limit || 50);
      if (history.length === 0) {
        return '无进化历史';
      }
      return history.map(h => 
        `[${new Date(h.timestamp).toLocaleString()}] ${h.action}: ${h.details}`
      ).join('\n');
    },
    
    evolution_patterns: () => {
      const patterns = evolution.getPatterns();
      if (patterns.length === 0) {
        return '暂无识别的模式';
      }
      return patterns.map(p => 
        `${p.sequence.join(' → ')} (${p.frequency}次)`
      ).join('\n');
    },
  };
}
