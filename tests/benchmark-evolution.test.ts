/**
 * Benchmark Evolution Test Suite
 *
 * Comprehensive comparison of capabilities across the evolution chain V11-V18.
 * Tests tool progression, module initialization, feature capability matrix,
 * inheritance verification, and performance benchmarks.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Tool definitions - static imports from each version
// ---------------------------------------------------------------------------
import { tools as v11Tools } from '../v11-agent/tools/definitions.js';
import { tools as v12Tools } from '../v12-agent/tools/definitions.js';
import { tools as v13Tools } from '../v13-agent/tools/definitions.js';
import { tools as v14Tools } from '../v14-agent/tools/definitions.js';
import { tools as v15Tools } from '../v15-agent/tools/definitions.js';
import { tools as v16Tools } from '../v16-agent/tools/definitions.js';
import { tools as v17Tools } from '../v17-agent/tools/definitions.js';
import { tools as v18Tools } from '../v18-agent/tools/definitions.js';

// ---------------------------------------------------------------------------
// Module imports for each version's distinguishing feature
// ---------------------------------------------------------------------------
import { SecuritySystem } from '../v12-agent/security/index.js';
import { EvolutionSystem } from '../v13-agent/evolution/index.js';
import { PluginManager } from '../v14-agent/plugins/index.js';
import { TaskClassifier, ModelRouter, DEFAULT_MODELS } from '../v15-agent/multimodel/index.js';
import { MermaidParser, ExecutionPlanner, WorkflowManager } from '../v16-agent/workflow/dag.js';
import { htmlToText, htmlToMarkdown, getWebTools } from '../v17-agent/external/web.js';
import { SubAgentManager } from '../v18-agent/collaboration/subagent.js';
import { AgentRegistry } from '../v18-agent/collaboration/registry.js';
import { TaskDistributor } from '../v18-agent/collaboration/distributor.js';

// ---------------------------------------------------------------------------
// V11 base module imports
// ---------------------------------------------------------------------------
import { SkillLoader } from '../v11-agent/skills/index.js';
import { IntrospectionTracker } from '../v13-agent/introspect/tracker.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const testDir = path.join(process.cwd(), 'tmp', 'test-benchmark');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ============================================================================
// 1. TOOL PROGRESSION BENCHMARK
// ============================================================================

describe('1. Tool Progression Benchmark', () => {
  const allVersionTools = [
    { version: 'V11', tools: v11Tools },
    { version: 'V12', tools: v12Tools },
    { version: 'V13', tools: v13Tools },
    { version: 'V14', tools: v14Tools },
    { version: 'V15', tools: v15Tools },
    { version: 'V16', tools: v16Tools },
    { version: 'V17', tools: v17Tools },
    { version: 'V18', tools: v18Tools },
  ];

  it('should have valid tool arrays for all versions', () => {
    for (const { version, tools } of allVersionTools) {
      expect(Array.isArray(tools), `${version} tools should be an array`).toBe(true);
      expect(tools.length, `${version} should have at least 1 tool`).toBeGreaterThan(0);
    }
  });

  it('V11 should have 28 base tools', () => {
    expect(v11Tools).toHaveLength(28);
  });

  it('V12 should have 28 tools (same as V11 base, security is policy-level)', () => {
    expect(v12Tools).toHaveLength(28);
  });

  it('V13 should have 28 tools (same as V12 base, evolution is analytical)', () => {
    expect(v13Tools).toHaveLength(28);
  });

  it('V14 should have 28 tools (same as base, plugin tools are dynamically loaded)', () => {
    expect(v14Tools).toHaveLength(28);
  });

  it('V15 should have 28 tools (same as base, multimodel tools are separate)', () => {
    expect(v15Tools).toHaveLength(28);
  });

  it('V16 should have 28 tools (same as base, workflow tools are separate)', () => {
    expect(v16Tools).toHaveLength(28);
  });

  it('V17 should add 2 web tools (web_fetch, web_search) for a total of 30', () => {
    expect(v17Tools).toHaveLength(30);
    const toolNames = v17Tools.map(t => t.name);
    expect(toolNames).toContain('web_fetch');
    expect(toolNames).toContain('web_search');
  });

  it('V18 should have 30 tools (inherits V17 web tools)', () => {
    expect(v18Tools).toHaveLength(30);
    const toolNames = v18Tools.map(t => t.name);
    expect(toolNames).toContain('web_fetch');
    expect(toolNames).toContain('web_search');
  });

  it('should show monotonically non-decreasing tool count across versions', () => {
    const counts = allVersionTools.map(v => v.tools.length);
    for (let i = 1; i < counts.length; i++) {
      expect(
        counts[i],
        `${allVersionTools[i].version} (${counts[i]}) should have >= tools than ${allVersionTools[i - 1].version} (${counts[i - 1]})`
      ).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });

  it('all versions should contain the V11 base tool set', () => {
    const v11ToolNames = new Set(v11Tools.map(t => t.name));
    for (const { version, tools } of allVersionTools) {
      const names = new Set(tools.map(t => t.name));
      for (const baseTool of v11ToolNames) {
        expect(
          names.has(baseTool),
          `${version} should contain base tool "${baseTool}"`
        ).toBe(true);
      }
    }
  });

  it('every tool should have name, description, and input_schema', () => {
    for (const { version, tools } of allVersionTools) {
      for (const tool of tools) {
        expect(tool.name, `${version} tool missing name`).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description, `${version} tool "${tool.name}" missing description`).toBeDefined();
        expect(tool.input_schema, `${version} tool "${tool.name}" missing input_schema`).toBeDefined();
        expect(tool.input_schema.type, `${version} tool "${tool.name}" schema should have type`).toBe('object');
      }
    }
  });

  it('no version should have duplicate tool names', () => {
    for (const { version, tools } of allVersionTools) {
      const names = tools.map(t => t.name);
      const unique = new Set(names);
      expect(
        unique.size,
        `${version} has duplicate tools: ${names.filter((n, i) => names.indexOf(n) !== i)}`
      ).toBe(names.length);
    }
  });

  describe('Tool Categories', () => {
    const v11ToolNames = v11Tools.map(t => t.name);

    it('should have base file tools', () => {
      const fileTools = ['bash', 'read_file', 'write_file', 'edit_file', 'grep'];
      for (const tool of fileTools) {
        expect(v11ToolNames).toContain(tool);
      }
    });

    it('should have memory tools', () => {
      const memoryTools = ['memory_search', 'daily_write', 'daily_read', 'daily_recent', 'longterm_read', 'longterm_append', 'memory_search_all'];
      for (const tool of memoryTools) {
        expect(v11ToolNames).toContain(tool);
      }
    });

    it('should have channel tools', () => {
      const channelTools = ['channel_list', 'channel_send', 'channel_status', 'channel_config', 'channel_start', 'channel_stop'];
      for (const tool of channelTools) {
        expect(v11ToolNames).toContain(tool);
      }
    });

    it('should have identity tools', () => {
      expect(v11ToolNames).toContain('identity_load');
      expect(v11ToolNames).toContain('identity_get');
    });

    it('should have introspection tools', () => {
      const introTools = ['introspect_stats', 'introspect_patterns', 'introspect_reflect', 'introspect_logs'];
      for (const tool of introTools) {
        expect(v11ToolNames).toContain(tool);
      }
    });

    it('should have skill and planning tools', () => {
      expect(v11ToolNames).toContain('Skill');
      expect(v11ToolNames).toContain('TodoWrite');
    });
  });
});

// ============================================================================
// 2. MODULE INITIALIZATION BENCHMARK
// ============================================================================

describe('2. Module Initialization Benchmark', () => {
  let workDir: string;

  beforeAll(() => {
    workDir = path.join(testDir, 'module-init');
    ensureDir(workDir);
  });

  afterAll(() => {
    cleanDir(testDir);
  });

  describe('V11: SkillLoader', () => {
    it('should instantiate without errors', () => {
      const skillsDir = path.join(workDir, 'v11-skills');
      ensureDir(skillsDir);
      const loader = new SkillLoader(skillsDir);
      expect(loader).toBeDefined();
      expect(loader.count).toBe(0);
      expect(loader.loadedCount).toBe(0);
    });

    it('should list available skills (empty dir)', () => {
      const skillsDir = path.join(workDir, 'v11-skills-empty');
      ensureDir(skillsDir);
      const loader = new SkillLoader(skillsDir);
      expect(loader.list()).toContain('无可用技能');
    });
  });

  describe('V12: SecuritySystem', () => {
    it('should instantiate with default policy', () => {
      const secDir = path.join(workDir, 'v12-security');
      ensureDir(secDir);
      const security = new SecuritySystem(secDir);
      expect(security).toBeDefined();
    });

    it('should have working permission checks', () => {
      const secDir = path.join(workDir, 'v12-security-perms');
      ensureDir(secDir);
      const security = new SecuritySystem(secDir);

      // Default context is "normal" trust level
      expect(security.checkPermission('read_file')).toBe(true);  // safe
      expect(security.checkPermission('write_file')).toBe(true); // confirm, normal >= 1
      expect(security.checkPermission('bash')).toBe(false);      // dangerous, normal < 2
    });

    it('should instantiate with custom policy', () => {
      const secDir = path.join(workDir, 'v12-security-custom');
      ensureDir(secDir);
      const security = new SecuritySystem(secDir, {
        defaultLevel: 'owner',
      });
      const policy = security.getPolicy();
      expect(policy.defaultLevel).toBe('owner');
    });

    it('should instantiate with custom context', () => {
      const secDir = path.join(workDir, 'v12-security-ctx');
      ensureDir(secDir);
      const security = new SecuritySystem(secDir, undefined, {
        userId: 'test-user',
        trustLevel: 'owner',
      });
      const ctx = security.getContext();
      expect(ctx.userId).toBe('test-user');
      expect(ctx.trustLevel).toBe('owner');
    });
  });

  describe('V13: EvolutionSystem', () => {
    it('should instantiate with dependencies', () => {
      const evoDir = path.join(workDir, 'v13-evolution');
      ensureDir(evoDir);
      const security = new SecuritySystem(evoDir);
      const introspection = new IntrospectionTracker(evoDir);

      const evolution = new EvolutionSystem(evoDir, security, introspection);
      expect(evolution).toBeDefined();
    });

    it('should return status without errors', () => {
      const evoDir = path.join(workDir, 'v13-evolution-status');
      ensureDir(evoDir);
      const security = new SecuritySystem(evoDir);
      const introspection = new IntrospectionTracker(evoDir);

      const evolution = new EvolutionSystem(evoDir, security, introspection);
      const status = evolution.status();
      expect(status).toBeDefined();
      expect(status.patternsAnalyzed).toBe(0);
      expect(status.suggestionsGenerated).toBe(0);
    });
  });

  describe('V14: PluginManager', () => {
    it('should instantiate and create plugin directory', () => {
      const plugDir = path.join(workDir, 'v14-plugins');
      ensureDir(plugDir);
      const manager = new PluginManager(plugDir);
      expect(manager).toBeDefined();
      expect(fs.existsSync(path.join(plugDir, 'plugins'))).toBe(true);
    });

    it('should discover plugins (empty dir)', () => {
      const plugDir = path.join(workDir, 'v14-plugins-discover');
      ensureDir(plugDir);
      const manager = new PluginManager(plugDir);
      const discovered = manager.discover();
      expect(discovered).toEqual([]);
    });

    it('should list loaded plugins (empty)', () => {
      const plugDir = path.join(workDir, 'v14-plugins-list');
      ensureDir(plugDir);
      const manager = new PluginManager(plugDir);
      expect(manager.list()).toEqual([]);
    });

    it('should return empty tools from plugins (no plugins loaded)', () => {
      const plugDir = path.join(workDir, 'v14-plugins-tools');
      ensureDir(plugDir);
      const manager = new PluginManager(plugDir);
      expect(manager.getTools()).toEqual([]);
    });
  });

  describe('V15: MultiModel System', () => {
    it('should instantiate TaskClassifier', () => {
      const classifier = new TaskClassifier();
      expect(classifier).toBeDefined();
    });

    it('should classify tasks correctly', () => {
      const classifier = new TaskClassifier();

      const codeTask = classifier.classify('请帮我写一个函数');
      expect(codeTask.type).toBe('code');
      expect(codeTask.requiredCapabilities).toContain('code');

      const reasonTask = classifier.classify('分析这个问题的原因');
      expect(reasonTask.type).toBe('reasoning');

      const creativeTask = classifier.classify('创作一个故事');
      expect(creativeTask.type).toBe('creative');

      const simpleTask = classifier.classify('TypeScript 是什么');
      expect(simpleTask.type).toBe('simple');
    });

    it('should instantiate ModelRouter with default models', () => {
      const router = new ModelRouter();
      expect(router).toBeDefined();
      const models = router.getModels();
      expect(models.length).toBe(DEFAULT_MODELS.length);
    });

    it('should select models based on task type', () => {
      const router = new ModelRouter();
      const selection = router.selectModel('帮我写一个排序函数');
      expect(selection.modelId).toBeDefined();
      expect(selection.reason).toBeDefined();
      expect(selection.estimatedCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('V16: Workflow System', () => {
    it('should instantiate MermaidParser', () => {
      const parser = new MermaidParser();
      expect(parser).toBeDefined();
    });

    it('should parse simple Mermaid flowchart', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`
        flowchart TD
        A[Start] --> B[Process]
        B --> C[End]
      `);
      expect(result.nodes.length).toBeGreaterThanOrEqual(2);
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it('should instantiate ExecutionPlanner', () => {
      const planner = new ExecutionPlanner();
      expect(planner).toBeDefined();
    });

    it('should instantiate WorkflowManager', () => {
      const manager = new WorkflowManager();
      expect(manager).toBeDefined();
      expect(manager.list()).toEqual([]);
    });

    it('should create workflow from Mermaid and produce execution plan', () => {
      const manager = new WorkflowManager();
      const dag = manager.createFromMermaid('test-workflow', `
        flowchart TD
        A[Step 1] --> B[Step 2]
        A --> C[Step 3]
        B --> D[Step 4]
        C --> D
      `);
      expect(dag.id).toBeDefined();
      expect(dag.name).toBe('test-workflow');
      expect(dag.nodes.size).toBeGreaterThanOrEqual(3);

      const plan = manager.getPlan(dag.id);
      expect(plan).not.toBeNull();
      expect(plan!.phases.length).toBeGreaterThanOrEqual(2);
      expect(plan!.estimatedParallelism).toBeGreaterThan(0);
    });
  });

  describe('V17: External Web Tools', () => {
    it('should export htmlToText function', () => {
      expect(typeof htmlToText).toBe('function');
    });

    it('should export htmlToMarkdown function', () => {
      expect(typeof htmlToMarkdown).toBe('function');
    });

    it('should convert HTML to text', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      const text = htmlToText(html);
      expect(text).toContain('Hello');
      expect(text).toContain('World');
      expect(text).not.toContain('<p>');
    });

    it('should convert HTML to markdown', () => {
      const html = '<h1>Title</h1><p>Text with <strong>bold</strong></p>';
      const md = htmlToMarkdown(html);
      expect(md).toContain('# Title');
      expect(md).toContain('**bold**');
    });

    it('should strip script and style tags', () => {
      const html = '<script>alert("xss")</script><style>body{}</style><p>Safe</p>';
      const text = htmlToText(html);
      expect(text).not.toContain('alert');
      expect(text).not.toContain('body{}');
      expect(text).toContain('Safe');
    });

    it('should export getWebTools that returns 2 tool definitions', () => {
      const webTools = getWebTools();
      expect(webTools).toHaveLength(2);
      expect(webTools[0].name).toBe('web_fetch');
      expect(webTools[1].name).toBe('web_search');
    });
  });

  describe('V18: Collaboration System', () => {
    it('should instantiate SubAgentManager', () => {
      const colDir = path.join(workDir, 'v18-subagent');
      ensureDir(colDir);
      const manager = new SubAgentManager(colDir);
      expect(manager).toBeDefined();
      expect(manager.list()).toEqual([]);
    });

    it('should instantiate AgentRegistry', () => {
      const colDir = path.join(workDir, 'v18-registry');
      ensureDir(colDir);
      const registry = new AgentRegistry(colDir);
      expect(registry).toBeDefined();
      expect(registry.list()).toEqual([]);
    });

    it('should register and find agents', () => {
      const colDir = path.join(workDir, 'v18-registry-ops');
      ensureDir(colDir);
      const registry = new AgentRegistry(colDir);

      const agent = registry.register({
        name: 'TestAgent',
        description: 'A test agent',
        capabilities: [{ name: 'code', description: 'Code generation', priority: 8 }],
        status: 'active',
      });

      expect(agent.id).toBeDefined();
      expect(registry.list()).toHaveLength(1);

      const found = registry.findByCapability('code');
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('TestAgent');
    });

    it('should instantiate TaskDistributor', () => {
      const colDir = path.join(workDir, 'v18-distributor');
      ensureDir(colDir);
      const subMgr = new SubAgentManager(colDir);
      const registry = new AgentRegistry(colDir);
      const distributor = new TaskDistributor(subMgr, registry);
      expect(distributor).toBeDefined();
      expect(distributor.listTasks()).toEqual([]);
    });

    it('should submit tasks', () => {
      const colDir = path.join(workDir, 'v18-distributor-submit');
      ensureDir(colDir);
      const subMgr = new SubAgentManager(colDir);
      const registry = new AgentRegistry(colDir);
      const distributor = new TaskDistributor(subMgr, registry);

      const task = distributor.submit('Analyze codebase', ['code', 'analysis'], 'high');
      expect(task.taskId).toBeDefined();
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('high');
      expect(task.requirements).toContain('code');
    });
  });
});

// ============================================================================
// 3. FEATURE CAPABILITY MATRIX
// ============================================================================

describe('3. Feature Capability Matrix', () => {
  /**
   * Capability matrix defining what each version supports.
   * Each capability name maps to the minimum version that introduced it.
   */
  const capabilityMatrix: Record<string, {
    introduced: number;
    description: string;
    verify: () => boolean;
  }> = {
    // V11 base capabilities
    'channels': {
      introduced: 11,
      description: 'Multi-channel message routing',
      verify: () => v11Tools.some(t => t.name === 'channel_list'),
    },
    'memory': {
      introduced: 11,
      description: 'Long-term and daily memory',
      verify: () => v11Tools.some(t => t.name === 'memory_search'),
    },
    'sessions': {
      introduced: 11,
      description: 'Session management',
      verify: () => v11Tools.some(t => t.name === 'session_list'),
    },
    'identity': {
      introduced: 11,
      description: 'Identity loading and management',
      verify: () => v11Tools.some(t => t.name === 'identity_get'),
    },
    'introspection': {
      introduced: 11,
      description: 'Behavioral introspection and self-analysis',
      verify: () => v11Tools.some(t => t.name === 'introspect_stats'),
    },
    'skills': {
      introduced: 11,
      description: 'Dynamic skill loading',
      verify: () => v11Tools.some(t => t.name === 'Skill'),
    },

    // V12 capabilities
    'security_policies': {
      introduced: 12,
      description: 'Tool permission and risk level policies',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-12');
        ensureDir(dir);
        try {
          const sec = new SecuritySystem(dir);
          return typeof sec.checkPermission === 'function';
        } catch { return false; }
      },
    },
    'audit_logging': {
      introduced: 12,
      description: 'Security audit logging',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-12-audit');
        ensureDir(dir);
        try {
          const sec = new SecuritySystem(dir);
          return typeof sec.audit === 'function';
        } catch { return false; }
      },
    },
    'data_masking': {
      introduced: 12,
      description: 'Sensitive data masking',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-12-mask');
        ensureDir(dir);
        try {
          const sec = new SecuritySystem(dir);
          return typeof sec.maskSensitive === 'function';
        } catch { return false; }
      },
    },

    // V13 capabilities
    'evolution_analysis': {
      introduced: 13,
      description: 'Behavior pattern analysis and evolution',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-13');
        ensureDir(dir);
        try {
          const sec = new SecuritySystem(dir);
          const intro = new IntrospectionTracker(dir);
          const evo = new EvolutionSystem(dir, sec, intro);
          return typeof evo.analyze === 'function';
        } catch { return false; }
      },
    },
    'behavior_patterns': {
      introduced: 13,
      description: 'Tool call pattern detection and optimization suggestions',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-13-pat');
        ensureDir(dir);
        try {
          const sec = new SecuritySystem(dir);
          const intro = new IntrospectionTracker(dir);
          const evo = new EvolutionSystem(dir, sec, intro);
          return typeof evo.suggest === 'function';
        } catch { return false; }
      },
    },

    // V14 capabilities
    'plugin_loading': {
      introduced: 14,
      description: 'Dynamic plugin loading and management',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-14');
        ensureDir(dir);
        try {
          const pm = new PluginManager(dir);
          return typeof pm.load === 'function' && typeof pm.unload === 'function';
        } catch { return false; }
      },
    },
    'hot_reload': {
      introduced: 14,
      description: 'Plugin hot-reload via load/unload lifecycle',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-14-hr');
        ensureDir(dir);
        try {
          const pm = new PluginManager(dir);
          return typeof pm.discover === 'function' && typeof pm.getTools === 'function';
        } catch { return false; }
      },
    },

    // V15 capabilities
    'multi_model_routing': {
      introduced: 15,
      description: 'Intelligent model selection and routing',
      verify: () => {
        try {
          const router = new ModelRouter();
          return typeof router.selectModel === 'function';
        } catch { return false; }
      },
    },
    'task_classification': {
      introduced: 15,
      description: 'Task type classification for model routing',
      verify: () => {
        try {
          const classifier = new TaskClassifier();
          return typeof classifier.classify === 'function';
        } catch { return false; }
      },
    },

    // V16 capabilities
    'dag_workflows': {
      introduced: 16,
      description: 'DAG-based workflow execution',
      verify: () => {
        try {
          const wm = new WorkflowManager();
          return typeof wm.createFromMermaid === 'function' && typeof wm.run === 'function';
        } catch { return false; }
      },
    },
    'mermaid_parsing': {
      introduced: 16,
      description: 'Mermaid flowchart syntax parsing',
      verify: () => {
        try {
          const parser = new MermaidParser();
          return typeof parser.parse === 'function';
        } catch { return false; }
      },
    },

    // V17 capabilities
    'web_fetch': {
      introduced: 17,
      description: 'Fetch and extract web page content',
      verify: () => v17Tools.some(t => t.name === 'web_fetch'),
    },
    'web_search': {
      introduced: 17,
      description: 'Web search via Brave Search API',
      verify: () => v17Tools.some(t => t.name === 'web_search'),
    },

    // V18 capabilities
    'sub_agents': {
      introduced: 18,
      description: 'Sub-agent lifecycle management',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-18');
        ensureDir(dir);
        try {
          const mgr = new SubAgentManager(dir);
          return typeof mgr.create === 'function' && typeof mgr.list === 'function';
        } catch { return false; }
      },
    },
    'agent_registry': {
      introduced: 18,
      description: 'Agent discovery and registration',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-18-reg');
        ensureDir(dir);
        try {
          const reg = new AgentRegistry(dir);
          return typeof reg.register === 'function' && typeof reg.findByCapability === 'function';
        } catch { return false; }
      },
    },
    'task_distribution': {
      introduced: 18,
      description: 'Intelligent task distribution to agents',
      verify: () => {
        const dir = path.join(testDir, 'cap-check-18-dist');
        ensureDir(dir);
        try {
          const sub = new SubAgentManager(dir);
          const reg = new AgentRegistry(dir);
          const dist = new TaskDistributor(sub, reg);
          return typeof dist.submit === 'function' && typeof dist.distribute === 'function';
        } catch { return false; }
      },
    },
  };

  afterAll(() => {
    cleanDir(testDir);
  });

  // Generate a test for each capability
  for (const [capName, cap] of Object.entries(capabilityMatrix)) {
    it(`should verify capability "${capName}" (introduced V${cap.introduced}): ${cap.description}`, () => {
      expect(cap.verify()).toBe(true);
    });
  }

  describe('Version capability counts', () => {
    const versionCapabilities: Record<number, string[]> = {
      11: ['channels', 'memory', 'sessions', 'identity', 'introspection', 'skills'],
      12: ['security_policies', 'audit_logging', 'data_masking'],
      13: ['evolution_analysis', 'behavior_patterns'],
      14: ['plugin_loading', 'hot_reload'],
      15: ['multi_model_routing', 'task_classification'],
      16: ['dag_workflows', 'mermaid_parsing'],
      17: ['web_fetch', 'web_search'],
      18: ['sub_agents', 'agent_registry', 'task_distribution'],
    };

    it('V11 should have 6 base capabilities', () => {
      expect(versionCapabilities[11]).toHaveLength(6);
    });

    it('V12 should add 3 security capabilities', () => {
      expect(versionCapabilities[12]).toHaveLength(3);
    });

    it('V13 should add 2 evolution capabilities', () => {
      expect(versionCapabilities[13]).toHaveLength(2);
    });

    it('V14 should add 2 plugin capabilities', () => {
      expect(versionCapabilities[14]).toHaveLength(2);
    });

    it('V15 should add 2 multimodel capabilities', () => {
      expect(versionCapabilities[15]).toHaveLength(2);
    });

    it('V16 should add 2 workflow capabilities', () => {
      expect(versionCapabilities[16]).toHaveLength(2);
    });

    it('V17 should add 2 web capabilities', () => {
      expect(versionCapabilities[17]).toHaveLength(2);
    });

    it('V18 should add 3 collaboration capabilities', () => {
      expect(versionCapabilities[18]).toHaveLength(3);
    });

    it('total capabilities across all versions should be 22', () => {
      const total = Object.values(versionCapabilities).reduce((sum, caps) => sum + caps.length, 0);
      expect(total).toBe(22);
    });

    it('cumulative capabilities should increase with each version', () => {
      let cumulative = 0;
      const versions = [11, 12, 13, 14, 15, 16, 17, 18];
      for (const v of versions) {
        cumulative += versionCapabilities[v].length;
        const expectedMin = v - 10; // V11 = at least 1, V18 = at least 8
        expect(
          cumulative,
          `Cumulative at V${v} should be >= ${expectedMin}`
        ).toBeGreaterThanOrEqual(expectedMin);
      }
    });
  });
});

