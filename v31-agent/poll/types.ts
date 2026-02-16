/**
 * V31 - 投票系统类型定义
 * 
 * 从 OpenClaw src/polls.ts 学习并扩展
 */

/**
 * 投票选项
 */
export interface PollOption {
  /** 选项 ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 投票数量 */
  votes: number;
  /** 投票者 ID 列表 */
  voters: string[];
}

/**
 * 投票状态
 */
export type PollStatus = "active" | "closed" | "cancelled";

/**
 * 投票配置
 */
export interface PollConfig {
  /** 投票问题 */
  question: string;
  /** 选项列表 */
  options: string[];
  /** 最大可选数量 (默认 1) */
  maxSelections?: number;
  /** 持续时间 (小时) */
  durationHours?: number;
  /** 是否匿名 (默认 false) */
  anonymous?: boolean;
  /** 是否允许修改投票 (默认 true) */
  allowChange?: boolean;
}

/**
 * 投票记录
 */
export interface Poll {
  /** 投票 ID */
  id: string;
  /** 投票问题 */
  question: string;
  /** 选项列表 */
  options: PollOption[];
  /** 最大可选数量 */
  maxSelections: number;
  /** 截止时间 (时间戳) */
  deadline?: number;
  /** 是否匿名 */
  anonymous: boolean;
  /** 是否允许修改 */
  allowChange: boolean;
  /** 状态 */
  status: PollStatus;
  /** 创建者 ID */
  creator: string;
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 总投票数 */
  totalVotes: number;
  /** 参与者数量 */
  participantCount: number;
  /** 标签 (用于分类) */
  tags?: string[];
}

/**
 * 用户投票记录
 */
export interface UserVote {
  /** 投票 ID */
  pollId: string;
  /** 用户 ID */
  userId: string;
  /** 选择的选项 ID 列表 */
  optionIds: string[];
  /** 投票时间 */
  votedAt: number;
  /** 是否修改过 */
  modified: boolean;
}

/**
 * 投票结果
 */
export interface PollResult {
  /** 投票 ID */
  pollId: string;
  /** 问题 */
  question: string;
  /** 总票数 */
  totalVotes: number;
  /** 参与者数 */
  participantCount: number;
  /** 选项结果 */
  results: Array<{
    optionId: string;
    text: string;
    votes: number;
    percentage: number;
    voters?: string[]; // 非匿名时显示
  }>;
  /** 获胜选项 */
  winners?: string[];
  /** 是否平局 */
  isTie?: boolean;
  /** 状态 */
  status: PollStatus;
}

/**
 * 投票引擎配置
 */
export interface PollEngineConfig {
  /** 最大选项数 (默认 10) */
  maxOptions?: number;
  /** 最大问题长度 (默认 200) */
  maxQuestionLength?: number;
  /** 最大选项长度 (默认 100) */
  maxOptionLength?: number;
  /** 默认持续时间 (小时, 默认 24) */
  defaultDurationHours?: number;
  /** 最大持续时间 (小时, 默认 168 = 7天) */
  maxDurationHours?: number;
  /** 数据存储路径 */
  storagePath?: string;
}

/**
 * 投票过滤器
 */
export interface PollFilter {
  /** 状态过滤 */
  status?: PollStatus;
  /** 创建者过滤 */
  creator?: string;
  /** 标签过滤 */
  tags?: string[];
  /** 创建时间起始 */
  createdAfter?: number;
  /** 创建时间结束 */
  createdBefore?: number;
}

/**
 * 投票统计
 */
export interface PollStats {
  /** 总投票数 */
  totalPolls: number;
  /** 活跃投票数 */
  activePolls: number;
  /** 已关闭投票数 */
  closedPolls: number;
  /** 总参与人次 */
  totalParticipations: number;
  /** 平均参与人数 */
  avgParticipants: number;
}
