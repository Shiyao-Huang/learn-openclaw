# V5 -> V5.5: 从 Skill 到 Hook 基础设施

## 版本差异（实测）

| 维度 | V5 | V5.5 |
|---|---|---|
| 代码行数 | 614 | 777 |
| 工具数 | 12 | 12 |
| 关键新增 | Skill 加载 | HookSystem + BootstrapManager |
| 技能工具名 | `Skill` | `Skill` |

---

## 核心改动

### 1. 引入 HookSystem

```typescript
type HookType = "bootstrap:files" | "session:start" | "session:end";
```

- `register()` 注册 handler
- `emit()` 顺序触发 handler
- `event.prevented` 可短路后续处理

### 2. 引入 BootstrapManager

- 读取 `bootstrap/*.md`
- 依据文件名前缀数字排序
- 合并为人格/引导注入内容

### 3. 主入口接入生命周期事件

```text
initialize -> emit(bootstrap:files) -> build SYSTEM
main start -> emit(session:start)
exit -> emit(session:end)
```

---

## 为什么这一版重要

V5.5 提前把“扩展点”抽离出来，让后续 V6 身份系统能够接入而不破坏主循环。
