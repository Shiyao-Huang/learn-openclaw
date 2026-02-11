/**
 * workflow/index.ts - V16 工作流模块导出
 */

export * from './dag.js';

import { WorkflowManager, DAGNode, WorkflowResult } from './dag.js';

// ============================================================================
// 工作流工具定义
// ============================================================================

export function getWorkflowTools() {
  return [
    {
      name: "workflow_create",
      description: "从 Mermaid flowchart 创建工作流",
      input_schema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "工作流名称" },
          mermaid: { type: "string", description: "Mermaid flowchart 定义" },
        },
        required: ["name", "mermaid"],
      },
    },
    {
      name: "workflow_plan",
      description: "获取工作流执行计划",
      input_schema: {
        type: "object" as const,
        properties: {
          workflowId: { type: "string", description: "工作流 ID" },
        },
        required: ["workflowId"],
      },
    },
    {
      name: "workflow_run",
      description: "执行工作流",
      input_schema: {
        type: "object" as const,
        properties: {
          workflowId: { type: "string", description: "工作流 ID" },
          context: { type: "object", description: "执行上下文" },
        },
        required: ["workflowId"],
      },
    },
    {
      name: "workflow_status",
      description: "查看工作流状态",
      input_schema: {
        type: "object" as const,
        properties: {
          workflowId: { type: "string", description: "工作流 ID" },
        },
        required: ["workflowId"],
      },
    },
    {
      name: "workflow_list",
      description: "列出所有工作流",
      input_schema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "workflow_visualize",
      description: "可视化工作流",
      input_schema: {
        type: "object" as const,
        properties: {
          workflowId: { type: "string", description: "工作流 ID" },
        },
        required: ["workflowId"],
      },
    },
  ];
}

// ============================================================================
// 工具处理器
// ============================================================================

export function createWorkflowHandlers(
  manager: WorkflowManager,
  taskExecutor?: (node: DAGNode, context: Record<string, any>) => Promise<any>
) {
  // 默认任务执行器：打印任务信息
  const defaultExecutor = async (node: DAGNode, context: Record<string, any>) => {
    console.log(`\x1b[36m[执行] ${node.id}: ${node.label}\x1b[0m`);
    // 模拟执行
    await new Promise(resolve => setTimeout(resolve, 100));
    return { nodeId: node.id, label: node.label, executed: true };
  };
  
  const executor = taskExecutor || defaultExecutor;
  
  return {
    workflow_create: (args: { name: string; mermaid: string }) => {
      try {
        const dag = manager.createFromMermaid(args.name, args.mermaid);
        const plan = manager.getPlan(dag.id);
        return `已创建工作流: ${dag.name}
ID: ${dag.id}
节点数: ${dag.nodes.size}
执行阶段: ${plan?.phases.length || 0}
预估并行度: ${plan?.estimatedParallelism.toFixed(1) || 0}`;
      } catch (e: any) {
        return `创建失败: ${e.message}`;
      }
    },
    
    workflow_plan: (args: { workflowId: string }) => {
      const plan = manager.getPlan(args.workflowId);
      if (!plan) return '工作流不存在';
      
      const lines = [`执行计划 (${plan.totalNodes} 节点, ${plan.phases.length} 阶段)`];
      lines.push(`预估并行度: ${plan.estimatedParallelism.toFixed(1)}`);
      lines.push('');
      
      plan.phases.forEach((phase, i) => {
        lines.push(`阶段 ${i + 1}: ${phase.join(', ')}`);
      });
      
      return lines.join('\n');
    },
    
    workflow_run: async (args: { workflowId: string; context?: Record<string, any> }) => {
      const result = await manager.run(args.workflowId, executor, {
        context: args.context,
        onNodeStart: (node) => console.log(`\x1b[33m[开始] ${node.id}\x1b[0m`),
        onNodeComplete: (node) => console.log(`\x1b[32m[完成] ${node.id}\x1b[0m`),
        onNodeFail: (node, err) => console.log(`\x1b[31m[失败] ${node.id}: ${err.message}\x1b[0m`),
      });
      
      if (!result) return '工作流不存在';
      
      return `执行结果: ${result.status}
完成: ${result.completedNodes} 节点
失败: ${result.failedNodes} 节点
耗时: ${result.totalTime}ms
${result.failedNodes > 0 ? `\n错误:\n${Object.entries(result.errors).map(([k, v]) => `  ${k}: ${v}`).join('\n')}` : ''}`;
    },
    
    workflow_status: (args: { workflowId: string }) => {
      const dag = manager.getStatus(args.workflowId);
      if (!dag) return '工作流不存在';
      
      const nodes = Array.from(dag.nodes.values());
      const statusCounts = {
        pending: nodes.filter(n => n.status === 'pending').length,
        running: nodes.filter(n => n.status === 'running').length,
        completed: nodes.filter(n => n.status === 'completed').length,
        failed: nodes.filter(n => n.status === 'failed').length,
        skipped: nodes.filter(n => n.status === 'skipped').length,
      };
      
      return `工作流: ${dag.name}
状态: ${dag.status}
节点状态:
  ○ 待执行: ${statusCounts.pending}
  ◐ 执行中: ${statusCounts.running}
  ● 已完成: ${statusCounts.completed}
  ✗ 失败: ${statusCounts.failed}
  ◌ 跳过: ${statusCounts.skipped}`;
    },
    
    workflow_list: () => {
      const workflows = manager.list();
      if (workflows.length === 0) return '无工作流';
      
      return workflows.map(w => 
        `[${w.status}] ${w.id}: ${w.name} (${w.nodeCount} 节点)`
      ).join('\n');
    },
    
    workflow_visualize: (args: { workflowId: string }) => {
      return manager.visualize(args.workflowId);
    },
  };
}
