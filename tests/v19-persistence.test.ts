/**
 * tests/v19-persistence.test.ts - V19 持久化系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  PersistenceManager,
  RecoveryHandler,
  createPersistenceHandlers,
  type AgentState,
  type SessionState,
  type TaskState,
  type SubAgentState,
  type MemoryState,
  type WorkflowState,
} from "../v19-agent/persistence/index.js";

// Mock data shared across test suites
const mockAgent: AgentState = {
  id: "test-agent",
  name: "Test Agent",
  status: "running",
  trustLevel: "owner",
  config: {},
  stats: { tasksCompleted: 10, tasksFailed: 2, uptime: 3600000 },
};

const mockSession: SessionState = {
  id: "session-1",
  channel: "console",
  userId: "owner",
  messages: [],
  context: {},
};

const mockTasks: TaskState[] = [
  {
    id: "task-1",
    type: "general",
    status: "completed",
    priority: 2,
    description: "Test task",
    dependencies: [],
    progress: 100,
    createdAt: Date.now(),
  },
];

const mockSubAgents: SubAgentState[] = [];
const mockMemory: MemoryState = { shortTerm: [], longTerm: [], dailyNotes: {}, sessionContext: {} };
const mockWorkflow: WorkflowState = { activeWorkflows: [], completedWorkflows: [] };

describe("V19 Persistence System", () => {
  let tempDir: string;
  let manager: PersistenceManager;
  let recovery: RecoveryHandler;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v19-test-"));
    manager = new PersistenceManager(tempDir);
    recovery = new RecoveryHandler(manager);
  });

  afterEach(() => {
    manager.cleanup();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Snapshot Management", () => {
    it("should create a snapshot", () => {
      const snapshot = manager.createSnapshot(
        mockAgent,
        mockSession,
        mockTasks,
        mockSubAgents,
        mockMemory,
        mockWorkflow,
        "Test Snapshot"
      );

      expect(snapshot.metadata.name).toBe("Test Snapshot");
      expect(snapshot.agent.id).toBe("test-agent");
      expect(snapshot.metadata.size).toBeGreaterThan(0);
    });

    it("should list snapshots", () => {
      manager.createSnapshot(mockAgent, mockSession, mockTasks, mockSubAgents, mockMemory, mockWorkflow);
      manager.createSnapshot(mockAgent, mockSession, mockTasks, mockSubAgents, mockMemory, mockWorkflow);

      const snapshots = manager.listSnapshots();
      expect(snapshots.length).toBe(2);
    });

    it("should get a snapshot by id", () => {
      const created = manager.createSnapshot(
        mockAgent,
        mockSession,
        mockTasks,
        mockSubAgents,
        mockMemory,
        mockWorkflow
      );

      const retrieved = manager.getSnapshot(created.metadata.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.id).toBe(created.metadata.id);
    });

    it("should delete a snapshot", () => {
      const snapshot = manager.createSnapshot(
        mockAgent,
        mockSession,
        mockTasks,
        mockSubAgents,
        mockMemory,
        mockWorkflow
      );

      const deleted = manager.deleteSnapshot(snapshot.metadata.id);
      expect(deleted).toBe(true);
      expect(manager.getSnapshot(snapshot.metadata.id)).toBeUndefined();
    });

    it("should enforce max snapshots limit", () => {
      // Create 12 snapshots (max is 10)
      for (let i = 0; i < 12; i++) {
        manager.createSnapshot(
          mockAgent,
          mockSession,
          mockTasks,
          mockSubAgents,
          mockMemory,
          mockWorkflow,
          `Snapshot ${i}`
        );
      }

      const snapshots = manager.listSnapshots();
      expect(snapshots.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Checkpoint Management", () => {
    it("should create a checkpoint", () => {
      const checkpoint = manager.createCheckpoint("task-1", 5, { progress: 50 });

      expect(checkpoint.step).toBe(5);
      expect(checkpoint.data.progress).toBe(50);
      expect(checkpoint.timestamp).toBeGreaterThan(0);
    });

    it("should get a checkpoint", () => {
      manager.createCheckpoint("task-1", 5, { progress: 50 });

      const retrieved = manager.getCheckpoint("task-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.step).toBe(5);
    });

    it("should return undefined for non-existent checkpoint", () => {
      const checkpoint = manager.getCheckpoint("non-existent");
      expect(checkpoint).toBeUndefined();
    });

    it("should delete a checkpoint", () => {
      manager.createCheckpoint("task-1", 5, { progress: 50 });
      
      const deleted = manager.deleteCheckpoint("task-1");
      expect(deleted).toBe(true);
      expect(manager.getCheckpoint("task-1")).toBeUndefined();
    });
  });

  describe("Crash Recovery", () => {
    it("should record a crash", () => {
      const crash = manager.recordCrash("error", "Test error", "main", "stack trace");

      expect(crash.type).toBe("error");
      expect(crash.message).toBe("Test error");
      expect(crash.component).toBe("main");
      expect(crash.recovered).toBe(false);
    });

    it("should get crash history", () => {
      manager.recordCrash("error", "Error 1", "main");
      manager.recordCrash("timeout", "Timeout", "task");

      const history = manager.getCrashHistory();
      expect(history.length).toBe(2);
    });

    it("should create a recovery plan", () => {
      const crash = manager.recordCrash("error", "Test error", "main");
      const plan = manager.createRecoveryPlan(crash.id);

      expect(plan).toBeDefined();
      expect(plan?.crashId).toBe(crash.id);
      expect(plan?.steps.length).toBeGreaterThan(0);
    });

    it("should check if recovery is needed", () => {
      const check = recovery.checkRecoveryNeeded();
      
      expect(check.needed).toBe(false);
    });

    it("should detect recovery need after crash", () => {
      manager.recordCrash("error", "Test error", "main");
      
      const check = recovery.checkRecoveryNeeded();
      expect(check.needed).toBe(true);
      expect(check.reason).toContain("Unrecovered crash");
    });

    it("should auto recover from latest snapshot", async () => {
      // Create a snapshot first
      manager.createSnapshot(
        mockAgent,
        mockSession,
        mockTasks,
        mockSubAgents,
        mockMemory,
        mockWorkflow
      );

      const result = await recovery.autoRecover();
      
      expect(result.success).toBe(true);
      expect(result.restoredComponents).toContain("agent");
      expect(result.restoredComponents).toContain("session");
    });
  });

  describe("Auto Snapshot", () => {
    it("should start auto snapshot", () => {
      const captureFn = () => ({
        agent: mockAgent,
        session: mockSession,
        tasks: mockTasks,
        subagents: mockSubAgents,
        memory: mockMemory,
        workflow: mockWorkflow,
      });

      manager.startAutoSnapshot(100, captureFn);
      
      // Auto snapshot timer should be set
      // Can't easily test the interval without waiting
      expect(() => manager.stopAutoSnapshot()).not.toThrow();
    });

    it("should stop auto snapshot", () => {
      const captureFn = () => ({
        agent: mockAgent,
        session: mockSession,
        tasks: mockTasks,
        subagents: mockSubAgents,
        memory: mockMemory,
        workflow: mockWorkflow,
      });

      manager.startAutoSnapshot(100, captureFn);
      manager.stopAutoSnapshot();
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("Persistence to Disk", () => {
    it("should persist snapshot to disk", () => {
      const snapshot = manager.createSnapshot(
        mockAgent,
        mockSession,
        mockTasks,
        mockSubAgents,
        mockMemory,
        mockWorkflow
      );

      const snapshotPath = path.join(tempDir, "snapshots", `${snapshot.metadata.id}.json`);
      expect(fs.existsSync(snapshotPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
      expect(content.metadata.id).toBe(snapshot.metadata.id);
    });

    it("should persist checkpoint to disk", () => {
      manager.createCheckpoint("task-1", 5, { progress: 50 });

      const checkpointPath = path.join(tempDir, "checkpoints", "task-1.json");
      expect(fs.existsSync(checkpointPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(checkpointPath, "utf-8"));
      expect(content.step).toBe(5);
    });

    it("should load snapshots from disk on init", () => {
      // Create snapshot
      const snapshot = manager.createSnapshot(
        mockAgent,
        mockSession,
        mockTasks,
        mockSubAgents,
        mockMemory,
        mockWorkflow
      );

      // Create new manager instance (simulating restart)
      const newManager = new PersistenceManager(tempDir);
      
      const retrieved = newManager.getSnapshot(snapshot.metadata.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.id).toBe(snapshot.metadata.id);
    });
  });

  describe("Reporting", () => {
    it("should generate manager report", () => {
      manager.createSnapshot(mockAgent, mockSession, mockTasks, mockSubAgents, mockMemory, mockWorkflow);
      manager.recordCrash("error", "Test", "main");

      const report = manager.generateReport();
      
      expect(report).toContain("持久化状态报告");
      expect(report).toContain("快照");
      expect(report).toContain("崩溃历史");
    });

    it("should generate recovery report", () => {
      const report = recovery.generateReport();
      
      expect(report).toContain("恢复状态报告");
      expect(report).toContain("恢复需求");
    });
  });

  describe("Cleanup", () => {
    it("should cleanup all data", () => {
      manager.createSnapshot(mockAgent, mockSession, mockTasks, mockSubAgents, mockMemory, mockWorkflow);
      manager.createCheckpoint("task-1", 5, {});
      manager.recordCrash("error", "Test", "main");

      manager.cleanup();

      expect(manager.listSnapshots().length).toBe(0);
      expect(manager.getCrashHistory().length).toBe(0);
    });
  });
});

// 工具函数测试
describe("Persistence Tools", () => {
  let tempDir: string;
  let manager: PersistenceManager;
  let recovery: RecoveryHandler;
  let stateCallCount = 0;

  const stateProvider = () => {
    stateCallCount++;
    return {
      agent: mockAgent,
      session: mockSession,
      tasks: mockTasks,
      subagents: mockSubAgents,
      memory: mockMemory,
      workflow: mockWorkflow,
    };
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v19-tools-test-"));
    manager = new PersistenceManager(tempDir);
    recovery = new RecoveryHandler(manager);
    stateCallCount = 0;
  });

  afterEach(() => {
    manager.cleanup();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create snapshot via tool", () => {
    const handlers = createPersistenceHandlers(manager, recovery, stateProvider);

    const result = handlers.snapshot_create({ name: "Test", tags: ["test"] });
    
    expect(result).toContain("✅ Snapshot created");
    expect(result).toContain("Test");
    expect(stateCallCount).toBe(1);
  });

  it("should list snapshots via tool", () => {
    const handlers = createPersistenceHandlers(manager, recovery, stateProvider);

    manager.createSnapshot(mockAgent, mockSession, mockTasks, mockSubAgents, mockMemory, mockWorkflow);
    
    const result = handlers.snapshot_list();
    
    expect(result).toContain("Snapshots");
  });

  it("should create checkpoint via tool", () => {
    const handlers = createPersistenceHandlers(manager, recovery, stateProvider);

    const result = handlers.checkpoint_create({
      taskId: "task-1",
      step: 5,
      data: { progress: 50 }
    });
    
    expect(result).toContain("✅ Checkpoint created");
    expect(result).toContain("task-1");
  });

  it("should check recovery via tool", () => {
    const handlers = createPersistenceHandlers(manager, recovery, stateProvider);

    const result = handlers.recovery_check();
    
    expect(result).toContain("恢复状态报告");
  });

  it("should view crash history via tool", () => {
    const handlers = createPersistenceHandlers(manager, recovery, stateProvider);

    manager.recordCrash("error", "Test error", "main");
    
    const result = handlers.crash_history({ limit: 10 });
    
    expect(result).toContain("Crash History");
    expect(result).toContain("error");
  });
});
