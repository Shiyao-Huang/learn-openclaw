/**
 * collaboration/distributor.ts - 任务分配器
 * 
 * 智能分配任务给合适的子代理:
 * - 分析任务需求
 * - 匹配 Agent 能力
 * - 负载均衡
 * - 结果聚合
 */

import { SubAgentManager, SubAgent, SubAgentOptions } from "./subagent.js";
import { AgentRegistry, AgentInfo } from "./registry.js";

export interface TaskAssignment {
  taskId: string;
  description: string;
  requirements: string[];
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  status: "pending" | "assigned" | "running" | "completed" | "failed";
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: string;
  error?: string;
  duration: number;
  agentId?: string;
}

export interface DistributionStrategy {
  type: "round-robin" | "least-busy" | "capability-match" | "broadcast";
  maxAgents?: number;
  requireAll?: boolean;
}

export class TaskDistributor {
  private tasks: Map<string, TaskAssignment> = new Map();
  private subAgentManager: SubAgentManager;
  private agentRegistry: AgentRegistry;
  private roundRobinIndex: number = 0;

  constructor(
    subAgentManager: SubAgentManager,
    agentRegistry: AgentRegistry
  ) {
    this.subAgentManager = subAgentManager;
    this.agentRegistry = agentRegistry;
  }

  /**
   * 提交任务
   */
  submit(
    description: string,
    requirements: string[] = [],
    priority: TaskAssignment["priority"] = "medium"
  ): TaskAssignment {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    const task: TaskAssignment = {
      taskId,
      description,
      requirements,
      priority,
      status: "pending",
      createdAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * 分配任务给子代理
   */
  async distribute(
    taskId: string,
    strategy: DistributionStrategy = { type: "capability-match" }
  ): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { taskId, success: false, error: "Task not found", duration: 0 };
    }

    task.status = "assigned";

    // 根据策略选择 Agent
    let agents: AgentInfo[] = [];

    switch (strategy.type) {
      case "round-robin":
        agents = this.selectRoundRobin(strategy.maxAgents || 1);
        break;
      case "least-busy":
        agents = this.selectLeastBusy(strategy.maxAgents || 1);
        break;
      case "broadcast":
        agents = this.agentRegistry.getAvailable();
        break;
      case "capability-match":
      default:
        agents = this.selectByCapability(task.requirements, strategy.maxAgents || 1);
        break;
    }

    if (agents.length === 0) {
      // 没有可用 Agent，创建子代理
      return this.assignToSubAgent(task);
    }

    // 分配给选中的 Agent
    task.assignedTo = agents[0].id;
    task.status = "running";
    task.startedAt = Date.now();

    // 实际生产环境这里会发送任务到 Agent
    // 简化版：创建子代理来模拟
    return this.assignToSubAgent(task);
  }

  /**
   * 分配给子代理
   */
  private async assignToSubAgent(task: TaskAssignment): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // 构建任务提示
      const taskPrompt = this.buildTaskPrompt(task);

      // 创建子代理
      const subAgent = await this.subAgentManager.create({
        name: `Task-${task.taskId.slice(-5)}`,
        task: taskPrompt,
        timeout: this.getTimeoutByPriority(task.priority),
      });

      task.assignedTo = subAgent.id;
      task.status = "running";
      task.startedAt = Date.now();

      // 等待完成
      const completedAgent = await this.subAgentManager.waitFor(subAgent.id, 300000);
      
      task.completedAt = Date.now();
      
      if (completedAgent.status === "completed" && completedAgent.result) {
        task.status = "completed";
        task.result = completedAgent.result;
        
        return {
          taskId: task.taskId,
          success: true,
          result: completedAgent.result,
          duration: Date.now() - startTime,
          agentId: subAgent.id,
        };
      } else {
        task.status = "failed";
        task.error = completedAgent.error || "Unknown error";
        
        return {
          taskId: task.taskId,
          success: false,
          error: completedAgent.error || "Task failed",
          duration: Date.now() - startTime,
          agentId: subAgent.id,
        };
      }
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : String(error);
      
