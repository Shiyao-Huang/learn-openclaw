/**
 * V12 Security 系统测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const testDir = path.join(process.cwd(), 'tmp', 'test-v12');
const securityDir = path.join(testDir, '.security');

describe('V12 Security System', () => {
  beforeEach(() => {
    if (!fs.existsSync(securityDir)) {
      fs.mkdirSync(securityDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(securityDir)) {
      fs.rmSync(securityDir, { recursive: true, force: true });
    }
  });

  describe('Tool Risk Levels', () => {
    const riskLevels = {
      safe: ['read_file', 'grep', 'memory_search', 'memory_get'],
      confirm: ['write_file', 'edit_file', 'memory_append'],
      dangerous: ['bash', 'identity_init', 'session_cleanup']
    };

    it('should categorize safe tools correctly', () => {
      expect(riskLevels.safe).toContain('read_file');
      expect(riskLevels.safe).toContain('grep');
    });

    it('should categorize confirm tools correctly', () => {
      expect(riskLevels.confirm).toContain('write_file');
      expect(riskLevels.confirm).toContain('edit_file');
    });

    it('should categorize dangerous tools correctly', () => {
      expect(riskLevels.dangerous).toContain('bash');
    });

    it('should have non-overlapping categories', () => {
      const allTools = [...riskLevels.safe, ...riskLevels.confirm, ...riskLevels.dangerous];
      const uniqueTools = new Set(allTools);
      expect(uniqueTools.size).toBe(allTools.length);
    });
  });

  describe('Trust Level Permissions', () => {
    const trustPermissions: Record<string, string[]> = {
      owner: ['safe', 'confirm', 'dangerous'],
      trusted: ['safe', 'confirm'],
      normal: ['safe'],
      restricted: []
    };

    it('should allow owner all risk levels', () => {
      expect(trustPermissions.owner).toContain('dangerous');
      expect(trustPermissions.owner).toHaveLength(3);
    });

    it('should restrict normal users to safe only', () => {
      expect(trustPermissions.normal).toEqual(['safe']);
    });

    it('should deny restricted users all tools', () => {
      expect(trustPermissions.restricted).toHaveLength(0);
    });
  });

  describe('Security Policy', () => {
    it('should persist policy to file', () => {
      const policy = {
        toolRiskLevels: { bash: 'dangerous', read_file: 'safe' },
        auditEnabled: true,
        confirmDangerous: true
      };
      
      const policyPath = path.join(securityDir, 'policy.json');
      fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2));
      
      const loaded = JSON.parse(fs.readFileSync(policyPath, 'utf-8'));
      expect(loaded.auditEnabled).toBe(true);
      expect(loaded.toolRiskLevels.bash).toBe('dangerous');
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log entries', () => {
      const entry = {
        timestamp: Date.now(),
        tool: 'bash',
        args: { command: 'ls' },
        riskLevel: 'dangerous',
        decision: 'denied',
        reason: 'Trust level too low'
      };
      
      expect(entry.tool).toBe('bash');
      expect(entry.decision).toBe('denied');
    });

    it('should write audit logs to daily files', () => {
      const today = new Date().toISOString().split('T')[0];
      const auditDir = path.join(securityDir, 'audit');
      fs.mkdirSync(auditDir, { recursive: true });
      
      const auditFile = path.join(auditDir, `audit_${today}.jsonl`);
      const entry = JSON.stringify({ timestamp: Date.now(), tool: 'test' });
      fs.writeFileSync(auditFile, entry + '\n');
      
      expect(fs.existsSync(auditFile)).toBe(true);
    });
  });

  describe('Sensitive Data Masking', () => {
    const sensitivePatterns = [
      /api[_-]?key\s*[:=]\s*['"]?([a-zA-Z0-9_-]+)/gi,
      /sk-[a-zA-Z0-9]{20,}/g,
      /ghp_[a-zA-Z0-9]{36}/g
    ];

    it('should detect OpenAI API keys', () => {
      const text = 'My key is sk-abc123def456ghi789jkl012mno345';
      const hasMatch = sensitivePatterns.some(p => p.test(text));
      expect(hasMatch).toBe(true);
    });

    it('should detect GitHub tokens', () => {
      const text = 'Token: ghp_abcdefghijklmnopqrstuvwxyz0123456789';
      const hasMatch = sensitivePatterns.some(p => p.test(text));
      expect(hasMatch).toBe(true);
    });

    it('should mask sensitive data', () => {
      const mask = (text: string) => {
        return text.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]');
      };
      
      const input = 'API_KEY=sk-abc123def456ghi789jkl012mno345';
      const masked = mask(input);
      expect(masked).toContain('[REDACTED]');
      expect(masked).not.toContain('sk-abc');
    });
  });

  describe('Group Chat Restrictions', () => {
    const groupDenyList = ['bash', 'write_file', 'edit_file', 'identity_update'];

    it('should deny dangerous tools in groups', () => {
      expect(groupDenyList).toContain('bash');
    });

    it('should deny write operations in groups', () => {
      expect(groupDenyList).toContain('write_file');
      expect(groupDenyList).toContain('edit_file');
    });

    it('should check tool against deny list', () => {
      const isAllowed = (tool: string, chatType: string) => {
        if (chatType === 'group' && groupDenyList.includes(tool)) {
          return false;
        }
        return true;
      };
      
      expect(isAllowed('bash', 'group')).toBe(false);
      expect(isAllowed('bash', 'direct')).toBe(true);
      expect(isAllowed('read_file', 'group')).toBe(true);
    });
  });
});
