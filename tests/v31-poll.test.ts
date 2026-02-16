/**
 * V31 - 投票系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PollEngine, getPollEngine, closePollEngine } from "../v31-agent/poll/engine.js";

describe("V31 投票系统", () => {
  let engine: PollEngine;

  beforeEach(() => {
    closePollEngine();
    engine = getPollEngine();
  });

  afterEach(() => {
    closePollEngine();
  });

  describe("创建投票", () => {
    it("应该创建基础投票", () => {
      const poll = engine.createPoll(
        {
          question: "今天吃什么？",
          options: ["汉堡", "披萨", "寿司"],
        },
        "user_1"
      );

      expect(poll.question).toBe("今天吃什么？");
      expect(poll.options).toHaveLength(3);
      expect(poll.maxSelections).toBe(1);
      expect(poll.status).toBe("active");
      expect(poll.anonymous).toBe(false);
      expect(poll.allowChange).toBe(true);
    });

    it("应该支持多选投票", () => {
      const poll = engine.createPoll(
        {
          question: "你喜欢哪些水果？",
          options: ["苹果", "香蕉", "橙子", "葡萄"],
          maxSelections: 2,
        },
        "user_1"
      );

      expect(poll.maxSelections).toBe(2);
    });

    it("应该支持限时投票", () => {
      const before = Date.now();
      const poll = engine.createPoll(
        {
          question: "紧急决定！",
          options: ["A", "B"],
          durationHours: 1,
        },
        "user_1"
      );
      const after = Date.now();

      expect(poll.deadline).toBeDefined();
      expect(poll.deadline!).toBeGreaterThan(before);
      expect(poll.deadline!).toBeLessThan(after + 2 * 60 * 60 * 1000);
    });

    it("应该支持匿名投票", () => {
      const poll = engine.createPoll(
        {
          question: "你支持谁？",
          options: ["候选人A", "候选人B"],
          anonymous: true,
        },
        "user_1"
      );

      expect(poll.anonymous).toBe(true);
    });

    it("应该禁止修改投票", () => {
      const poll = engine.createPoll(
        {
          question: "最终决定",
          options: ["A", "B"],
          allowChange: false,
        },
        "user_1"
      );

      expect(poll.allowChange).toBe(false);
    });

    it("应该拒绝空问题", () => {
      expect(() =>
        engine.createPoll({ question: "", options: ["A", "B"] }, "user_1")
      ).toThrow("投票问题不能为空");
    });

    it("应该拒绝少于2个选项", () => {
      expect(() =>
        engine.createPoll({ question: "问题", options: ["A"] }, "user_1")
      ).toThrow("至少需要 2 个选项");
    });

    it("应该拒绝过多选项", () => {
      const options = Array(11).fill("选项");
      expect(() =>
        engine.createPoll({ question: "问题", options }, "user_1")
      ).toThrow("最多支持 10 个选项");
    });

    it("应该拒绝无效的最大选择数", () => {
      expect(() =>
        engine.createPoll(
          { question: "问题", options: ["A", "B"], maxSelections: 0 },
          "user_1"
        )
      ).toThrow("最大选择数至少为 1");
    });

    it("应该拒绝超过选项数的最大选择数", () => {
      expect(() =>
        engine.createPoll(
          { question: "问题", options: ["A", "B"], maxSelections: 5 },
          "user_1"
        )
      ).toThrow("最大选择数不能超过选项数量");
    });
  });

  describe("投票", () => {
    it("应该成功投票", () => {
      const poll = engine.createPoll(
        {
          question: "测试投票",
          options: ["A", "B", "C"],
        },
        "user_1"
      );

      const vote = engine.vote(poll.id, "user_2", ["opt_0"]);

      expect(vote.optionIds).toEqual(["opt_0"]);
      expect(vote.modified).toBe(false);

      const updatedPoll = engine.getPoll(poll.id)!;
      expect(updatedPoll.options[0].votes).toBe(1);
      expect(updatedPoll.participantCount).toBe(1);
    });

    it("应该支持多选投票", () => {
      const poll = engine.createPoll(
        {
          question: "多选测试",
          options: ["A", "B", "C"],
          maxSelections: 2,
        },
        "user_1"
      );

      const vote = engine.vote(poll.id, "user_2", ["opt_0", "opt_1"]);

      expect(vote.optionIds).toHaveLength(2);

      const updatedPoll = engine.getPoll(poll.id)!;
      expect(updatedPoll.totalVotes).toBe(2);
    });

    it("应该允许修改投票", () => {
      const poll = engine.createPoll(
        {
          question: "修改测试",
          options: ["A", "B", "C"],
          allowChange: true,
        },
        "user_1"
      );

      engine.vote(poll.id, "user_2", ["opt_0"]);
      const vote = engine.vote(poll.id, "user_2", ["opt_1"]);

      expect(vote.modified).toBe(true);

      const updatedPoll = engine.getPoll(poll.id)!;
      expect(updatedPoll.options[0].votes).toBe(0);
      expect(updatedPoll.options[1].votes).toBe(1);
    });

    it("应该禁止修改投票", () => {
      const poll = engine.createPoll(
        {
          question: "禁止修改测试",
          options: ["A", "B", "C"],
          allowChange: false,
        },
        "user_1"
      );

      engine.vote(poll.id, "user_2", ["opt_0"]);

      expect(() => engine.vote(poll.id, "user_2", ["opt_1"])).toThrow(
        "此投票不允许修改"
      );
    });

    it("应该拒绝无效选项", () => {
      const poll = engine.createPoll(
        {
          question: "测试",
          options: ["A", "B"],
        },
        "user_1"
      );

      expect(() => engine.vote(poll.id, "user_2", ["invalid"])).toThrow(
        "无效选项"
      );
    });

    it("应该拒绝超过最大选择数", () => {
      const poll = engine.createPoll(
        {
          question: "测试",
          options: ["A", "B", "C"],
          maxSelections: 1,
        },
        "user_1"
      );

      expect(() => engine.vote(poll.id, "user_2", ["opt_0", "opt_1"])).toThrow(
        "最多可选 1 个选项"
      );
    });

    it("应该拒绝空选择", () => {
      const poll = engine.createPoll(
        {
          question: "测试",
          options: ["A", "B"],
        },
        "user_1"
      );

      expect(() => engine.vote(poll.id, "user_2", [])).toThrow(
        "请选择至少一个选项"
      );
    });
  });

  describe("获取结果", () => {
    it("应该计算投票结果", () => {
      const poll = engine.createPoll(
        {
          question: "结果测试",
          options: ["A", "B", "C"],
        },
        "user_1"
      );

      engine.vote(poll.id, "user_2", ["opt_0"]);
      engine.vote(poll.id, "user_3", ["opt_0"]);
      engine.vote(poll.id, "user_4", ["opt_1"]);

      const result = engine.getResult(poll.id);

      expect(result.totalVotes).toBe(3);
      expect(result.participantCount).toBe(3);
      expect(result.results[0].optionId).toBe("opt_0");
      expect(result.results[0].votes).toBe(2);
      expect(result.winners).toEqual(["opt_0"]);
      expect(result.isTie).toBeFalsy();
    });

    it("应该检测平局", () => {
      const poll = engine.createPoll(
        {
          question: "平局测试",
          options: ["A", "B"],
        },
        "user_1"
      );

      engine.vote(poll.id, "user_2", ["opt_0"]);
      engine.vote(poll.id, "user_3", ["opt_1"]);

      const result = engine.getResult(poll.id);

      expect(result.isTie).toBe(true);
      expect(result.winners).toHaveLength(2);
    });

    it("应该计算百分比", () => {
      const poll = engine.createPoll(
        {
          question: "百分比测试",
          options: ["A", "B"],
        },
        "user_1"
      );

      engine.vote(poll.id, "user_2", ["opt_0"]);
      engine.vote(poll.id, "user_3", ["opt_1"]);

      const result = engine.getResult(poll.id);

      expect(result.results[0].percentage).toBe(50);
      expect(result.results[1].percentage).toBe(50);
    });
  });

  describe("关闭投票", () => {
    it("应该关闭投票", () => {
      const poll = engine.createPoll(
        {
          question: "关闭测试",
          options: ["A", "B"],
        },
        "user_1"
      );

      const closedPoll = engine.closePoll(poll.id, "user_1");

      expect(closedPoll.status).toBe("closed");
    });

    it("只有创建者可以关闭", () => {
      const poll = engine.createPoll(
        {
          question: "关闭测试",
          options: ["A", "B"],
        },
        "user_1"
      );

      expect(() => engine.closePoll(poll.id, "user_2")).toThrow(
        "只有创建者可以关闭投票"
      );
    });

    it("应该禁止在已关闭的投票中投票", () => {
      const poll = engine.createPoll(
        {
          question: "关闭测试",
          options: ["A", "B"],
        },
        "user_1"
      );

      engine.closePoll(poll.id, "user_1");

      expect(() => engine.vote(poll.id, "user_2", ["opt_0"])).toThrow(
        "投票已结束"
      );
    });
  });

  describe("取消投票", () => {
    it("应该取消投票", () => {
      const poll = engine.createPoll(
        {
          question: "取消测试",
          options: ["A", "B"],
        },
        "user_1"
      );

      const cancelledPoll = engine.cancelPoll(poll.id, "user_1");

      expect(cancelledPoll.status).toBe("cancelled");
    });

    it("只有创建者可以取消", () => {
      const poll = engine.createPoll(
        {
          question: "取消测试",
          options: ["A", "B"],
        },
        "user_1"
      );

      expect(() => engine.cancelPoll(poll.id, "user_2")).toThrow(
        "只有创建者可以取消投票"
      );
    });
  });

  describe("列出投票", () => {
    it("应该列出所有投票", () => {
      engine.createPoll({ question: "投票1", options: ["A", "B"] }, "user_1");
      engine.createPoll({ question: "投票2", options: ["C", "D"] }, "user_1");

      const polls = engine.listPolls();

      expect(polls).toHaveLength(2);
    });

    it("应该按状态过滤", () => {
      const poll = engine.createPoll(
        { question: "投票1", options: ["A", "B"] },
        "user_1"
      );
      engine.createPoll({ question: "投票2", options: ["C", "D"] }, "user_1");

      engine.closePoll(poll.id, "user_1");

      const activePolls = engine.listPolls({ status: "active" });
      const closedPolls = engine.listPolls({ status: "closed" });

      expect(activePolls).toHaveLength(1);
      expect(closedPolls).toHaveLength(1);
    });

    it("应该按创建者过滤", () => {
      engine.createPoll({ question: "投票1", options: ["A", "B"] }, "user_1");
      engine.createPoll({ question: "投票2", options: ["C", "D"] }, "user_2");

      const user1Polls = engine.listPolls({ creator: "user_1" });

      expect(user1Polls).toHaveLength(1);
    });
  });

  describe("统计", () => {
    it("应该返回统计数据", () => {
      engine.createPoll({ question: "投票1", options: ["A", "B"] }, "user_1");
      engine.createPoll({ question: "投票2", options: ["C", "D"] }, "user_1");

      const stats = engine.getStats();

      expect(stats.totalPolls).toBe(2);
      expect(stats.activePolls).toBe(2);
      expect(stats.closedPolls).toBe(0);
    });
  });

  describe("过期检查", () => {
    it("应该关闭过期投票", () => {
      const poll = engine.createPoll(
        {
          question: "过期测试",
          options: ["A", "B"],
          durationHours: 0.00001, // 非常短的时间
        },
        "user_1"
      );

      // 等待投票过期
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const closedCount = engine.checkExpired();
          expect(closedCount).toBe(1);

          const expiredPoll = engine.getPoll(poll.id)!;
          expect(expiredPoll.status).toBe("closed");
          resolve();
        }, 100);
      });
    });
  });

  describe("删除投票", () => {
    it("应该删除投票", () => {
      const poll = engine.createPoll(
        { question: "删除测试", options: ["A", "B"] },
        "user_1"
      );

      const deleted = engine.deletePoll(poll.id);

      expect(deleted).toBe(true);
      expect(engine.getPoll(poll.id)).toBeUndefined();
    });

    it("应该返回 false 如果投票不存在", () => {
      const deleted = engine.deletePoll("nonexistent");
      expect(deleted).toBe(false);
    });
  });

  describe("清空", () => {
    it("应该清空所有投票", () => {
      engine.createPoll({ question: "投票1", options: ["A", "B"] }, "user_1");
      engine.createPoll({ question: "投票2", options: ["C", "D"] }, "user_1");

      engine.clear();

      const stats = engine.getStats();
      expect(stats.totalPolls).toBe(0);
    });
  });
});
