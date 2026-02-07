# V5 → V6: 从技能到身份

## 📊 版本对比

| 维度 | V5 | V6 |
|------|----|----|
| 代码行数 | ~554 | ~965 |
| 工具数量 | 13 | 17 (+4 identity_*) |
| 核心理念 | 技能即扩展 | 身份即人格 |
| 人格方式 | ❌ 硬编码 | ✅ 文件配置 |
| 人格文件 | 0 | 7 |
| 模板来源 | - | .ID.sample/ |

## 🎯 Motivation: 为什么需要 V6？

### V5 的局限性

```
场景: 不同用户希望 Agent 有不同的交互风格

V5 的做法:
1. 修改系统提示中���人格描述
2. 重新部署
3. 所有用户共享同一人格
```

**问题：**
1. **单一人格** - 所有任务用同一种风格
2. **无法适应** - 不同用户有不同偏好
3. **硬编码** - 修改人格需要改代码
4. **无记忆** - 不记得用户的习惯

### V6 的解决方案

```
project/
├── AGENTS.md      # 行为规范
├── SOUL.md        # 核心价值观
├── IDENTITY.md    # 当前身份
├── USER.md        # 用户偏好
├── BOOTSTRAP.md   # 首次引导
├── HEARTBEAT.md   # 心跳配置
├── TOOLS.md       # 工具偏好
└── memory/        # 记忆目录

.ID.sample/        # 模板来源目录
├── AGENTS.md
├── SOUL.md
├── IDENTITY.md
├── USER.md
├── BOOTSTRAP.md
├── HEARTBEAT.md
└── TOOLS.md
```

**优势：**
1. **Workspace 初始化** - 自动从 .ID.sample/ 复制模板
2. **用户偏好** - 记住用户的习惯和偏好
3. **动态配置** - 通过文件配置，无需改代码
4. **核心不变** - SOUL.md 定义不可变的核心价值观
5. **首次引导** - BOOTSTRAP.md 支持新用户引导

## 🔧 核心变更

### 1. PERSONA_FILES 与模板加载 (新增 ~30行)

```typescript
// 人格文件列表（从 .ID.sample 目录复制）
const PERSONA_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "IDENTITY.md",
  "USER.md",
  "BOOTSTRAP.md",
  "HEARTBEAT.md",
  "TOOLS.md"
];

// 从 .ID.sample 目录加载模板内容
function loadPersonaTemplate(filename: string): string {
  const samplePath = path.join(ID_SAMPLE_DIR, filename);
  if (fs.existsSync(samplePath)) {
    return fs.readFileSync(samplePath, "utf-8");
  }
  // 如果 .ID.sample 不存在，返回最小模板
  return `# ${filename}\n\n(模板文件缺失，请检查 .ID.sample 目录)`;
}
```

### 2. IdentitySystem 类 (新增 ~120行)

```typescript
class IdentitySystem {
  private workspaceDir: string;
  private identityCache: { name: string; soul: string; user: string; rules: string } | null = null;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
  }

  // 初始化 Workspace（从 .ID.sample 复制缺失的人格文件）
  initWorkspace(): string {
    const created: string[] = [];
    const existed: string[] = [];

    for (const filename of PERSONA_FILES) {
      const filePath = path.join(this.workspaceDir, filename);
      if (!fs.existsSync(filePath)) {
        const content = loadPersonaTemplate(filename);
        fs.writeFileSync(filePath, content, "utf-8");
        created.push(filename);
      } else {
        existed.push(filename);
      }
    }

    // 确保 memory 目录存在
    const memoryDir = path.join(this.workspaceDir, "memory");
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
      created.push("memory/");
    }

    if (created.length === 0) {
      return `Workspace 已就绪 (${existed.length} 个人格文件)`;
    }
    return `Workspace 初始化:\n  创建: ${created.join(", ")}\n  已存在: ${existed.join(", ")}`;
  }

  // 加载身份信息
  loadIdentity(): string {
    const files = ["AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md"];
    const contents: Record<string, string> = {};

    for (const file of files) {
      const filePath = path.join(this.workspaceDir, file);
      contents[file] = fs.existsSync(filePath)
        ? fs.readFileSync(filePath, "utf-8")
        : `(${file} 不存在)`;
    }

    // 提取名字 (支持 **名字** 和 **Name** 两种格式)
    const nameMatch = contents["IDENTITY.md"].match(/\*\*(名字|Name)\*\*:\s*(.+)/);
    const name = nameMatch ? nameMatch[2].trim() : "Assistant";

    this.identityCache = {
      name,
      soul: contents["SOUL.md"],
      user: contents["USER.md"],
      rules: contents["AGENTS.md"]
    };

    // 检查是否需要首次引导
    const bootstrapPath = path.join(this.workspaceDir, "BOOTSTRAP.md");
    const needsBootstrap = fs.existsSync(bootstrapPath) && name === "(待设置)";

    return needsBootstrap
      ? `身份加载完成: ${name} (首次运行，请完成引导设置)`
      : `身份加载完成: ${name}`;
  }

  // 获取增强的系统提示（注入身份信息）
  getEnhancedSystemPrompt(basePrompt: string): string {
    if (!this.identityCache) {
      this.loadIdentity();
    }

    return `${basePrompt}

# 你的身份
${this.identityCache!.soul}

# 用户信息
${this.identityCache!.user}

# 行为规范
${this.identityCache!.rules}`;
  }

  // 更新身份文件
  updateIdentityFile(file: string, content: string): string {
    const validFiles = ["IDENTITY.md", "SOUL.md", "USER.md", "HEARTBEAT.md", "TOOLS.md"];
    if (!validFiles.includes(file)) {
      return `错误: 只能更新 ${validFiles.join(", ")}`;
    }
    const filePath = path.join(this.workspaceDir, file);
    fs.writeFileSync(filePath, content, "utf-8");
    this.identityCache = null; // 清除缓存
    return `已更新: ${file}`;
  }

  // 获取当前身份摘要
  getIdentitySummary(): string {
    if (!this.identityCache) {
      this.loadIdentity();
    }
    return `名字: ${this.identityCache!.name}\n\n灵魂摘要:\n${this.identityCache!.soul.slice(0, 300)}...`;
  }

  // 获取名字
  getName(): string {
    if (!this.identityCache) {
      this.loadIdentity();
    }
    return this.identityCache!.name;
  }
}
```

### 3. 身份工具 (新增 4 个)

```typescript
// identity_init - 初始化 Workspace
{
  name: "identity_init",
  description: "初始化 Workspace（创建人格文件 AGENTS.md/SOUL.md/IDENTITY.md/USER.md/BOOTSTRAP.md/HEARTBEAT.md/TOOLS.md）",
  input_schema: { type: "object", properties: {} }
}

