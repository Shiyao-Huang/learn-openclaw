/**
 * workflow/dag.ts - V16 DAG 工作流引擎
 * 
 * 核心功能:
 * - Mermaid → DAG 解析: 从 Mermaid flowchart 提取节点和依赖
 * - 并行执行: 识别可并行的任务
 * - 条件分支: 支持 if/else 逻辑
 * - 错误恢复: 失败重试和回滚
 */

// ============================================================================
// 类型定义
// ============================================================================

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface DAGNode {
  id: string;
  label: string;
  type: 'task' | 'condition' | 'start' | 'end';
  dependsOn: string[];
  status: NodeStatus;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  retries?: number;
}

export interface DAGEdge {
  from: string;
  to: string;
  condition?: string;  // 条件分支: "yes" | "no" | undefined
}

export interface DAG {
  id: string;
  name: string;
  nodes: Map<string, DAGNode>;
  edges: DAGEdge[];
  createdAt: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ExecutionPlan {
  phases: string[][];  // 每个 phase 包含可并行执行的节点 ID
  totalNodes: number;
  estimatedParallelism: number;
}

export interface WorkflowResult {
  dagId: string;
  status: 'completed' | 'failed' | 'partial';
  completedNodes: number;
  failedNodes: number;
  totalTime: number;
  results: Record<string, any>;
  errors: Record<string, string>;
}

// ============================================================================
// Mermaid 解析器
// ============================================================================

export class MermaidParser {
  /**
   * 解析 Mermaid flowchart 语法
   * 
   * 支持的语法:
   * - A[Task A] --> B[Task B]
   * - A --> B --> C
   * - A{Condition} -->|yes| B
   * - A((Start))
   * - A[[End]]
   */
  parse(mermaid: string): { nodes: DAGNode[]; edges: DAGEdge[] } {
    const nodes: Map<string, DAGNode> = new Map();
    const edges: DAGEdge[] = [];
    
    // 移除 flowchart 声明行
    const lines = mermaid
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('flowchart') && !l.startsWith('graph') && !l.startsWith('%%'));
    
    for (const line of lines) {
      // 解析节点定义和边
      this.parseLine(line, nodes, edges);
    }
    
    // 计算 dependsOn
    for (const edge of edges) {
      const toNode = nodes.get(edge.to);
      if (toNode && !toNode.dependsOn.includes(edge.from)) {
        toNode.dependsOn.push(edge.from);
      }
    }
    
    return { nodes: Array.from(nodes.values()), edges };
  }
  
  private parseLine(line: string, nodes: Map<string, DAGNode>, edges: DAGEdge[]) {
    // 匹配边: A --> B 或 A -->|condition| B
    const edgePattern = /([\w\u4e00-\u9fff\u3400-\u4dbf]+)(?:\[.*?\]|\{.*?\}|\(\(.*?\)\)|\[\[.*?\]\])?\s*-->\s*(?:\|([\w\u4e00-\u9fff\u3400-\u4dbf]+)\|)?\s*([\w\u4e00-\u9fff\u3400-\u4dbf]+)(?:\[.*?\]|\{.*?\}|\(\(.*?\)\)|\[\[.*?\]\])?/g;
    
    let match;
    while ((match = edgePattern.exec(line)) !== null) {
      const [_, fromId, condition, toId] = match;
      
      // 确保节点存在
      if (!nodes.has(fromId)) {
        nodes.set(fromId, this.createNode(fromId, line));
      }
      if (!nodes.has(toId)) {
        nodes.set(toId, this.createNode(toId, line));
      }
      
      edges.push({
        from: fromId,
        to: toId,
        condition: condition || undefined
      });
    }
    
    // 匹配独立节点定义
    const nodePatterns = [
      /([\w\u4e00-\u9fff\u3400-\u4dbf]+)\[([^\]]+)\]/,           // A[Task A] - 普通任务
      /([\w\u4e00-\u9fff\u3400-\u4dbf]+)\{([^}]+)\}/,            // A{Condition} - 条件
      /([\w\u4e00-\u9fff\u3400-\u4dbf]+)\(\(([^)]+)\)\)/,        // A((Start)) - 开始
      /([\w\u4e00-\u9fff\u3400-\u4dbf]+)\[\[([^\]]+)\]\]/,       // A[[End]] - 结束
    ];
    
    for (const pattern of nodePatterns) {
      const nodeMatch = line.match(pattern);
      if (nodeMatch && !nodes.has(nodeMatch[1])) {
        nodes.set(nodeMatch[1], this.createNode(nodeMatch[1], line));
      }
    }
  }
  
  private createNode(id: string, line: string): DAGNode {
    let label = id;
    let type: DAGNode['type'] = 'task';
    
    // 转义 id 中的正则特殊字符
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 提取标签和类型
    const labelMatch = line.match(new RegExp(`${escapedId}\\[([^\\]]+)\\]`));
    if (labelMatch) {
      label = labelMatch[1];
      type = 'task';
    }
    
    const condMatch = line.match(new RegExp(`${escapedId}\\{([^}]+)\\}`));
    if (condMatch) {
      label = condMatch[1];
      type = 'condition';
    }
    
    const startMatch = line.match(new RegExp(`${escapedId}\\(\\(([^)]+)\\)\\)`));
    if (startMatch) {
      label = startMatch[1];
      type = 'start';
    }
    
    const endMatch = line.match(new RegExp(`${escapedId}\\[\\[([^\\]]+)\\]\\]`));
    if (endMatch) {
      label = endMatch[1];
      type = 'end';
    }
    
    return {
      id,
      label,
      type,
      dependsOn: [],
      status: 'pending'
    };
  }
}

