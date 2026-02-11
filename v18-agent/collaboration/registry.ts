/**
 * collaboration/registry.ts - Agent 注册表
 * 
 * 管理 Agent 的发现和注册:
 * - 注册 Agent 能力
 * - 发现匹配的 Agent
 * - 维护 Agent 健康状态
 */

import * as fs from "fs";
import * as path from "path";

export interface AgentCapability {
  name: string;
  description: string;
  priority: number;  // 1-10, 越高越优先
}

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  status: "active" | "busy" | "offline";
  lastSeen: number;
  metadata?: Record<string, any>;
}

export class AgentRegistry {
  private agents: Map<string, AgentInfo> = new Map();
  private registryPath: string;

  constructor(workDir: string) {
    this.registryPath = path.join(workDir, ".agent-registry.json");
    this.load();
  }

  /**
   * 注册 Agent
   */
  register(agent: Omit<AgentInfo, "id" | "lastSeen"> & { id?: string }): AgentInfo {
    const id = agent.id || `agent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    const info: AgentInfo = {
      ...agent,
      id,
      lastSeen: Date.now(),
    };

    this.agents.set(id, info);
    this.save();
    return info;
  }

  /**
   * 更新 Agent 状态
   */
  updateStatus(id: string, status: AgentInfo["status"]): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;

    agent.status = status;
    agent.lastSeen = Date.now();
    this.save();
    return true;
  }

  /**
   * 心跳更新
   */
  heartbeat(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;

    agent.lastSeen = Date.now();
    if (agent.status === "offline") {
      agent.status = "active";
    }
    this.save();
    return true;
  }

  /**
   * 获取 Agent
   */
  get(id: string): AgentInfo | undefined {
    return this.agents.get(id);
  }

  /**
   * 列出所有 Agent
   */
  list(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  /**
   * 查找具有特定能力的 Agent
   */
  findByCapability(capabilityName: string): AgentInfo[] {
    return this.list()
      .filter(a => a.status !== "offline")
      .filter(a => a.capabilities.some(c => 
        c.name.toLowerCase() === capabilityName.toLowerCase()
      ))
      .sort((a, b) => {
        const pa = a.capabilities.find(c => c.name.toLowerCase() === capabilityName.toLowerCase())?.priority || 0;
        const pb = b.capabilities.find(c => c.name.toLowerCase() === capabilityName.toLowerCase())?.priority || 0;
        return pb - pa;
      });
  }

  /**
   * 搜索 Agent
   */
  search(query: string): AgentInfo[] {
    const q = query.toLowerCase();
    return this.list().filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.capabilities.some(c => c.name.toLowerCase().includes(q))
    );
  }

  /**
   * 获取可用 Agent (非 offline)
   */
  getAvailable(): AgentInfo[] {
    return this.list().filter(a => a.status !== "offline");
  }

  /**
   * 注销 Agent
   */
  unregister(id: string): boolean {
    const deleted = this.agents.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  /**
   * 清理长时间未心跳的 Agent
   */
  cleanup(maxAgeMs: number = 300000): number {
    const now = Date.now();
    let count = 0;

    for (const [id, agent] of this.agents) {
      if (now - agent.lastSeen >= maxAgeMs) {
        agent.status = "offline";
        count++;
      }
    }

    if (count > 0) this.save();
    return count;
  }

  /**
   * 保存到文件
   */
  private save(): void {
    const data = Array.from(this.agents.values());
    fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
  }

  /**
   * 从文件加载
   */
  private load(): void {
    if (!fs.existsSync(this.registryPath)) return;

    try {
      const data = JSON.parse(fs.readFileSync(this.registryPath, "utf-8"));
      for (const agent of data) {
        this.agents.set(agent.id, agent);
      }
    } catch {
      // ignore
    }
  }

  /**
   * 生成注册表报告
   */
  generateReport(): string {
    const all = this.list();
    const active = all.filter(a => a.status === "active").length;
    const busy = all.filter(a => a.status === "busy").length;
    const offline = all.filter(a => a.status === "offline").length;

    const capabilities = new Map<string, number>();
    for (const agent of all) {
      for (const cap of agent.capabilities) {
        capabilities.set(cap.name, (capabilities.get(cap.name) || 0) + 1);
      }
    }

    return `## Agent 注册表报告

总计: ${all.length} 个 Agent
- 🟢 活跃: ${active}
- 🟡 忙碌: ${busy}
- ⚫ 离线: ${offline}

### 能力分布
${Array.from(capabilities.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([name, count]) => `- ${name}: ${count} 个 Agent`)
  .join("\n")}

### Agent 列表
${all.slice(0, 10).map(a => `- [${a.status === "active" ? "🟢" : a.status === "busy" ? "🟡" : "⚫"}] ${a.name}: ${a.capabilities.map(c => c.name).join(", ")}`).join("\n")}
${all.length > 10 ? `\n... 还有 ${all.length - 10} 个 Agent` : ""}
`;
  }
}
