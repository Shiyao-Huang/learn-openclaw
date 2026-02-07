# Learn OpenClaw - Build AI Agents from Scratch

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> **Disclaimer**: This is an independent educational project for learning AI Agent architecture. Not affiliated with any commercial product.

**The most comprehensive AI Agent tutorial: 10 progressive versions, from 150 lines to production-ready.**

[中文文档](./README_zh.md)

---

## Why This Repository?

Modern AI Agents (Claude Code, Cursor, etc.) are complex systems with tens of thousands of lines of code. Reading them directly is overwhelming.

**This project takes a different approach**: Start with the simplest possible agent (150 lines), then progressively add one capability at a time until you have a production-grade system.

```
V0 (150 lines) → V9 (1500+ lines)
   │
   └── Each version adds exactly ONE new concept
```

---

## The Evolution

| Version | Core Concept | Lines | What You'll Learn |
|---------|-------------|-------|-------------------|
| **V0** | Bash is All You Need | ~150 | The Agent Loop - the foundation of everything |
| **V1** | Specialized Tools | ~287 | Why dedicated tools beat generic bash |
| **V2** | Local Memory | ~457 | Vector search without external databases |
| **V3** | Task Planning | ~527 | Making AI behavior predictable with TodoManager |
| **V4** | Subagents | ~570 | Context isolation through process recursion |
| **V5** | Skills System | ~554 | Domain expertise without retraining |
| **V6** | Identity System | ~930 | Multi-persona switching and personality |
| **V7** | Layered Memory | ~1176 | Time-aware memory: daily logs + long-term |
| **V8** | Heartbeat System | ~1369 | Proactive behavior and scheduled tasks |
| **V9** | Session Management | ~1516 | Multi-task isolation and context switching |

---

## Learning Path

```
Start Here
    │
    ▼
[V0: Bash Agent] ────────► "One tool is enough"
    │                       The core loop that powers ALL agents
    ▼
[V1: Basic Tools] ───────► "Specialized > Generic"
    │                       +read/write/edit/grep with safePath
    ▼
[V2: Memory] ────────────► "No external DB needed"
    │                       +LocalMemory with Jaccard similarity
    ▼
[V3: TodoManager] ───────► "Make plans visible"
    │                       +TodoWrite for explicit planning
    ▼
[V4: Subagent] ──────────► "Divide and conquer"
    │                       +Process recursion for isolation
    ▼
[V5: Skill] ─────────────► "Expertise without retraining"
    │                       +SkillLoader with YAML frontmatter
    ▼
[V6: Identity] ──────────► "Personality is configuration"
    │                       +Multi-persona switching
    ▼
[V7: LayeredMemory] ─────► "Time-aware agents"
    │                       +Daily logs + long-term memory
    ▼
[V8: Heartbeat] ─────────► "Proactive, not reactive"
    │                       +Scheduled checks and reminders
    ▼
[V9: Session] ───────────► "Multi-task isolation"
                            +SessionManager for context switching
```

---

## The Core Pattern

**Every AI agent is just this loop:**

```typescript
while (true) {
    const response = await model(messages, tools);
    if (response.stop_reason !== "tool_use") {
        return response.text;
    }
    const results = execute(response.tool_calls);
    messages.push(results);
}
```

That's it. The model calls tools until done. **Everything else is refinement.**

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Shiyao-Huang/learn-openclaw
cd learn-openclaw

# Install dependencies
npm install

