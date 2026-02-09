/**
 * V7 分层记忆系统测试
 * 测试 LayeredMemory 类的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 测试用的临时目录
const TEST_DIR = path.join(process.cwd(), '.test-workspace-v7');

// 从 v7-agent.ts 提取的 LayeredMemory 类（简化版用于测试）
class LayeredMemory {
  private workspaceDir: string;
  private memoryDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.memoryDir = path.join(workspaceDir, "memory");
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  private getToday(): string {
    return new Date().toISOString().split("T")[0];
  }

  private getDailyPath(date?: string): string {
    return path.join(this.memoryDir, `${date || this.getToday()}.md`);
  }

  writeDailyNote(content: string): string {
    const today = this.getToday();
    const filePath = this.getDailyPath(today);
    const timestamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });

    let existing = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf-8")
      : `# ${today} 日记\n`;

    fs.writeFileSync(filePath, existing + `\n## ${timestamp}\n\n${content}\n`, "utf-8");
    return `已记录到 ${today} 日记`;
  }

  readDailyNote(date?: string): string {
    const filePath = this.getDailyPath(date);
    if (!fs.existsSync(filePath)) {
      return date ? `${date} 没有日记` : "今天还没有日记";
    }
    return fs.readFileSync(filePath, "utf-8");
  }

  readRecentNotes(days: number = 3): string {
    const notes: string[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const filePath = this.getDailyPath(dateStr);

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        notes.push(`--- ${dateStr} ---\n${content.slice(0, 1500)}${content.length > 1500 ? "..." : ""}`);
      }
    }

    return notes.length > 0 ? notes.join("\n\n") : "最近没有日记";
  }

  listDailyNotes(): string {
    const files = fs.readdirSync(this.memoryDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();

    if (files.length === 0) return "暂无日记";

    return files.slice(0, 20).map(f => {
      const date = f.replace(".md", "");
      const stat = fs.statSync(path.join(this.memoryDir, f));
      return `- ${date} (${Math.round(stat.size / 1024)}KB)`;
    }).join("\n");
  }

  readLongTermMemory(): string {
    const memoryPath = path.join(this.workspaceDir, "MEMORY.md");
    if (!fs.existsSync(memoryPath)) {
      return "长期记忆为空（MEMORY.md 不存在）";
    }
    return fs.readFileSync(memoryPath, "utf-8");
  }

  updateLongTermMemory(content: string): string {
    const memoryPath = path.join(this.workspaceDir, "MEMORY.md");
    fs.writeFileSync(memoryPath, content, "utf-8");
    return "长期记忆已更新";
  }

  appendLongTermMemory(section: string, content: string): string {
    const memoryPath = path.join(this.workspaceDir, "MEMORY.md");
    let existing = fs.existsSync(memoryPath)
      ? fs.readFileSync(memoryPath, "utf-8")
      : "# MEMORY.md - 长期记忆\n";

    const sectionHeader = `## ${section}`;
    if (existing.includes(sectionHeader)) {
      const lines = existing.split("\n");
      const sectionIndex = lines.findIndex(l => l.startsWith(sectionHeader));
      let insertIndex = sectionIndex + 1;
      while (insertIndex < lines.length && !lines[insertIndex].startsWith("## ")) {
        insertIndex++;
      }
      lines.splice(insertIndex, 0, `- ${content}`);
      existing = lines.join("\n");
    } else {
      existing += `\n\n${sectionHeader}\n\n- ${content}`;
    }

    fs.writeFileSync(memoryPath, existing, "utf-8");
    return `已添加到长期记忆 [${section}]`;
  }

  searchAllMemory(query: string): string {
    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    const longTermPath = path.join(this.workspaceDir, "MEMORY.md");
    if (fs.existsSync(longTermPath)) {
      const content = fs.readFileSync(longTermPath, "utf-8");
      if (content.toLowerCase().includes(lowerQuery)) {
        const lines = content.split("\n").filter(l => l.toLowerCase().includes(lowerQuery));
        results.push(`[MEMORY.md] ${lines[0]?.slice(0, 100) || "找到匹配"}`);
      }
    }

    const files = fs.readdirSync(this.memoryDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse()
      .slice(0, 30);

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.memoryDir, file), "utf-8");
      if (content.toLowerCase().includes(lowerQuery)) {
        const date = file.replace(".md", "");
        const lines = content.split("\n").filter(l => l.toLowerCase().includes(lowerQuery));
        results.push(`[${date}] ${lines[0]?.slice(0, 100) || "找到匹配"}`);
      }
    }

    return results.length > 0 ? results.slice(0, 10).join("\n") : "未找到相关记忆";
  }

  getTimeContext(): string {
    const now = new Date();
    const today = this.getToday();
    const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    const hour = now.getHours();

    let timeOfDay = "凌晨";
    if (hour >= 6 && hour < 12) timeOfDay = "上午";
    else if (hour >= 12 && hour < 14) timeOfDay = "中午";
    else if (hour >= 14 && hour < 18) timeOfDay = "下午";
    else if (hour >= 18 && hour < 22) timeOfDay = "晚上";
    else if (hour >= 22) timeOfDay = "深夜";

    return `今天是 ${today} 星期${dayOfWeek}，现在是${timeOfDay} ${hour}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
}

describe('V7 LayeredMemory - 分层记忆系统', () => {
  let memory: LayeredMemory;

  beforeEach(() => {
    // 创建测试目录
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    memory = new LayeredMemory(TEST_DIR);
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('日记层 (Daily Notes)', () => {
    it('应该能写入今日日记', () => {
      const result = memory.writeDailyNote('测试内容');
      expect(result).toContain('已记录到');
      expect(result).toContain('日记');
    });

    it('应该能读取今日日记', () => {
      memory.writeDailyNote('测试内容123');
      const content = memory.readDailyNote();
      expect(content).toContain('测试内容123');
    });

    it('读取不存在的日记应返回提示', () => {
      const result = memory.readDailyNote('2020-01-01');
      expect(result).toBe('2020-01-01 没有日记');
    });

    it('应该能追加多条日记', () => {
      memory.writeDailyNote('第一条');
      memory.writeDailyNote('第二条');
      const content = memory.readDailyNote();
      expect(content).toContain('第一条');
      expect(content).toContain('第二条');
    });

    it('应该能列出所有日记', () => {
      memory.writeDailyNote('测试');
      const list = memory.listDailyNotes();
      expect(list).toContain(new Date().toISOString().split('T')[0]);
    });

    it('空目录应返回暂无日记', () => {
      // 清空 memory 目录中的日记文件
      const memoryDir = path.join(TEST_DIR, 'memory');
      const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
      files.forEach(f => fs.unlinkSync(path.join(memoryDir, f)));
      
      const list = memory.listDailyNotes();
      expect(list).toBe('暂无日记');
    });

    it('应该能读取最近几天的日记', () => {
      memory.writeDailyNote('今天的内容');
      const recent = memory.readRecentNotes(3);
      expect(recent).toContain('今天的内容');
    });
  });

  describe('长期记忆层 (Long-term Memory)', () => {
    it('读取不存在的长期记忆应返回提示', () => {
      const result = memory.readLongTermMemory();
      expect(result).toContain('长期记忆为空');
    });

    it('应该能更新长期记忆', () => {
      const content = '# 测试记忆\n\n这是测试内容';
      memory.updateLongTermMemory(content);
      const result = memory.readLongTermMemory();
      expect(result).toBe(content);
    });

    it('应该能追加到新分类', () => {
      memory.appendLongTermMemory('测试分类', '测试条目');
      const content = memory.readLongTermMemory();
      expect(content).toContain('## 测试分类');
      expect(content).toContain('- 测试条目');
    });

    it('应该能追加到已有分类', () => {
      memory.appendLongTermMemory('经验教训', '第一条经验');
      memory.appendLongTermMemory('经验教训', '第二条经验');
      const content = memory.readLongTermMemory();
      expect(content).toContain('第一条经验');
      expect(content).toContain('第二条经验');
    });
  });

  describe('跨层搜索 (Search All)', () => {
    it('应该能搜索长期记忆', () => {
      memory.updateLongTermMemory('# 记忆\n\n关键词测试');
      const result = memory.searchAllMemory('关键词');
      expect(result).toContain('MEMORY.md');
    });

    it('应该能搜索日记', () => {
      memory.writeDailyNote('特殊搜索词ABC');
      const result = memory.searchAllMemory('ABC');
      expect(result).toContain(new Date().toISOString().split('T')[0]);
    });

    it('搜索不存在的内容应返回提示', () => {
      const result = memory.searchAllMemory('不存在的内容xyz123');
      expect(result).toBe('未找到相关记忆');
    });
  });

  describe('时间上下文 (Time Context)', () => {
    it('应该返回正确格式的时间上下文', () => {
      const context = memory.getTimeContext();
      expect(context).toMatch(/今天是 \d{4}-\d{2}-\d{2} 星期[日一二三四五六]/);
      expect(context).toMatch(/现在是(凌晨|上午|中午|下午|晚上|深夜)/);
    });
  });
});
