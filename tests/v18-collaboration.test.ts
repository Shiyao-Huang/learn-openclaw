/**
 * v18-collaboration.test.ts - V18 团队协作测试
 * 
 * 测试内容:
 * - SubAgent 管理
 * - Agent 注册表
 * - 任务分配
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SubAgentManager } from '../v18-agent/collaboration/subagent.js';
import { AgentRegistry } from '../v18-agent/collaboration/registry.js';
import { TaskDistributor } from '../v18-agent/collaboration/distributor.js';

describe('V18 Collaboration System', () => {
  let tempDir: string;
  let subAgentManager: SubAgentManager;
  let agentRegistry: AgentRegistry;
  let taskDistributor: TaskDistributor;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v18-test-'));
    subAgentManager = new SubAgentManager(tempDir);
    agentRegistry = new AgentRegistry(tempDir);
    taskDistributor = new TaskDistributor(subAgentManager, agentRegistry);
  });

  describe('SubAgentManager', () => {
    it('should create a sub-agent', async () => {
      const agent = await subAgentManager.create({
        name: 'TestAgent',
        task: 'Say hello',
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('TestAgent');
      expect(agent.task).toBe('Say hello');
      expect(['pending', 'starting', 'running']).toContain(agent.status);
    });

    it('should list sub-agents', async () => {
      await subAgentManager.create({ task: 'Task 1' });
      await subAgentManager.create({ task: 'Task 2' });

      const agents = subAgentManager.list();
      expect(agents.length).toBe(2);
    });

    it('should get sub-agent by id', async () => {
      const agent = await subAgentManager.create({ task: 'Test' });
      const retrieved = subAgentManager.get(agent.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(agent.id);
    });

    it('should cleanup completed agents', async () => {
      const agent = await subAgentManager.create({ task: 'Test', timeout: 100 });
      
      // Wait for completion
      await new Promise(r => setTimeout(r, 200));
      
      const count = subAgentManager.cleanup();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AgentRegistry', () => {
    it('should register an agent', () => {
      const agent = agentRegistry.register({
        name: 'TestAgent',
        description: 'A test agent',
        capabilities: [
          { name: 'chat', description: 'Chat capability', priority: 10 }
        ],
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('TestAgent');
      expect(agent.capabilities).toHaveLength(1);
      expect(agent.id).toBeDefined();
    });

    it('should list all agents', () => {
      agentRegistry.register({
        name: 'Agent1',
        capabilities: [{ name: 'chat', description: '', priority: 5 }],
      });
      agentRegistry.register({
        name: 'Agent2',
        capabilities: [{ name: 'search', description: '', priority: 5 }],
      });

      const agents = agentRegistry.list();
      expect(agents.length).toBe(2);
    });

    it('should find agents by capability', () => {
      agentRegistry.register({
        name: 'ChatAgent',
        capabilities: [
          { name: 'chat', description: '', priority: 10 },
          { name: 'search', description: '', priority: 5 }
        ],
      });
      agentRegistry.register({
        name: 'SearchAgent',
        capabilities: [
          { name: 'search', description: '', priority: 10 }
        ],
      });

      const chatAgents = agentRegistry.findByCapability('chat');
      expect(chatAgents.length).toBe(1);
      expect(chatAgents[0].name).toBe('ChatAgent');

      const searchAgents = agentRegistry.findByCapability('search');
      expect(searchAgents.length).toBe(2);
    });

    it('should update agent status', () => {
      const agent = agentRegistry.register({
        name: 'TestAgent',
        capabilities: [],
      });

      const success = agentRegistry.updateStatus(agent.id, 'busy');
      expect(success).toBe(true);

      const updated = agentRegistry.get(agent.id);
      expect(updated?.status).toBe('busy');
    });

    it('should cleanup offline agents', () => {
      agentRegistry.register({
        name: 'TestAgent',
        capabilities: [],
      });

      // Immediately cleanup (0ms threshold)
      const count = agentRegistry.cleanup(0);
      expect(count).toBe(1);

      const agent = agentRegistry.list()[0];
      expect(agent.status).toBe('offline');
    });
  });

  describe('TaskDistributor', () => {
    it('should submit a task', () => {
      const task = taskDistributor.submit(
        'Test task',
        ['capability1'],
        'high'
      );

      expect(task).toBeDefined();
      expect(task.description).toBe('Test task');
      expect(task.requirements).toContain('capability1');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('pending');
    });

    it('should list all tasks', () => {
      taskDistributor.submit('Task 1');
      taskDistributor.submit('Task 2');

      const tasks = taskDistributor.listTasks();
      expect(tasks.length).toBe(2);
    });

    it('should get task status', () => {
      const task = taskDistributor.submit('Test');
      const status = taskDistributor.getTaskStatus(task.taskId);

      expect(status.status).toBe('pending');
    });

    it('should return not_found for unknown task', () => {
      const status = taskDistributor.getTaskStatus('unknown');
      expect(status.status).toBe('not_found');
    });
  });
});
