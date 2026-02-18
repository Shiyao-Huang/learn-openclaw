/**
 * V38: 命令执行审批工具
 * 
 * 工具定义和处理器
 */

import {
  ApprovalEngine,
  getApprovalEngine,
  ApprovalConfig,
  ApprovalPolicy,
  AllowlistEntry,
  ApprovalResult,
  CommandAnalysis,
  CommandSegment,
} from "./engine.js";

// ============================================================================
// Tool Definitions
// ============================================================================

export const APPROVAL_TOOLS = [
  // Allowlist Management
  {
    name: "approval_allowlist_add",
    description: "Add a command pattern to the allowlist. Patterns support wildcards (* and ?).",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Command pattern to allow (e.g., '/usr/bin/git', '/home/user/scripts/*')",
        },
        description: {
          type: "string",
          description: "Optional description of why this pattern is allowed",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "approval_allowlist_remove",
    description: "Remove a command pattern from the allowlist by ID or pattern",
    parameters: {
      type: "object",
      properties: {
        idOrPattern: {
          type: "string",
          description: "ID or pattern to remove",
        },
      },
      required: ["idOrPattern"],
    },
  },
  {
    name: "approval_allowlist_list",
    description: "List all allowlist entries",
    parameters: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Optional search pattern to filter results",
        },
      },
    },
  },
  {
    name: "approval_allowlist_get",
    description: "Get details of a specific allowlist entry",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Entry ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "approval_allowlist_update",
    description: "Update an allowlist entry",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Entry ID",
        },
        description: {
          type: "string",
          description: "New description",
        },
        pattern: {
          type: "string",
          description: "New pattern",
        },
      },
      required: ["id"],
    },
  },

  // Safe Bins Management
  {
    name: "approval_safebins_list",
    description: "List all safe binary names that are always allowed",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "approval_safebins_add",
    description: "Add a binary name to the safe bins list",
    parameters: {
      type: "object",
      properties: {
        bin: {
          type: "string",
          description: "Binary name to add (e.g., 'curl', 'wget')",
        },
      },
      required: ["bin"],
    },
  },
  {
    name: "approval_safebins_remove",
    description: "Remove a binary name from the safe bins list",
    parameters: {
      type: "object",
      properties: {
        bin: {
          type: "string",
          description: "Binary name to remove",
        },
      },
      required: ["bin"],
    },
  },

  // Policy Management
  {
    name: "approval_policy_get",
    description: "Get the current approval policy configuration",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "approval_policy_set",
    description: "Update the approval policy configuration",
    parameters: {
      type: "object",
      properties: {
        security: {
          type: "string",
          enum: ["deny", "allowlist", "full"],
          description: "Security level: deny (block all), allowlist (check list), full (allow all)",
        },
        ask: {
          type: "string",
          enum: ["off", "on-miss", "always"],
          description: "When to ask for approval: off (never), on-miss (when not in list), always",
        },
        askFallback: {
          type: "string",
          enum: ["deny", "allowlist", "full"],
          description: "Fallback security level when asking times out",
        },
        autoAllowSkills: {
          type: "boolean",
          description: "Whether to automatically allow skill commands",
        },
      },
    },
  },

  // Command Analysis
  {
    name: "approval_analyze",
    description: "Analyze a command without checking approval. Shows how the command will be parsed.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Command to analyze",
        },
        cwd: {
          type: "string",
          description: "Working directory for path resolution",
        },
      },
      required: ["command"],
    },
  },

  // Approval Check
  {
    name: "approval_check",
    description: "Check if a command is approved based on current policy and allowlist",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Command to check",
        },
        cwd: {
          type: "string",
          description: "Working directory for path resolution",
        },
      },
      required: ["command"],
    },
  },

  // Statistics & Management
  {
    name: "approval_stats",
    description: "Get statistics about the approval system",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "approval_config_export",
    description: "Export the current approval configuration as JSON",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "approval_config_import",
    description: "Import approval configuration from JSON",
    parameters: {
      type: "object",
      properties: {
        config: {
          type: "string",
          description: "JSON configuration string",
        },
      },
      required: ["config"],
    },
  },
  {
    name: "approval_reset",
    description: "Reset approval configuration to defaults",
    parameters: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Must be true to confirm reset",
        },
      },
      required: ["confirm"],
    },
  },
];

export const APPROVAL_TOOL_COUNT = APPROVAL_TOOLS.length;

// ============================================================================
// Tool Handlers
// ============================================================================

type ToolHandler = (
  engine: ApprovalEngine,
  params: Record<string, unknown>
) => Promise<{ ok: boolean; result?: unknown; error?: string }>;