// ============================================================================
// 执行计划器
// ============================================================================

export class ExecutionPlanner {
  /**
   * 生成执行计划，识别可并行的任务
   */
  plan(dag: DAG): ExecutionPlan {
    const phases: string[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(dag.nodes.keys());
    
    while (remaining.size > 0) {
      const phase: string[] = [];
      
      for (const nodeId of remaining) {
        const node = dag.nodes.get(nodeId)!;
        
        // 检查所有依赖是否已完成
        const depsCompleted = node.dependsOn.every(dep => completed.has(dep));
        
        if (depsCompleted) {
          phase.push(nodeId);
        }
      }
      
      if (phase.length === 0) {
        // 检测循环依赖
        console.error('检测到循环依赖或无法解析的依赖');
        break;
      }
      
      phases.push(phase);
      
      for (const nodeId of phase) {
        completed.add(nodeId);
        remaining.delete(nodeId);
      }
    }
    
    return {
      phases,
      totalNodes: dag.nodes.size,
      estimatedParallelism: phases.length > 0 
        ? dag.nodes.size / phases.length 
        : 0
    };
  }
}

// ============================================================================
// DAG 执行器
// ============================================================================

export type TaskExecutor = (node: DAGNode, context: Record<string, any>) => Promise<any>;

export class DAGExecutor {
  private maxRetries: number;
  private retryDelay: number;
  
  constructor(options: { maxRetries?: number; retryDelay?: number } = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
  }
  
  /**
   * 执行 DAG
   */
  async execute(
    dag: DAG, 
    executor: TaskExecutor,
    options: { 
      onNodeStart?: (node: DAGNode) => void;
      onNodeComplete?: (node: DAGNode) => void;
      onNodeFail?: (node: DAGNode, error: Error) => void;
      context?: Record<string, any>;
    } = {}
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const planner = new ExecutionPlanner();
    const plan = planner.plan(dag);
    
    dag.status = 'running';
    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};
    const context = options.context || {};
    
    let completedNodes = 0;
    let failedNodes = 0;
    
    for (const phase of plan.phases) {
      // 并行执行当前阶段的所有节点
      const promises = phase.map(async (nodeId) => {
        const node = dag.nodes.get(nodeId)!;
        
        // 跳过 start/end 节点
        if (node.type === 'start' || node.type === 'end') {
          node.status = 'completed';
          completedNodes++;
          return;
        }
        
        // 检查条件分支
        if (this.shouldSkip(node, dag, results)) {
          node.status = 'skipped';
          return;
        }
        
        node.status = 'running';
        node.startTime = Date.now();
        options.onNodeStart?.(node);
        
        try {
          // 带重试的执行
          const result = await this.executeWithRetry(node, executor, context);
          node.result = result;
          node.status = 'completed';
          node.endTime = Date.now();
          results[nodeId] = result;
          completedNodes++;
          options.onNodeComplete?.(node);
        } catch (error: any) {
          node.error = error.message;
          node.status = 'failed';
          node.endTime = Date.now();
          errors[nodeId] = error.message;
          failedNodes++;
          options.onNodeFail?.(node, error);
        }
      });
      
      await Promise.all(promises);
      
      // 如果有失败且没有后续可执行节点，提前终止
      if (failedNodes > 0) {
        const hasRunnableNodes = plan.phases
          .slice(plan.phases.indexOf(phase) + 1)
          .some(p => p.some(id => {
            const n = dag.nodes.get(id)!;
            return n.dependsOn.every(dep => {
              const depNode = dag.nodes.get(dep);
              return depNode?.status === 'completed';
            });
          }));
        
        if (!hasRunnableNodes) {
          break;
        }
      }
    }
    
