/**
 * V31 - 投票系统工具处理器
 */

import { PollEngine, getPollEngine, closePollEngine } from "./engine.js";
import type { ToolHandler } from "../../v10-agent/types.js";
import { PollEngineConfig } from "./types.js";

// 默认用户 ID (用于简化测试)
const DEFAULT_USER = "user_default";

/**
 * 创建投票处理器
 */
export const pollCreateHandler: ToolHandler = async (args: Record<string, unknown>) => {
  const engine = getPollEngine();
  
  try {
    const poll = engine.createPoll(
      {
        question: args.question as string,
        options: args.options as string[],
        maxSelections: args.maxSelections as number | undefined,
        durationHours: args.durationHours as number | undefined,
        anonymous: args.anonymous as boolean | undefined,
        allowChange: args.allowChange as boolean | undefined,
      },
      DEFAULT_USER // 简化：使用默认用户作为创建者
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              poll: {
                id: poll.id,
                question: poll.question,
                options: poll.options.map((opt) => ({
                  id: opt.id,
                  text: opt.text,
                })),
                maxSelections: poll.maxSelections,
                deadline: poll.deadline,
                anonymous: poll.anonymous,
                allowChange: poll.allowChange,
                status: poll.status,
                createdAt: poll.createdAt,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 投票处理器
 */
export const pollVoteHandler: ToolHandler = async (args: Record<string, unknown>) => {
  const engine = getPollEngine();

  try {
    const vote = engine.vote(
      args.pollId as string,
      DEFAULT_USER, // 简化：使用默认用户
      args.optionIds as string[]
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            vote: {
              pollId: vote.pollId,
              optionIds: vote.optionIds,
              votedAt: vote.votedAt,
              modified: vote.modified,
            },
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 获取投票处理器
 */
export const pollGetHandler: ToolHandler = async (args: Record<string, unknown>) => {
  const engine = getPollEngine();

  try {
    const poll = engine.getPoll(args.pollId as string);

    if (!poll) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "投票不存在",
            }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              poll: {
                id: poll.id,
                question: poll.question,
                options: poll.options.map((opt) => ({
                  id: opt.id,
                  text: opt.text,
                  votes: opt.votes,
                  voters: poll.anonymous ? undefined : opt.voters,
                })),
                maxSelections: poll.maxSelections,
                deadline: poll.deadline,
                anonymous: poll.anonymous,
                allowChange: poll.allowChange,
                status: poll.status,
                creator: poll.creator,
                totalVotes: poll.totalVotes,
                participantCount: poll.participantCount,
                createdAt: poll.createdAt,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 获取结果处理器
 */
export const pollResultHandler: ToolHandler = async (args: Record<string, unknown>) => {
  const engine = getPollEngine();

  try {
    const result = engine.getResult(args.pollId as string);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              result: {
                pollId: result.pollId,
                question: result.question,
                totalVotes: result.totalVotes,
                participantCount: result.participantCount,
                results: result.results.map((r) => ({
                  optionId: r.optionId,
                  text: r.text,
                  votes: r.votes,
                  percentage: Math.round(r.percentage * 100) / 100,
                  voters: r.voters,
                })),
                winners: result.winners,
                isTie: result.isTie,
                status: result.status,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 关闭投票处理器
 */
export const pollCloseHandler: ToolHandler = async (args: Record<string, unknown>) => {
  const engine = getPollEngine();

  try {
    const poll = engine.closePoll(args.pollId as string, DEFAULT_USER);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            poll: {
              id: poll.id,
              status: poll.status,
              updatedAt: poll.updatedAt,
            },
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 取消投票处理器
 */
export const pollCancelHandler: ToolHandler = async (args: Record<string, unknown>) => {
  const engine = getPollEngine();

  try {
    const poll = engine.cancelPoll(args.pollId as string, DEFAULT_USER);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            poll: {
              id: poll.id,
              status: poll.status,
              updatedAt: poll.updatedAt,
            },
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 列出投票处理器
 */
export const pollListHandler: ToolHandler = async (args: Record<string, unknown>) => {
  const engine = getPollEngine();

  try {
    const filter = {
      status: args.status as "active" | "closed" | "cancelled" | undefined,
      creator: args.creator as string | undefined,
    };

    let polls = engine.listPolls(filter);
    const limit = (args.limit as number) ?? 20;
    polls = polls.slice(0, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              count: polls.length,
              polls: polls.map((p) => ({
                id: p.id,
                question: p.question,
                status: p.status,
                participantCount: p.participantCount,
                createdAt: p.createdAt,
                deadline: p.deadline,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 统计处理器
 */
export const pollStatsHandler: ToolHandler = async () => {
  const engine = getPollEngine();

  try {
    const stats = engine.getStats();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              stats,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 删除投票处理器
 */
export const pollDeleteHandler: ToolHandler = async (args: Record<string, unknown>) => {
  const engine = getPollEngine();

  try {
    const deleted = engine.deletePoll(args.pollId as string);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: deleted,
            pollId: args.pollId,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 检查过期投票处理器
 */
export const pollCheckExpiredHandler: ToolHandler = async () => {
  const engine = getPollEngine();

  try {
    const closedCount = engine.checkExpired();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            closedCount,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * 投票系统处理器映射
 */
export const pollHandlers: Record<string, ToolHandler> = {
  poll_create: pollCreateHandler,
  poll_vote: pollVoteHandler,
  poll_get: pollGetHandler,
  poll_result: pollResultHandler,
  poll_close: pollCloseHandler,
  poll_cancel: pollCancelHandler,
  poll_list: pollListHandler,
  poll_stats: pollStatsHandler,
  poll_delete: pollDeleteHandler,
  poll_check_expired: pollCheckExpiredHandler,
};

/**
 * 关闭投票系统
 */
export function closePollHandlers(): void {
  closePollEngine();
}
