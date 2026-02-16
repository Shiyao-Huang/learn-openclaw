/**
 * V31 - 投票引擎
 * 
 * 投票系统核心，管理投票的创建、投票、统计等
 */

import { randomUUID } from "crypto";
import {
  Poll,
  PollConfig,
  PollOption,
  PollResult,
  PollFilter,
  PollStats,
  PollEngineConfig,
  UserVote,
} from "./types.js";

/**
 * 投票引擎
 */
export class PollEngine {
  private polls: Map<string, Poll> = new Map();
  private votes: Map<string, UserVote[]> = new Map(); // pollId -> UserVote[]
  private config: Required<Omit<PollEngineConfig, "storagePath">> & { storagePath?: string };

  constructor(config: PollEngineConfig = {}) {
    this.config = {
      maxOptions: config.maxOptions ?? 10,
      maxQuestionLength: config.maxQuestionLength ?? 200,
      maxOptionLength: config.maxOptionLength ?? 100,
      defaultDurationHours: config.defaultDurationHours ?? 24,
      maxDurationHours: config.maxDurationHours ?? 168,
      storagePath: config.storagePath,
    };
  }

  /**
   * 创建投票
   */
  createPoll(config: PollConfig, creator: string): Poll {
    // 验证问题
    const question = config.question.trim();
    if (!question) {
      throw new Error("投票问题不能为空");
    }
    if (question.length > this.config.maxQuestionLength) {
      throw new Error(`问题长度不能超过 ${this.config.maxQuestionLength} 字符`);
    }

    // 验证选项
    const options = config.options
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);

    if (options.length < 2) {
      throw new Error("至少需要 2 个选项");
    }
    if (options.length > this.config.maxOptions) {
      throw new Error(`最多支持 ${this.config.maxOptions} 个选项`);
    }

    options.forEach((opt, i) => {
      if (opt.length > this.config.maxOptionLength) {
        throw new Error(`选项 ${i + 1} 长度不能超过 ${this.config.maxOptionLength} 字符`);
      }
    });

    // 验证最大选择数
    const maxSelections = config.maxSelections ?? 1;
    if (maxSelections < 1) {
      throw new Error("最大选择数至少为 1");
    }
    if (maxSelections > options.length) {
      throw new Error("最大选择数不能超过选项数量");
    }

    // 计算截止时间
    let deadline: number | undefined;
    const durationHours = config.durationHours ?? this.config.defaultDurationHours;
    if (durationHours > 0) {
      if (durationHours > this.config.maxDurationHours) {
        throw new Error(`持续时间不能超过 ${this.config.maxDurationHours} 小时`);
      }
      deadline = Date.now() + durationHours * 60 * 60 * 1000;
    }

    // 创建投票选项
    const pollOptions: PollOption[] = options.map((text, index) => ({
      id: `opt_${index}`,
      text,
      votes: 0,
      voters: [],
    }));

    // 创建投票
    const poll: Poll = {
      id: `poll_${randomUUID().slice(0, 8)}`,
      question,
      options: pollOptions,
      maxSelections,
      deadline,
      anonymous: config.anonymous ?? false,
      allowChange: config.allowChange ?? true,
      status: "active",
      creator,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalVotes: 0,
      participantCount: 0,
      tags: [],
    };

    this.polls.set(poll.id, poll);
    this.votes.set(poll.id, []);

