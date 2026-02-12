/**
 * V3 测试 - 任务规划系统
 * 
 * 核心能力:
 * - TodoManager 管理任务列表
 * - 任务分解和状态追踪
 * - Make Plans Visible 哲学
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'v3-test');

// V3 任务状态
type TodoStatus = "pending" | "in_progress" | "completed";

interface TodoItem {
  content: string;
  status: TodoStatus;
  activeForm?: string;  // 进行中时的简短描述
}

// V3 TodoManager 实现
class TodoManager {
  private todos: TodoItem[] = [];
  private maxItems = 20;

  update(items: TodoItem[]): string {
    // 验证约束
    if (items.length > this.maxItems) {
      return `错误: 最多支持 ${this.maxItems} 个任务`;
    }

    const inProgress = items.filter(t => t.status === 'in_progress');
    if (inProgress.length > 1) {
      return "错误: 只能有一个进行中的任务";
    }

    this.todos = items;
    return this.format();
  }

  private format(): string {
    if (this.todos.length === 0) return "暂无任务";

    const icons: Record<TodoStatus, string> = {
      pending: '○',
      in_progress: '▶',
      completed: '✓'
    };

    const lines = this.todos.map(t => {
      const icon = icons[t.status];
      const active = t.activeForm && t.status === 'in_progress' ? ` - ${t.activeForm}` : '';
      return `${icon} ${t.content}${active}`;
    });

    const stats = this.getStats();
    return `${lines.join('\n')}\n\n总计: ${stats.total} | 待办: ${stats.pending} | 进行中: ${stats.inProgress} | 完成: ${stats.completed}`;
  }

  private getStats() {
    return {
      total: this.todos.length,
      pending: this.todos.filter(t => t.status === 'pending').length,
      inProgress: this.todos.filter(t => t.status === 'in_progress').length,
      completed: this.todos.filter(t => t.status === 'completed').length
    };
  }

  getTodos(): TodoItem[] {
    return [...this.todos];
  }

  clear(): void {
    this.todos = [];
  }
}

describe('V3 TodoManager - 任务规划系统', () => {
  let todoManager: TodoManager;

  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    todoManager = new TodoManager();
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('任务创建', () => {
    it('应该能创建待办任务', () => {
      const result = todoManager.update([
        { content: '读取文件', status: 'pending' }
      ]);
      expect(result).toContain('读取文件');
      expect(result).toContain('○');
    });

    it('应该能创建进行中任务', () => {
      const result = todoManager.update([
        { content: '正在处理', status: 'in_progress', activeForm: '处理数据中' }
      ]);
      expect(result).toContain('▶');
      expect(result).toContain('处理数据中');
    });

    it('应该能创建已完成任务', () => {
      const result = todoManager.update([
        { content: '完成的任务', status: 'completed' }
      ]);
      expect(result).toContain('✓');
    });
  });

  describe('任务约束', () => {
    it('最多支持 20 个任务', () => {
      const items: TodoItem[] = Array(21).fill(null).map((_, i) => ({
        content: `任务 ${i + 1}`,
        status: 'pending' as const
      }));
      const result = todoManager.update(items);
      expect(result).toContain('错误');
      expect(result).toContain('最多支持');
    });

    it('只能有一个进行中的任务', () => {
      const result = todoManager.update([
        { content: '任务1', status: 'in_progress' },
        { content: '任务2', status: 'in_progress' }
      ]);
      expect(result).toContain('错误');
      expect(result).toContain('只能有一个');
    });

    it('允许多个待办和已完成任务', () => {
      const result = todoManager.update([
        { content: '待办1', status: 'pending' },
        { content: '待办2', status: 'pending' },
        { content: '完成1', status: 'completed' },
        { content: '完成2', status: 'completed' }
      ]);
      expect(result).not.toContain('错误');
    });
  });

  describe('任务状态转换', () => {
    it('pending -> in_progress', () => {
      todoManager.update([{ content: '测试任务', status: 'pending' }]);
      
      const result = todoManager.update([{ content: '测试任务', status: 'in_progress' }]);
      expect(result).toContain('▶');
    });

    it('in_progress -> completed', () => {
      todoManager.update([{ content: '测试任务', status: 'in_progress' }]);
      
      const result = todoManager.update([{ content: '测试任务', status: 'completed' }]);
      expect(result).toContain('✓');
    });

    it('completed -> pending (重新开始)', () => {
      todoManager.update([{ content: '测试任务', status: 'completed' }]);
      
      const result = todoManager.update([{ content: '测试任务', status: 'pending' }]);
      expect(result).toContain('○');
    });
  });

  describe('activeForm', () => {
    it('进行中任务可以显示 activeForm', () => {
      const result = todoManager.update([
        { content: '部署服务', status: 'in_progress', activeForm: '正在推送镜像' }
      ]);
      expect(result).toContain('正在推送镜像');
    });

    it('非进行中任务忽略 activeForm', () => {
      const result = todoManager.update([
        { content: '待办任务', status: 'pending', activeForm: '这不应该显示' }
      ]);
      expect(result).not.toContain('这不应该显示');
    });
  });

  describe('统计信息', () => {
    it('应该显示正确的统计', () => {
      const result = todoManager.update([
        { content: '待办1', status: 'pending' },
        { content: '待办2', status: 'pending' },
        { content: '进行中', status: 'in_progress' },
        { content: '完成1', status: 'completed' },
        { content: '完成2', status: 'completed' },
        { content: '完成3', status: 'completed' }
      ]);
      
      expect(result).toContain('总计: 6');
      expect(result).toContain('待办: 2');
      expect(result).toContain('进行中: 1');
      expect(result).toContain('完成: 3');
    });
  });

  describe('空状态', () => {
    it('无任务应显示提示', () => {
      const result = todoManager.update([]);
      expect(result).toContain('暂无任务');
    });
  });

  describe('任务分解', () => {
    it('复杂任务应分解为子任务', () => {
      // 模拟分解"实现用户认证"为子任务
      const result = todoManager.update([
        { content: '设计数据库 schema', status: 'completed' },
        { content: '实现注册 API', status: 'completed' },
        { content: '实现登录 API', status: 'in_progress', activeForm: '编写 JWT 逻辑' },
        { content: '实现登出 API', status: 'pending' },
        { content: '添加单元测试', status: 'pending' }
      ]);
      
      expect(result).toContain('设计数据库');
      expect(result).toContain('实现登录');
    });

    it('任务应按顺序执行', () => {
      // 先决条件任务完成前，后续任务保持 pending
      const todos = todoManager.update([
        { content: '安装依赖', status: 'in_progress' },
        { content: '配置环境', status: 'pending' },
        { content: '启动服务', status: 'pending' }
      ]);
      
      const items = todoManager.getTodos();
      expect(items[0].status).toBe('in_progress');
      expect(items[1].status).toBe('pending');
      expect(items[2].status).toBe('pending');
    });
  });

  describe('Make Plans Visible 哲学', () => {
    it('任务列表应该是可见的', () => {
      const result = todoManager.update([
        { content: '分析需求', status: 'completed' },
        { content: '编写代码', status: 'in_progress', activeForm: '实现核心逻辑' },
        { content: '测试验证', status: 'pending' }
      ]);
      
      // 结果应该是可读的格式
      expect(result).toContain('✓ 分析需求');
      expect(result).toContain('▶ 编写代码');
      expect(result).toContain('○ 测试验证');
    });

    it('进度应该是可追踪的', () => {
      const result = todoManager.update([
        { content: '任务A', status: 'completed' },
        { content: '任务B', status: 'completed' },
        { content: '任务C', status: 'pending' },
        { content: '任务D', status: 'pending' }
      ]);
      
      // 可以看到完成进度
      expect(result).toContain('完成: 2');
      expect(result).toContain('待办: 2');
    });
  });

  describe('边界情况', () => {
    it('应该处理空内容的任务', () => {
      const result = todoManager.update([{ content: '', status: 'pending' }]);
      // 空内容也应该被接受（由上游验证）
      expect(result).not.toContain('错误');
    });

    it('应该处理很长的任务描述', () => {
      const longContent = 'a'.repeat(1000);
      const result = todoManager.update([{ content: longContent, status: 'pending' }]);
      expect(result).toContain(longContent);
    });

    it('应该处理特殊字符', () => {
      const result = todoManager.update([
        { content: '处理特殊字符: <>&"\'', status: 'pending' }
      ]);
      expect(result).toContain('<>&"\'');
    });
  });
});