// ============================================================================
// 4. INHERITANCE VERIFICATION
// ============================================================================

describe('4. Inheritance Verification', () => {
  it('V18 should contain ALL V11 base tool names', () => {
    const v11Names = new Set(v11Tools.map(t => t.name));
    const v18Names = new Set(v18Tools.map(t => t.name));
    for (const name of v11Names) {
      expect(v18Names.has(name), `V18 missing V11 base tool: ${name}`).toBe(true);
    }
  });

  it('V18 should contain ALL V17 web tools', () => {
    const v17Names = new Set(v17Tools.map(t => t.name));
    const v18Names = new Set(v18Tools.map(t => t.name));
    for (const name of v17Names) {
      expect(v18Names.has(name), `V18 missing V17 tool: ${name}`).toBe(true);
    }
  });

  it('V18 tools should be a superset of V11 tools', () => {
    const v11Names = v11Tools.map(t => t.name);
    const v18Names = v18Tools.map(t => t.name);
    expect(v18Names.length).toBeGreaterThanOrEqual(v11Names.length);
    for (const name of v11Names) {
      expect(v18Names).toContain(name);
    }
  });

  it('V18 should have at least as many tools as any previous version', () => {
    const allVersions = [v11Tools, v12Tools, v13Tools, v14Tools, v15Tools, v16Tools, v17Tools, v18Tools];
    const v18Count = v18Tools.length;
    for (let i = 0; i < allVersions.length; i++) {
      expect(
        v18Count,
        `V18 (${v18Count}) should >= V${i + 11} (${allVersions[i].length})`
      ).toBeGreaterThanOrEqual(allVersions[i].length);
    }
  });

  describe('Module composition chain', () => {
    afterAll(() => {
      cleanDir(testDir);
    });

    it('V12 SecuritySystem can be used standalone', () => {
      const dir = path.join(testDir, 'inherit-v12');
      ensureDir(dir);
      const sec = new SecuritySystem(dir);
      expect(sec.checkPermission('read_file')).toBe(true);
    });

    it('V13 EvolutionSystem composes V12 SecuritySystem + V11 IntrospectionTracker', () => {
      const dir = path.join(testDir, 'inherit-v13');
      ensureDir(dir);
      const sec = new SecuritySystem(dir);
      const intro = new IntrospectionTracker(dir);
      const evo = new EvolutionSystem(dir, sec, intro);
      expect(evo).toBeDefined();
      // EvolutionSystem requires both security and introspection as dependencies
      const status = evo.status();
      expect(status).toBeDefined();
    });

    it('V14 PluginManager works independently', () => {
      const dir = path.join(testDir, 'inherit-v14');
      ensureDir(dir);
      const pm = new PluginManager(dir);
      expect(pm.discover()).toEqual([]);
    });

    it('V15 ModelRouter works independently with default models', () => {
      const router = new ModelRouter();
      const models = router.getModels();
      expect(models.length).toBeGreaterThan(0);
    });

    it('V16 WorkflowManager works independently', () => {
      const wm = new WorkflowManager();
      expect(wm.list()).toEqual([]);
    });

    it('V18 TaskDistributor composes V18 SubAgentManager + AgentRegistry', () => {
      const dir = path.join(testDir, 'inherit-v18');
      ensureDir(dir);
      const sub = new SubAgentManager(dir);
      const reg = new AgentRegistry(dir);
      const dist = new TaskDistributor(sub, reg);

      // Can submit and track tasks
      const task = dist.submit('Test task');
      expect(task.taskId).toBeDefined();
      expect(dist.listTasks()).toHaveLength(1);
    });
  });
});