# Configure API key
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# Run any version (start with v0!)
npx tsx v0-agent.ts    # Minimal agent
npx tsx v1-agent.ts    # Basic tools
npx tsx v2-agent.ts    # Local memory
npx tsx v3-agent.ts    # Task planning
npx tsx v4-agent.ts    # Subagents
npx tsx v5-agent.ts    # Skills system
npx tsx v6-agent.ts    # Identity system
npx tsx v7-agent.ts    # Layered memory
npx tsx v8-agent.ts    # Heartbeat system
npx tsx v9-agent.ts    # Session management
```

---

## Key Insights by Version

### V0: Bash is All You Need (~150 lines)

> "One tool is enough"

A single `bash` tool creates a complete agent. It can read files (`cat`), write files (`echo >`), search code (`grep`), and execute anything.

**Key insight**: The model IS the agent. Code just provides tools.

### V1: Specialized Tools (~287 lines)

> "Dedicated tools are safer than generic bash"

Replace dangerous bash with safe, purpose-built tools:
- `read_file`: Path validation prevents escapes
- `write_file`: Auto-creates directories
- `edit_file`: Precise find-and-replace
- `grep`: Content search

**Key insight**: Constraints enable complexity.

### V2: Local Memory (~457 lines)

> "No external vector database needed"

`LocalMemory` implements:
- **Jaccard similarity**: Simple, works great for CJK languages
- **2-gram tokenization**: Chinese-friendly character pairs
- **Auto-indexing**: Build index on append

**Key insight**: Simple algorithms often beat complex ones.

### V3: Task Planning (~527 lines)

> "Make plans visible"

`TodoManager` enforces structure:
- Max 20 tasks
- Only 1 `in_progress` at a time
- Single `TodoWrite` tool (replace, not patch)

**Key insight**: Explicit planning makes AI predictable.

### V4: Subagents (~570 lines)

> "Context isolation through process recursion"

```typescript
const cmd = `npx tsx "${scriptPath}" "${escapedPrompt}"`;
execSync(cmd, { env: { OPENCLAW_SUBAGENT: "1" } });
```

**Key insight**: Clean context = better results.

### V5: Skills System (~554 lines)

> "Domain expertise without retraining"

`SkillLoader` parses YAML frontmatter and injects knowledge on-demand.

**Key insight**: Knowledge injection beats fine-tuning.

### V6: Identity System (~930 lines)

> "Personality is just configuration"

Files that define an agent:
- `AGENTS.md`: Available personas
- `SOUL.md`: Core values
- `IDENTITY.md`: Active identity
- `USER.md`: User preferences

**Key insight**: Identity is data, not code.

### V7: Layered Memory (~1176 lines)

> "Agents need time awareness"

- **Daily logs**: `memory/YYYY-MM-DD.md`
- **Long-term memory**: `MEMORY.md`
- **Time context**: Auto-injected date info

**Key insight**: Memory needs temporal structure.

### V8: Heartbeat System (~1369 lines)

> "Proactive, not just reactive"

`HeartbeatSystem` enables:
- Scheduled reminders
- Proactive checks
- Task tracking

**Key insight**: Great agents anticipate needs.

### V9: Session Management (~1516 lines)

> "Multi-task isolation"

- **main**: Persistent primary session
- **isolated**: Independent context per task
- Session switching and state preservation

**Key insight**: Isolation prevents context pollution.

---

## File Structure

```
learn-openclaw/
├── v0-agent.ts          # ~150 lines: 1 tool, core loop
├── v1-agent.ts          # ~287 lines: 5 tools, safe operations
├── v2-agent.ts          # ~457 lines: local memory system
├── v3-agent.ts          # ~527 lines: task planning
├── v4-agent.ts          # ~570 lines: subagent coordination
├── v5-agent.ts          # ~554 lines: skill system
├── v6-agent.ts          # ~930 lines: identity system
├── v7-agent.ts          # ~1176 lines: layered memory
├── v8-agent.ts          # ~1369 lines: heartbeat system
├── v9-agent.ts          # ~1516 lines: session management
├── skills/              # Example skills
├── docs/                # Technical documentation
│   ├── v0-Bash即一切.md
│   ├── v1-模型即代理.md
│   └── ...
├── .ID.sample/          # Sample identity files
├── .env.example         # Environment template
└── package.json         # Dependencies
```

---

## Evolution Dependencies

```
V0 (Core Loop)
 └── V1 (Basic Tools)
      └── V2 (Local Memory)
           └── V3 (Task Planning)
                └── V4 (Subagents)
                     └── V5 (Skills)
                          └── V6 (Identity)
                               └── V7 (Layered Memory)
                                    └── V8 (Heartbeat)
                                         └── V9 (Sessions)
```

Each version is a strict superset of the previous. No version skipping.

---

## Philosophy

> **The model is 80%. Code is 20%.**

Modern agents work not because of clever engineering, but because the model is trained to BE an agent. Our job is to give it tools and stay out of the way.

---

## Documentation

### Technical Docs (docs/)

| Doc | Topic |
|-----|-------|
| [v0-Bash即一切](./docs/v0-Bash即一切.md) | The core agent loop |
| [v1-模型即代理](./docs/v1-模型即代理.md) | Model as agent |
| [v2-向量记忆系统](./docs/v2-向量记忆系统.md) | Local vector memory |
| [v3-任务规划系统](./docs/v3-任务规划系统.md) | Task planning |
| [v4-子代理协调](./docs/v4-子代理协调.md) | Subagent coordination |
| [v5-Skill系统](./docs/v5-Skill系统.md) | Skills mechanism |
| [v6-身份系统](./docs/v6-身份系统.md) | Identity system |
| [v7-分层记忆](./docs/v7-分层记忆.md) | Layered memory |
| [v8-心跳系统](./docs/v8-心跳系统.md) | Heartbeat system |
| [v9-会话管理](./docs/v9-会话管理.md) | Session management |

### Evolution Guides (docs/evolution/)

Step-by-step diffs between versions showing exactly what changed and why.

---

## Related Resources

| Resource | Description |
|----------|-------------|
| [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) | Python version, 5 stages |
| [Agent Skills Spec](https://agentskills.io/specification) | Official skills specification |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python) | Official Python SDK |

---

## Contributing

Contributions welcome! Please feel free to submit issues and pull requests.

- Add new skills in `skills/`
- Improve documentation in `docs/`
- Report bugs via [Issues](https://github.com/Shiyao-Huang/learn-openclaw/issues)

---

## License

MIT

---

<p align="center">
  <strong>Model as Agent. That's the whole secret.</strong>
</p>

<p align="center">
  <a href="https://github.com/Shiyao-Huang">@Shiyao-Huang</a>
</p>
