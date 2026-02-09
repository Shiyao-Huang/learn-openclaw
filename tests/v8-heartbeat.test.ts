/**
 * V8 心跳系统测试
 * 测试 HeartbeatSystem 类的核心功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(process.cwd(), '.test-workspace-v8');

interface HeartbeatState {
  lastChecks: Record<string, number>;
  lastHeartbeat: number;
}

// 从 v8-agent.ts 提取的 HeartbeatSystem 类
class HeartbeatSystem {
  private workspaceDir: string;
  private heartbeatFile: string;
  private stateFile: string;
  private state: HeartbeatState;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.heartbeatFile = path.join(workspaceDir, "HEARTBEAT.md");
    this.stateFile = path.join(workspaceDir, "memory", "heartbeat-state.json");
    this.state = this.loadState();
  }

  private loadState(): HeartbeatState {
    if (fs.existsSync(this.stateFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.stateFile, "utf-8"));
      } catch (e) { /* 文件损坏，重新创建 */ }
    }
    return { lastChecks: {}, lastHeartbeat: 0 };
  }

  private saveState() {
    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  getChecklist(): string {
    if (!fs.existsSync(this.heartbeatFile)) {
      return "HEARTBEAT.md 不存在（这是正常的，可以创建一个来定义检查清单）";
    }
    return fs.readFileSync(this.heartbeatFile, "utf-8");
  }

  updateChecklist(content: string): string {
    fs.writeFileSync(this.heartbeatFile, content, "utf-8");
    return "HEARTBEAT.md 已更新";
  }

  recordCheck(checkName: string): string {
    this.state.lastChecks[checkName] = Date.now();
    this.state.lastHeartbeat = Date.now();
    this.saveState();
    return `已记录检查: ${checkName}`;
  }

  getStatus(): string {
    const lines = [`上次心跳: ${this.state.lastHeartbeat ? new Date(this.state.lastHeartbeat).toLocaleString("zh-CN") : "从未"}`];
    for (const [name, time] of Object.entries(this.state.lastChecks)) {
      const ago = Math.floor((Date.now() - time) / 60000);
      lines.push(`- ${name}: ${ago} 分钟前`);
    }
    return lines.join("\n");
  }

  shouldDisturb(): boolean {
    const hour = new Date().getHours();
    return !(hour >= 23 || hour < 8);
  }

  needsCheck(checkName: string, intervalMinutes: number = 30): boolean {
    const lastTime = this.state.lastChecks[checkName] || 0;
    return (Date.now() - lastTime) / 60000 >= intervalMinutes;
  }

  runHeartbeat(): string {
    if (!this.shouldDisturb()) {
      return "HEARTBEAT_OK (深夜静默)";
    }
    const checklist = this.getChecklist();
    if (checklist.includes("不存在")) {
      return "HEARTBEAT_OK (无检查清单)";
    }
    this.state.lastHeartbeat = Date.now();
    this.saveState();
    return `心跳触发，请检查 HEARTBEAT.md 中的事项。如果没有需要处理的，回复 HEARTBEAT_OK`;
  }

  // 暴露内部状态用于测试
  getState(): HeartbeatState {
    return this.state;
  }
}

describe('V8 HeartbeatSystem - 心跳系统', () => {
  let heartbeat: HeartbeatSystem;

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    heartbeat = new HeartbeatSystem(TEST_DIR);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('检查清单管理', () => {
    it('不存在清单时应返回提示', () => {
      const result = heartbeat.getChecklist();
      expect(result).toContain('不存在');
    });

    it('应该能创建和读取清单', () => {
      const content = '# HEARTBEAT\n- [ ] 检查邮件\n- [ ] 检查日历';
      heartbeat.updateChecklist(content);
      const result = heartbeat.getChecklist();
      expect(result).toBe(content);
    });

    it('应该能更新清单', () => {
      heartbeat.updateChecklist('旧内容');
      heartbeat.updateChecklist('新内容');
      expect(heartbeat.getChecklist()).toBe('新内容');
    });
  });

  describe('检查记录', () => {
    it('应该能记录检查时间', () => {
      const result = heartbeat.recordCheck('邮件检查');
      expect(result).toContain('已记录检查');
      expect(result).toContain('邮件检查');
    });

    it('记录检查后状态应更新', () => {
      heartbeat.recordCheck('测试检查');
      const state = heartbeat.getState();
      expect(state.lastChecks['测试检查']).toBeDefined();
      expect(state.lastHeartbeat).toBeGreaterThan(0);
    });

    it('应该能获取检查状态', () => {
      heartbeat.recordCheck('检查A');
      heartbeat.recordCheck('检查B');
      const status = heartbeat.getStatus();
      expect(status).toContain('检查A');
      expect(status).toContain('检查B');
      expect(status).toContain('分钟前');
    });
  });

  describe('检查间隔判断', () => {
    it('新检查项应该需要检查', () => {
      expect(heartbeat.needsCheck('新项目')).toBe(true);
    });

    it('刚检查过的项目不需要立即再检查', () => {
      heartbeat.recordCheck('测试项');
      expect(heartbeat.needsCheck('测试项', 30)).toBe(false);
    });

    it('超过间隔时间后应该需要检查', () => {
      // 模拟 31 分钟前的检查
      const state = heartbeat.getState();
      state.lastChecks['旧项目'] = Date.now() - 31 * 60 * 1000;
      expect(heartbeat.needsCheck('旧项目', 30)).toBe(true);
    });
  });

  describe('深夜静默模式', () => {
    it('深夜时间 (23:00-08:00) 不应打扰', () => {
      // 模拟凌晨 3 点
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-09T03:00:00'));
      
      const newHeartbeat = new HeartbeatSystem(TEST_DIR);
      expect(newHeartbeat.shouldDisturb()).toBe(false);
    });

    it('白天时间应该可以打扰', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-09T14:00:00'));
      
      const newHeartbeat = new HeartbeatSystem(TEST_DIR);
      expect(newHeartbeat.shouldDisturb()).toBe(true);
    });
  });

  describe('心跳执行', () => {
    it('无清单时应返回 HEARTBEAT_OK', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-09T14:00:00'));
      
      const newHeartbeat = new HeartbeatSystem(TEST_DIR);
      const result = newHeartbeat.runHeartbeat();
      expect(result).toContain('HEARTBEAT_OK');
      expect(result).toContain('无检查清单');
    });

    it('深夜时应返回静默状态', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-09T02:00:00'));
      
      const newHeartbeat = new HeartbeatSystem(TEST_DIR);
      newHeartbeat.updateChecklist('# 清单\n- 测试');
      const result = newHeartbeat.runHeartbeat();
      expect(result).toContain('HEARTBEAT_OK');
      expect(result).toContain('深夜静默');
    });

    it('有清单且非深夜时应触发心跳', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-09T14:00:00'));
      
      const newHeartbeat = new HeartbeatSystem(TEST_DIR);
      newHeartbeat.updateChecklist('# 清单\n- 检查邮件');
      const result = newHeartbeat.runHeartbeat();
      expect(result).toContain('心跳触发');
      expect(result).toContain('HEARTBEAT.md');
    });
  });

  describe('状态持久化', () => {
    it('状态应该持久化到文件', () => {
      heartbeat.recordCheck('持久化测试');
      
      // 创建新实例，应该能读取之前的状态
      const newHeartbeat = new HeartbeatSystem(TEST_DIR);
      const state = newHeartbeat.getState();
      expect(state.lastChecks['持久化测试']).toBeDefined();
    });
  });
});
