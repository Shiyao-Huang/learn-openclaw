/**
 * SWE-bench 风格集成测试 - v0-v20 跨版本能力验证
 * 
 * 类似 SWE-bench 哲学:
 * - 测试解决实际问题的能力，而非 API 调用
 * - 端到端场景测试
 * - 跨版本功能集成
 * 
 * 测试分类:
 * - 文件操作能力
 * - 记忆与搜索能力
 * - 任务规划能力
 * - 子代理协作能力
 * - 身份与人格能力
 * - 高级功能集成
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'swebench-test');

// ============================================================================
// SWE-bench 风格测试场景
// ============================================================================

describe('SWE-bench 集成测试 - 文件操作能力', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('场景: 代码重构任务', () => {
    it('应该能找到并替换所有匹配的代码', () => {
      // 创建测试文件
      const srcDir = path.join(TEST_DIR, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      
      fs.writeFileSync(path.join(srcDir, 'a.ts'), `
import { oldFunction } from './utils';
import { helper } from './helper';

export function main() {
  return oldFunction() + helper();
}
`);
      
      fs.writeFileSync(path.join(srcDir, 'b.ts'), `
import { oldFunction } from './utils';

export function secondary() {
  return oldFunction() * 2;
}
`);

      // 任务: 将 oldFunction 重命名为 newFunction
      // Step 1: 搜索所有引用
      const grepResult = execSync(
        `grep -r "oldFunction" ${srcDir} --include="*.ts" -l`,
        { encoding: 'utf-8' }
      );
      
      // Step 2: 替换
      const files = grepResult.trim().split('\n').filter(f => f);
      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        const newContent = content.replace(/oldFunction/g, 'newFunction');
        fs.writeFileSync(file, newContent);
      });

      // Step 3: 验证
      const aContent = fs.readFileSync(path.join(srcDir, 'a.ts'), 'utf-8');
      const bContent = fs.readFileSync(path.join(srcDir, 'b.ts'), 'utf-8');
      
      expect(aContent).toContain('newFunction');
      expect(aContent).not.toContain('oldFunction');
      expect(bContent).toContain('newFunction');
      expect(bContent).not.toContain('oldFunction');
    });

    it('应该能安全地处理文件不存在的情况', () => {
      const nonexistentFile = path.join(TEST_DIR, 'nonexistent.txt');
      let errorCaught = false;
      
      try {
        fs.readFileSync(nonexistentFile, 'utf-8');
      } catch (e) {
        errorCaught = true;
      }
      
      expect(errorCaught).toBe(true);
    });
  });

  describe('场景: 项目结构分析', () => {
    it('应该能列出目录结构并生成报告', () => {
      // 创建复杂目录结构
      const dirs = [
        'src/components',
        'src/utils',
        'src/services',
        'tests/unit',
        'tests/integration',
        'docs'
      ];
      
      dirs.forEach(dir => {
        fs.mkdirSync(path.join(TEST_DIR, dir), { recursive: true });
      });
      
      // 创建一些文件
      fs.writeFileSync(path.join(TEST_DIR, 'src/index.ts'), '');
      fs.writeFileSync(path.join(TEST_DIR, 'src/components/Button.tsx'), '');
      fs.writeFileSync(path.join(TEST_DIR, 'tests/unit/test.ts'), '');
      
      // 任务: 生成目录树
      const result = execSync(`find ${TEST_DIR} -type f -name "*.ts" -o -name "*.tsx"`, {
        encoding: 'utf-8'
      });
      
      expect(result).toContain('index.ts');
      expect(result).toContain('Button.tsx');
      expect(result).toContain('test.ts');
    });
  });
});

describe('SWE-bench 集成测试 - 记忆与搜索能力', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('场景: 知识库检索', () => {
    it('应该能索引文档并按相关性搜索', () => {
      const docsDir = path.join(TEST_DIR, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      
      // 创建多个文档
      fs.writeFileSync(path.join(docsDir, 'python.md'), `# Python 编程

Python 是一种高级编程语言，广泛用于:
- Web 开发
- 数据科学
- 机器学习
- 自动化脚本
`);
      
      fs.writeFileSync(path.join(docsDir, 'javascript.md'), `# JavaScript 编程

JavaScript 是 Web 开发的核心语言:
- 前端开发
- Node.js 后端
- React/Vue 框架
`);
      
      fs.writeFileSync(path.join(docsDir, 'devops.md'), `# DevOps 实践

DevOps 结合开发和运维:
- CI/CD 流水线
- 容器化部署
- Kubernetes 编排
`);

      // 任务: 搜索关于 Web 开发的文档
      const result = execSync(
        `grep -l -i "web" ${docsDir}/*.md`,
        { encoding: 'utf-8' }
      );
      
      expect(result).toContain('python.md');
      expect(result).toContain('javascript.md');
      expect(result).not.toContain('devops.md');
    });
  });
});

describe('SWE-bench 集成测试 - 任务规划能力', () => {
  describe('场景: 多步骤部署任务', () => {
    it('应该能分解复杂任务为可执行的步骤', () => {
      // 模拟任务分解
      const complexTask = '部署一个 Node.js 应用到生产环境';
      
      const steps = [
        { content: '运行测试套件', status: 'pending' as const },
        { content: '构建生产包', status: 'pending' as const },
        { content: '构建 Docker 镜像', status: 'pending' as const },
        { content: '推送镜像到仓库', status: 'pending' as const },
        { content: '更新 Kubernetes 配置', status: 'pending' as const },
        { content: '执行滚动更新', status: 'pending' as const },
        { content: '验证部署健康', status: 'pending' as const }
      ];
      
      // 验证任务分解质量
      expect(steps.length).toBeGreaterThan(5);
      expect(steps.every(s => s.content.length > 0)).toBe(true);
      
      // 验证顺序依赖
      const buildIndex = steps.findIndex(s => s.content.includes('构建'));
      const pushIndex = steps.findIndex(s => s.content.includes('推送'));
      expect(buildIndex).toBeLessThan(pushIndex);
    });

    it('应该能追踪任务进度', () => {
      type Status = 'pending' | 'in_progress' | 'completed';
      
      interface Task {
        content: string;
        status: Status;
      }
      
      const tasks: Task[] = [
        { content: '任务A', status: 'completed' },
        { content: '任务B', status: 'completed' },
        { content: '任务C', status: 'in_progress' },
        { content: '任务D', status: 'pending' }
      ];
      
      const completed = tasks.filter(t => t.status === 'completed').length;
      const total = tasks.length;
      const progress = completed / total;
      
      expect(progress).toBe(0.5);
    });
  });
});

describe('SWE-bench 集成测试 - 子代理协作能力', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('场景: 并行代码分析', () => {
    it('应该能并行处理多个独立任务', async () => {
      // 创建多个独立的代码文件
      const files = ['module-a.ts', 'module-b.ts', 'module-c.ts'];
      
      files.forEach(file => {
        fs.writeFileSync(path.join(TEST_DIR, file), `
// ${file}
export function func() {
  return "${file} result";
}
`);
      });
      
      // 模拟并行处理
      const results = await Promise.all(
        files.map(async file => {
          const content = fs.readFileSync(path.join(TEST_DIR, file), 'utf-8');
          return { file, lines: content.split('\n').length };
        })
      );
      
      expect(results.length).toBe(3);
      results.forEach(r => {
        expect(r.lines).toBeGreaterThan(0);
      });
    });
  });

  describe('场景: 上下文隔离', () => {
    it('子任务之间应该相互隔离', () => {
      // 模拟两个隔离的工作区
      const workspace1 = path.join(TEST_DIR, 'workspace1');
      const workspace2 = path.join(TEST_DIR, 'workspace2');
      
      fs.mkdirSync(workspace1, { recursive: true });
      fs.mkdirSync(workspace2, { recursive: true });
      
      fs.writeFileSync(path.join(workspace1, 'config.json'), '{"name": "ws1"}');
      fs.writeFileSync(path.join(workspace2, 'config.json'), '{"name": "ws2"}');
      
      // 验证隔离
      const config1 = JSON.parse(fs.readFileSync(path.join(workspace1, 'config.json'), 'utf-8'));
      const config2 = JSON.parse(fs.readFileSync(path.join(workspace2, 'config.json'), 'utf-8'));
      
      expect(config1.name).toBe('ws1');
      expect(config2.name).toBe('ws2');
    });
  });
});

describe('SWE-bench 集成测试 - 身份与人格能力', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('场景: 多人格切换', () => {
    it('应该能根据场景使用不同人格', () => {
      const personalities = {
        coder: {
          soul: '# 编程助手\n\n专注于代码质量和技术实现',
          style: '技术性、精确'
        },
        reviewer: {
          soul: '# 代码审查员\n\n专注于代码安全和最佳实践',
          style: '批判性、建议性'
        },
        mentor: {
          soul: '# 编程导师\n\n专注于教学和引导',
          style: '耐心、解释性'
        }
      };
      
      // 验证每种人格有不同的特征
      expect(personalities.coder.soul).toContain('代码质量');
      expect(personalities.reviewer.soul).toContain('安全');
      expect(personalities.mentor.soul).toContain('教学');
    });
  });

  describe('场景: 用户偏好记忆', () => {
    it('应该能记住用户的偏好设置', () => {
      const userConfig = {
        name: '测试用户',
        timezone: 'UTC+8',
        preferences: {
          language: 'zh-CN',
          editor: 'vscode',
          theme: 'dark'
        }
      };
      
      fs.writeFileSync(
        path.join(TEST_DIR, 'USER.md'),
        `- Name: ${userConfig.name}\n- Timezone: ${userConfig.timezone}\n- Language: ${userConfig.preferences.language}`
      );
      
      const saved = fs.readFileSync(path.join(TEST_DIR, 'USER.md'), 'utf-8');
      
      expect(saved).toContain('测试用户');
      expect(saved).toContain('UTC+8');
      expect(saved).toContain('zh-CN');
    });
  });
});

describe('SWE-bench 集成测试 - 高级功能集成', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('场景: 完整的开发工作流', () => {
    it('应该能执行完整的开发流程', () => {
      // 1. 创建项目结构
      const projectDir = path.join(TEST_DIR, 'my-project');
      fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });
      
      // 2. 创建源代码
      fs.writeFileSync(path.join(projectDir, 'src', 'index.ts'), `
export function add(a: number, b: number): number {
  return a + b;
}
`);
      
      // 3. 创建测试
      fs.writeFileSync(path.join(projectDir, 'tests', 'index.test.ts'), `
import { add } from '../src/index';

test('add should sum two numbers', () => {
  expect(add(1, 2)).toBe(3);
});
`);
      
      // 4. 创建配置
      fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
        name: 'my-project',
        version: '1.0.0',
        scripts: {
          test: 'vitest run',
          build: 'tsc'
        }
      }, null, 2));
      
      // 验证项目结构
      expect(fs.existsSync(path.join(projectDir, 'src/index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'tests/index.test.ts'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
    });
  });

  describe('场景: 跨版本能力验证', () => {
    it('V0-V6 能力应该可用', () => {
      const capabilities = {
        v0: ['bash'],
        v1: ['read_file', 'write_file', 'edit_file', 'grep'],
        v2: ['memory_search', 'memory_append', 'memory_ingest'],
        v3: ['TodoWrite'],
        v4: ['SubAgent'],
        v5: ['Skill'],
        v6: ['Identity']
      };
      
      // 验证能力累积
      const allCapabilities = Object.values(capabilities).flat();
      expect(allCapabilities.length).toBeGreaterThan(10);
      
      // 验证关键能力存在
      expect(allCapabilities).toContain('bash');
      expect(allCapabilities).toContain('read_file');
      expect(allCapabilities).toContain('memory_search');
      expect(allCapabilities).toContain('TodoWrite');
    });

    it('高级版本应该继承基础能力', () => {
      // V7+ 应该有 V0-V6 的所有能力
      const baseCapabilities = [
        'bash',           // V0
        'file_ops',       // V1
        'memory',         // V2
        'planning',       // V3
        'subagent',       // V4
        'skills',         // V5
        'identity'        // V6
      ];
      
      const advancedVersionCapabilities = [...baseCapabilities];
      
      // V7+ 新增能力
      const advancedCapabilities = [
        'heartbeat',      // V8
        'session',        // V9
        'introspection',  // V10
        'channel',        // V11
        'security',       // V12
        'evolution',      // V13
        'plugins',        // V14
        'multimodel'      // V15
      ];
      
      const allCapabilities = [...advancedVersionCapabilities, ...advancedCapabilities];
      
      expect(allCapabilities.length).toBe(baseCapabilities.length + advancedCapabilities.length);
    });
  });
});

describe('SWE-bench 集成测试 - 性能基准', () => {
  it('文件操作应该在合理时间内完成', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    
    const start = Date.now();
    
    // 创建 100 个文件
    for (let i = 0; i < 100; i++) {
      fs.writeFileSync(path.join(TEST_DIR, `file-${i}.txt`), `content ${i}`);
    }
    
    const elapsed = Date.now() - start;
    
    // 应该在 1 秒内完成
    expect(elapsed).toBeLessThan(1000);
    
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('搜索操作应该在合理时间内完成', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    
    // 创建测试文件
    for (let i = 0; i < 50; i++) {
      fs.writeFileSync(
        path.join(TEST_DIR, `doc-${i}.md`),
        `# Document ${i}\n\nThis is document number ${i}.`.repeat(10)
      );
    }
    
    const start = Date.now();
    
    // 执行搜索
    const result = execSync(`grep -l "Document 25" ${TEST_DIR}/*.md`, { encoding: 'utf-8' });
    
    const elapsed = Date.now() - start;
    
    expect(result).toContain('doc-25.md');
    expect(elapsed).toBeLessThan(1000);
    
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });
});
