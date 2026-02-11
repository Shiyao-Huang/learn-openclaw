/**
 * persistence/manager.ts - 状态持久化管理器
 * 
 * 负责状态快照、检查点创建和恢复的中央管理器
 */

import * as fs from "fs";
import * as path from "path";
import {
  StateSnapshot,
  SnapshotMetadata,
  AgentState,
  SessionState,
  TaskState,
  SubAgentState,
  MemoryState,
  WorkflowState,
  CheckpointConfig,
  RecoveryStrategy,
  RecoveryResult,
  PersistenceConfig,
  CrashInfo,
  RecoveryPlan,
  TaskCheckpoint,
} from "./types.js";

/** 默认配置 */
const DEFAULT_CONFIG: PersistenceConfig = {
  snapshotsDir: "./snapshots",
  checkpointsDir: "./checkpoints",
  autoSnapshotIntervalMs: 0, // 0 = disabled
  maxSnapshots: 10,
  maxCheckpointsPerTask: 5,
  compressionEnabled: false,
  encryptionEnabled: false,
};

/** 状态持久化管理器 */
export class PersistenceManager {
  private config: PersistenceConfig;
  private snapshots: Map<string, StateSnapshot> = new Map();
  private checkpoints: Map<string, TaskCheckpoint> = new Map();
  private crashes: CrashInfo[] = [];
  private currentState?: StateSnapshot;
  private autoSnapshotTimer?: NodeJS.Timeout;

  constructor(workDir: string, config?: Partial<PersistenceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.config.snapshotsDir = path.resolve(workDir, this.config.snapshotsDir);
    this.config.checkpointsDir = path.resolve(workDir, this.config.checkpointsDir);
    
    this.ensureDirectories();
    this.loadExistingSnapshots();
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  private ensureDirectories(): void {
    if (!fs.existsSync(this.config.snapshotsDir)) {
      fs.mkdirSync(this.config.snapshotsDir, { recursive: true });
    }
    if (!fs.existsSync(this.config.checkpointsDir)) {
      fs.mkdirSync(this.config.checkpointsDir, { recursive: true });
    }
  }

  private loadExistingSnapshots(): void {
    try {
      const files = fs.readdirSync(this.config.snapshotsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const snapshotPath = path.join(this.config.snapshotsDir, file);
          try {
            const data = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
            this.snapshots.set(data.metadata.id, data);
          } catch {
            // Skip corrupted snapshots
          }
        }
      }
    } catch {
      // Directory might be empty
    }
  }

  // ============================================================================
  // 状态快照
  // ============================================================================

  /**
   * 创建完整状态快照
   */
  createSnapshot(
    agent: AgentState,
    session: SessionState,
    tasks: TaskState[],
    subagents: SubAgentState[],
    memory: MemoryState,
    workflow: WorkflowState,
    name?: string,
    description?: string,
    tags?: string[]
  ): StateSnapshot {
    const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    const metadata: SnapshotMetadata = {
      id,
      name: name || `Snapshot ${new Date().toISOString()}`,
      description,
      createdAt: Date.now(),
      version: "v19",
      tags: tags || [],
      size: 0,
    };

    const snapshot: StateSnapshot = {
      metadata,
      agent,
      session,
      tasks,
      subagents,
      memory,
      workflow,
    };

    // Calculate size
    const json = JSON.stringify(snapshot);
    metadata.size = Buffer.byteLength(json, "utf-8");

    this.snapshots.set(id, snapshot);
    this.currentState = snapshot;

    // Persist to disk
    this.persistSnapshot(snapshot);

    // Cleanup old snapshots
    this.cleanupOldSnapshots();

    return snapshot;
  }