    return poll;
  }

  /**
   * 投票
   */
  vote(pollId: string, userId: string, optionIds: string[]): UserVote {
    const poll = this.polls.get(pollId);
    if (!poll) {
      throw new Error("投票不存在");
    }

    if (poll.status !== "active") {
      throw new Error("投票已结束");
    }

    if (poll.deadline && Date.now() > poll.deadline) {
      // 自动关闭过期投票
      poll.status = "closed";
      throw new Error("投票已过期");
    }

    // 验证选项
    if (!optionIds || optionIds.length === 0) {
      throw new Error("请选择至少一个选项");
    }

    if (optionIds.length > poll.maxSelections) {
      throw new Error(`最多可选 ${poll.maxSelections} 个选项`);
    }

    const validOptionIds = new Set(poll.options.map((opt) => opt.id));
    for (const optId of optionIds) {
      if (!validOptionIds.has(optId)) {
        throw new Error(`无效选项: ${optId}`);
      }
    }

    // 检查是否已投票
    const pollVotes = this.votes.get(pollId) || [];
    const existingVote = pollVotes.find((v) => v.userId === userId);

    if (existingVote) {
      if (!poll.allowChange) {
        throw new Error("此投票不允许修改");
      }

      // 取消之前的投票
      for (const oldOptId of existingVote.optionIds) {
        const option = poll.options.find((opt) => opt.id === oldOptId);
        if (option) {
          option.votes--;
          option.voters = option.voters.filter((v) => v !== userId);
        }
      }

      // 更新投票
      existingVote.optionIds = optionIds;
      existingVote.votedAt = Date.now();
      existingVote.modified = true;
    } else {
      // 新投票
      const newVote: UserVote = {
        pollId,
        userId,
        optionIds,
        votedAt: Date.now(),
        modified: false,
      };
      pollVotes.push(newVote);
      poll.participantCount++;
    }

    // 记录新投票
    for (const optId of optionIds) {
      const option = poll.options.find((opt) => opt.id === optId);
      if (option) {
        option.votes++;
        if (!poll.anonymous) {
          option.voters.push(userId);
        }
      }
    }

    poll.totalVotes += existingVote ? 0 : optionIds.length;
    poll.updatedAt = Date.now();

    return existingVote || pollVotes[pollVotes.length - 1];
  }

  /**
   * 获取投票
   */
  getPoll(pollId: string): Poll | undefined {
    return this.polls.get(pollId);
  }

  /**
   * 获取投票结果
   */
  getResult(pollId: string): PollResult {
    const poll = this.polls.get(pollId);
    if (!poll) {
      throw new Error("投票不存在");
    }

    const results = poll.options.map((opt) => ({
      optionId: opt.id,
      text: opt.text,
      votes: opt.votes,
      percentage: poll.totalVotes > 0 ? (opt.votes / poll.totalVotes) * 100 : 0,
      voters: poll.anonymous ? undefined : opt.voters,
    }));

    // 排序 (票数降序)
    results.sort((a, b) => b.votes - a.votes);

    // 找出获胜者
    let winners: string[] = [];
    let isTie = false;

    if (results.length > 0 && results[0].votes > 0) {
      const maxVotes = results[0].votes;
      winners = results.filter((r) => r.votes === maxVotes).map((r) => r.optionId);
      isTie = winners.length > 1;
    }

    return {
      pollId: poll.id,
      question: poll.question,
      totalVotes: poll.totalVotes,
      participantCount: poll.participantCount,
      results,
      winners: winners.length > 0 ? winners : undefined,
      isTie,
      status: poll.status,
    };
  }

  /**
   * 关闭投票
   */
  closePoll(pollId: string, requester: string): Poll {
    const poll = this.polls.get(pollId);
    if (!poll) {
      throw new Error("投票不存在");
    }

    if (poll.status !== "active") {
      throw new Error("投票已结束");
    }

    // 只有创建者可以关闭
    if (poll.creator !== requester) {
      throw new Error("只有创建者可以关闭投票");
    }

    poll.status = "closed";
    poll.updatedAt = Date.now();

    return poll;
  }

  /**
   * 取消投票
   */
  cancelPoll(pollId: string, requester: string): Poll {
    const poll = this.polls.get(pollId);
    if (!poll) {
      throw new Error("投票不存在");
    }

    if (poll.status !== "active") {
      throw new Error("投票已结束");
    }

    // 只有创建者可以取消
    if (poll.creator !== requester) {
      throw new Error("只有创建者可以取消投票");
    }

    poll.status = "cancelled";
    poll.updatedAt = Date.now();

    return poll;
  }

  /**
   * 列出投票
   */
  listPolls(filter?: PollFilter): Poll[] {
    let polls = Array.from(this.polls.values());

    if (filter) {
      if (filter.status) {
        polls = polls.filter((p) => p.status === filter.status);
      }
      if (filter.creator) {
        polls = polls.filter((p) => p.creator === filter.creator);
      }
      if (filter.createdAfter) {
        polls = polls.filter((p) => p.createdAt >= filter.createdAfter!);
      }
      if (filter.createdBefore) {
        polls = polls.filter((p) => p.createdAt <= filter.createdBefore!);
      }
      if (filter.tags && filter.tags.length > 0) {
        polls = polls.filter((p) =>
          filter.tags!.some((tag) => p.tags?.includes(tag))
        );
      }
    }

    // 按创建时间降序
    polls.sort((a, b) => b.createdAt - a.createdAt);

    return polls;
  }

  /**
   * 获取统计
   */
  getStats(): PollStats {
    const polls = Array.from(this.polls.values());

    const activePolls = polls.filter((p) => p.status === "active");
    const closedPolls = polls.filter((p) => p.status === "closed");
    const totalParticipations = polls.reduce((sum, p) => sum + p.participantCount, 0);

    return {
      totalPolls: polls.length,
      activePolls: activePolls.length,
      closedPolls: closedPolls.length,
      totalParticipations,
      avgParticipants: polls.length > 0 ? totalParticipations / polls.length : 0,
    };
  }

  /**
   * 删除投票
   */
  deletePoll(pollId: string): boolean {
    const poll = this.polls.get(pollId);
    if (!poll) {
      return false;
    }

    this.polls.delete(pollId);
    this.votes.delete(pollId);
    return true;
  }

  /**
   * 清空所有投票
   */
  clear(): void {
    this.polls.clear();
    this.votes.clear();
  }

  /**
   * 检查并关闭过期投票
   */
  checkExpired(): number {
    const now = Date.now();
    let closedCount = 0;

    for (const poll of this.polls.values()) {
      if (poll.status === "active" && poll.deadline && now > poll.deadline) {
        poll.status = "closed";
        poll.updatedAt = now;
        closedCount++;
      }
    }

    return closedCount;
  }
}

// 单例实例
let engineInstance: PollEngine | null = null;

export function getPollEngine(config?: PollEngineConfig): PollEngine {
  if (!engineInstance) {
    engineInstance = new PollEngine(config);
  }
  return engineInstance;
}

export function closePollEngine(): void {
  if (engineInstance) {
    engineInstance.clear();
    engineInstance = null;
  }
}
