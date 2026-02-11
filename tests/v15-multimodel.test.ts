/**
 * V15 Multi-Model System Tests
 *
 * Note: ModelRouter stores direct references to model config objects and
 * mutates them via Object.assign in updateModel(). To avoid cross-test
 * pollution of the module-level DEFAULT_MODELS array, every router in
 * these tests is constructed with a deep-cloned model list.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskClassifier,
  ModelRouter,
  DEFAULT_MODELS,
  getMultiModelTools,
  createMultiModelHandlers,
  type ModelConfig,
  type ModelCapability,
} from '../v15-agent/multimodel/index';

/**
 * Returns a deep copy of DEFAULT_MODELS so that mutations via
 * updateModel() do not leak between tests.
 */
function freshModels(): ModelConfig[] {
  return DEFAULT_MODELS.map(m => ({
    ...m,
    capabilities: [...m.capabilities],
  }));
}

// ============================================================================
// Model Registry Tests
// ============================================================================

describe('V15 Multi-Model System', () => {

  describe('Model Registry (DEFAULT_MODELS)', () => {
    it('should define three default models', () => {
      expect(DEFAULT_MODELS).toHaveLength(3);
    });

    it('should include Sonnet, Haiku, and Opus', () => {
      const ids = DEFAULT_MODELS.map(m => m.id);
      expect(ids).toContain('claude-sonnet');
      expect(ids).toContain('claude-haiku');
      expect(ids).toContain('claude-opus');
    });

    it('should have all models enabled by default', () => {
      for (const model of DEFAULT_MODELS) {
        expect(model.enabled).toBe(true);
      }
    });

    it('should set correct provider for all default models', () => {
      for (const model of DEFAULT_MODELS) {
        expect(model.provider).toBe('anthropic');
      }
    });

    it('should assign ascending priority: Haiku < Sonnet < Opus', () => {
      const haiku = DEFAULT_MODELS.find(m => m.id === 'claude-haiku')!;
      const sonnet = DEFAULT_MODELS.find(m => m.id === 'claude-sonnet')!;
      const opus = DEFAULT_MODELS.find(m => m.id === 'claude-opus')!;

      expect(haiku.priority).toBeLessThan(sonnet.priority);
      expect(sonnet.priority).toBeLessThan(opus.priority);
    });

    it('should have Haiku as the cheapest model', () => {
      const costs = DEFAULT_MODELS.map(m => m.costPer1kInput);
      const haiku = DEFAULT_MODELS.find(m => m.id === 'claude-haiku')!;
      expect(haiku.costPer1kInput).toBe(Math.min(...costs));
    });

    it('should give Haiku limited capabilities (fast + tools only)', () => {
      const haiku = DEFAULT_MODELS.find(m => m.id === 'claude-haiku')!;
      expect(haiku.capabilities).toEqual(['fast', 'tools']);
    });

    it('should give Sonnet and Opus full capabilities', () => {
      const sonnet = DEFAULT_MODELS.find(m => m.id === 'claude-sonnet')!;
      const opus = DEFAULT_MODELS.find(m => m.id === 'claude-opus')!;

      for (const cap of ['code', 'reasoning', 'creative', 'tools', 'long_context'] as ModelCapability[]) {
        expect(sonnet.capabilities).toContain(cap);
        expect(opus.capabilities).toContain(cap);
      }
    });
  });

  // ============================================================================
  // ModelRouter - Model Management
  // ============================================================================

  describe('ModelRouter - Model Management', () => {
    let router: ModelRouter;

    beforeEach(() => {
      router = new ModelRouter(freshModels());
    });

    it('should list all registered models', () => {
      const models = router.getModels();
      expect(models).toHaveLength(3);
    });

    it('should get model by selecting it with forceModel', () => {
      const selection = router.selectModel('any task', 'claude-opus');
      expect(selection.modelId).toBe('claude-opus');
      expect(selection.reason).toBe('用户指定');
    });

    it('should enable and disable models via updateModel', () => {
      router.updateModel('claude-haiku', { enabled: false });
      const models = router.getModels();
      const haiku = models.find(m => m.id === 'claude-haiku')!;
      expect(haiku.enabled).toBe(false);

      router.updateModel('claude-haiku', { enabled: true });
      const updated = router.getModels().find(m => m.id === 'claude-haiku')!;
      expect(updated.enabled).toBe(true);
    });

    it('should initialize with custom models', () => {
      const customModels: ModelConfig[] = [
        {
          id: 'custom-model',
          name: 'Custom Model',
          provider: 'local',
          costPer1kInput: 0.001,
          costPer1kOutput: 0.002,
          maxTokens: 2048,
          capabilities: ['fast'],
          priority: 1,
          enabled: true,
        },
      ];

      const customRouter = new ModelRouter(customModels);
      const models = customRouter.getModels();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('custom-model');
    });

    it('should throw when no models are available', () => {
      router.updateModel('claude-sonnet', { enabled: false });
      router.updateModel('claude-haiku', { enabled: false });
      router.updateModel('claude-opus', { enabled: false });

      expect(() => router.selectModel('any task')).toThrow('没有可用的模型');
    });

    it('should handle forceModel for non-existent model by falling through to classification', () => {
      // When forceModel is specified but doesn't exist, selectModel falls through
      // to classification-based routing which still finds enabled models
      const selection = router.selectModel('simple task', 'non-existent-model');
      expect(selection.modelId).toBeDefined();
    });

    it('should update model priority', () => {
      router.updateModel('claude-haiku', { priority: 100 });
      const models = router.getModels();
      const haiku = models.find(m => m.id === 'claude-haiku')!;
      expect(haiku.priority).toBe(100);
    });
  });

  // ============================================================================
  // Task Classifier Tests
  // ============================================================================

  describe('TaskClassifier', () => {
    let classifier: TaskClassifier;

    beforeEach(() => {
      classifier = new TaskClassifier();
    });

    describe('Simple Tasks', () => {
      it('should classify "what is X" as simple', () => {
        const result = classifier.classify('what is a variable?');
        expect(result.type).toBe('simple');
      });

      it('should classify "define X" as simple', () => {
        const result = classifier.classify('define recursion');
        expect(result.type).toBe('simple');
      });

      it('should classify tasks containing "simple" keyword as simple', () => {
        const result = classifier.classify('give me a simple answer');
        expect(result.type).toBe('simple');
      });

      it('should always include "tools" in requiredCapabilities', () => {
        const result = classifier.classify('what is a function?');
        expect(result.requiredCapabilities).toContain('tools');
      });

      it('should have 0.5 confidence for simple tasks', () => {
        const result = classifier.classify('what is a loop?');
        expect(result.confidence).toBe(0.5);
      });
    });

    describe('Code Tasks', () => {
      it('should classify "write function" as code', () => {
        const result = classifier.classify('write a function to sort arrays');
        expect(result.type).toBe('code');
        expect(result.requiredCapabilities).toContain('code');
      });

      it('should classify "fix bug" as code', () => {
        const result = classifier.classify('fix the bug in my code');
        expect(result.type).toBe('code');
      });

      it('should classify "implement feature" as code', () => {
        const result = classifier.classify('implement a binary search');
        expect(result.type).toBe('code');
      });

      it('should classify "debug this" as code', () => {
        const result = classifier.classify('debug this issue');
        expect(result.type).toBe('code');
      });

      it('should have high confidence for code tasks', () => {
        const result = classifier.classify('write a function');
        expect(result.confidence).toBe(0.8);
      });

      it('should classify Chinese code keywords correctly', () => {
        const result = classifier.classify('帮我写一段代码');
        expect(result.type).toBe('code');
      });
    });

    describe('Creative Tasks', () => {
      it('should classify "write a story" as creative', () => {
        // "write" triggers creative; no code keywords present
        const result = classifier.classify('write a story about space');
        expect(result.type).toBe('creative');
        expect(result.requiredCapabilities).toContain('creative');
      });

      it('should classify "poem" tasks as creative', () => {
        const result = classifier.classify('compose a poem about nature');
        expect(result.type).toBe('creative');
      });

      it('should classify Chinese creative keyword correctly', () => {
        const result = classifier.classify('帮我创作一首诗');
        expect(result.type).toBe('creative');
      });

      it('should classify "story" tasks as creative', () => {
        const result = classifier.classify('tell me a story');
        expect(result.type).toBe('creative');
      });

      it('should have 0.7 confidence for creative tasks', () => {
        const result = classifier.classify('create a poem');
        expect(result.confidence).toBe(0.7);
      });
    });

    describe('Reasoning Tasks', () => {
      it('should classify "analyze" tasks as reasoning', () => {
        const result = classifier.classify('analyze this dataset');
        expect(result.type).toBe('reasoning');
        expect(result.requiredCapabilities).toContain('reasoning');
      });

      it('should classify "why" questions as reasoning', () => {
        const result = classifier.classify('why does this happen?');
        expect(result.type).toBe('reasoning');
      });

      it('should classify "explain" tasks as reasoning', () => {
        const result = classifier.classify('explain the difference between TCP and UDP');
        expect(result.type).toBe('reasoning');
      });

      it('should classify Chinese reasoning keyword correctly', () => {
        const result = classifier.classify('请推理这个问题');
        expect(result.type).toBe('reasoning');
      });

      it('should have 0.7 confidence for reasoning tasks', () => {
        const result = classifier.classify('analyze this problem');
        expect(result.confidence).toBe(0.7);
      });
    });

    describe('Complex Tasks', () => {
      it('should classify long input (>500 chars) without keywords as complex', () => {
        const longInput = 'a'.repeat(501);
        const result = classifier.classify(longInput);
        expect(result.type).toBe('complex');
        expect(result.confidence).toBe(0.6);
      });

      it('should classify unknown tasks without simple keywords as complex', () => {
        // "hello there" has no simple/code/reasoning/creative keywords
        // and !hasSimple triggers complex branch
        const result = classifier.classify('hello there');
        expect(result.type).toBe('complex');
      });

      it('should add reasoning capability for complex tasks', () => {
        const result = classifier.classify('hello there, how are you doing');
        expect(result.requiredCapabilities).toContain('reasoning');
      });
    });

    describe('Long Context Detection', () => {
      it('should add long_context capability for inputs > 2000 chars', () => {
        const longInput = 'x'.repeat(2001);
        const result = classifier.classify(longInput);
        expect(result.requiredCapabilities).toContain('long_context');
      });

      it('should not add long_context for short inputs', () => {
        const result = classifier.classify('short input');
        expect(result.requiredCapabilities).not.toContain('long_context');
      });
    });

    describe('Keyword Priority', () => {
      it('should prioritize code over reasoning when both keywords present', () => {
        const result = classifier.classify('analyze the code and debug it');
        expect(result.type).toBe('code');
      });

      it('should prioritize code over creative when both present', () => {
        const result = classifier.classify('write code for the function');
        expect(result.type).toBe('code');
      });

      it('should prioritize reasoning over creative when both present', () => {
        const result = classifier.classify('analyze and write a report');
        expect(result.type).toBe('reasoning');
      });
    });
  });

  // ============================================================================
  // Model Router Tests
  // ============================================================================

  describe('ModelRouter - Routing', () => {
    let router: ModelRouter;

    beforeEach(() => {
      router = new ModelRouter(freshModels());
    });

    it('should route simple tasks to the cheapest capable model', () => {
      // "what is" triggers simple classification
      // Simple tasks: filter by requiredCapabilities (tools), sort by cost ascending
      // Haiku has 'tools' and is cheapest
      const selection = router.selectModel('what is a variable?');
      expect(selection.modelId).toBe('claude-haiku');
      expect(selection.reason).toContain('simple');
    });

    it('should route code tasks to the highest-priority capable model', () => {
      // Code tasks need 'code' + 'tools' capabilities, sorted by priority descending
      // Haiku lacks 'code', so Sonnet and Opus qualify; Opus has highest priority
      const selection = router.selectModel('write a function to sort arrays');
      expect(selection.modelId).toBe('claude-opus');
      expect(selection.reason).toContain('code');
    });

    it('should route reasoning tasks to the highest-priority model with reasoning', () => {
      const selection = router.selectModel('analyze this problem in detail');
      expect(selection.modelId).toBe('claude-opus');
      expect(selection.reason).toContain('reasoning');
    });

    it('should route creative tasks to the highest-priority model with creative', () => {
      const selection = router.selectModel('create a story about dragons');
      expect(selection.modelId).toBe('claude-opus');
      expect(selection.reason).toContain('creative');
    });

    it('should route complex tasks (no keywords) to highest-priority model with reasoning', () => {
      // "hello" has no keyword matches and is short, so !hasSimple triggers complex
      // complex requires 'reasoning'; Opus is highest priority with 'reasoning'
      const selection = router.selectModel('hello');
      expect(selection.modelId).toBe('claude-opus');
      expect(selection.reason).toContain('complex');
    });

    it('should provide fallback models in the selection', () => {
      const selection = router.selectModel('implement a search algorithm');
      // Code task -> Opus selected; Sonnet has matching capabilities
      expect(selection.fallbacks.length).toBeGreaterThan(0);
    });

    it('should use forceModel to override routing', () => {
      const selection = router.selectModel('complex reasoning task', 'claude-haiku');
      expect(selection.modelId).toBe('claude-haiku');
      expect(selection.reason).toBe('用户指定');
    });

    it('should return estimated cost in selection', () => {
      const selection = router.selectModel('what is a variable?');
      expect(selection.estimatedCost).toBeGreaterThan(0);
      expect(typeof selection.estimatedCost).toBe('number');
    });

    it('should fall back to enabled model when preferred is disabled', () => {
      router.updateModel('claude-opus', { enabled: false });
      // Code task: Opus disabled, Sonnet is next highest priority with 'code'
      const selection = router.selectModel('implement binary search');
      expect(selection.modelId).toBe('claude-sonnet');
    });

    it('should fall back to default model when no capability match', () => {
      const limitedModels: ModelConfig[] = [
        {
          id: 'limited-model',
          name: 'Limited',
          provider: 'local',
          costPer1kInput: 0.001,
          costPer1kOutput: 0.002,
          maxTokens: 1024,
          capabilities: ['fast'],
          priority: 1,
          enabled: true,
        },
      ];
      const limitedRouter = new ModelRouter(limitedModels);

      // Code task requires 'code' + 'tools', but model only has 'fast'
      // No candidates match, falls back to first enabled model
      const selection = limitedRouter.selectModel('write code');
      expect(selection.modelId).toBe('limited-model');
      expect(selection.reason).toBe('默认模型');
    });
  });

  // ============================================================================
  // Routing Rules Tests
  // ============================================================================

  describe('ModelRouter - Routing Rules', () => {
    let router: ModelRouter;

    beforeEach(() => {
      router = new ModelRouter(freshModels());
    });

    it('should match rules by task type', () => {
      router.addRule({
        id: 'code-to-sonnet',
        condition: { type: 'code' },
        targetModel: 'claude-sonnet',
        priority: 10,
      });

      const selection = router.selectModel('implement a function');
      expect(selection.modelId).toBe('claude-sonnet');
      expect(selection.reason).toContain('规则匹配');
      expect(selection.reason).toContain('code-to-sonnet');
    });

    it('should match rules by keywords', () => {
      router.addRule({
        id: 'urgent-to-haiku',
        condition: { keywords: ['urgent', 'quick'] },
        targetModel: 'claude-haiku',
        priority: 10,
      });

      const selection = router.selectModel('urgent: what is the status?');
      expect(selection.modelId).toBe('claude-haiku');
    });

    it('should sort rules by priority (higher first)', () => {
      router.addRule({
        id: 'low-priority',
        condition: { type: 'code' },
        targetModel: 'claude-haiku',
        priority: 1,
      });
      router.addRule({
        id: 'high-priority',
        condition: { type: 'code' },
        targetModel: 'claude-opus',
        priority: 10,
      });

      const selection = router.selectModel('write some code');
      expect(selection.modelId).toBe('claude-opus');
      expect(selection.reason).toContain('high-priority');
    });

    it('should skip rule if target model is disabled', () => {
      router.updateModel('claude-haiku', { enabled: false });
      router.addRule({
        id: 'all-to-haiku',
        condition: {},
        targetModel: 'claude-haiku',
        priority: 100,
      });

      const selection = router.selectModel('what is a variable?');
      // Haiku is disabled, so rule is skipped; falls through to classification
      expect(selection.modelId).not.toBe('claude-haiku');
    });

    it('should match rules by minTokens', () => {
      router.addRule({
        id: 'long-to-opus',
        condition: { minTokens: 100 },
        targetModel: 'claude-opus',
        priority: 10,
      });

      // Input of 401 chars => 100.25 tokens (chars/4) >= 100
      const longInput = 'a'.repeat(401);
      const selection = router.selectModel(longInput);
      expect(selection.modelId).toBe('claude-opus');
      expect(selection.reason).toContain('long-to-opus');
    });

    it('should match rules by maxTokens', () => {
      router.addRule({
        id: 'short-to-haiku',
        condition: { maxTokens: 10 },
        targetModel: 'claude-haiku',
        priority: 10,
      });

      // Input of 39 chars => 9.75 tokens < 10
      const shortInput = 'a'.repeat(39);
      const selection = router.selectModel(shortInput);
      expect(selection.modelId).toBe('claude-haiku');
      expect(selection.reason).toContain('short-to-haiku');
    });

    it('should not match when minTokens is not met', () => {
      router.addRule({
        id: 'long-to-opus',
        condition: { minTokens: 1000 },
        targetModel: 'claude-opus',
        priority: 10,
      });

      // "what is this" is short and won't meet minTokens
      // Also contains "what is" so classified as simple
      const selection = router.selectModel('what is this');
      expect(selection.reason).not.toContain('long-to-opus');
    });

    it('should not match when maxTokens is exceeded', () => {
      router.addRule({
        id: 'short-to-haiku',
        condition: { maxTokens: 5 },
        targetModel: 'claude-haiku',
        priority: 10,
      });

      // Long input will exceed maxTokens
      const longInput = 'a'.repeat(100);
      const selection = router.selectModel(longInput);
      expect(selection.reason).not.toContain('short-to-haiku');
    });

    it('should match combined type + keywords condition', () => {
      router.addRule({
        id: 'code-review',
        condition: { type: 'code', keywords: ['review'] },
        targetModel: 'claude-sonnet',
        priority: 10,
      });

      // Has both code keywords and 'review'
      const selection = router.selectModel('review this code please');
      expect(selection.modelId).toBe('claude-sonnet');
      expect(selection.reason).toContain('code-review');
    });

    it('should not match when type condition does not match', () => {
      router.addRule({
        id: 'creative-only',
        condition: { type: 'creative' },
        targetModel: 'claude-haiku',
        priority: 10,
      });

      // This is classified as 'code', not 'creative'
      const selection = router.selectModel('debug this code');
      expect(selection.reason).not.toContain('creative-only');
    });
  });

  // ============================================================================
  // Usage Stats Tests
  // ============================================================================

  describe('ModelRouter - Usage Stats', () => {
    let router: ModelRouter;

    beforeEach(() => {
      router = new ModelRouter(freshModels());
    });

    it('should initialize stats with zero values', () => {
      const stats = router.getStats();
      expect(stats).toHaveLength(3);
      for (const stat of stats) {
        expect(stat.calls).toBe(0);
        expect(stat.inputTokens).toBe(0);
        expect(stat.outputTokens).toBe(0);
        expect(stat.totalCost).toBe(0);
        expect(stat.avgLatency).toBe(0);
        expect(stat.errors).toBe(0);
      }
    });

    it('should track API calls per model', () => {
      router.recordUsage('claude-sonnet', 100, 200, 500);
      router.recordUsage('claude-sonnet', 150, 300, 600);

      const stats = router.getStats();
      const sonnetStats = stats.find(s => s.modelId === 'claude-sonnet')!;
      expect(sonnetStats.calls).toBe(2);
    });

    it('should track token usage', () => {
      router.recordUsage('claude-opus', 500, 1000, 800);

      const stats = router.getStats();
      const opusStats = stats.find(s => s.modelId === 'claude-opus')!;
      expect(opusStats.inputTokens).toBe(500);
      expect(opusStats.outputTokens).toBe(1000);
    });

    it('should accumulate tokens across multiple calls', () => {
      router.recordUsage('claude-haiku', 100, 200, 300);
      router.recordUsage('claude-haiku', 150, 250, 400);

      const stats = router.getStats();
      const haikuStats = stats.find(s => s.modelId === 'claude-haiku')!;
      expect(haikuStats.inputTokens).toBe(250);
      expect(haikuStats.outputTokens).toBe(450);
    });

    it('should calculate cost estimates based on model pricing', () => {
      // Sonnet: $0.003/1k input, $0.015/1k output
      router.recordUsage('claude-sonnet', 1000, 1000, 500);

      const stats = router.getStats();
      const sonnetStats = stats.find(s => s.modelId === 'claude-sonnet')!;
      // cost = (1000 * 0.003 + 1000 * 0.015) / 1000 = 0.018
      expect(sonnetStats.totalCost).toBeCloseTo(0.018, 6);
    });

    it('should accumulate costs across multiple calls', () => {
      // Haiku: $0.0008/1k input, $0.004/1k output
      router.recordUsage('claude-haiku', 1000, 500, 200);
      router.recordUsage('claude-haiku', 2000, 1000, 300);

      const stats = router.getStats();
      const haikuStats = stats.find(s => s.modelId === 'claude-haiku')!;
      // call1: (1000 * 0.0008 + 500 * 0.004) / 1000 = 0.0028
      // call2: (2000 * 0.0008 + 1000 * 0.004) / 1000 = 0.0056
      // total = 0.0084
      expect(haikuStats.totalCost).toBeCloseTo(0.0084, 6);
    });

    it('should calculate average latency correctly', () => {
      router.recordUsage('claude-opus', 100, 200, 500);
      router.recordUsage('claude-opus', 100, 200, 700);
      router.recordUsage('claude-opus', 100, 200, 900);

      const stats = router.getStats();
      const opusStats = stats.find(s => s.modelId === 'claude-opus')!;
      // avg = (500 + 700 + 900) / 3 = 700
      expect(opusStats.avgLatency).toBeCloseTo(700, 1);
    });

    it('should update average latency incrementally', () => {
      router.recordUsage('claude-opus', 100, 200, 100);
      const stats1 = router.getStats().find(s => s.modelId === 'claude-opus')!;
      expect(stats1.avgLatency).toBeCloseTo(100, 1);

      router.recordUsage('claude-opus', 100, 200, 300);
      const stats2 = router.getStats().find(s => s.modelId === 'claude-opus')!;
      // (100 * 1 + 300) / 2 = 200
      expect(stats2.avgLatency).toBeCloseTo(200, 1);
    });

    it('should track errors', () => {
      router.recordUsage('claude-sonnet', 100, 0, 500, true);
      router.recordUsage('claude-sonnet', 100, 200, 600, false);
      router.recordUsage('claude-sonnet', 100, 0, 400, true);

      const stats = router.getStats();
      const sonnetStats = stats.find(s => s.modelId === 'claude-sonnet')!;
      expect(sonnetStats.errors).toBe(2);
      expect(sonnetStats.calls).toBe(3);
    });

    it('should not count non-error calls as errors', () => {
      router.recordUsage('claude-haiku', 100, 200, 300);
      router.recordUsage('claude-haiku', 100, 200, 300, false);

      const stats = router.getStats();
      const haikuStats = stats.find(s => s.modelId === 'claude-haiku')!;
      expect(haikuStats.errors).toBe(0);
    });

    it('should silently ignore recording for unknown model', () => {
      // Should not throw
      router.recordUsage('non-existent', 100, 200, 500);
      const stats = router.getStats();
      expect(stats.find(s => s.modelId === 'non-existent')).toBeUndefined();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('ModelRouter - Configuration', () => {
    it('should use default models when no config provided', () => {
      const router = new ModelRouter(freshModels());
      const models = router.getModels();
      expect(models).toHaveLength(DEFAULT_MODELS.length);
    });

    it('should accept custom model configurations', () => {
      const customModels: ModelConfig[] = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          costPer1kInput: 0.01,
          costPer1kOutput: 0.03,
          maxTokens: 4096,
          capabilities: ['code', 'reasoning', 'creative', 'tools'],
          priority: 3,
          enabled: true,
        },
        {
          id: 'local-llm',
          name: 'Local LLM',
          provider: 'local',
          costPer1kInput: 0,
          costPer1kOutput: 0,
          maxTokens: 2048,
          capabilities: ['fast', 'tools'],
          priority: 1,
          enabled: true,
        },
      ];

      const router = new ModelRouter(customModels);
      const models = router.getModels();
      expect(models).toHaveLength(2);
      expect(models.map(m => m.id)).toContain('gpt-4');
      expect(models.map(m => m.id)).toContain('local-llm');
    });

    it('should update priority via updateModel', () => {
      const router = new ModelRouter(freshModels());
      router.updateModel('claude-haiku', { priority: 10 });

      const models = router.getModels();
      const haiku = models.find(m => m.id === 'claude-haiku')!;
      expect(haiku.priority).toBe(10);
    });

    it('should support partial updates via updateModel', () => {
      const router = new ModelRouter(freshModels());
      const originalName = router.getModels().find(m => m.id === 'claude-haiku')!.name;

      router.updateModel('claude-haiku', { priority: 50 });

      const updated = router.getModels().find(m => m.id === 'claude-haiku')!;
      expect(updated.priority).toBe(50);
      expect(updated.name).toBe(originalName); // unchanged
    });

    it('should silently ignore updateModel for non-existent model', () => {
      const router = new ModelRouter(freshModels());
      // Should not throw
      router.updateModel('non-existent', { enabled: false });
      expect(router.getModels()).toHaveLength(3);
    });

    it('should affect routing after priority change', () => {
      const router = new ModelRouter(freshModels());
      // Boost Sonnet above Opus
      router.updateModel('claude-sonnet', { priority: 100 });

      // Code task -> highest priority with 'code' capability
      const selection = router.selectModel('implement a function');
      expect(selection.modelId).toBe('claude-sonnet');
    });

    it('should affect routing after disabling a model', () => {
      const router = new ModelRouter(freshModels());
      // Disable Opus
      router.updateModel('claude-opus', { enabled: false });

      // Code task -> Sonnet (next highest with 'code')
      const selection = router.selectModel('debug the code');
      expect(selection.modelId).toBe('claude-sonnet');
    });
  });

  // ============================================================================
  // Tool Definitions Tests
  // ============================================================================

  describe('getMultiModelTools', () => {
    it('should return four tool definitions', () => {
      const tools = getMultiModelTools();
      expect(tools).toHaveLength(4);
    });

    it('should define model_select tool', () => {
      const tools = getMultiModelTools();
      const selectTool = tools.find(t => t.name === 'model_select');
      expect(selectTool).toBeDefined();
      expect(selectTool!.input_schema.required).toContain('task');
    });

    it('should define model_list tool', () => {
      const tools = getMultiModelTools();
      const listTool = tools.find(t => t.name === 'model_list');
      expect(listTool).toBeDefined();
    });

    it('should define model_stats tool', () => {
      const tools = getMultiModelTools();
      const statsTool = tools.find(t => t.name === 'model_stats');
      expect(statsTool).toBeDefined();
    });

    it('should define model_config tool with required modelId', () => {
      const tools = getMultiModelTools();
      const configTool = tools.find(t => t.name === 'model_config');
      expect(configTool).toBeDefined();
      expect(configTool!.input_schema.required).toContain('modelId');
    });

    it('should have description for each tool', () => {
      const tools = getMultiModelTools();
      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(typeof tool.description).toBe('string');
      }
    });

    it('should have valid input_schema type for each tool', () => {
      const tools = getMultiModelTools();
      for (const tool of tools) {
        expect(tool.input_schema.type).toBe('object');
      }
    });
  });

  // ============================================================================
  // Tool Handlers Tests
  // ============================================================================

  describe('createMultiModelHandlers', () => {
    let router: ModelRouter;
    let handlers: ReturnType<typeof createMultiModelHandlers>;

    beforeEach(() => {
      router = new ModelRouter(freshModels());
      handlers = createMultiModelHandlers(router);
    });

    describe('model_select handler', () => {
      it('should return selection details as formatted string', () => {
        const result = handlers.model_select({ task: 'what is TypeScript?' });
        expect(result).toContain('选择模型:');
        expect(result).toContain('原因:');
        expect(result).toContain('预估成本:');
        expect(result).toContain('备用模型:');
      });

      it('should respect forceModel parameter', () => {
        const result = handlers.model_select({ task: 'any', forceModel: 'claude-haiku' });
        expect(result).toContain('claude-haiku');
        expect(result).toContain('用户指定');
      });

      it('should include cost with dollar sign', () => {
        const result = handlers.model_select({ task: 'what is JavaScript?' });
        expect(result).toMatch(/\$\d+\.\d+/);
      });
    });

    describe('model_list handler', () => {
      it('should list all models with status indicators', () => {
        const result = handlers.model_list();
        expect(result).toContain('claude-sonnet');
        expect(result).toContain('claude-haiku');
        expect(result).toContain('claude-opus');
      });

      it('should show enabled checkmark for enabled models', () => {
        const result = handlers.model_list();
        // All models are enabled, so should have check mark
        const checkCount = (result.match(/\u2713/g) || []).length;
        expect(checkCount).toBe(3);
      });

      it('should show disabled indicator for disabled models', () => {
        router.updateModel('claude-haiku', { enabled: false });
        const result = handlers.model_list();
        // Should contain cross mark for disabled model
        expect(result).toContain('\u2717');
      });

      it('should display capabilities', () => {
        const result = handlers.model_list();
        expect(result).toContain('code');
        expect(result).toContain('reasoning');
        expect(result).toContain('fast');
      });

      it('should display cost information', () => {
        const result = handlers.model_list();
        expect(result).toContain('$');
        expect(result).toContain('1k');
      });

      it('should display priority for each model', () => {
        const result = handlers.model_list();
        expect(result).toContain('优先级:');
      });
    });

    describe('model_stats handler', () => {
      it('should return "no records" when no usage', () => {
        const result = handlers.model_stats();
        expect(result).toBe('暂无使用记录');
      });

      it('should show stats after recording usage', () => {
        router.recordUsage('claude-sonnet', 500, 1000, 300);
        const result = handlers.model_stats();
        expect(result).toContain('claude-sonnet');
        expect(result).toContain('500');   // inputTokens
        expect(result).toContain('1000');  // outputTokens
        expect(result).toContain('$');     // cost
      });

      it('should only show models with usage', () => {
        router.recordUsage('claude-opus', 100, 200, 500);
        const result = handlers.model_stats();
        expect(result).toContain('claude-opus');
        expect(result).not.toContain('claude-haiku');
        expect(result).not.toContain('claude-sonnet');
      });

      it('should display call count', () => {
        router.recordUsage('claude-haiku', 100, 200, 300);
        router.recordUsage('claude-haiku', 100, 200, 300);
        const result = handlers.model_stats();
        expect(result).toContain('2');
      });

      it('should display error count', () => {
        router.recordUsage('claude-sonnet', 100, 0, 500, true);
        const result = handlers.model_stats();
        expect(result).toContain('错误: 1');
      });
    });

    describe('model_config handler', () => {
      it('should update model enabled state', () => {
        const result = handlers.model_config({ modelId: 'claude-haiku', enabled: false });
        expect(result).toContain('已更新');
        expect(result).toContain('claude-haiku');

        const models = router.getModels();
        const haiku = models.find(m => m.id === 'claude-haiku')!;
        expect(haiku.enabled).toBe(false);
      });

      it('should update model priority', () => {
        handlers.model_config({ modelId: 'claude-sonnet', priority: 99 });

        const models = router.getModels();
        const sonnet = models.find(m => m.id === 'claude-sonnet')!;
        expect(sonnet.priority).toBe(99);
      });

      it('should handle updates with only modelId (no changes)', () => {
        const result = handlers.model_config({ modelId: 'claude-opus' });
        expect(result).toContain('已更新');
      });

      it('should handle both enabled and priority updates at once', () => {
        handlers.model_config({ modelId: 'claude-haiku', enabled: false, priority: 50 });

        const models = router.getModels();
        const haiku = models.find(m => m.id === 'claude-haiku')!;
        expect(haiku.enabled).toBe(false);
        expect(haiku.priority).toBe(50);
      });
    });
  });

  // ============================================================================
  // Cost Estimation Tests
  // ============================================================================

  describe('Cost Estimation', () => {
    let router: ModelRouter;

    beforeEach(() => {
      router = new ModelRouter(freshModels());
    });

    it('should estimate higher cost for longer inputs', () => {
      const shortSelection = router.selectModel('hi', 'claude-sonnet');
      const longSelection = router.selectModel('a'.repeat(1000), 'claude-sonnet');

      expect(longSelection.estimatedCost).toBeGreaterThan(shortSelection.estimatedCost);
    });

    it('should estimate higher cost for more expensive models', () => {
      const haikuSelection = router.selectModel('what is X?', 'claude-haiku');
      const opusSelection = router.selectModel('what is X?', 'claude-opus');

      expect(opusSelection.estimatedCost).toBeGreaterThan(haikuSelection.estimatedCost);
    });

    it('should estimate cost proportional to input length', () => {
      const input1 = 'a'.repeat(100);
      const input2 = 'a'.repeat(200);

      const sel1 = router.selectModel(input1, 'claude-sonnet');
      const sel2 = router.selectModel(input2, 'claude-sonnet');

      // Cost should roughly double when input doubles
      const ratio = sel2.estimatedCost / sel1.estimatedCost;
      expect(ratio).toBeGreaterThan(1.5);
      expect(ratio).toBeLessThan(2.5);
    });

    it('should cap output tokens at model maxTokens', () => {
      // Very large input where inputTokens * 2 > maxTokens
      // Sonnet maxTokens = 8192
      // We need input where inputLength/4 * 2 > 8192 => inputLength > 16384
      const largeInput = 'x'.repeat(20000);
      const selection = router.selectModel(largeInput, 'claude-sonnet');

      // inputTokens = 20000/4 = 5000
      // outputTokens = min(5000*2, 8192) = 8192
      // cost = (5000 * 0.003 + 8192 * 0.015) / 1000
      const expectedCost = (5000 * 0.003 + 8192 * 0.015) / 1000;
      expect(selection.estimatedCost).toBeCloseTo(expectedCost, 6);
    });

    it('should estimate zero cost for zero-cost model', () => {
      const freeModel: ModelConfig[] = [{
        id: 'free-model',
        name: 'Free',
        provider: 'local',
        costPer1kInput: 0,
        costPer1kOutput: 0,
        maxTokens: 4096,
        capabilities: ['fast', 'tools'],
        priority: 1,
        enabled: true,
      }];
      const freeRouter = new ModelRouter(freeModel);

      const selection = freeRouter.selectModel('test', 'free-model');
      expect(selection.estimatedCost).toBe(0);
    });
  });

  // ============================================================================
  // Fallback Tests
  // ============================================================================

  describe('Fallback Logic', () => {
    let router: ModelRouter;

    beforeEach(() => {
      router = new ModelRouter(freshModels());
    });

    it('should provide fallbacks with matching capabilities for Opus', () => {
      // Force Opus: fallbacks should have all of Opus's capabilities
      // Opus: code, reasoning, creative, tools, long_context
      // Sonnet: code, reasoning, creative, tools, long_context (same set)
      // Haiku: fast, tools (missing code, reasoning, creative, long_context)
      const selection = router.selectModel('test', 'claude-opus');
      expect(selection.fallbacks).toContain('claude-sonnet');
      expect(selection.fallbacks).not.toContain('claude-haiku');
    });

    it('should return empty fallbacks for Haiku (limited capabilities)', () => {
      const selection = router.selectModel('test', 'claude-haiku');
      // Haiku: fast, tools
      // Sonnet and Opus don't have 'fast', so they don't match ALL of Haiku's caps
      expect(selection.fallbacks).toHaveLength(0);
    });

    it('should order fallbacks by priority (highest first)', () => {
      const selection = router.selectModel('test', 'claude-sonnet');
      // Sonnet: code, reasoning, creative, tools, long_context
      // Opus has all of these and higher priority (3 > 2)
      expect(selection.fallbacks.length).toBeGreaterThan(0);
      expect(selection.fallbacks[0]).toBe('claude-opus');
    });

    it('should exclude disabled models from fallbacks', () => {
      router.updateModel('claude-sonnet', { enabled: false });
      const selection = router.selectModel('test', 'claude-opus');
      expect(selection.fallbacks).not.toContain('claude-sonnet');
    });

    it('should limit fallbacks to at most 2 models', () => {
      // getFallbacks slices to 2
      const selection = router.selectModel('test', 'claude-opus');
      expect(selection.fallbacks.length).toBeLessThanOrEqual(2);
    });

    it('should provide fallbacks from selectModel classification path', () => {
      // Code task -> Opus selected, candidates include Sonnet
      const selection = router.selectModel('implement a search algorithm');
      expect(selection.modelId).toBe('claude-opus');
      // Fallbacks come from candidates.slice(1, 3)
      expect(selection.fallbacks).toContain('claude-sonnet');
    });

    it('should return empty fallbacks when no other models match capabilities', () => {
      const singleModel: ModelConfig[] = [{
        id: 'only-model',
        name: 'Only Model',
        provider: 'local',
        costPer1kInput: 0.001,
        costPer1kOutput: 0.002,
        maxTokens: 2048,
        capabilities: ['fast', 'tools'],
        priority: 1,
        enabled: true,
      }];
      const singleRouter = new ModelRouter(singleModel);
      const selection = singleRouter.selectModel('test', 'only-model');
      expect(selection.fallbacks).toHaveLength(0);
    });
  });
});
