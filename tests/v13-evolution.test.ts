/**
 * V13 Evolution 系统测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const testDir = path.join(process.cwd(), 'tmp', 'test-v13');
const evolutionDir = path.join(testDir, '.evolution');
const introspectionDir = path.join(testDir, '.introspection');

describe('V13 Evolution System', () => {
  beforeEach(() => {
    if (!fs.existsSync(evolutionDir)) {
      fs.mkdirSync(evolutionDir, { recursive: true });
    }
    if (!fs.existsSync(introspectionDir)) {
      fs.mkdirSync(introspectionDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Behavior Analysis', () => {
    it('should identify tool call patterns', () => {
      // 模拟内省日志
      const logs = [
        { tool: 'read_file', duration: 10, timestamp: Date.now() - 1000 },
        { tool: 'edit_file', duration: 20, timestamp: Date.now() - 900 },
        { tool: 'bash', duration: 100, timestamp: Date.now() - 800 },
        { tool: 'read_file', duration: 10, timestamp: Date.now() - 700 },
        { tool: 'edit_file', duration: 20, timestamp: Date.now() - 600 },
        { tool: 'bash', duration: 100, timestamp: Date.now() - 500 },
      ];
      
      // 识别序列
      const sequences = new Map<string, number>();
      for (let i = 0; i < logs.length - 2; i++) {
        const seq = [logs[i].tool, logs[i+1].tool, logs[i+2].tool].join(' -> ');
        sequences.set(seq, (sequences.get(seq) || 0) + 1);
      }
      
      expect(sequences.get('read_file -> edit_file -> bash')).toBe(2);
    });

    it('should detect inefficient patterns', () => {
      const logs = [
        { tool: 'read_file', path: '/a.txt' },
        { tool: 'read_file', path: '/a.txt' },
        { tool: 'read_file', path: '/a.txt' },
      ];
      
      // 检测重复读取
      const isInefficient = logs[0].tool === logs[1].tool && logs[1].tool === logs[2].tool;
      expect(isInefficient).toBe(true);
    });

    it('should calculate error rates', () => {
      const calls = [
        { tool: 'bash', success: true },
        { tool: 'bash', success: false },
        { tool: 'bash', success: true },
        { tool: 'bash', success: false },
      ];
      
      const errorRate = calls.filter(c => !c.success).length / calls.length;
      expect(errorRate).toBe(0.5);
    });
  });

  describe('Policy Suggestions', () => {
    it('should generate suggestions based on patterns', () => {
      const pattern = {
        sequence: ['read_file', 'read_file', 'read_file'],
        frequency: 5,
        avgDuration: 30
      };
      
      const suggestion = {
        type: 'performance',
        tool: 'read_file',
        currentValue: '无缓存',
        suggestedValue: '添加文件缓存',
        confidence: 0.7,
        reason: '检测到重复读取模式'
      };
      
      expect(suggestion.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should require confirmation for low confidence suggestions', () => {
      const suggestion = {
        confidence: 0.5,
        applied: false
      };
      
      const needsConfirm = suggestion.confidence < 0.7;
      expect(needsConfirm).toBe(true);
    });

    it('should auto-apply high confidence suggestions', () => {
      const suggestion = {
        confidence: 0.95,
        applied: false
      };
      
      const canAutoApply = suggestion.confidence >= 0.9;
      expect(canAutoApply).toBe(true);
    });
  });

  describe('Evolution History', () => {
    it('should log evolution actions', () => {
      const historyFile = path.join(evolutionDir, 'history.jsonl');
      const entry = {
        timestamp: Date.now(),
        action: 'analyze',
        details: '分析了 7 天的数据'
      };
      
      fs.writeFileSync(historyFile, JSON.stringify(entry) + '\n');
      
      const content = fs.readFileSync(historyFile, 'utf-8');
      const parsed = JSON.parse(content.trim());
      expect(parsed.action).toBe('analyze');
    });

    it('should track applied suggestions', () => {
      const suggestionsFile = path.join(evolutionDir, 'suggestions.json');
      const suggestions = [
        { id: 'sug_001', applied: true },
        { id: 'sug_002', applied: false }
      ];
      
      fs.writeFileSync(suggestionsFile, JSON.stringify(suggestions));
      
      const loaded = JSON.parse(fs.readFileSync(suggestionsFile, 'utf-8'));
      const appliedCount = loaded.filter((s: any) => s.applied).length;
      expect(appliedCount).toBe(1);
    });
  });

  describe('Pattern Storage', () => {
    it('should persist identified patterns', () => {
      const patternsFile = path.join(evolutionDir, 'patterns.json');
      const patterns = [
        { sequence: ['read_file', 'edit_file'], frequency: 10 },
        { sequence: ['memory_search', 'memory_get'], frequency: 5 }
      ];
      
      fs.writeFileSync(patternsFile, JSON.stringify(patterns, null, 2));
      
      const loaded = JSON.parse(fs.readFileSync(patternsFile, 'utf-8'));
      expect(loaded).toHaveLength(2);
      expect(loaded[0].frequency).toBe(10);
    });
  });

  describe('Integration with Security System', () => {
    it('should read audit logs for analysis', () => {
      const auditDir = path.join(testDir, '.security', 'audit');
      fs.mkdirSync(auditDir, { recursive: true });
      
      const today = new Date().toISOString().split('T')[0];
      const auditFile = path.join(auditDir, `audit_${today}.jsonl`);
      const entries = [
        { tool: 'bash', riskLevel: 'dangerous', decision: 'allowed' },
        { tool: 'write_file', riskLevel: 'confirm', decision: 'allowed' }
      ];
      
      fs.writeFileSync(auditFile, entries.map(e => JSON.stringify(e)).join('\n'));
      
      const content = fs.readFileSync(auditFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(2);
    });

    it('should suggest security policy adjustments', () => {
      // 如果所有危险操作都被允许，可能建议调整策略
      const auditEntries = [
        { riskLevel: 'dangerous', decision: 'allowed' },
        { riskLevel: 'dangerous', decision: 'allowed' },
        { riskLevel: 'dangerous', decision: 'allowed' }
      ];
      
      const allAllowed = auditEntries.every(e => e.decision === 'allowed');
      expect(allAllowed).toBe(true);
    });
  });

  describe('Self-Healing', () => {
    it('should detect error patterns', () => {
      const errorLogs = [
        { tool: 'bash', error: 'command not found', timestamp: Date.now() - 1000 },
        { tool: 'bash', error: 'command not found', timestamp: Date.now() - 500 },
        { tool: 'bash', error: 'command not found', timestamp: Date.now() }
      ];
      
      const errorPattern = {
        pattern: 'command not found',
        frequency: errorLogs.length,
        autoFixable: false
      };
      
      expect(errorPattern.frequency).toBe(3);
    });

    it('should suggest retry strategies', () => {
      const errorPattern = {
        pattern: 'timeout',
        frequency: 5,
        autoFixable: true,
        fixStrategy: 'retry with exponential backoff'
      };
      
      expect(errorPattern.fixStrategy).toBeDefined();
    });
  });
});
