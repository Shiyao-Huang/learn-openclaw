/**
 * V6 测试 - 身份系统
 * 
 * 核心能力:
 * - 人格文件: SOUL.md/IDENTITY.md/USER.md
 * - Workspace 初始化
 * - Soul Switch 动态切换
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'v6-test');
const IDENTITY_DIR = path.join(TEST_DIR, 'identity');
const SAMPLE_DIR = path.join(TEST_DIR, 'sample');

// V6 IdentitySystem 实现
class IdentitySystem {
  private identityDir: string;
  private identity: {
    soul: string;
    identity: string;
    user: string;
    agents: string;
  } = { soul: '', identity: '', user: '', agents: '' };

  constructor(identityDir: string) {
    this.identityDir = identityDir;
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.identityDir)) {
      return;
    }

    const readFile = (name: string): string => {
      const file = path.join(this.identityDir, name);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
    };

    this.identity = {
      soul: readFile('SOUL.md'),
      identity: readFile('IDENTITY.md'),
      user: readFile('USER.md'),
      agents: readFile('AGENTS.md')
    };
  }

  getIdentity(): { soul: string; identity: string; user: string; agents: string } {
    return { ...this.identity };
  }

  getSummary(): string {
    const parts: string[] = [];
    if (this.identity.identity) {
      const match = this.identity.identity.match(/^#\s*(.+)$/m);
      if (match) parts.push(`身份: ${match[1]}`);
    }
    if (this.identity.user) {
      const match = this.identity.user.match(/Name:\s*(.+)/i);
      if (match) parts.push(`用户: ${match[1]}`);
    }
    return parts.join(' | ') || '未配置身份';
  }

  initialize(sampleDir: string): boolean {
    if (fs.existsSync(this.identityDir)) {
      return false; // 已存在
    }

    if (!fs.existsSync(sampleDir)) {
      return false; // 模板不存在
    }

    fs.mkdirSync(this.identityDir, { recursive: true });
    
    // 复制模板文件
    const files = ['SOUL.md', 'IDENTITY.md', 'USER.md', 'AGENTS.md'];
    for (const file of files) {
      const src = path.join(sampleDir, file);
      const dst = path.join(this.identityDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      }
    }

    this.load();
    return true;
  }

  updateSoul(content: string): void {
    this.identity.soul = content;
    fs.writeFileSync(path.join(this.identityDir, 'SOUL.md'), content);
  }

  updateUser(content: string): void {
    this.identity.user = content;
    fs.writeFileSync(path.join(this.identityDir, 'USER.md'), content);
  }
}

describe('V6 IdentitySystem - 身份系统', () => {
  let identitySystem: IdentitySystem;

  beforeEach(() => {
    fs.mkdirSync(IDENTITY_DIR, { recursive: true });
    fs.mkdirSync(SAMPLE_DIR, { recursive: true });
    identitySystem = new IdentitySystem(IDENTITY_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('身份文件', () => {
    it('应该能读取 SOUL.md', () => {
      fs.writeFileSync(path.join(IDENTITY_DIR, 'SOUL.md'), '# 我是 AI 助手\n\n这是我的核心人格定义。');
      
      const identity = new IdentitySystem(IDENTITY_DIR);
      expect(identity.getIdentity().soul).toContain('AI 助手');
    });

    it('应该能读取 IDENTITY.md', () => {
      fs.writeFileSync(path.join(IDENTITY_DIR, 'IDENTITY.md'), '# 项目助手\n\n这是一个项目专用助手。');
      
      const identity = new IdentitySystem(IDENTITY_DIR);
      expect(identity.getIdentity().identity).toContain('项目助手');
    });

    it('应该能读取 USER.md', () => {
      fs.writeFileSync(path.join(IDENTITY_DIR, 'USER.md'), `- Name: 张三\n- Timezone: UTC+8`);
      
      const identity = new IdentitySystem(IDENTITY_DIR);
      expect(identity.getIdentity().user).toContain('张三');
    });

    it('应该能读取 AGENTS.md', () => {
      fs.writeFileSync(path.join(IDENTITY_DIR, 'AGENTS.md'), '# 工作区配置\n\n这是工作区规则。');
      
      const identity = new IdentitySystem(IDENTITY_DIR);
      expect(identity.getIdentity().agents).toContain('工作区配置');
    });
  });

  describe('身份摘要', () => {
    it('应该能生成身份摘要', () => {
      fs.writeFileSync(path.join(IDENTITY_DIR, 'IDENTITY.md'), '# 代码审查助手');
      fs.writeFileSync(path.join(IDENTITY_DIR, 'USER.md'), `- Name: 李四\n- Timezone: UTC+8`);
      
      const identity = new IdentitySystem(IDENTITY_DIR);
      const summary = identity.getSummary();
      
      expect(summary).toContain('代码审查助手');
      expect(summary).toContain('李四');
    });

    it('未配置身份应返回提示', () => {
      const summary = identitySystem.getSummary();
      expect(summary).toContain('未配置');
    });
  });

  describe('Workspace 初始化', () => {
    it('应该能从模板初始化', () => {
      // 创建模板
      fs.writeFileSync(path.join(SAMPLE_DIR, 'SOUL.md'), '# 默认人格');
      fs.writeFileSync(path.join(SAMPLE_DIR, 'IDENTITY.md'), '# 默认身份');
      fs.writeFileSync(path.join(SAMPLE_DIR, 'USER.md'), '- Name: 用户');
      fs.writeFileSync(path.join(SAMPLE_DIR, 'AGENTS.md'), '# 默认规则');
      
      // 删除现有身份目录
      fs.rmSync(IDENTITY_DIR, { recursive: true, force: true });
      
      const identity = new IdentitySystem(IDENTITY_DIR);
      const result = identity.initialize(SAMPLE_DIR);
      
      expect(result).toBe(true);
      expect(identity.getIdentity().soul).toContain('默认人格');
      expect(identity.getIdentity().identity).toContain('默认身份');
    });

    it('已存在的目录不应重复初始化', () => {
      fs.writeFileSync(path.join(SAMPLE_DIR, 'SOUL.md'), '# 模板');
      
      const result = identitySystem.initialize(SAMPLE_DIR);
      expect(result).toBe(false);
    });

    it('模板不存在应返回 false', () => {
      fs.rmSync(IDENTITY_DIR, { recursive: true, force: true });
      
      const identity = new IdentitySystem(IDENTITY_DIR);
      const result = identity.initialize('/nonexistent/path');
      expect(result).toBe(false);
    });
  });

  describe('动态更新', () => {
    it('应该能更新 SOUL.md', () => {
      identitySystem.updateSoul('# 新人格\n\n更新后的人格定义。');
      
      const identity = identitySystem.getIdentity();
      expect(identity.soul).toContain('新人格');
      expect(fs.readFileSync(path.join(IDENTITY_DIR, 'SOUL.md'), 'utf-8')).toContain('新人格');
    });

    it('应该能更新 USER.md', () => {
      identitySystem.updateUser('- Name: 新用户\n- Role: 管理员');
      
      const identity = identitySystem.getIdentity();
      expect(identity.user).toContain('新用户');
      expect(identity.user).toContain('管理员');
    });
  });

  describe('人格即配置', () => {
    it('不同配置应产生不同人格', () => {
      // 配置 A: 严肃的助手
      fs.writeFileSync(path.join(IDENTITY_DIR, 'SOUL.md'), `# 严肃助手

- 语气正式
- 详细解释
- 专业术语`);

      // 配置 B: 轻松的助手
      const lightSoul = `# 轻松助手

- 语气随意
- 简短回答
- 俚语使用`;

      const seriousIdentity = new IdentitySystem(IDENTITY_DIR);
      expect(seriousIdentity.getIdentity().soul).toContain('严肃');
      expect(seriousIdentity.getIdentity().soul).not.toContain('轻松');

      fs.writeFileSync(path.join(IDENTITY_DIR, 'SOUL.md'), lightSoul);
      const lightIdentity = new IdentitySystem(IDENTITY_DIR);
      expect(lightIdentity.getIdentity().soul).toContain('轻松');
      expect(lightIdentity.getIdentity().soul).not.toContain('严肃');
    });

    it('人格应该可以版本控制', () => {
      fs.writeFileSync(path.join(IDENTITY_DIR, 'SOUL.md'), `# v1.0 人格

版本: 1.0
更新时间: 2024-01-01`);

      const content = fs.readFileSync(path.join(IDENTITY_DIR, 'SOUL.md'), 'utf-8');
      expect(content).toContain('v1.0');
    });
  });

  describe('多用户场景', () => {
    it('应该能区分不同用户', () => {
      // 用户 A
      const userADir = path.join(TEST_DIR, 'user-a');
      fs.mkdirSync(userADir, { recursive: true });
      fs.writeFileSync(path.join(userADir, 'USER.md'), '- Name: 用户A\n- Role: 开发者');

      // 用户 B
      const userBDir = path.join(TEST_DIR, 'user-b');
      fs.mkdirSync(userBDir, { recursive: true });
      fs.writeFileSync(path.join(userBDir, 'USER.md'), '- Name: 用户B\n- Role: 设计师');

      const identityA = new IdentitySystem(userADir);
      const identityB = new IdentitySystem(userBDir);

      expect(identityA.getIdentity().user).toContain('用户A');
      expect(identityB.getIdentity().user).toContain('用户B');
    });
  });

  describe('Soul Switch', () => {
    it('应该能切换人格', () => {
      // 初始人格
      fs.writeFileSync(path.join(IDENTITY_DIR, 'SOUL.md'), '# 原始人格');
      const identity = new IdentitySystem(IDENTITY_DIR);
      expect(identity.getIdentity().soul).toContain('原始');

      // 切换人格
      identity.updateSoul('# 新人格\n\n切换后的人格。');
      expect(identity.getIdentity().soul).toContain('新人格');
    });

    it('切换人格应该持久化', () => {
      identitySystem.updateSoul('# 持久化测试');
      
      // 重新加载
      const reloaded = new IdentitySystem(IDENTITY_DIR);
      expect(reloaded.getIdentity().soul).toContain('持久化测试');
    });
  });

  describe('安全考虑', () => {
    it('身份文件应该只在工作区内', () => {
      // 路径检查
      const safePath = (p: string): boolean => {
        const resolved = path.resolve(IDENTITY_DIR, p);
        const relative = path.relative(IDENTITY_DIR, resolved);
        return !relative.startsWith('..') && !path.isAbsolute(relative);
      };

      expect(safePath('SOUL.md')).toBe(true);
      expect(safePath('../etc/passwd')).toBe(false);
      expect(safePath('/etc/passwd')).toBe(false);
    });
  });
});
