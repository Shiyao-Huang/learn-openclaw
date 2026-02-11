/**
 * collaboration/tools.ts - V18 协作工具定义
 * 
 * 提供 Agent 协作相关的工具
 */

import { SubAgentManager } from "./subagent.js";
import { AgentRegistry } from "./registry.js";
import { TaskDistributor } from "./distributor.js";

export function getCollaborationTools(): any[] {
  return [
    {
      name: "subagent_create",
      description: "Create a sub-agent to handle a specific task in isolation. Use for parallel work or when you need independent processing.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name for the sub-agent (optional)"
          },
          task: {
            type: "string",
            description: "Task description for the sub-agent"
          },
          model: {
            type: "string",
            description: "Model to use (optional, default: claude-3-5-haiku)",
            enum: ["claude-3-5-haiku", "claude-sonnet", "claude-opus"]
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (optional, default: 300000)"
          },
          maxLines: {
            type: "number",
            description: "Maximum output lines to capture (optional, default: 100)"
          }
        },
        required: ["task"]
      }
    },
    {
      name: "subagent_list",
      description: "List all sub-agents and their status",
      input_schema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Filter by status (optional)",
            enum: ["pending", "starting", "running", "completed", "failed", "stopped"]
          }
        }
      }
    },
    {
      name: "subagent_status",
      description: "Get status and result of a specific sub-agent",
      input_schema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Sub-agent ID"
          }
        },
        required: ["id"]
      }
    },
    {
      name: "subagent_wait",
      description: "Wait for a sub-agent to complete and get its result",
      input_schema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Sub-agent ID"
          },
          timeout: {
            type: "number",
            description: "Maximum wait time in milliseconds (optional, default: 60000)"
          }
        },
        required: ["id"]
      }
    },
    {
      name: "subagent_stop",
      description: "Stop a running sub-agent",
      input_schema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Sub-agent ID"
          }
        },
        required: ["id"]
      }
    },
    {
      name: "agent_register",
      description: "Register a new agent with the registry",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Agent name"
          },
          description: {
            type: "string",
            description: "Agent description"
          },
          capabilities: {
            type: "array",
            description: "List of capabilities",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                priority: { type: "number", minimum: 1, maximum: 10 }
              }
            }
          }
        },
        required: ["name", "capabilities"]
      }
    },
    {
      name: "agent_list",
      description: "List all registered agents",
      input_schema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "agent_find",
      description: "Find agents by capability",
      input_schema: {
        type: "object",
        properties: {
          capability: {
            type: "string",
            description: "Capability name to search for"
          }
        },
        required: ["capability"]
      }
    },
    {
      name: "task_submit",
      description: "Submit a task to be distributed to available agents",
      input_schema: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Task description"
          },
          requirements: {
            type: "array",
            description: "Required capabilities",
            items: { type: "string" }
          },
          priority: {
            type: "string",
            description: "Task priority",
            enum: ["low", "medium", "high", "urgent"],
            default: "medium"
          }
        },
        required: ["description"]
      }
    },
    {
      name: "task_status",
      description: "Check the status of a submitted task",
      input_schema: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "Task ID returned by task_submit"
          }
        },
        required: ["taskId"]
      }
    },
    {
      name: "collaboration_report",
      description: "Generate a collaboration system report",
      input_schema: {
        type: "object",
        properties: {}
      }
    }
  ];
}

export function createCollaborationHandlers(
  subAgentManager: SubAgentManager,
  agentRegistry: AgentRegistry,
  taskDistributor: TaskDistributor
) {
  return {
    subagent_create: async (args: any) => {
      const agent = await subAgentManager.create({
        name: args.name,
        task: args.task,
        model: args.model,
        timeout: args.timeout,
        maxLines: args.maxLines,
      });
      
      return `Created sub-agent: ${agent.id}
Status: ${agent.status}
Task: ${agent.task.slice(0, 100)}...`;
    },

    subagent_list: (args: any) => {
      const agents = args.status 
        ? subAgentManager.list().filter(a => a.status === args.status)
        : subAgentManager.list();
      
      if (agents.length === 0) {
        return "No sub-agents found.";
      }

      return `## Sub-agents (${agents.length})

${agents.map(a => 
  `- ${a.name} [${a.status}] ${a.result ? "✓" : ""}`
).join("\n")}`;
    },

    subagent_status: (args: any) => {
      const result = subAgentManager.getResult(args.id);
      return `Status: ${result.status}
${result.result ? `Result:\n${result.result.slice(0, 500)}` : ""}
${result.error ? `Error: ${result.error}` : ""}`;
    },

    subagent_wait: async (args: any) => {
      try {
        const agent = await subAgentManager.waitFor(args.id, args.timeout);
        return `Sub-agent completed with status: ${agent.status}
${agent.result ? `Result:\n${agent.result.slice(0, 1000)}` : ""}
${agent.error ? `Error: ${agent.error}` : ""}`;
      } catch (error) {
        return `Error waiting for sub-agent: ${error}`;
      }
    },

    subagent_stop: async (args: any) => {
      const success = await subAgentManager.stop(args.id);
      return success ? "Sub-agent stopped." : "Failed to stop sub-agent (may not be running).";
    },

    agent_register: (args: any) => {
      const agent = agentRegistry.register({
        name: args.name,
        description: args.description,
        capabilities: args.capabilities || [],
      });
      
      return `Registered agent: ${agent.id}
Name: ${agent.name}
Capabilities: ${agent.capabilities.map((c: any) => c.name).join(", ")}`;
    },

    agent_list: () => {
      const agents = agentRegistry.list();
      if (agents.length === 0) {
        return "No agents registered.";
      }

      return `## Registered Agents (${agents.length})

${agents.map(a => 
  `- [${a.status === "active" ? "🟢" : a.status === "busy" ? "🟡" : "⚫"}] ${a.name}: ${a.capabilities.map(c => c.name).join(", ")}`
).join("\n")}`;
    },

    agent_find: (args: any) => {
      const agents = agentRegistry.findByCapability(args.capability);
      if (agents.length === 0) {
        return `No agents found with capability: ${args.capability}`;
      }

      return `## Agents with "${args.capability}" (${agents.length})

${agents.map(a => 
  `- ${a.name} (${a.status}): ${a.capabilities.find(c => c.name.toLowerCase().includes(args.capability.toLowerCase()))?.priority || 0}/10`
).join("\n")}`;
    },

    task_submit: (args: any) => {
      const task = taskDistributor.submit(
        args.description,
        args.requirements || [],
        args.priority
      );
      
      return `Task submitted: ${task.taskId}
Description: ${task.description.slice(0, 100)}...
Priority: ${task.priority}
Status: ${task.status}

Use task_status with taskId "${task.taskId}" to check progress.`;
    },

    task_status: (args: any) => {
      const status = taskDistributor.getTaskStatus(args.taskId);
      return `Task Status: ${status.status}
${status.result ? `Result:\n${status.result.slice(0, 500)}` : ""}
${status.error ? `Error: ${status.error}` : ""}`;
    },

    collaboration_report: () => {
      return `${subAgentManager.generateReport()}\n\n${agentRegistry.generateReport()}\n\n${taskDistributor.generateReport()}`;
    }
  };
}