// identity_load - 重新加载身份
{
  name: "identity_load",
  description: "重新加载身份信息",
  input_schema: { type: "object", properties: {} }
}

// identity_update - 更新身份文件
{
  name: "identity_update",
  description: "更新身份文件",
  input_schema: {
    type: "object",
    properties: {
      file: { type: "string", enum: ["IDENTITY.md", "SOUL.md", "USER.md", "HEARTBEAT.md", "TOOLS.md"] },
      content: { type: "string" }
    },
    required: ["file", "content"]
  }
}

// identity_get - 获取身份摘要
{
  name: "identity_get",
  description: "获取当前身份摘要",
  input_schema: { type: "object", properties: {} }
}
```

### 4. 系统提示更新

```typescript
// V5: 静态系统提示
const SYSTEM = `你是 OpenClaw V5...`;

// V6: 动态注入身份
const response = await client.messages.create({
  model: MODEL,
  system: [{ type: "text", text: identitySystem.getEnhancedSystemPrompt(BASE_SYSTEM) }],
  messages: history,
  tools: TOOLS,
  max_tokens: 8000
});
```

## 📈 Diff 统计

```diff
 v5-agent.ts → v6-agent.ts

 + 新增 ~411 行
   - PERSONA_FILES + loadPersonaTemplate (~30行)
   - IdentitySystem 类 (~120行)
   - identity_* 工具定义 (~40行)
   - 工具路由 case (~20行)
   - 系统提示身份规则 (~30行)

 ~ 修改 ~20 行
   - chat() 函数使用 getEnhancedSystemPrompt
   - 主入口初始化身份系统
```

## 💡 设计洞察

> **七个身份文件的分工**
>
> | 文件 | 用途 | 修改频率 |
> |------|------|---------|
> | AGENTS.md | 行为规范 | 很少 |
> | SOUL.md | 核心价值观 | 几乎不变 |
> | IDENTITY.md | 当前身份 | 偶尔 |
> | USER.md | 用户偏好 | 经常 |
> | BOOTSTRAP.md | 首次引导 | 一次性 |
> | HEARTBEAT.md | 心跳配置 | 偶尔 |
> | TOOLS.md | 工具偏好 | 偶尔 |

> **为什么分离 SOUL 和 IDENTITY？**
>
> - **SOUL** = 不可变的核心价值观（诚实、有帮助、无害）
> - **IDENTITY** = 可变的身份信息（名字、角色、特点）
>
> 这样可以在保持核心价值观不变的情况下，灵活调整身份。

> **模板外部化的好处**
>
> ```
> .ID.sample/  →  project/
> ```
>
> - 模板与代码分离，便于维护
> - 用户可自定义模板
> - 支持多项目共享模板

> **身份缓存的作用**
>
> ```typescript
> private identityCache: { ... } | null = null;
> ```
>
> - 避免每次请求都读取文件
> - 更新身份文件后清除缓存
> - 下次请求时重新加载

## 🧪 验证测试

```bash
# 初始化身份系统
npx tsx v6-agent.ts "初始化 workspace"

# 查看生成的文件
ls -la AGENTS.md SOUL.md IDENTITY.md USER.md BOOTSTRAP.md HEARTBEAT.md TOOLS.md

# 更新身份
npx tsx v6-agent.ts "把我的名字设置为小明"

# 验证身份
npx tsx v6-agent.ts "你叫什么名字？"
```

## 🌟 身份演进

V6 的身份系统为后续版本奠定基础：

```
V6: 身份系统
├── AGENTS.md (行为规范)
├── SOUL.md (核心价值观)
├── IDENTITY.md (当前身份)
├── USER.md (用户偏好)
├── BOOTSTRAP.md (首次引导)
├── HEARTBEAT.md (心跳配置)
└── TOOLS.md (工具偏好)

V7: 分层记忆 (基于身份的记忆)
V8: 心跳系统 (基于身份的主动性)
V9: 会话管理 (基于身份的多会话)
```
