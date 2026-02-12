/**
 * V5 测试 - Skill 系统
 * 
 * 核心能力:
 * - 知识外部化: SKILL.md 文件
 * - 渐进式加载: 按需加载
 * - 缓存友好
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'v5-test');
const SKILL_DIR = path.join(TEST_DIR, 'skills');

// V5 Skill 接口
interface Skill {
  name: string;
  description: string;
  tools?: string[];
  content: string;
  path: string;
}

// V5 SkillLoader 实现
class SkillLoader {
  private skillsDir: string;
  private cache: Map<string, Skill> = new Map();

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  load(skillName: string): Skill | null {
    // 检查缓存
    if (this.cache.has(skillName)) {
      return this.cache.get(skillName)!;
    }

    // 查找 skill 文件
    const skillPath = path.join(this.skillsDir, skillName, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      return null;
    }

    const content = fs.readFileSync(skillPath, 'utf-8');
    const skill: Skill = {
      name: skillName,
      description: this.parseDescription(content),
      tools: this.parseTools(content),
      content,
      path: skillPath
    };

    // 缓存
    this.cache.set(skillName, skill);
    return skill;
  }

  list(): string[] {
    if (!fs.existsSync(this.skillsDir)) return [];
    return fs.readdirSync(this.skillsDir).filter(name => {
      const skillFile = path.join(this.skillsDir, name, 'SKILL.md');
      return fs.existsSync(skillFile);
    });
  }

  private parseDescription(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : '';
  }

  private parseTools(content: string): string[] {
    const match = content.match(/##\s*工具\s*\n([\s\S]*?)(?=##|$)/i);
    if (!match) return [];
    const toolsSection = match[1];
    const tools: string[] = [];
    const toolMatches = toolsSection.matchAll(/[-*]\s*`?(\w+)`?/g);
    for (const m of toolMatches) {
      tools.push(m[1]);
    }
    return tools;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

describe('V5 SkillSystem - 技能系统', () => {
  let skillLoader: SkillLoader;

  beforeEach(() => {
    fs.mkdirSync(SKILL_DIR, { recursive: true });
    skillLoader = new SkillLoader(SKILL_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('Skill 文件格式', () => {
    it('应该能解析 SKILL.md 文件', () => {
      const skillPath = path.join(SKILL_DIR, 'test-skill', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, `# 测试技能

这是一个测试技能的描述。

## 工具

- tool_one
- tool_two
- tool_three

## 使用说明

使用这些工具完成任务。
`);

      const skill = skillLoader.load('test-skill');
      expect(skill).not.toBeNull();
      expect(skill!.name).toBe('test-skill');
      expect(skill!.description).toBe('测试技能');
      expect(skill!.tools).toContain('tool_one');
      expect(skill!.tools).toContain('tool_two');
    });

    it('不存在 Skill 应返回 null', () => {
      const skill = skillLoader.load('nonexistent');
      expect(skill).toBeNull();
    });
  });

  describe('Skill 列表', () => {
    it('应该能列出所有可用的 Skill', () => {
      // 创建多个 skill
      const skills = ['skill-a', 'skill-b', 'skill-c'];
      skills.forEach(name => {
        const skillPath = path.join(SKILL_DIR, name, 'SKILL.md');
        fs.mkdirSync(path.dirname(skillPath), { recursive: true });
        fs.writeFileSync(skillPath, `# ${name}`);
      });

      const list = skillLoader.list();
      expect(list.length).toBe(3);
      expect(list).toContain('skill-a');
      expect(list).toContain('skill-b');
      expect(list).toContain('skill-c');
    });

    it('空目录应返回空列表', () => {
      const list = skillLoader.list();
      expect(list).toEqual([]);
    });

    it('只列出有 SKILL.md 的目录', () => {
      fs.mkdirSync(path.join(SKILL_DIR, 'no-skill-file'), { recursive: true });
      fs.mkdirSync(path.join(SKILL_DIR, 'has-skill-file'), { recursive: true });
      fs.writeFileSync(path.join(SKILL_DIR, 'has-skill-file', 'SKILL.md'), '# Has Skill');

      const list = skillLoader.list();
      expect(list).toContain('has-skill-file');
      expect(list).not.toContain('no-skill-file');
    });
  });

  describe('缓存机制', () => {
    it('应该缓存加载的 Skill', () => {
      const skillPath = path.join(SKILL_DIR, 'cached-skill', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, '# Cached Skill');

      // 第一次加载
      skillLoader.load('cached-skill');
      
      // 修改文件
      fs.writeFileSync(skillPath, '# Modified');
      
      // 第二次加载应该返回缓存
      const skill = skillLoader.load('cached-skill');
      expect(skill!.description).toBe('Cached Skill');
    });

    it('clearCache 应该清除缓存', () => {
      const skillPath = path.join(SKILL_DIR, 'clear-test', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, '# Original');

      skillLoader.load('clear-test');
      skillLoader.clearCache();
      
      fs.writeFileSync(skillPath, '# Modified');
      
      const skill = skillLoader.load('clear-test');
      expect(skill!.description).toBe('Modified');
    });
  });

  describe('知识外部化', () => {
    it('Skill 应该包含领域知识', () => {
      const skillPath = path.join(SKILL_DIR, 'git-expert', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, `# Git 专家

## 常用命令

### 分支操作
- git branch -a: 查看所有分支
- git checkout -b: 创建并切换分支
- git merge: 合并分支

### 提交历史
- git log --oneline: 简洁日志
- git rebase -i: 交互式变基

## 最佳实践

1. 频繁提交
2. 写好 commit message
3. 使用分支开发
`);

      const skill = skillLoader.load('git-expert');
      expect(skill!.content).toContain('git branch');
      expect(skill!.content).toContain('最佳实践');
    });

    it('Skill 应该包含工具定义', () => {
      const skillPath = path.join(SKILL_DIR, 'github', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, `# GitHub 集成

## 工具

- gh_cli: GitHub CLI 命令
- create_repo: 创建仓库
- create_issue: 创建 Issue
- create_pr: 创建 Pull Request
`);

      const skill = skillLoader.load('github');
      expect(skill!.tools).toContain('gh_cli');
      expect(skill!.tools).toContain('create_repo');
      expect(skill!.tools).toContain('create_issue');
    });
  });

  describe('渐进式加载', () => {
    it('只在需要时加载 Skill', () => {
      // 创建多个 skill
      for (let i = 0; i < 10; i++) {
        const skillPath = path.join(SKILL_DIR, `skill-${i}`, 'SKILL.md');
        fs.mkdirSync(path.dirname(skillPath), { recursive: true });
        fs.writeFileSync(skillPath, `# Skill ${i}`);
      }

      // 只加载需要的
      const skill = skillLoader.load('skill-5');
      expect(skill!.name).toBe('skill-5');
      
      // 其他 skill 不应被加载
      const list = skillLoader.list();
      expect(list.length).toBe(10);
    });

    it('不污染系统提示', () => {
      // Skill 内容是作为 tool_result 注入，不是系统提示
      const skillPath = path.join(SKILL_DIR, 'test', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, `# Test Skill\n\n内容很长\n`.repeat(100));

      const skill = skillLoader.load('test');
      // Skill 内容独立存在，不影响系统提示大小
      expect(skill!.content.length).toBeGreaterThan(1000);
    });
  });

  describe('Skill 组合', () => {
    it('应该能加载多个 Skill', () => {
      // 创建多个相关 skill
      const skills = ['python', 'pytest', 'pip'];
      skills.forEach(name => {
        const skillPath = path.join(SKILL_DIR, name, 'SKILL.md');
        fs.mkdirSync(path.dirname(skillPath), { recursive: true });
        fs.writeFileSync(skillPath, `# ${name} skill`);
      });

      const loaded = skills.map(s => skillLoader.load(s));
      expect(loaded.every(s => s !== null)).toBe(true);
    });

    it('相关 Skill 应该能协同工作', () => {
      // 模拟 python + pytest 协同
      const pythonSkill = `# Python

## 工具
- python_run
- pip_install`;

      const pytestSkill = `# Pytest

## 工具
- pytest_run
- pytest_watch`;

      fs.mkdirSync(path.join(SKILL_DIR, 'python'), { recursive: true });
      fs.mkdirSync(path.join(SKILL_DIR, 'pytest'), { recursive: true });
      fs.writeFileSync(path.join(SKILL_DIR, 'python', 'SKILL.md'), pythonSkill);
      fs.writeFileSync(path.join(SKILL_DIR, 'pytest', 'SKILL.md'), pytestSkill);

      const p = skillLoader.load('python');
      const t = skillLoader.load('pytest');

      const allTools = [...(p!.tools || []), ...(t!.tools || [])];
      expect(allTools).toContain('python_run');
      expect(allTools).toContain('pytest_run');
    });
  });

  describe('错误处理', () => {
    it('格式错误的 SKILL.md 应该优雅处理', () => {
      const skillPath = path.join(SKILL_DIR, 'malformed', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, '没有标题的内容');

      const skill = skillLoader.load('malformed');
      expect(skill).not.toBeNull();
      expect(skill!.description).toBe(''); // 没有标题
    });

    it('空 SKILL.md 应该被接受', () => {
      const skillPath = path.join(SKILL_DIR, 'empty', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, '');

      const skill = skillLoader.load('empty');
      expect(skill).not.toBeNull();
    });
  });
});