  /**
   * 保存快照到磁盘
   */
  private persistSnapshot(snapshot: StateSnapshot): void {
    const filePath = path.join(this.config.snapshotsDir, `${snapshot.metadata.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  }

  /**
   * 清理旧快照
   */
  private cleanupOldSnapshots(): void {
    if (this.snapshots.size <= this.config.maxSnapshots) return;

    const sorted = Array.from(this.snapshots.entries())
      .sort((a, b) => b[1].metadata.createdAt - a[1].metadata.createdAt);

    const toDelete = sorted.slice(this.config.maxSnapshots);
    for (const [id] of toDelete) {
      this.snapshots.delete(id);
      const filePath = path.join(this.config.snapshotsDir, `${id}.json`);
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * 获取快照
   */
  getSnapshot(id: string): StateSnapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * 列出所有快照
   */
  listSnapshots(): SnapshotMetadata[] {
    return Array.from(this.snapshots.values())
      .map(s => s.metadata)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 删除快照
   */
  deleteSnapshot(id: string): boolean {
    const existed = this.snapshots.delete(id);
    if (existed) {
      const filePath = path.join(this.config.snapshotsDir, `${id}.json`);
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore errors
      }
    }
    return existed;
  }

  // ============================================================================
  // 检查点
  // ============================================================================

  /**
   * 创建任务检查点
   */
  createCheckpoint(
    taskId: string,
    step: number,
    data: Record<string, unknown>
  ): TaskCheckpoint {
    const checkpoint: TaskCheckpoint = {
      step,
      data,
      timestamp: Date.now(),
    };

    this.checkpoints.set(taskId, checkpoint);
    
    // Persist checkpoint
    const filePath = path.join(this.config.checkpointsDir, `${taskId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));

    return checkpoint;
  }

