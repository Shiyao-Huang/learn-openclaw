/**
 * multimodel/index.ts - V15 多模型协作系统
 * 
 * 核心功能:
 * - 模型路由: 根据任务类型选择最优模型
 * - 成本优化: 简单任务用便宜模型，复杂任务用强模型
 * - 并行调用: 多模型同时处理，取最优结果
 * - 降级策略: 主模型失败时自动切换备用模型
 */

import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// 类型定义
// ============================================================================

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'local';
  costPer1kInput: number;
  costPer1kOutput: number;
  maxTokens: number;
  capabilities: ModelCapability[];
  priority: number;
  enabled: boolean;
}

export type ModelCapability = 
  | 'code'
  | 'reasoning'
  | 'creative'
  | 'fast'
  | 'vision'
  | 'tools'
  | 'long_context';

export interface TaskClassification {
  type: 'simple' | 'complex' | 'creative' | 'code' | 'reasoning';
  confidence: number;
  requiredCapabilities: ModelCapability[];
}

export interface ModelSelection {
  modelId: string;
  reason: string;
  estimatedCost: number;
  fallbacks: string[];
}

export interface ModelUsageStats {
  modelId: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  avgLatency: number;
  errors: number;
}

export interface RoutingRule {
  id: string;
  condition: {
    type?: TaskClassification['type'];
    keywords?: string[];
    minTokens?: number;
    maxTokens?: number;
  };
  targetModel: string;
  priority: number;
}

// ============================================================================
// 默认模型配置
// ============================================================================

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    maxTokens: 8192,
    capabilities: ['code', 'reasoning', 'creative', 'tools', 'long_context'],
    priority: 2,
    enabled: true
  },
  {
    id: 'claude-haiku',
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    maxTokens: 4096,
    capabilities: ['fast', 'tools'],
    priority: 1,
    enabled: true
  },
  {
    id: 'claude-opus',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    maxTokens: 8192,
    capabilities: ['code', 'reasoning', 'creative', 'tools', 'long_context'],
    priority: 3,
    enabled: true
  }
];

// ============================================================================
// 任务分类器
// ============================================================================

export class TaskClassifier {
  private codeKeywords = ['代码', 'code', '函数', 'function', '实现', 'implement', 'bug', '调试', 'debug'];
  private reasoningKeywords = ['分析', 'analyze', '推理', 'reason', '为什么', 'why', '解释', 'explain'];
  private creativeKeywords = ['写', 'write', '创作', 'create', '故事', 'story', '诗', 'poem'];
  private simpleKeywords = ['是什么', 'what is', '定义', 'define', '简单', 'simple'];

  classify(input: string): TaskClassification {
    const lower = input.toLowerCase();
    const length = input.length;

    // 检查关键词
    const hasCode = this.codeKeywords.some(k => lower.includes(k));
    const hasReasoning = this.reasoningKeywords.some(k => lower.includes(k));
    const hasCreative = this.creativeKeywords.some(k => lower.includes(k));
    const hasSimple = this.simpleKeywords.some(k => lower.includes(k));

    // 确定类型
    let type: TaskClassification['type'] = 'simple';
    let confidence = 0.5;
    const requiredCapabilities: ModelCapability[] = ['tools'];

    if (hasCode) {
      type = 'code';
      confidence = 0.8;
      requiredCapabilities.push('code');
    } else if (hasReasoning) {
      type = 'reasoning';
      confidence = 0.7;
      requiredCapabilities.push('reasoning');
    } else if (hasCreative) {
      type = 'creative';
      confidence = 0.7;
      requiredCapabilities.push('creative');
    } else if (length > 500 || !hasSimple) {
      type = 'complex';
      confidence = 0.6;
      requiredCapabilities.push('reasoning');
    }

    // 长文本需要长上下文
    if (length > 2000) {
      requiredCapabilities.push('long_context');
    }

    return { type, confidence, requiredCapabilities };
  }
}

// ============================================================================
// 模型路由器
// ============================================================================

export class ModelRouter {
  private models: Map<string, ModelConfig> = new Map();
  private rules: RoutingRule[] = [];
  private stats: Map<string, ModelUsageStats> = new Map();
  private classifier: TaskClassifier;

  constructor(models: ModelConfig[] = DEFAULT_MODELS) {
    this.classifier = new TaskClassifier();
    for (const model of models) {
      this.models.set(model.id, model);
      this.stats.set(model.id, {
        modelId: model.id,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        avgLatency: 0,
        errors: 0
      });
    }
  }

