# V4 -> V5: 从子代理执行到 Skill 知识加载

## 版本差异（实测）

| 维度 | V4 | V5 |
|---|---|---|
| 代码行数 | 599 | 614 |
| 工具数 | 12 | 12 |
| 关键新增 | - | `SkillLoader` + `Skill` 工具 |

V5 不是“加更多工具”，而是把领域知识加载机制引入到同一工具框架。

---

## 核心改动

### 1. 新增 `SkillLoader`

- 扫描 `skills/*/SKILL.md`
- 解析 frontmatter: `name` + `description`
- 加载完整技能内容并附带资源目录摘要

### 2. 新增 `Skill` 工具

```typescript
name: "Skill"
input: { skill: string }
```

- `skill='list'` 列表模式
- `skill='<name>'` 加载模式

### 3. 系统提示流程变化

从：

```text
plan -> delegate -> execute
```

到：

```text
identify -> load skill -> plan -> execute -> track
```

---

## 设计价值

1. 领域知识外置到 Markdown 文件，可维护性大幅提升。
2. 任务前置技能匹配，减少模型“临时猜”策略。
3. 非代码改动即可扩展能力。

---

## 最小验证

```bash
npx tsx v5-agent.ts
```

```text
>> 先列出可用技能
[Skill] {"skill":"list"}

>> 加载 code-review 技能
[Skill] {"skill":"code-review"}
```

---

下一步：V5.5 将引入 Hook 扩展点，使系统提示组装与会话生命周期可编程。