  /**
   * 获取任务检查点
   */
  getCheckpoint(taskId: string): TaskCheckpoint | undefined {
    // Try memory first
    if (this.checkpoints.has(taskId)) {
      return this.checkpoints.get(taskId);
    }

    // Try disk
    const filePath = path.join(this.config.checkpointsDir, `${taskId}.json`);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      this.checkpoints.set(taskId, data);
      return data;
    } catch {
      return undefined;
    }
  }

  /**
   * 删除检查点
   */
  deleteCheckpoint(taskId: string): boolean {
    const existed = this.checkpoints.delete(taskId);
    const filePath = path.join(this.config.checkpointsDir, `${taskId}.json`);
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore errors
    }
    return existed;
  }

  // ============================================================================
  // 自动快照
  // ============================================================================

  /**
   * 启动自动快照
   */
  startAutoSnapshot(
    intervalMs: number,
    captureFn: () => Omit<StateSnapshot, "metadata">
  ): void {
    this.stopAutoSnapshot();
    
    this.autoSnapshotTimer = setInterval(() => {
      const state = captureFn();
      this.createSnapshot(
        state.agent,
        state.session,
        state.tasks,
        state.subagents,
        state.memory,
        state.workflow,
        `Auto Snapshot ${new Date().toISOString()}`,
        "Automatic periodic snapshot",
        ["auto"]
      );
    }, intervalMs);
  }

  /**
   * 停止自动快照
   */
  stopAutoSnapshot(): void {
    if (this.autoSnapshotTimer) {
      clearInterval(this.autoSnapshotTimer);
      this.autoSnapshotTimer = undefined;
    }
  }

  // ============================================================================
  // 崩溃恢复
  // ============================================================================

  /**
   * 记录崩溃信息
   */
  recordCrash(
    type: CrashInfo["type"],
    message: string,
    component: string,
    stack?: string
  ): CrashInfo {
    const crash: CrashInfo = {
      id: `crash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      type,
      message,
      stack,
      component,
      snapshotId: this.currentState?.metadata.id,
      recovered: false,
    };

    this.crashes.push(crash);
    
    // Keep only recent crashes
    if (this.crashes.length > 50) {
      this.crashes = this.crashes.slice(-50);
    }

    return crash;
  }

  /**
   * 获取崩溃历史
   */
  getCrashHistory(): CrashInfo[] {
    return [...this.crashes].reverse();
  }

  /**
   * 创建恢复计划
   */
  createRecoveryPlan(crashId: string, strategy?: RecoveryStrategy): RecoveryPlan | undefined {
    const crash = this.crashes.find(c => c.id === crashId);
    if (!crash) return undefined;

    const recoveryStrategy: RecoveryStrategy = strategy || {
      type: crash.snapshotId ? "resume" : "restart",
      targetSnapshot: crash.snapshotId,
      retryCount: 3,
      retryDelayMs: 1000,
    };

    const steps = [
      {
        id: `step_${Date.now()}_1`,
        type: "restore_snapshot" as const,
        target: recoveryStrategy.targetSnapshot || "latest",
        status: "pending" as const,
      },
      {
        id: `step_${Date.now()}_2`,
        type: "restart_component" as const,
        target: crash.component,
        status: "pending" as const,
      },
    ];

    return {
      crashId,
      strategy: recoveryStrategy,
      steps,
      estimatedTime: 5000,
    };
  }

  /**
   * 执行恢复
   */
  async executeRecovery(plan: RecoveryPlan): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      success: false,
      restoredComponents: [],
      failedComponents: [],
      errors: [],
      timestamp: Date.now(),
    };

    for (const step of plan.steps) {
      step.status = "in_progress";
      
      try {
        switch (step.type) {
          case "restore_snapshot":
            if (step.target === "latest") {
              const latest = this.listSnapshots()[0];
              if (latest) {
                result.snapshotId = latest.id;
                result.restoredComponents.push("state");
              }
            } else {
              const snapshot = this.getSnapshot(step.target);
              if (snapshot) {
                result.snapshotId = snapshot.metadata.id;
                result.restoredComponents.push("state");
              }
            }
            break;
            
          case "restart_component":
            result.restoredComponents.push(step.target);
            break;
            
          case "notify":
            // Notification would be sent here
            break;
        }
        
        step.status = "completed";
      } catch (error) {
        step.status = "failed";
        step.error = error instanceof Error ? error.message : String(error);
        result.failedComponents.push(step.target);
        result.errors.push(step.error);
      }
    }

    result.success = result.failedComponents.length === 0;
    
    // Mark crash as recovered
    const crash = this.crashes.find(c => c.id === plan.crashId);
    if (crash) {
      crash.recovered = result.success;
    }

    return result;
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 获取当前状态
   */
  getCurrentState(): StateSnapshot | undefined {
    return this.currentState;
  }

  /**
   * 生成状态报告
   */
  generateReport(): string {
    const snapshots = this.listSnapshots();
    const recentCrashes = this.crashes.slice(-5);

    return `## 持久化状态报告

### 快照 (${snapshots.length} / ${this.config.maxSnapshots})
${snapshots.slice(0, 5).map(s => 
  `- ${s.name} (${new Date(s.createdAt).toLocaleString()}) [${(s.size / 1024).toFixed(1)} KB]`
).join("\n")}
${snapshots.length > 5 ? `\n... 还有 ${snapshots.length - 5} 个快照` : ""}

### 检查点
- 内存中的检查点: ${this.checkpoints.size}
- 检查点目录: ${this.config.checkpointsDir}

### 崩溃历史 (${this.crashes.length})
${recentCrashes.length > 0 
  ? recentCrashes.map(c => 
      `- ${new Date(c.timestamp).toLocaleString()}: ${c.type} - ${c.component} ${c.recovered ? "(已恢复)" : ""}`
    ).join("\n")
  : "无崩溃记录"
}

### 自动快照
${this.autoSnapshotTimer ? "✅ 运行中" : "⏸️ 已停止"}
`;
  }

  /**
   * 清理所有数据
   */
  cleanup(): void {
    this.stopAutoSnapshot();
    
    // Clear memory
    this.snapshots.clear();
    this.checkpoints.clear();
    this.crashes = [];
    this.currentState = undefined;

    // Clear disk
    try {
      fs.rmSync(this.config.snapshotsDir, { recursive: true, force: true });
      fs.rmSync(this.config.checkpointsDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }

    this.ensureDirectories();
  }
}

export { PersistenceConfig, DEFAULT_CONFIG };
