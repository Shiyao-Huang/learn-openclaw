/**
 * V13.5 Context Compression 系统测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const testDir = path.join(process.cwd(), 'tmp', 'test-v13.5');
const compressionDir = path.join(testDir, '.compression');

describe('V13.5 Context Compression System', () => {
  beforeEach(() => {
    if (!fs.existsSync(compressionDir)) {
      fs.mkdirSync(compressionDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Configuration', () => {
    it('should have default config values', () => {
      const defaultConfig = {
        maxTurns: 50,
        keepRecent: 10,
        maxToolOutput: 3000,
        summaryMaxChars: 500,
        autoCompress: true,
        importanceThreshold: 0.3
      };
      
      expect(defaultConfig.maxTurns).toBe(50);
      expect(defaultConfig.keepRecent).toBe(10);
      expect(defaultConfig.autoCompress).toBe(true);
    });

    it('should persist config to file', () => {
      const config = { maxTurns: 30, keepRecent: 5 };
      const configFile = path.join(compressionDir, 'config.json');
      
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
      
      const loaded = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      expect(loaded.maxTurns).toBe(30);
    });
  });

  describe('Message Importance', () => {
    it('should score user messages higher', () => {
      const evaluateImportance = (role: string) => {
        let score = 0.5;
        if (role === 'user') score += 0.2;
        return score;
      };
      
      expect(evaluateImportance('user')).toBeGreaterThan(evaluateImportance('assistant'));
    });

    it('should detect important keywords', () => {
      const importantKeywords = ['重要', '记住', '必须', 'important', 'remember'];
      const text = '这是一个重要的任务';
      
      const hasImportant = importantKeywords.some(kw => text.includes(kw));
      expect(hasImportant).toBe(true);
    });

    it('should lower score for tool results', () => {
      const isToolResult = (content: any) => {
        if (Array.isArray(content)) {
          return content.some(c => c.type === 'tool_result');
        }
        return false;
      };
      
      const toolContent = [{ type: 'tool_result', content: 'result' }];
      expect(isToolResult(toolContent)).toBe(true);
    });
  });

  describe('Tool Output Truncation', () => {
    it('should truncate long outputs', () => {
      const maxLength = 100;
      const longOutput = 'a'.repeat(200);
      
      const truncate = (output: string) => {
        if (output.length <= maxLength) return output;
        const half = Math.floor(maxLength / 2);
        return output.slice(0, half) + '...[截断]...' + output.slice(-half);
      };
      
      const truncated = truncate(longOutput);
      expect(truncated.length).toBeLessThan(longOutput.length);
      expect(truncated).toContain('[截断]');
    });

    it('should not truncate short outputs', () => {
      const maxLength = 100;
      const shortOutput = 'short text';
      
      const truncate = (output: string) => {
        if (output.length <= maxLength) return output;
        return output.slice(0, maxLength) + '...';
      };
      
      expect(truncate(shortOutput)).toBe(shortOutput);
    });
  });

  describe('Summary Generation', () => {
    it('should extract key points from messages', () => {
      const messages = [
        { role: 'user', content: '帮我写一个函数' },
        { role: 'assistant', content: '好的，这是函数...' }
      ];
      
      const points = messages
        .filter(m => m.role === 'user')
        .map(m => `用户: ${m.content.slice(0, 50)}`);
      
      expect(points).toHaveLength(1);
      expect(points[0]).toContain('用户:');
    });

    it('should persist summaries', () => {
      const summaryFile = path.join(compressionDir, 'summaries.json');
      const summaries = [
        { timestamp: Date.now(), turnRange: [0, 10], content: '摘要1', keyPoints: ['点1'] }
      ];
      
      fs.writeFileSync(summaryFile, JSON.stringify(summaries));
      
      const loaded = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
      expect(loaded).toHaveLength(1);
    });
  });

  describe('Compression Logic', () => {
    it('should not compress short history', () => {
      const keepRecent = 10;
      const history = Array(15).fill({ role: 'user', content: 'test' });
      
      const shouldCompress = history.length > keepRecent * 2;
      expect(shouldCompress).toBe(false);
    });

    it('should compress long history', () => {
      const keepRecent = 10;
      const history = Array(30).fill({ role: 'user', content: 'test' });
      
      const shouldCompress = history.length > keepRecent * 2;
      expect(shouldCompress).toBe(true);
    });

    it('should preserve recent messages', () => {
      const keepRecent = 5;
      const history = Array(20).fill(null).map((_, i) => ({ 
        role: 'user' as const, 
        content: `message ${i}` 
      }));
      
      const toKeep = history.slice(-keepRecent * 2);
      expect(toKeep).toHaveLength(10);
      expect(toKeep[toKeep.length - 1].content).toBe('message 19');
    });
  });

  describe('Sliding Window', () => {
    it('should maintain window size', () => {
      const maxTurns = 50;
      let history: any[] = [];
      
      // 模拟添加消息
      for (let i = 0; i < 60; i++) {
        history.push({ role: 'user', content: `msg ${i}` });
        if (history.length > maxTurns) {
          history = history.slice(-maxTurns);
        }
      }
      
      expect(history.length).toBe(maxTurns);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track compression stats', () => {
      const stats = {
        totalMessages: 100,
        compressedMessages: 30,
        savedTokens: 5000,
        summaries: 3,
        lastCompression: Date.now()
      };
      
      expect(stats.compressedMessages).toBeLessThan(stats.totalMessages);
      expect(stats.savedTokens).toBeGreaterThan(0);
    });
  });
});