      return {
        taskId: task.taskId,
        success: false,
        error: task.error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 构建任务提示
   */
  private buildTaskPrompt(task: TaskAssignment): string {
    return `## 任务
${task.description}

${task.requirements.length > 0 ? `## 要求
${task.requirements.map(r => `- ${r}`).join("\n")}

` : ""}## 说明
请完成以上任务，并输出简洁的结果。如果有多个步骤，请简要列出。
`;
  }

  /**
   * 根据优先级获取超时时间
   */
  private getTimeoutByPriority(priority: TaskAssignment["priority"]): number {
    switch (priority) {
      case "urgent": return 60000;    // 1分钟
      case "high": return 120000;     // 2分钟
      case "low": return 600000;      // 10分钟
      default: return 300000;         // 5分钟
    }
  }

  /**
   * 轮询选择
   */
  private selectRoundRobin(count: number): AgentInfo[] {
    const available = this.agentRegistry.getAvailable();
    if (available.length === 0) return [];

    const selected: AgentInfo[] = [];
    for (let i = 0; i < count; i++) {
      const index = (this.roundRobinIndex + i) % available.length;
      selected.push(available[index]);
    }
    this.roundRobinIndex = (this.roundRobinIndex + count) % available.length;
    
    return selected;
  }

  /**
   * 选择最空闲的
   */
  private selectLeastBusy(count: number): AgentInfo[] {
    // 简化：随机选择，实际应该跟踪每个 Agent 的任务数
    const available = this.agentRegistry.getAvailable();
    return available.slice(0, count);
  }

  /**
   * 按能力匹配选择
   */
  private selectByCapability(requirements: string[], count: number): AgentInfo[] {
    if (requirements.length === 0) {
      return this.agentRegistry.getAvailable().slice(0, count);
    }

    // 找到匹配最多能力的 Agent
    const available = this.agentRegistry.getAvailable();
    const scored = available.map(agent => {
      const score = requirements.filter(req =>
        agent.capabilities.some(c => 
          c.name.toLowerCase().includes(req.toLowerCase()) ||
          req.toLowerCase().includes(c.name.toLowerCase())
        )
      ).length;
      return { agent, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.agent);
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): TaskAssignment | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 列出所有任务
   */
  listTasks(): TaskAssignment[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): { status: string; result?: string; error?: string } {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { status: "not_found" };
    }

    return {
      status: task.status,
      result: task.result,
      error: task.error,
    };
  }

  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === "completed" || task.status === "failed") {
      return false;
    }

    if (task.assignedTo) {
      await this.subAgentManager.stop(task.assignedTo);
    }

    task.status = "failed";
    task.error = "Cancelled by user";
    task.completedAt = Date.now();
    return true;
  }

  /**
   * 生成任务报告
   */
  generateReport(): string {
    const all = this.listTasks();
    const pending = all.filter(t => t.status === "pending").length;
    const running = all.filter(t => t.status === "running").length;
    const completed = all.filter(t => t.status === "completed").length;
    const failed = all.filter(t => t.status === "failed").length;

    const avgDuration = all
      .filter(t => t.completedAt && t.startedAt)
      .reduce((sum, t) => sum + (t.completedAt! - t.startedAt!), 0) / (completed + failed || 1);

    return `## 任务分配报告

总计: ${all.length} 个任务
- ⏳ 待分配: ${pending}
- 🔄 运行中: ${running}
- ✅ 已完成: ${completed}
- ❌ 失败: ${failed}

平均执行时间: ${(avgDuration / 1000).toFixed(1)} 秒

### 最近任务
${all.slice(-5).reverse().map(t => 
  `- [${t.status === "completed" ? "✅" : t.status === "failed" ? "❌" : t.status === "running" ? "🔄" : "⏳"}] ${t.description.slice(0, 40)}...`
).join("\n")}
`;
  }
}
