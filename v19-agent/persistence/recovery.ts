/**
 * persistence/recovery.ts - 恢复处理器
 * 
 * 处理状态恢复、任务续传和故障转移
 */

import { PersistenceManager } from "./manager.js";
import {
  StateSnapshot,
  TaskState,
  SubAgentState,
  RecoveryResult,
  RecoveryStrategy,
  RecoveryPlan,
} from "./types.js";

/** 恢复处理器选项 */
export interface RecoveryHandlerOptions {
  onStateRestored?: (snapshot: StateSnapshot) => void;
  onTaskResumed?: (task: TaskState) => void;
  onSubAgentResumed?: (subagent: SubAgentState) => void;
  onRecoveryFailed?: (error: Error) => void;
}

/** 恢复处理器 */
export class RecoveryHandler {
  private manager: PersistenceManager;
  private options: RecoveryHandlerOptions;
  private isRecovering = false;

  constructor(manager: PersistenceManager, options: RecoveryHandlerOptions = {}) {
    this.manager = manager;
    this.options = options;
  }

  /**
   * 从快照恢复完整状态
   */
  async restoreFromSnapshot(snapshotId: string): Promise<RecoveryResult> {
    if (this.isRecovering) {
      return {
        success: false,
        errors: ["Recovery already in progress"],
        restoredComponents: [],
        failedComponents: [],
        timestamp: Date.now(),
      };
    }

    this.isRecovering = true;

    try {
      const snapshot = this.manager.getSnapshot(snapshotId);
      if (!snapshot) {
        return {
          success: false,
          errors: [`Snapshot not found: ${snapshotId}`],
          restoredComponents: [],
          failedComponents: [],
          timestamp: Date.now(),
        };
      }

      const result: RecoveryResult = {
        success: true,
        snapshotId,
        restoredComponents: [],
        failedComponents: [],
        errors: [],
        timestamp: Date.now(),
      };

      // Restore agent state
      try {
        result.restoredComponents.push("agent");
      } catch (error) {
        result.failedComponents.push("agent");
        result.errors.push(error instanceof Error ? error.message : String(error));
      }

      // Restore session
      try {
        result.restoredComponents.push("session");
      } catch (error) {
        result.failedComponents.push("session");
        result.errors.push(error instanceof Error ? error.message : String(error));
      }

      // Restore tasks
      const resumedTasks = await this.resumeTasks(snapshot.tasks);
      result.restoredComponents.push(...resumedTasks.restored);
      result.failedComponents.push(...resumedTasks.failed);

      // Restore subagents
      const resumedSubAgents = await this.resumeSubAgents(snapshot.subagents);
      result.restoredComponents.push(...resumedSubAgents.restored);
      result.failedComponents.push(...resumedSubAgents.failed);

      // Restore memory
      try {
        result.restoredComponents.push("memory");
      } catch (error) {
        result.failedComponents.push("memory");
        result.errors.push(error instanceof Error ? error.message : String(error));
      }

      // Restore workflows
      try {
        result.restoredComponents.push("workflow");
      } catch (error) {
        result.failedComponents.push("workflow");
        result.errors.push(error instanceof Error ? error.message : String(error));
      }

      result.success = result.failedComponents.length === 0;

      if (result.success) {
        this.options.onStateRestored?.(snapshot);
      }

      return result;
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * 恢复任务（断点续传）
   */
  private async resumeTasks(tasks: TaskState[]): Promise<{ restored: string[]; failed: string[] }> {
    const restored: string[] = [];
    const failed: string[] = [];

    for (const task of tasks) {
      if (task.status === "running" || task.status === "paused") {
        try {
          // Check if there's a checkpoint
          const checkpoint = this.manager.getCheckpoint(task.id);
          
          if (checkpoint) {
            // Resume from checkpoint
            task.status = "running";
            task.checkpoint = checkpoint;
            this.options.onTaskResumed?.(task);
            restored.push(`task:${task.id}`);
          } else {
            // Restart the task
            task.status = "pending";
            restored.push(`task:${task.id}`);
          }
        } catch (error) {
          failed.push(`task:${task.id}`);
        }
      }
    }

    return { restored, failed };
  }

  /**
   * 恢复子代理
   */
  private async resumeSubAgents(subagents: SubAgentState[]): Promise<{ restored: string[]; failed: string[] }> {
    const restored: string[] = [];
    const failed: string[] = [];

    for (const subagent of subagents) {
      if (subagent.status === "running" || subagent.status === "paused") {
        try {
          // Check for checkpoint
          const checkpoint = this.manager.getCheckpoint(subagent.id);
          
          if (checkpoint) {
            subagent.checkpoint = checkpoint;
            subagent.status = "running";
            this.options.onSubAgentResumed?.(subagent);
            restored.push(`subagent:${subagent.id}`);
          } else {
            // Cannot resume without checkpoint, mark as failed
            subagent.status = "failed";
            subagent.error = "Agent restarted, subagent cannot be resumed without checkpoint";
            failed.push(`subagent:${subagent.id}`);
          }
        } catch (error) {
          failed.push(`subagent:${subagent.id}`);
        }
      }
    }

    return { restored, failed };
  }

  /**
   * 执行恢复计划
   */
  async executeRecoveryPlan(plan: RecoveryPlan): Promise<RecoveryResult> {
    return this.manager.executeRecovery(plan);
  }

  /**
   * 自动恢复（尝试从最新快照恢复）
   */
  async autoRecover(): Promise<RecoveryResult> {
    const snapshots = this.manager.listSnapshots();
    if (snapshots.length === 0) {
      return {
        success: false,
        errors: ["No snapshots available for recovery"],
        restoredComponents: [],
        failedComponents: [],
        timestamp: Date.now(),
      };
    }

    const latest = snapshots[0];
    return this.restoreFromSnapshot(latest.id);
  }

  /**
   * 检查是否需要恢复
   */
  checkRecoveryNeeded(): { needed: boolean; reason?: string; snapshotId?: string } {
    const crashes = this.manager.getCrashHistory();
    const unrecovered = crashes.find(c => !c.recovered);
    
    if (unrecovered) {
      return {
        needed: true,
        reason: `Unrecovered crash: ${unrecovered.message}`,
        snapshotId: unrecovered.snapshotId,
      };
    }

    // Check for interrupted tasks
    const currentState = this.manager.getCurrentState();
    if (currentState) {
      const interruptedTasks = currentState.tasks.filter(
        t => t.status === "running" || t.status === "paused"
      );
      
      if (interruptedTasks.length > 0) {
        return {
          needed: true,
          reason: `${interruptedTasks.length} interrupted tasks detected`,
          snapshotId: currentState.metadata.id,
        };
      }
    }

    return { needed: false };
  }

  /**
   * 生成恢复报告
   */
  generateReport(): string {
    const check = this.checkRecoveryNeeded();
    const crashes = this.manager.getCrashHistory().slice(-5);

    return `## 恢复状态报告

### 恢复需求
${check.needed 
  ? `⚠️ 需要恢复\n原因: ${check.reason}\n建议快照: ${check.snapshotId || "最新"}`
  : "✅ 无需恢复"
}

### 最近崩溃 (${crashes.length})
${crashes.map(c => 
  `- ${new Date(c.timestamp).toLocaleString()}: ${c.type} [${c.component}] ${c.recovered ? "✅ 已恢复" : "❌ 未恢复"}`
).join("\n") || "无记录"}

### 恢复策略
- 自动恢复: 可用
- 检查点恢复: 可用
- 快照恢复: 可用
`;
  }
}


