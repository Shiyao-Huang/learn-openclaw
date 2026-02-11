/**
 * workflow.test.ts - V16 工作流引擎测试
 * 
 * 测试内容:
 * - Mermaid 解析
 * - DAG 构建
 * - 执行计划生成
 * - 工作流执行
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MermaidParser,
  ExecutionPlanner,
  WorkflowManager,
  DAGNode,
  DAG,
} from '../v16-agent/workflow/dag.js';

describe('V16 Workflow Engine', () => {
  describe('MermaidParser', () => {
    let parser: MermaidParser;

    beforeEach(() => {
      parser = new MermaidParser();
    });

    it('should parse simple sequential flow', () => {
      const mermaid = `
        flowchart TD
          A[Task A] --> B[Task B]
          B --> C[Task C]
      `;

      const { nodes, edges } = parser.parse(mermaid);

      expect(nodes).toHaveLength(3);
      expect(edges).toHaveLength(2);
      expect(nodes[0].id).toBe('A');
      expect(nodes[1].dependsOn).toContain('A');
    });

    it('should parse parallel branches', () => {
      const mermaid = `
        flowchart TD
          A[Start] --> B[Task B]
          A --> C[Task C]
          B --> D[End]
          C --> D
      `;

      const { nodes, edges } = parser.parse(mermaid);

      expect(nodes).toHaveLength(4);
      const nodeB = nodes.find(n => n.id === 'B');
      const nodeC = nodes.find(n => n.id === 'C');
      expect(nodeB?.dependsOn).toContain('A');
      expect(nodeC?.dependsOn).toContain('A');
    });

    it('should parse condition nodes', () => {
      const mermaid = `
        flowchart TD
          A{Valid?} -->|yes| B[Process]
          A -->|no| C[Error]
      `;

      const { nodes, edges } = parser.parse(mermaid);

      const nodeA = nodes.find(n => n.id === 'A');
      expect(nodeA?.type).toBe('condition');
      expect(edges).toHaveLength(2);
      expect(edges[0].condition).toBe('yes');
      expect(edges[1].condition).toBe('no');
    });

    it('should parse start and end nodes', () => {
      const mermaid = `
        flowchart TD
          Start((Start)) --> A[Task]
          A --> End[[End]]
      `;

      const { nodes } = parser.parse(mermaid);

      const startNode = nodes.find(n => n.id === 'Start');
      const endNode = nodes.find(n => n.id === 'End');
      expect(startNode?.type).toBe('start');
      expect(endNode?.type).toBe('end');
    });
  });

  describe('ExecutionPlanner', () => {
    let planner: ExecutionPlanner;

    beforeEach(() => {
      planner = new ExecutionPlanner();
    });

    it('should create sequential phases', () => {
      const nodes: DAGNode[] = [
        { id: 'A', label: 'A', type: 'task', dependsOn: [], status: 'pending' },
        { id: 'B', label: 'B', type: 'task', dependsOn: ['A'], status: 'pending' },
        { id: 'C', label: 'C', type: 'task', dependsOn: ['B'], status: 'pending' },
      ];

      const plan = planner.createPlan(nodes);

      expect(plan.phases).toHaveLength(3);
      expect(plan.phases[0]).toEqual(['A']);
      expect(plan.phases[1]).toEqual(['B']);
      expect(plan.phases[2]).toEqual(['C']);
    });

    it('should identify parallel tasks', () => {
      const nodes: DAGNode[] = [
        { id: 'A', label: 'A', type: 'task', dependsOn: [], status: 'pending' },
        { id: 'B', label: 'B', type: 'task', dependsOn: ['A'], status: 'pending' },
        { id: 'C', label: 'C', type: 'task', dependsOn: ['A'], status: 'pending' },
        { id: 'D', label: 'D', type: 'task', dependsOn: ['B', 'C'], status: 'pending' },
      ];

      const plan = planner.createPlan(nodes);

      expect(plan.phases).toHaveLength(3);
      expect(plan.phases[0]).toEqual(['A']);
      expect(plan.phases[1]).toContain('B');
      expect(plan.phases[1]).toContain('C');
      expect(plan.phases[2]).toEqual(['D']);
      expect(plan.estimatedParallelism).toBeGreaterThan(1);
    });

    it('should handle empty graph', () => {
      const plan = planner.createPlan([]);
      expect(plan.phases).toHaveLength(0);
      expect(plan.estimatedParallelism).toBe(0);
    });
  });

  describe('WorkflowManager', () => {
    let manager: WorkflowManager;

    beforeEach(() => {
      manager = new WorkflowManager();
    });

    it('should create workflow from Mermaid', () => {
      const mermaid = `
        flowchart TD
          A[Fetch] --> B[Process]
          B --> C[Save]
      `;

      const dag = manager.createFromMermaid('Test Workflow', mermaid);

      expect(dag.id).toBeDefined();
      expect(dag.name).toBe('Test Workflow');
      expect(dag.nodes.size).toBe(3);
    });

    it('should get execution plan', () => {
      const mermaid = `
        flowchart TD
          A --> B
          B --> C
      `;

      const dag = manager.createFromMermaid('Test', mermaid);
      const plan = manager.getPlan(dag.id);

      expect(plan).toBeDefined();
      expect(plan?.phases.length).toBeGreaterThan(0);
    });

    it('should execute workflow', async () => {
      const mermaid = `
        flowchart TD
          A[Task A] --> B[Task B]
      `;

      const dag = manager.createFromMermaid('Test', mermaid);
      const mockExecutor = async (node: DAGNode) => {
        return { executed: true, nodeId: node.id };
      };

      const result = await manager.run(dag.id, mockExecutor);

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
      expect(result?.completedNodes).toBe(2);
      expect(result?.failedNodes).toBe(0);
    });

    it('should handle execution errors', async () => {
      const mermaid = `
        flowchart TD
          A[Task A] --> B[Task B]
      `;

      const dag = manager.createFromMermaid('Test', mermaid);
      const mockExecutor = async (node: DAGNode) => {
        if (node.id === 'B') throw new Error('Task B failed');
        return { executed: true };
      };

      const result = await manager.run(dag.id, mockExecutor);

      expect(result?.status).toBe('partial');
      expect(result?.completedNodes).toBe(1);
      expect(result?.failedNodes).toBe(1);
    });

    it('should list all workflows', () => {
      manager.createFromMermaid('Workflow 1', 'flowchart TD\nA --> B');
      manager.createFromMermaid('Workflow 2', 'flowchart TD\nC --> D');

      const list = manager.list();

      expect(list).toHaveLength(2);
    });

    it('should visualize workflow', () => {
      const mermaid = `
        flowchart TD
          A[Start] --> B{Valid?}
          B -->|yes| C[Process]
          B -->|no| D[Error]
      `;

      const dag = manager.createFromMermaid('Test', mermaid);
      const viz = manager.visualize(dag.id);

      expect(viz).toContain('Test');
      expect(viz).toContain('A');
      expect(viz).toContain('B');
    });
  });
});
