/**
 * V9 会话管理系统测试
 * 测试 SessionManager 类的核心功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(process.cwd(), '.test-workspace-v9');

type SessionType = "main" | "isolated";

interface MessageParam {
  role: "user" | "assistant";
  content: string;
}

interface Session {
  key: string;
  type: SessionType;
  history: MessageParam[];
  createdAt: number;
  lastActiveAt: number;
  metadata: Record<string, any>;
}

// 从 v9-agent.ts 提取的 SessionManager 类
class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionsDir: string;

  constructor(workspaceDir: string) {
    this.sessionsDir = path.join(workspaceDir, ".sessions");
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    this.loadSessions();
  }

  private loadSessions() {
    const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.sessionsDir, file), "utf-8"));
        this.sessions.set(data.key, data);
      } catch (e) { /* 忽略损坏的会话文件 */ }
    }
  }

  private saveSession(session: Session) {
    const filePath = path.join(this.sessionsDir, `${session.key}.json`);
    const toSave = { ...session, history: session.history.slice(-20) };
    fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2));
  }

  private generateKey(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  createSession(type: SessionType = "main", metadata: Record<string, any> = {}): Session {
    const session: Session = {
      key: this.generateKey(),
      type,
      history: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      metadata
    };
    this.sessions.set(session.key, session);
    this.saveSession(session);
    return session;
  }

  getSession(key: string): Session | undefined {
    const session = this.sessions.get(key);
    if (session) session.lastActiveAt = Date.now();
    return session;
  }

  getOrCreateSession(key?: string, type: SessionType = "main"): Session {
    if (key) {
      const existing = this.getSession(key);
      if (existing) return existing;
    }
    return this.createSession(type);
  }

  updateHistory(key: string, history: MessageParam[]) {
    const session = this.sessions.get(key);
    if (session) {
      session.history = history;
      session.lastActiveAt = Date.now();
      this.saveSession(session);
    }
  }

  listSessions(): string {
    const sessions = Array.from(this.sessions.values())
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    if (sessions.length === 0) return "暂无会话";
    return sessions.slice(0, 10).map(s => {
      const ago = Math.floor((Date.now() - s.lastActiveAt) / 60000);
      return `- ${s.key} [${s.type}] (${ago}分钟前, ${s.history.length}条消息)`;
    }).join("\n");
  }

  deleteSession(key: string): string {
    if (!this.sessions.has(key)) return `会话 ${key} 不存在`;
    this.sessions.delete(key);
    const filePath = path.join(this.sessionsDir, `${key}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return `已删除会话 ${key}`;
  }

  cleanupSessions(): string {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let cleaned = 0;
    for (const [key, session] of this.sessions) {
      if (session.lastActiveAt < cutoff) {
        this.deleteSession(key);
        cleaned++;
      }
    }
    return `已清理 ${cleaned} 个过期会话`;
  }

  isMainSession(key: string): boolean {
    return this.sessions.get(key)?.type === "main";
  }

  // 暴露内部数据用于测试
  getSessionCount(): number {
    return this.sessions.size;
  }
}

describe('V9 SessionManager - 会话管理系统', () => {
  let manager: SessionManager;

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    manager = new SessionManager(TEST_DIR);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('会话创建', () => {
    it('应该能创建主会话', () => {
      const session = manager.createSession('main');
      expect(session.key).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(session.type).toBe('main');
      expect(session.history).toEqual([]);
    });

    it('应该能创建隔离会话', () => {
      const session = manager.createSession('isolated');
      expect(session.type).toBe('isolated');
    });

    it('应该能带元数据创建会话', () => {
      const metadata = { source: 'discord', channel: '123' };
      const session = manager.createSession('isolated', metadata);
      expect(session.metadata).toEqual(metadata);
    });

    it('每个会话应有唯一 key', () => {
      const s1 = manager.createSession();
      const s2 = manager.createSession();
      expect(s1.key).not.toBe(s2.key);
    });
  });

  describe('会话获取', () => {
    it('应该能获取已存在的会话', () => {
      const created = manager.createSession();
      const retrieved = manager.getSession(created.key);
      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe(created.key);
    });

    it('获取不存在的会话应返回 undefined', () => {
      const result = manager.getSession('nonexistent_key');
      expect(result).toBeUndefined();
    });

    it('getOrCreateSession 应返回已存在的会话', () => {
      const created = manager.createSession();
      const retrieved = manager.getOrCreateSession(created.key);
      expect(retrieved.key).toBe(created.key);
    });

    it('getOrCreateSession 无 key 时应创建新会话', () => {
      const session = manager.getOrCreateSession();
      expect(session).toBeDefined();
      expect(session.key).toMatch(/^session_/);
    });
  });

  describe('会话历史', () => {
    it('应该能更新会话历史', () => {
      const session = manager.createSession();
      const history: MessageParam[] = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！' }
      ];
      manager.updateHistory(session.key, history);
      
      const updated = manager.getSession(session.key);
      expect(updated?.history).toHaveLength(2);
    });

    it('保存时应只保留最近 20 条消息', () => {
      const session = manager.createSession();
      const history: MessageParam[] = Array(30).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i}`
      }));
      manager.updateHistory(session.key, history);
      
      // 重新加载验证持久化
      const newManager = new SessionManager(TEST_DIR);
      const loaded = newManager.getSession(session.key);
      expect(loaded?.history.length).toBeLessThanOrEqual(20);
    });
  });

  describe('会话列表', () => {
    it('空时应返回暂无会话', () => {
      expect(manager.listSessions()).toBe('暂无会话');
    });

    it('应该能列出所有会话', () => {
      manager.createSession('main');
      manager.createSession('isolated');
      const list = manager.listSessions();
      expect(list).toContain('[main]');
      expect(list).toContain('[isolated]');
    });

    it('列表应按最近活跃排序', () => {
      const s1 = manager.createSession();
      const s2 = manager.createSession();
      // s2 更新后应该排在前面
      manager.updateHistory(s2.key, [{ role: 'user', content: 'test' }]);
      
      const list = manager.listSessions();
      const s1Index = list.indexOf(s1.key);
      const s2Index = list.indexOf(s2.key);
      expect(s2Index).toBeLessThan(s1Index);
    });
  });

  describe('会话删除', () => {
    it('应该能删除会话', () => {
      const session = manager.createSession();
      const result = manager.deleteSession(session.key);
      expect(result).toContain('已删除');
      expect(manager.getSession(session.key)).toBeUndefined();
    });

    it('删除不存在的会话应返回提示', () => {
      const result = manager.deleteSession('nonexistent');
      expect(result).toContain('不存在');
    });

    it('删除应同时删除文件', () => {
      const session = manager.createSession();
      const filePath = path.join(TEST_DIR, '.sessions', `${session.key}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
      
      manager.deleteSession(session.key);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('会话清理', () => {
    it('应该清理 7 天前的会话', () => {
      // 创建一个"旧"会话
      const session = manager.createSession();
      // 手动修改 lastActiveAt 为 8 天前
      const filePath = path.join(TEST_DIR, '.sessions', `${session.key}.json`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      data.lastActiveAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      fs.writeFileSync(filePath, JSON.stringify(data));
      
      // 重新加载并清理
      const newManager = new SessionManager(TEST_DIR);
      const result = newManager.cleanupSessions();
      expect(result).toContain('已清理 1 个');
    });

    it('不应清理活跃的会话', () => {
      manager.createSession();
      manager.createSession();
      const result = manager.cleanupSessions();
      expect(result).toContain('已清理 0 个');
      expect(manager.getSessionCount()).toBe(2);
    });
  });

  describe('会话类型判断', () => {
    it('应该正确判断主会话', () => {
      const main = manager.createSession('main');
      const isolated = manager.createSession('isolated');
      
      expect(manager.isMainSession(main.key)).toBe(true);
      expect(manager.isMainSession(isolated.key)).toBe(false);
    });
  });

  describe('持久化', () => {
    it('会话应该持久化到文件', () => {
      const session = manager.createSession('main', { test: true });
      
      // 创建新实例验证持久化
      const newManager = new SessionManager(TEST_DIR);
      const loaded = newManager.getSession(session.key);
      expect(loaded).toBeDefined();
      expect(loaded?.type).toBe('main');
      expect(loaded?.metadata.test).toBe(true);
    });
  });
});
