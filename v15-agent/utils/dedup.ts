/**
 * v11-agent/utils/dedup.ts - 统一消息去重模块
 *
 * 功能：
 * - 消息去重：防止重复处理同一消息
 * - 并发锁：防止同一消息被并发处理
 */

import type { MessageContext } from "../channel/types.js";

export interface DedupOptions {
  /** 去重 TTL（毫秒），默认 60000 */
  ttl?: number;
  /** 清理间隔（毫秒），默认 ttl * 2 */
  cleanupInterval?: number;
}

/**
 * 消息去重器
 *
 * 合并了两种去重策略：
 * 1. 已处理消息记录（防止重复处理）
 * 2. 处理中锁（防止并发处理）
 */
export class MessageDeduplicator {
  private processed = new Set<string>();
  private processing = new Set<string>();
  private ttl: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: DedupOptions = {}) {
    this.ttl = options.ttl ?? 60000;
    const cleanupInterval = options.cleanupInterval ?? this.ttl * 2;

    // 定期清理已处理记录
    this.cleanupTimer = setInterval(() => {
      this.processed.clear();
    }, cleanupInterval);
  }

  /**
   * 生成消息唯一 key
   */
  static generateKey(ctx: MessageContext): string {
    return ctx.messageId || `${ctx.channel}:${ctx.chatId}:${ctx.text}:${ctx.timestamp}`;
  }

  /**
   * 检查消息是否可以处理
   *
   * @returns true 如果消息可以处理，false 如果应该跳过
   */
  canProcess(key: string): boolean {
    // 已处理过
    if (this.processed.has(key)) {
      return false;
    }
    // 正在处理中
    if (this.processing.has(key)) {
      return false;
    }
    return true;
  }

  /**
   * 标记消息开始处理
   *
   * @returns true 如果成功获取锁，false 如果消息已在处理或已处理过
   */
  acquire(key: string): boolean {
    if (!this.canProcess(key)) {
      return false;
    }
    this.processing.add(key);
    this.processed.add(key);
    return true;
  }

  /**
   * 标记消息处理完成，释放锁
   */
  release(key: string): void {
    this.processing.delete(key);
  }

  /**
   * 检查消息是否已处理过
   */
  isProcessed(key: string): boolean {
    return this.processed.has(key);
  }

  /**
   * 检查消息是否正在处理
   */
  isProcessing(key: string): boolean {
    return this.processing.has(key);
  }

  /**
   * 获取统计信息
   */
  stats(): { processed: number; processing: number } {
    return {
      processed: this.processed.size,
      processing: this.processing.size,
    };
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.processed.clear();
    this.processing.clear();
  }
}
