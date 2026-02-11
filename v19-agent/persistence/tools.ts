/**
 * persistence/tools.ts - V19 持久化工具定义
 * 
 * 提供状态快照、检查点和恢复相关的工具
 */

import { PersistenceManager } from "./manager.js";
import { RecoveryHandler } from "./recovery.js";

export function getPersistenceTools(): any[] {
  return [
    {
      name: "snapshot_create",
      description: "Create a full state snapshot for persistence and recovery",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Snapshot name (optional)"
          },
          description: {
            type: "string",
            description: "Snapshot description (optional)"
          },
          tags: {
            type: "array",
            description: "Tags for the snapshot (optional)",
            items: { type: "string" }
          }
        }
      }
    },
    {
      name: "snapshot_list",
      description: "List all available state snapshots",
      input_schema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "snapshot_restore",
      description: "Restore state from a snapshot",
      input_schema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Snapshot ID to restore"
          }
        },
        required: ["id"]
      }
    },
    {
      name: "snapshot_delete",
      description: "Delete a snapshot",
      input_schema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Snapshot ID to delete"
          }
        },
        required: ["id"]
      }
    },
    {
      name: "checkpoint_create",
      description: "Create a checkpoint for a task to enable resume from interruption",
      input_schema: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "Task ID"
          },
          step: {
            type: "number",
            description: "Current step number"
          },
          data: {
            type: "object",
            description: "Checkpoint data to save"
          }
        },
        required: ["taskId", "step", "data"]
      }
    },
    {
      name: "checkpoint_get",
      description: "Get checkpoint data for a task",
      input_schema: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "Task ID"
          }
        },
        required: ["taskId"]
      }
    },
    {
      name: "auto_snapshot_config",
      description: "Configure automatic snapshot creation",
      input_schema: {
        type: "object",
        properties: {
          enabled: {
            type: "boolean",
            description: "Enable/disable auto snapshots"
          },
          intervalMinutes: {
            type: "number",
            description: "Interval in minutes (minimum 1)"
          }
        }
      }
    },
    {
      name: "recovery_check",
      description: "Check if recovery is needed and view recovery status",
      input_schema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "recovery_execute",
      description: "Execute automatic recovery from the latest snapshot",
      input_schema: {
        type: "object",
        properties: {
          snapshotId: {
            type: "string",
            description: "Specific snapshot to recover from (optional, uses latest if not provided)"
          }
        }
      }
    },
    {
      name: "crash_history",
      description: "View crash history and recovery attempts",
      input_schema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of entries (default: 10)"
          }
        }
      }
    },
    {
      name: "persistence_report",
      description: "Generate comprehensive persistence and recovery report",
      input_schema: {
        type: "object",
        properties: {}
      }
    }
  ];
}

export function createPersistenceHandlers(
  manager: PersistenceManager,
  recovery: RecoveryHandler,
  stateProvider: () => {
    agent: any;
    session: any;
    tasks: any[];
    subagents: any[];
    memory: any;
    workflow: any;
  }
) {
  let autoSnapshotCaptureFn: (() => any) | undefined;

  return {
    snapshot_create: (args: any) => {
      const state = stateProvider();
      const snapshot = manager.createSnapshot(
        state.agent,
        state.session,
        state.tasks,
        state.subagents,
        state.memory,
        state.workflow,
        args.name,
        args.description,
        args.tags
      );
      
      return `✅ Snapshot created: ${snapshot.metadata.id}
Name: ${snapshot.metadata.name}
Size: ${(snapshot.metadata.size / 1024).toFixed(1)} KB
Time: ${new Date(snapshot.metadata.createdAt).toLocaleString()}`;
    },

    snapshot_list: () => {
      const snapshots = manager.listSnapshots();
      if (snapshots.length === 0) {
        return "No snapshots available.";
      }

      return `## Snapshots (${snapshots.length})

${snapshots.map(s => 
  `- **${s.name}**\n  ID: \`${s.id}\`\n  Size: ${(s.size / 1024).toFixed(1)} KB\n  Time: ${new Date(s.createdAt).toLocaleString()}${s.tags.length > 0 ? `\n  Tags: ${s.tags.join(", ")}` : ""}`
).join("\n\n")}`;
    },

    snapshot_restore: async (args: any) => {
      const result = await recovery.restoreFromSnapshot(args.id);
      
      if (result.success) {
        return `✅ State restored from snapshot: ${args.id}

Restored components:\n${result.restoredComponents.map(c => `- ✅ ${c}`).join("\n")}`;
      } else {
        return `❌ Restore failed

Failed components:\n${result.failedComponents.map(c => `- ❌ ${c}`).join("\n")}

Errors:\n${result.errors.map(e => `- ${e}`).join("\n")}`;
      }
    },

    snapshot_delete: (args: any) => {
      const success = manager.deleteSnapshot(args.id);
      return success 
        ? `✅ Snapshot deleted: ${args.id}`
        : `❌ Snapshot not found: ${args.id}`;
    },

    checkpoint_create: (args: any) => {
      const checkpoint = manager.createCheckpoint(args.taskId, args.step, args.data);
      return `✅ Checkpoint created for task: ${args.taskId}
Step: ${checkpoint.step}
Time: ${new Date(checkpoint.timestamp).toLocaleString()}`;
    },

    checkpoint_get: (args: any) => {
      const checkpoint = manager.getCheckpoint(args.taskId);
      if (!checkpoint) {
        return `No checkpoint found for task: ${args.taskId}`;
      }

      return `## Checkpoint for ${args.taskId}

Step: ${checkpoint.step}
Time: ${new Date(checkpoint.timestamp).toLocaleString()}
Data keys: ${Object.keys(checkpoint.data).join(", ")}`;
    },

    auto_snapshot_config: (args: any) => {
      if (args.enabled === false) {
        manager.stopAutoSnapshot();
        return "⏸️ Auto snapshots disabled.";
      }

      if (args.enabled === true || args.intervalMinutes) {
        const intervalMs = (args.intervalMinutes || 5) * 60 * 1000;
        autoSnapshotCaptureFn = () => stateProvider();
        manager.startAutoSnapshot(intervalMs, autoSnapshotCaptureFn);
        return `✅ Auto snapshots enabled (interval: ${args.intervalMinutes || 5} minutes)`;
      }

      return "Current auto snapshot status: " + (autoSnapshotCaptureFn ? "enabled" : "disabled");
    },

    recovery_check: () => {
      return recovery.generateReport();
    },

    recovery_execute: async (args: any) => {
      if (args.snapshotId) {
        const result = await recovery.restoreFromSnapshot(args.snapshotId);
        return result.success
          ? `✅ Recovery completed successfully from ${args.snapshotId}`
          : `❌ Recovery failed: ${result.errors.join(", ")}`;
      } else {
        const result = await recovery.autoRecover();
        return result.success
          ? `✅ Auto recovery completed successfully`
          : `❌ Auto recovery failed: ${result.errors.join(", ")}`;
      }
    },

    crash_history: (args: any) => {
      const crashes = manager.getCrashHistory();
      const limit = args.limit || 10;
      const recent = crashes.slice(0, limit);

      if (recent.length === 0) {
        return "No crash history.";
      }

      return `## Crash History (${recent.length}/${crashes.length})

${recent.map(c => 
      `- **${c.type}** - ${new Date(c.timestamp).toLocaleString()}
  Component: ${c.component}
  Message: ${c.message}
  Recovered: ${c.recovered ? "✅" : "❌"}`
    ).join("\n\n")}`;
    },

    persistence_report: () => {
      return manager.generateReport() + "\n\n" + recovery.generateReport();
    }
  };
}
