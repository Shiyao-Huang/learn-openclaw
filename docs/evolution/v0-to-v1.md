# V0 → V1: 从 Bash 到专用工具

## 📊 版本对比

| 维度 | V0 | V1 |
|------|----|----|
| 代码行数 | ~153 | ~363 |
| 工具数量 | 1 (bash) | 5 (bash, read, write, edit, grep) |
| 核心理念 | Bash 即一切 | 模型即代理 |

## 🎯 Motivation: 为什么需要 V1？

### V0 的局限性

```typescript
// V0: 所有操作都通过 bash
bash("cat file.txt")           // 读取
bash("echo 'content' > file")  // 写入
bash("sed -i 's/old/new/' f")  // 编辑
bash("grep -r 'pattern' .")    // 搜索
```

**问题：**
1. **模型负担重** - 模型需要记住各种 shell 命令语法
2. **错误处理弱** - bash 错误信息不够结构化
3. **跨平台差异** - macOS/Linux/Windows 命令不同
4. **安全风险高** - 任意 bash 命令可能造成破坏

### V1 的解决方案

```typescript
// V1: 专用工具，语义清晰
read_file({ path: "file.txt", limit: 100 })
write_file({ path: "file.txt", content: "..." })
edit_file({ path: "file.txt", old_text: "old", new_text: "new" })
grep({ pattern: "pattern", path: ".", recursive: true })
```

**优势：**
1. **语义明确** - 工具名即意图
2. **参数校验** - JSON Schema 约束输入
3. **安全边界** - `safePath()` 限制访问范围
4. **错误友好** - 结构化错误返回

## 🔧 核心变更

### 1. 工具定义 (新增)

```typescript
// V0: 只有一个工具
const TOOLS = [{
  name: "bash",
  description: "执行 shell 命令",
  input_schema: { ... }
}];

// V1: 5个专用工具
const TOOLS = [
  { name: "bash", ... },
  { name: "read_file", description: "读取文件内容", ... },
  { name: "write_file", description: "写入文件内容", ... },
  { name: "edit_file", description: "精确编辑文件", ... },
  { name: "grep", description: "搜索文件内容", ... }
];
```

### 2. 工具路由 (新增)

```typescript
// V0: 直接执行 bash
execSync(cmd, { encoding: "utf-8" });

// V1: 根据工具名路由
switch (toolName) {
  case "bash": output = runBash(args.command); break;
  case "read_file": output = runRead(args.path, args.limit); break;
  case "write_file": output = runWrite(args.path, args.content); break;
  case "edit_file": output = runEdit(args.path, args.old_text, args.new_text); break;
  case "grep": output = runGrep(args.pattern, args.path, args.recursive); break;
}
```

### 3. 安全边界 (新增)

```typescript
// V1 新增: 路径安全检查
function safePath(p: string): string {
  const resolved = path.resolve(WORKDIR, p);
  const relative = path.relative(WORKDIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`路径超出工作区: ${p}`);
  }
  return resolved;
}
```

## 📈 Diff 统计

```diff
 v0-agent.ts → v1-agent.ts
 
 + 新增 ~210 行
   - 4个新工具定义 (~60行)
   - 4个工具实现函数 (~100行)
   - safePath 安全函数 (~10行)
   - 工具路由 switch (~40行)
 
 ~ 修改 ~20 行
   - 系统提示更新
   - 工具调用日志格式
```

## 💡 设计洞察

> **奥卡姆剃刀 vs 专用工具**
> 
> V0 证明了"一个工具足够"，但 V1 证明了"专用工具更好"。
> 这不是矛盾，而是权衡：
> - 极简主义 → 理解本质
> - 专用工具 → 提升效率

## 🧪 验证测试

```bash
# V0 方式 (仍然可用)
npx tsx v1-agent.ts "用 bash 执行 ls -la"

# V1 方式 (推荐)
npx tsx v1-agent.ts "读取 README.md 的前10行"
```