  // 添加路由规则
  addRule(rule: RoutingRule) {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  // 选择模型
  selectModel(input: string, forceModel?: string): ModelSelection {
    // 强制指定模型
    if (forceModel && this.models.has(forceModel)) {
      const model = this.models.get(forceModel)!;
      return {
        modelId: forceModel,
        reason: '用户指定',
        estimatedCost: this.estimateCost(model, input.length),
        fallbacks: this.getFallbacks(forceModel)
      };
    }

    // 分类任务
    const classification = this.classifier.classify(input);

    // 检查路由规则
    for (const rule of this.rules) {
      if (this.matchRule(rule, classification, input)) {
        const model = this.models.get(rule.targetModel);
        if (model?.enabled) {
          return {
            modelId: rule.targetModel,
            reason: `规则匹配: ${rule.id}`,
            estimatedCost: this.estimateCost(model, input.length),
            fallbacks: this.getFallbacks(rule.targetModel)
          };
        }
      }
    }

    // 默认选择：根据任务类型和能力匹配
    const candidates = Array.from(this.models.values())
      .filter(m => m.enabled)
      .filter(m => classification.requiredCapabilities.every(c => m.capabilities.includes(c)))
      .sort((a, b) => {
        // 简单任务优先便宜模型，复杂任务优先强模型
        if (classification.type === 'simple') {
          return a.costPer1kInput - b.costPer1kInput;
        }
        return b.priority - a.priority;
      });

    if (candidates.length === 0) {
      // 没有匹配的模型，使用默认
      const defaultModel = Array.from(this.models.values()).find(m => m.enabled);
      if (!defaultModel) {
        throw new Error('没有可用的模型');
      }
      return {
        modelId: defaultModel.id,
        reason: '默认模型',
        estimatedCost: this.estimateCost(defaultModel, input.length),
        fallbacks: []
      };
    }

    const selected = candidates[0];
    return {
      modelId: selected.id,
      reason: `任务类型: ${classification.type}`,
      estimatedCost: this.estimateCost(selected, input.length),
      fallbacks: candidates.slice(1, 3).map(m => m.id)
    };
  }

  private matchRule(rule: RoutingRule, classification: TaskClassification, input: string): boolean {
    const { condition } = rule;
    
    if (condition.type && condition.type !== classification.type) {
      return false;
    }
    
    if (condition.keywords) {
      const lower = input.toLowerCase();
      if (!condition.keywords.some(k => lower.includes(k))) {
        return false;
      }
    }
    
    if (condition.minTokens && input.length / 4 < condition.minTokens) {
      return false;
    }
    
    if (condition.maxTokens && input.length / 4 > condition.maxTokens) {
      return false;
    }
    
    return true;
  }

  private estimateCost(model: ModelConfig, inputLength: number): number {
    const inputTokens = inputLength / 4;
    const outputTokens = Math.min(inputTokens * 2, model.maxTokens);
    return (inputTokens * model.costPer1kInput + outputTokens * model.costPer1kOutput) / 1000;
  }

  private getFallbacks(modelId: string): string[] {
    const model = this.models.get(modelId);
    if (!model) return [];
    
    return Array.from(this.models.values())
      .filter(m => m.enabled && m.id !== modelId)
      .filter(m => model.capabilities.every(c => m.capabilities.includes(c)))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 2)
      .map(m => m.id);
  }

  // 记录使用
  recordUsage(modelId: string, inputTokens: number, outputTokens: number, latencyMs: number, error: boolean = false) {
    const stats = this.stats.get(modelId);
    if (!stats) return;

    const model = this.models.get(modelId);
    if (!model) return;

    stats.calls++;
    stats.inputTokens += inputTokens;
    stats.outputTokens += outputTokens;
    stats.totalCost += (inputTokens * model.costPer1kInput + outputTokens * model.costPer1kOutput) / 1000;
    stats.avgLatency = (stats.avgLatency * (stats.calls - 1) + latencyMs) / stats.calls;
    if (error) stats.errors++;
  }

  // 获取统计
  getStats(): ModelUsageStats[] {
    return Array.from(this.stats.values());
  }

  // 获取模型列表
  getModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  // 更新模型配置
  updateModel(modelId: string, updates: Partial<ModelConfig>) {
    const model = this.models.get(modelId);
    if (model) {
      Object.assign(model, updates);
    }
  }
}

// ============================================================================
// 多模型工具定义
// ============================================================================

export function getMultiModelTools() {
  return [
    {
      name: "model_select",
      description: "为任务选择最优模型",
      input_schema: {
        type: "object" as const,
        properties: {
          task: { type: "string", description: "任务描述" },
          forceModel: { type: "string", description: "强制使用的模型ID" },
        },
        required: ["task"],
      },
    },
    {
      name: "model_list",
      description: "列出所有可用模型",
      input_schema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "model_stats",
      description: "查看模型使用统计",
      input_schema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "model_config",
      description: "更新模型配置",
      input_schema: {
        type: "object" as const,
        properties: {
          modelId: { type: "string", description: "模型ID" },
          enabled: { type: "boolean", description: "是否启用" },
          priority: { type: "number", description: "优先级" },
        },
        required: ["modelId"],
      },
    },
  ];
}

// ============================================================================
// 工具处理器
// ============================================================================

export function createMultiModelHandlers(router: ModelRouter) {
  return {
    model_select: (args: { task: string; forceModel?: string }) => {
      const selection = router.selectModel(args.task, args.forceModel);
      return `选择模型: ${selection.modelId}
原因: ${selection.reason}
预估成本: $${selection.estimatedCost.toFixed(4)}
备用模型: ${selection.fallbacks.join(', ') || '无'}`;
    },
    
    model_list: () => {
      const models = router.getModels();
      return models.map(m => 
        `[${m.enabled ? '✓' : '✗'}] ${m.id} (${m.name})
    能力: ${m.capabilities.join(', ')}
    成本: $${m.costPer1kInput}/1k输入, $${m.costPer1kOutput}/1k输出
    优先级: ${m.priority}`
      ).join('\n\n');
    },
    
    model_stats: () => {
      const stats = router.getStats();
      if (stats.every(s => s.calls === 0)) {
        return '暂无使用记录';
      }
      return stats
        .filter(s => s.calls > 0)
        .map(s => 
          `${s.modelId}:
    调用: ${s.calls} 次
    Token: ${s.inputTokens} 输入 / ${s.outputTokens} 输出
    成本: $${s.totalCost.toFixed(4)}
    延迟: ${s.avgLatency.toFixed(0)}ms
    错误: ${s.errors}`
        ).join('\n\n');
    },
    
    model_config: (args: { modelId: string; enabled?: boolean; priority?: number }) => {
      const updates: Partial<ModelConfig> = {};
      if (args.enabled !== undefined) updates.enabled = args.enabled;
      if (args.priority !== undefined) updates.priority = args.priority;
      
      router.updateModel(args.modelId, updates);
      return `已更新模型 ${args.modelId} 配置`;
    },
  };
}