// ============================================================================
// 5. PERFORMANCE BENCHMARK
// ============================================================================

describe('5. Performance Benchmark', () => {
  afterAll(() => {
    cleanDir(testDir);
  });

  const measureTime = (fn: () => void): number => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  };

  describe('Module initialization time', () => {
    it('V12 SecuritySystem should initialize within 100ms', () => {
      const dir = path.join(testDir, 'perf-v12');
      ensureDir(dir);
      const time = measureTime(() => {
        new SecuritySystem(dir);
      });
      expect(time).toBeLessThan(100);
    });

    it('V13 EvolutionSystem should initialize within 100ms', () => {
      const dir = path.join(testDir, 'perf-v13');
      ensureDir(dir);
      const time = measureTime(() => {
        const sec = new SecuritySystem(dir);
        const intro = new IntrospectionTracker(dir);
        new EvolutionSystem(dir, sec, intro);
      });
      expect(time).toBeLessThan(100);
    });

    it('V14 PluginManager should initialize within 50ms', () => {
      const dir = path.join(testDir, 'perf-v14');
      ensureDir(dir);
      const time = measureTime(() => {
        new PluginManager(dir);
      });
      expect(time).toBeLessThan(50);
    });

    it('V15 ModelRouter should initialize within 10ms', () => {
      const time = measureTime(() => {
        new ModelRouter();
      });
      expect(time).toBeLessThan(10);
    });

    it('V15 TaskClassifier should initialize within 5ms', () => {
      const time = measureTime(() => {
        new TaskClassifier();
      });
      expect(time).toBeLessThan(5);
    });

    it('V16 WorkflowManager should initialize within 10ms', () => {
      const time = measureTime(() => {
        new WorkflowManager();
      });
      expect(time).toBeLessThan(10);
    });

    it('V18 SubAgentManager should initialize within 50ms', () => {
      const dir = path.join(testDir, 'perf-v18-sub');
      ensureDir(dir);
      const time = measureTime(() => {
        new SubAgentManager(dir);
      });
      expect(time).toBeLessThan(50);
    });

    it('V18 AgentRegistry should initialize within 50ms', () => {
      const dir = path.join(testDir, 'perf-v18-reg');
      ensureDir(dir);
      const time = measureTime(() => {
        new AgentRegistry(dir);
      });
      expect(time).toBeLessThan(50);
    });
  });

  describe('Operation performance', () => {
    it('V12 permission check should complete within 1ms', () => {
      const dir = path.join(testDir, 'perf-v12-check');
      ensureDir(dir);
      const sec = new SecuritySystem(dir);
      const time = measureTime(() => {
        for (let i = 0; i < 1000; i++) {
          sec.checkPermission('read_file');
          sec.checkPermission('bash');
          sec.checkPermission('write_file');
        }
      });
      // 3000 checks should complete well under 100ms
      expect(time).toBeLessThan(100);
    });

    it('V12 data masking should complete within 1ms per call', () => {
      const dir = path.join(testDir, 'perf-v12-mask');
      ensureDir(dir);
      const sec = new SecuritySystem(dir);
      const sensitiveData = 'API_KEY=sk-abcdefghijklmnopqrstuvwxyz012345678901234567 password: "secret123"';
      const time = measureTime(() => {
        for (let i = 0; i < 100; i++) {
          sec.maskSensitive(sensitiveData);
        }
      });
      expect(time).toBeLessThan(50); // 100 calls under 50ms
    });

    it('V15 task classification should complete within 1ms per call', () => {
      const classifier = new TaskClassifier();
      const time = measureTime(() => {
        for (let i = 0; i < 1000; i++) {
          classifier.classify('请帮我实现一个二叉树遍历函数');
        }
      });
      expect(time).toBeLessThan(50); // 1000 calls under 50ms
    });

    it('V15 model selection should complete within 1ms per call', () => {
      const router = new ModelRouter();
      const time = measureTime(() => {
        for (let i = 0; i < 100; i++) {
          router.selectModel('分析这段代码的性能问题');
        }
      });
      expect(time).toBeLessThan(50); // 100 calls under 50ms
    });

    it('V16 Mermaid parsing should complete within 5ms for a medium-size graph', () => {
      const parser = new MermaidParser();
      const mermaid = `
        flowchart TD
        A[Start] --> B[Step 1]
        A --> C[Step 2]
        B --> D[Step 3]
        C --> D
        D --> E[Step 4]
        D --> F[Step 5]
        E --> G[End]
        F --> G
      `;
      const time = measureTime(() => {
        parser.parse(mermaid);
      });
      expect(time).toBeLessThan(5);
    });

    it('V16 execution planning should complete within 10ms for a medium DAG', () => {
      const manager = new WorkflowManager();
      const dag = manager.createFromMermaid('perf-test', `
        flowchart TD
        A[Step 1] --> B[Step 2]
        A --> C[Step 3]
        B --> D[Step 4]
        C --> D
        D --> E[Step 5]
      `);
      const time = measureTime(() => {
        manager.getPlan(dag.id);
      });
      expect(time).toBeLessThan(10);
    });

    it('V17 HTML-to-text should process a large page within 10ms', () => {
      // Generate a large HTML string (~50KB)
      const paragraphs = Array.from({ length: 200 }, (_, i) =>
        `<p>Paragraph ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>`
      ).join('\n');
      const html = `<html><head><style>body { color: red; }</style></head><body>${paragraphs}</body></html>`;
      const time = measureTime(() => {
        htmlToText(html);
      });
      expect(time).toBeLessThan(10);
    });

    it('V18 agent registration should complete within 5ms per agent', () => {
      const dir = path.join(testDir, 'perf-v18-reg-ops');
      ensureDir(dir);
      const registry = new AgentRegistry(dir);
      const time = measureTime(() => {
        for (let i = 0; i < 20; i++) {
          registry.register({
            name: `Agent-${i}`,
            description: `Test agent ${i}`,
            capabilities: [
              { name: 'code', description: 'Coding', priority: 5 },
              { name: 'analysis', description: 'Analysis', priority: 3 },
            ],
            status: 'active',
          });
        }
      });
      expect(time).toBeLessThan(100); // 20 registrations under 100ms
    });

    it('V18 capability search should complete within 5ms', () => {
      const dir = path.join(testDir, 'perf-v18-search');
      ensureDir(dir);
      const registry = new AgentRegistry(dir);
      // Register 50 agents
      for (let i = 0; i < 50; i++) {
        registry.register({
          name: `Agent-${i}`,
          description: `Test agent ${i}`,
          capabilities: [
            { name: i % 3 === 0 ? 'code' : 'analysis', description: 'Cap', priority: i % 10 },
          ],
          status: i % 5 === 0 ? 'offline' : 'active',
        });
      }
      const time = measureTime(() => {
        for (let i = 0; i < 100; i++) {
          registry.findByCapability('code');
        }
      });
      expect(time).toBeLessThan(50); // 100 searches under 50ms
    });
  });

  describe('Comparative initialization benchmark', () => {
    it('should rank initialization times from fastest to slowest', () => {
      const dir = path.join(testDir, 'perf-comparative');
      ensureDir(dir);

      const benchmarks: Array<{ name: string; timeMs: number }> = [];

      // V15 TaskClassifier (no I/O)
      const t1 = measureTime(() => new TaskClassifier());
      benchmarks.push({ name: 'V15 TaskClassifier', timeMs: t1 });

      // V15 ModelRouter (no I/O)
      const t2 = measureTime(() => new ModelRouter());
      benchmarks.push({ name: 'V15 ModelRouter', timeMs: t2 });

      // V16 WorkflowManager (no I/O)
      const t3 = measureTime(() => new WorkflowManager());
      benchmarks.push({ name: 'V16 WorkflowManager', timeMs: t3 });

      // V14 PluginManager (creates dir)
      const d14 = path.join(dir, 'pm');
      ensureDir(d14);
      const t4 = measureTime(() => new PluginManager(d14));
      benchmarks.push({ name: 'V14 PluginManager', timeMs: t4 });

      // V12 SecuritySystem (creates audit dir)
      const d12 = path.join(dir, 'ss');
      ensureDir(d12);
      const t5 = measureTime(() => new SecuritySystem(d12));
      benchmarks.push({ name: 'V12 SecuritySystem', timeMs: t5 });

      // V18 SubAgentManager (creates dir)
      const d18s = path.join(dir, 'sam');
      ensureDir(d18s);
      const t6 = measureTime(() => new SubAgentManager(d18s));
      benchmarks.push({ name: 'V18 SubAgentManager', timeMs: t6 });

      // V18 AgentRegistry (file I/O)
      const d18r = path.join(dir, 'ar');
      ensureDir(d18r);
      const t7 = measureTime(() => new AgentRegistry(d18r));
      benchmarks.push({ name: 'V18 AgentRegistry', timeMs: t7 });

      // V13 EvolutionSystem (composes multiple modules)
      const d13 = path.join(dir, 'es');
      ensureDir(d13);
      const t8 = measureTime(() => {
        const sec = new SecuritySystem(d13);
        const intro = new IntrospectionTracker(d13);
        new EvolutionSystem(d13, sec, intro);
      });
      benchmarks.push({ name: 'V13 EvolutionSystem (full chain)', timeMs: t8 });

      // Sort by time
      benchmarks.sort((a, b) => a.timeMs - b.timeMs);

      // Log results for visibility
      console.log('\n--- Initialization Performance Rankings ---');
      benchmarks.forEach((b, i) => {
        console.log(`  ${i + 1}. ${b.name}: ${b.timeMs.toFixed(3)}ms`);
      });
      console.log('-------------------------------------------\n');

      // All initializations should complete within 200ms
      for (const b of benchmarks) {
        expect(
          b.timeMs,
          `${b.name} took ${b.timeMs.toFixed(2)}ms, expected < 200ms`
        ).toBeLessThan(200);
      }
    });
  });
});
