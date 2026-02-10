/**
 * v11-agent/session/manager.ts - 会话管理系统
 * 
 * 支持多会话隔离，每个渠道/用户独立上下文
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type Anthropic from "@anthropic-ai/sdk";
import type { Session, SessionType } from "../core/types.js";

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionDir: string;
  private maxAge: number = 7 * 24 * 60 * 60 * 1000; // 7天过期

  constructor(workDir: string) {
    this.sessionDir = path.join(workDir, ".sessions");
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
    this.loadAllSync();
  }

  // 同步加载所有持久化的会话（仅用于构造函数）
  private loadAllSync(): void {
    if (!fs.existsSync(this.sessionDir)) return;

    const files = fs.readdirSync(this.sessionDir)
      .filter(f => f.endsWith(".json"));

    for (const file of files) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(this.sessionDir, file), "utf-8")
        );
        const session: Session = {
          key: data.key,
          type: data.type || 'main',
          history: data.history || [],
          createdAt: data.createdAt || Date.now(),
          lastActiveAt: data.lastActiveAt || Date.now(),
          metadata: data.metadata,
        };
        this.sessions.set(session.key, session);
      } catch (e) {
        console.log(`\x1b[33m警告: 无法加载会话 ${file}\x1b[0m`);
      }
    }
  }

  // 异步加载所有持久化的会话
  async loadAll(): Promise<void> {
    if (!fs.existsSync(this.sessionDir)) return;

    const files = (await fsp.readdir(this.sessionDir))
      .filter(f => f.endsWith(".json"));

    for (const file of files) {
      try {
        const data = JSON.parse(
          await fsp.readFile(path.join(this.sessionDir, file), "utf-8")
        );
        const session: Session = {
          key: data.key,
          type: data.type || 'main',
          history: data.history || [],
          createdAt: data.createdAt || Date.now(),
          lastActiveAt: data.lastActiveAt || Date.now(),
          metadata: data.metadata,
        };
        this.sessions.set(session.key, session);
      } catch (e) {
        console.log(`\x1b[33m警告: 无法加载会话 ${file}\x1b[0m`);
      }
    }
  }

  // 保存会话到磁盘
  private async save(session: Session): Promise<void> {
    const filePath = path.join(
      this.sessionDir,
      `${this.sanitizeKey(session.key)}.json`
    );
    await fsp.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  // 清理 key 中的特殊字符
  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  // 创建新会话
  create(key: string, type: SessionType = 'main'): Session {
    const session: Session = {
      key,
      type,
      history: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    this.sessions.set(key, session);
    this.save(session).catch(e => console.error(`保存会话失败: ${e.message}`));
    return session;
  }

  // 获取会话（不存在则返回 undefined）
  get(key: string): Session | undefined {
    const session = this.sessions.get(key);
    if (session) {
      session.lastActiveAt = Date.now();
    }
    return session;
  }

  // 获取或创建会话
  getOrCreate(key: string, type: SessionType = 'main'): Session {
    let session = this.get(key);
    if (!session) {
      session = this.create(key, type);
    }
    return session;
  }

  // 更新会话历史
  updateHistory(key: string, history: Anthropic.MessageParam[]): void {
    const session = this.sessions.get(key);
    if (session) {
      session.history = history;
      session.lastActiveAt = Date.now();
      this.save(session).catch(e => console.error(`保存会话失败: ${e.message}`));
    }
  }

  // 追加消息到历史
  appendMessage(key: string, message: Anthropic.MessageParam): void {
    const session = this.sessions.get(key);
    if (session) {
      session.history.push(message);
      session.lastActiveAt = Date.now();
      this.save(session).catch(e => console.error(`保存会话失败: ${e.message}`));
    }
  }

  // 删除会话
  async delete(key: string): Promise<boolean> {
    const session = this.sessions.get(key);
    if (session) {
      this.sessions.delete(key);
      const filePath = path.join(
        this.sessionDir,
        `${this.sanitizeKey(key)}.json`
      );
      if (fs.existsSync(filePath)) {
        await fsp.unlink(filePath);
      }
      return true;
    }
    return false;
  }

  // 列出所有会话
  list(): Session[] {
    return Array.from(this.sessions.values());
  }

  // 清理过期会话
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, session] of this.sessions) {
      if (now - session.lastActiveAt > this.maxAge) {
        await this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  // 获取会话统计
  stats(): string {
    const total = this.sessions.size;
    const main = Array.from(this.sessions.values()).filter(s => s.type === 'main').length;
    const isolated = total - main;
    return `会话: ${total} (主: ${main}, 隔离: ${isolated})`;
  }

  // 设置会话元数据
  setMetadata(key: string, metadata: Record<string, any>): void {
    const session = this.sessions.get(key);
    if (session) {
      session.metadata = { ...session.metadata, ...metadata };
      this.save(session).catch(e => console.error(`保存会话失败: ${e.message}`));
    }
  }

  // 获取会话元数据
  getMetadata(key: string): Record<string, any> | undefined {
    return this.sessions.get(key)?.metadata;
  }
}

export default SessionManager;