    dag.status = failedNodes > 0 
      ? (completedNodes > 0 ? 'failed' : 'failed')
      : 'completed';
    
    return {
      dagId: dag.id,
      status: failedNodes === 0 ? 'completed' : (completedNodes > 0 ? 'partial' : 'failed'),
      completedNodes,
      failedNodes,
      totalTime: Date.now() - startTime,
      results,
      errors
    };
  }
  
  private shouldSkip(node: DAGNode, dag: DAG, results: Record<string, any>): boolean {
    // 检查是否有条件边指向此节点
    for (const edge of dag.edges) {
      if (edge.to === node.id && edge.condition) {
        const fromNode = dag.nodes.get(edge.from);
        if (fromNode?.type === 'condition') {
          const conditionResult = results[edge.from];
          // 如果条件结果与边条件不匹配，跳过
          if (conditionResult !== undefined) {
            const matches = (conditionResult === true && edge.condition === 'yes') ||
                           (conditionResult === false && edge.condition === 'no');
            if (!matches) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
  
  private async executeWithRetry(
    node: DAGNode, 
    executor: TaskExecutor,
    context: Record<string, any>
  ): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        node.retries = attempt;
        return await executor(node, context);
      } catch (error: any) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 工作流管理器
// ============================================================================

export class WorkflowManager {
  private parser: MermaidParser;
  private planner: ExecutionPlanner;
  private executor: DAGExecutor;
  private workflows: Map<string, DAG> = new Map();
  
  constructor() {
    this.parser = new MermaidParser();
    this.planner = new ExecutionPlanner();
    this.executor = new DAGExecutor();
  }
  
  /**
   * 从 Mermaid 创建工作流
   */
  createFromMermaid(name: string, mermaid: string): DAG {
    const { nodes, edges } = this.parser.parse(mermaid);
    
    const dag: DAG = {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      nodes: new Map(nodes.map(n => [n.id, n])),
      edges,
      createdAt: Date.now(),
      status: 'pending'
    };
    
    this.workflows.set(dag.id, dag);
    return dag;
  }
  
  /**
   * 获取执行计划
   */
  getPlan(dagId: string): ExecutionPlan | null {
    const dag = this.workflows.get(dagId);
    if (!dag) return null;
    return this.planner.plan(dag);
  }
  
  /**
   * 执行工作流
   */
  async run(
    dagId: string, 
    executor: TaskExecutor,
    options?: Parameters<DAGExecutor['execute']>[2]
  ): Promise<WorkflowResult | null> {
    const dag = this.workflows.get(dagId);
    if (!dag) return null;
    return this.executor.execute(dag, executor, options);
  }
  
  /**
   * 获取工作流状态
   */
  getStatus(dagId: string): DAG | null {
    return this.workflows.get(dagId) || null;
  }
  
  /**
   * 列出所有工作流
   */
  list(): Array<{ id: string; name: string; status: string; nodeCount: number }> {
    return Array.from(this.workflows.values()).map(dag => ({
      id: dag.id,
      name: dag.name,
      status: dag.status,
      nodeCount: dag.nodes.size
    }));
  }
  
  /**
   * 可视化 DAG (ASCII)
   */
  visualize(dagId: string): string {
    const dag = this.workflows.get(dagId);
    if (!dag) return '工作流不存在';
    
    const plan = this.planner.plan(dag);
    const lines: string[] = [`工作流: ${dag.name} (${dag.id})`];
    lines.push(`状态: ${dag.status}`);
    lines.push(`节点: ${dag.nodes.size}, 阶段: ${plan.phases.length}`);
    lines.push('');
    
    for (let i = 0; i < plan.phases.length; i++) {
      const phase = plan.phases[i];
      lines.push(`阶段 ${i + 1}:`);
      for (const nodeId of phase) {
        const node = dag.nodes.get(nodeId)!;
        const statusIcon = {
          'pending': '○',
          'running': '◐',
          'completed': '●',
          'failed': '✗',
          'skipped': '◌'
        }[node.status];
        lines.push(`  ${statusIcon} ${node.id}: ${node.label} [${node.type}]`);
      }
    }
    
    return lines.join('\n');
  }
}
