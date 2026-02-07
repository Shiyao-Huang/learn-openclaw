# V4 → V5: 从硬编码到可扩展技能

## 📊 版本对比

| 维度 | V4 | V5 |
|------|----|----|
| 代码行数 | ~567 | ~722 |
| 工具数量 | 12 | 13 (+1 Skill) |
| 核心理念 | 委托即协作 | 技能即扩展 |
| 扩展方式 | ❌ 改代码 | ✅ 加文件 |

## 🎯 Motivation: 为什么需要 V5？

### V4 的局限性

```
场景: 需要 Agent 学会使用 GitHub CLI

V4 的做法:
1. 修改 v4-agent.ts
2. 添加 github 工具定义
3. 实现 runGitHub 函数
4. 重新部署
```

**问题：**
1. **扩展困难** - 每个新能力都要改代码
2. **知识固化** - 领域知识硬编码在代码里
3. **无法共享** - 技能无法在 Agent 间复用
4. **维护成本** - 代码越来越臃肿

### V5 的解决方案

```markdown
<!-- skills/github/SKILL.md -->
---
name: github
description: GitHub CLI 操作指南
---
# GitHub Skill

## 常用命令
- `gh issue list` - 列出 issues
- `gh pr create` - 创建 PR
...
```

```typescript
// Agent 动态加载技能
Skill({ skill: "github" })
// → 返回 SKILL.md 内容，Agent 按指引操作
```

**优势：**
1. **零代码扩展** - 加 Markdown 文件即可
2. **知识外置** - 领域知识与代码分离
3. **可共享** - 技能文件可复制到其他项目
4. **易维护** - 非程序员也能编写技能

## 🔧 核心变更

### 1. SkillLoader 类 (新增 ~60行)

```typescript
interface SkillMeta {
  name: string;
  description: string;
}

class SkillLoader {
  private skillsDir: string;
  private cache: Map<string, { meta: SkillMeta; content: string }> = new Map();

  constructor() {
    this.skillsDir = path.join(WORKDIR, "skills");
  }

  // 列出所有可用技能
  list(): string {
    const skills = fs.readdirSync(this.skillsDir)
      .filter(d => fs.existsSync(path.join(this.skillsDir, d, "SKILL.md")));
    
    return skills.map(name => {
      const { meta } = this.load(name);
      return `- ${name}: ${meta.description}`;
    }).join("\n");
  }

  // 加载技能内容
  load(skillName: string): { meta: SkillMeta; content: string } {
    if (this.cache.has(skillName)) {
      return this.cache.get(skillName)!;
    }

    const skillPath = path.join(this.skillsDir, skillName, "SKILL.md");
    const raw = fs.readFileSync(skillPath, "utf-8");
    
    // 解析 YAML frontmatter
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) throw new Error(`技能格式错误: ${skillName}`);
    
    const meta = yaml.parse(match[1]) as SkillMeta;
    const content = match[2].trim();
    
    this.cache.set(skillName, { meta, content });
    return { meta, content };
  }

  // 获取技能内容（供 Agent 使用）
  get(skillName: string): string {
    const { content } = this.load(skillName);
    return `<skill-loaded name="${skillName}">\n${content}\n</skill-loaded>\n\n请按照上述技能文档的指引完成任务。`;
  }
}
```

### 2. Skill 工具 (新增)

```typescript
{
  name: "Skill",
  description: "加载技能文档。当任务涉及特定领域时，先加载相关技能获取指引",
  input_schema: {
    type: "object",
    properties: {
      skill: { type: "string", description: "技能名称（如 github, docker）" },
      action: { type: "string", enum: ["load", "list"], description: "load=加载技能, list=列出所有" }
    },
    required: ["skill"]
  }
}
```

### 3. 技能文件格式

```markdown
<!-- skills/<name>/SKILL.md -->
---
name: skill-name
description: 一句话描述这个技能
---
# 技能标题

## 概述
技能的用途和适用场景

## 使用方法
具体的操作指南

## 示例
实际使用示例

## 注意事项
常见问题和解决方案
```

### 4. 系统提示更新

```typescript
const SYSTEM = `你是 OpenClaw V5 - 技能型 Agent。

工作循环: identify -> load-skill -> plan -> execute -> track -> remember

技能规则:
- 遇到特定领域任务时，先用 Skill 工具加载相关技能
- 技能文档包含领域知识和操作指南
- 按照技能文档的指引完成任务
- 可用 Skill({ action: "list" }) 查看所有可用技能`;
```

## 📈 Diff 统计

```diff
 v4-agent.ts → v5-agent.ts
 
 + 新增 ~155 行
   - SkillMeta 接口 (~5行)
   - SkillLoader 类 (~80行)
   - Skill 工具定义 (~15行)
   - 工具路由 case (~10行)
   - 系统提示技能规则 (~15行)
 
 + 新增依赖
   - yaml (YAML frontmatter 解析)
 
 ~ 修改 ~10 行
   - 系统提示更新
```

## 💡 设计洞察

> **为什么用 Markdown 而不是 JSON/YAML？**
> 
> 1. **人类友好** - 非程序员也能编写
> 2. **富文本** - 支持代码块、列表、表格
> 3. **版本控制** - Git diff 友好
> 4. **生态兼容** - 可直接在 GitHub 预览

> **YAML Frontmatter 的作用**
> 
> ```yaml
> ---
> name: github
> description: GitHub CLI 操作指南
> ---
> ```
> 
> - 结构化元数据（名称、描述）
> - 与内容分离
> - 便于索引和搜索

> **技能 vs 工具**
> 
> | 维度 | 工具 (Tool) | 技能 (Skill) |
> |------|-------------|--------------|
> | 定义方式 | TypeScript 代码 | Markdown 文件 |
> | 执行方式 | 直接调用函数 | 指导 Agent 行为 |
> | 扩展成本 | 高（改代码） | 低（加文件） |
> | 适用场景 | 原子操作 | 领域知识 |

## 🧪 验证测试

```bash
# 创建测试技能
mkdir -p skills/hello
cat > skills/hello/SKILL.md << 'EOF'
---
name: hello
description: 问候技能
---
# Hello Skill

当用户需要问候时，回复 "你好！我是 OpenClaw V5！"
EOF

# 加载并使用技能
npx tsx v5-agent.ts "加载 hello 技能并打个招呼"
```

## 🌟 技能生态

V5 的技能系统为 Agent 生态奠定基础：

```
skills/
├── github/SKILL.md      # GitHub 操作
├── docker/SKILL.md      # Docker 管理
├── kubernetes/SKILL.md  # K8s 部署
├── aws/SKILL.md         # AWS 服务
└── ...
```

技能可以：
- 在项目间复制
- 在社区共享
- 版本控制
- 持续改进