const handlers: Record<string, ToolHandler> = {
  // Allowlist Management
  "approval_allowlist_add": async (engine, params) => {
    try {
      const pattern = String(params.pattern ?? "");
      const description = params.description ? String(params.description) : undefined;
      const entry = engine.addAllowlist(pattern, description);
      return { ok: true, result: entry };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  "approval_allowlist_remove": async (engine, params) => {
    const idOrPattern = String(params.idOrPattern ?? "");
    const removed = engine.removeAllowlist(idOrPattern);
    return { ok: true, result: { removed } };
  },

  "approval_allowlist_list": async (engine, params) => {
    let entries = engine.getAllowlist();
    const search = params.search ? String(params.search).toLowerCase() : null;
    if (search) {
      entries = entries.filter(e =>
        e.pattern.toLowerCase().includes(search) ||
        e.description?.toLowerCase().includes(search)
      );
    }
    return { ok: true, result: { entries, count: entries.length } };
  },

  "approval_allowlist_get": async (engine, params) => {
    const id = String(params.id ?? "");
    const entries = engine.getAllowlist();
    const entry = entries.find(e => e.id === id);
    if (!entry) {
      return { ok: false, error: "Entry not found" };
    }
    return { ok: true, result: entry };
  },

  "approval_allowlist_update": async (engine, params) => {
    const id = String(params.id ?? "");
    const updates: Partial<AllowlistEntry> = {};
    if (params.description !== undefined) {
      updates.description = String(params.description);
    }
    if (params.pattern !== undefined) {
      updates.pattern = String(params.pattern);
    }
    const entry = engine.updateAllowlist(id, updates);
    if (!entry) {
      return { ok: false, error: "Entry not found" };
    }
    return { ok: true, result: entry };
  },

  // Safe Bins Management
  "approval_safebins_list": async (engine) => {
    const bins = engine.getSafeBins();
    return { ok: true, result: { bins, count: bins.length } };
  },

  "approval_safebins_add": async (engine, params) => {
    const bin = String(params.bin ?? "");
    engine.addSafeBin(bin);
    return { ok: true, result: { added: bin } };
  },

  "approval_safebins_remove": async (engine, params) => {
    const bin = String(params.bin ?? "");
    engine.removeSafeBin(bin);
    return { ok: true, result: { removed: bin } };
  },

  // Policy Management
  "approval_policy_get": async (engine) => {
    const policy = engine.getPolicy();
    return { ok: true, result: policy };
  },

  "approval_policy_set": async (engine, params) => {
    const updates: Partial<ApprovalPolicy> = {};
    if (params.security !== undefined) {
      updates.security = params.security as ApprovalPolicy["security"];
    }
    if (params.ask !== undefined) {
      updates.ask = params.ask as ApprovalPolicy["ask"];
    }
    if (params.askFallback !== undefined) {
      updates.askFallback = params.askFallback as ApprovalPolicy["askFallback"];
    }
    if (params.autoAllowSkills !== undefined) {
      updates.autoAllowSkills = Boolean(params.autoAllowSkills);
    }
    engine.setPolicy(updates);
    return { ok: true, result: engine.getPolicy() };
  },

  // Command Analysis
  "approval_analyze": async (engine, params) => {
    const command = String(params.command ?? "");
    const cwd = params.cwd ? String(params.cwd) : undefined;
    const analysis = engine.analyzeCommand(command, { cwd });
    return { ok: true, result: analysis };
  },

  // Approval Check
  "approval_check": async (engine, params) => {
    const command = String(params.command ?? "");
    const cwd = params.cwd ? String(params.cwd) : undefined;
    const result = engine.checkApproval(command, { cwd });
    const requiresApproval = engine.requiresApproval(result);
    return { ok: true, result: { ...result, requiresApproval } };
  },

  // Statistics & Management
  "approval_stats": async (engine) => {
    const stats = engine.getStats();
    return { ok: true, result: stats };
  },

  "approval_config_export": async (engine) => {
    const config = engine.exportConfig();
    return { ok: true, result: { config } };
  },

  "approval_config_import": async (engine, params) => {
    try {
      const config = String(params.config ?? "");
      engine.importConfig(config);
      return { ok: true, result: { imported: true } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  "approval_reset": async (engine, params) => {
    if (params.confirm !== true) {
      return { ok: false, error: "Reset not confirmed. Set confirm=true to proceed." };
    }
    engine.reset();
    return { ok: true, result: { reset: true } };
  },
};

export async function createApprovalHandlers(engine?: ApprovalEngine): Promise<
  Map<string, (params: Record<string, unknown>) => Promise<{ ok: boolean; result?: unknown; error?: string }>>
> {
  const e = engine ?? getApprovalEngine();
  const map = new Map();

  for (const [name, handler] of Object.entries(handlers)) {
    map.set(name, (params: Record<string, unknown>) => handler(e, params));
  }

  return map;
}

export async function closeApprovalHandlers(): Promise<void> {
  // Cleanup if needed
}
