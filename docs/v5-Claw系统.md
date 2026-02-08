# V5: Skill 系统（文件名保留历史名）

> 核心哲学: 把领域知识从代码里剥离出来，按需加载。

V5 在 V4 基础上新增 `SkillLoader` 与 `Skill` 工具。它不是让模型“变聪明”，而是让模型在需要时加载对应的技能文档。

---

## V4 vs V5

| 维度 | V4 | V5 |
|---|---|---|
| 工具数 | 12 | 12 |
| 新能力 | 子代理隔离执行 | 领域技能注入 |
| 技能形态 | 无 | `skills/<name>/SKILL.md` |
| 技能工具 | 无 | `Skill` |
| 代码规模 | 599 行 | 614 行 |

说明：V5 的新增点主要是“替换能力”，不是堆工具数量。

---

## 目录与文件格式

```text
skills/
  code-review/
    SKILL.md
    scripts/
    references/
    assets/
```

`SKILL.md` 采用 YAML frontmatter + Markdown body：

```markdown
---
name: code-review
description: 代码审查专家
---

# 审查规则
...
```

---

## SkillLoader 设计

`SkillLoader` 做三件事：

1. 扫描 `SKILL_DIR`（默认 `${WORKDIR}/skills`）
2. 解析 `SKILL.md` frontmatter
3. 按需加载完整技能内容，并附带资源目录摘要

输出示例：

```text
<skill-loaded name="code-review">
...
</skill-loaded>

**可用资源:**
- 脚本 (scripts/): lint.sh
- 参考文档 (references/): style-guide.md
```

---

## Skill 工具

```typescript
{
  name: "Skill",
  input_schema: {
    properties: {
      skill: { type: "string" } // 支持 skill='list'
    },
    required: ["skill"]
  }
}
```

- `Skill({ skill: "list" })`: 列出所有技能
- `Skill({ skill: "xxx" })`: 加载指定技能

---

## 系统提示中的执行顺序

V5 强制先做“技能匹配”，再规划任务：

```text
identify -> load skill -> plan(TodoWrite) -> execute -> track
```

这让技能从“可选参考”升级为“任务入口约束”。

---

## 最小验证

```bash
npx tsx v5-agent.ts
```

```text
>> 帮我做一次代码审查
[Skill] {"skill":"code-review"}
[TodoWrite] ...
```

---

## 与后续版本关系

- V5.5 引入 Hook，把“系统组装时机”开放出来。
- V5.5+ 继续沿用技能机制，统一使用 `SkillLoader` 与 `Skill` 工具名。

---

[← V4: 子代理协调](./v4-子代理协调.md) | [V5.5: Hook 系统 →](./v5.5-Hook系统.md)
