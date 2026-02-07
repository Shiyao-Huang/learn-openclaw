# V6 → V7: 从身份到时间感知

## 📊 版本对比

| 维度 | V6 | V7 |
|------|----|----|
| 代码行数 | ~930 | ~1176 |
| 工具数量 | 17 | 24 (+7 daily_*/longterm_*) |
| 核心理念 | 身份即人格 | 时间即维度 |
| 记忆方式 | ❌ 扁平存储 | ✅ 分层组织 |

## 🎯 Motivation: 为什么需要 V7？

### V6 的局限性

```
场景: 用户问 "上周三我们讨论了什么？"

V6 的做法:
1. 搜索 MEMORY.md
2. 找到相关内容
3. 但不知道是哪天的
```

**问题：**
1. **无时间感** - 不知道什么时候发生了什么
2. **混杂存储** - 日常琐事和重要知识混在一起
3. **难以回顾** - 无法按时间线回顾历史
4. **上下文缺失** - 不知道"今天是几号"

### V7 的解决方案

```
project/
├── memory/
│   ├── 2024-01-15.md    # 今天的日记
│   ├── 2024-01-14.md    # 昨天的日记
│   └── ...
├── MEMORY.md            # 长期记忆（精炼的重要信息）
└── ...
```

**优势：**
1. **时间维度** - 记忆带有时间标记
2. **分层存储** - 日常琐事和重要知识分开
3. **自动归档** - 日记按日期自动组织
4. **上下文注入** - Agent 知道"今天是几号"

## 🔧 核心变更

### 1. LayeredMemory 类 (新增 ~180行)

```typescript
class LayeredMemory {
  private workspaceDir: string;
  private memoryDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.memoryDir = path.join(workspaceDir, "memory");
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  // 获取今天的日期字符串
  private getToday(): string {
    return new Date().toISOString().split("T")[0];
  }

  // 写入今日日记
  writeDailyNote(content: string): string {
    const today = this.getToday();
    const filePath = path.join(this.memoryDir, `${today}.md`);
    const timestamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });

    let existing = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf-8")
      : `# ${today} 日记\n`;

    fs.writeFileSync(filePath, existing + `\n## ${timestamp}\n\n${content}\n`, "utf-8");
    return `已记录到 ${today} 日记`;
  }

  // 读取指定日期的日记
  readDailyNote(date?: string): string {
    const filePath = path.join(this.memoryDir, `${date || this.getToday()}.md`);
    if (!fs.existsSync(filePath)) {
      return date ? `${date} 没有日记` : "今天还没有日记";
    }
    return fs.readFileSync(filePath, "utf-8");
  }

  // 读取最近 N 天的日记
  readRecentNotes(days: number = 3): string {
    const notes: string[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const filePath = path.join(this.memoryDir, `${dateStr}.md`);

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        notes.push(`--- ${dateStr} ---\n${content.slice(0, 1500)}`);
      }
    }

    return notes.length > 0 ? notes.join("\n\n") : "最近没有日记";
  }

  // 追加到长期记忆的某个分类
  appendLongTermMemory(section: string, content: string): string {
    const memoryPath = path.join(this.workspaceDir, "MEMORY.md");
    let existing = fs.existsSync(memoryPath)
      ? fs.readFileSync(memoryPath, "utf-8")
      : "# MEMORY.md - 长期记忆\n";

    const sectionHeader = `## ${section}`;
    if (existing.includes(sectionHeader)) {
      // 在 section 末尾追加
      const lines = existing.split("\n");
      const sectionIndex = lines.findIndex(l => l.startsWith(sectionHeader));
      let insertIndex = sectionIndex + 1;
      while (insertIndex < lines.length && !lines[insertIndex].startsWith("## ")) {
        insertIndex++;
      }
      lines.splice(insertIndex, 0, `- ${content}`);
      existing = lines.join("\n");
    } else {
      existing += `\n\n${sectionHeader}\n\n- ${content}`;
    }

    fs.writeFileSync(memoryPath, existing, "utf-8");
    return `已添加到长期记忆 [${section}]`;
  }

  // 获取时间上下文
  getTimeContext(): string {
    const now = new Date();
    const today = this.getToday();
    const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    const hour = now.getHours();

    let timeOfDay = "凌晨";
    if (hour >= 6 && hour < 12) timeOfDay = "上午";
    else if (hour >= 12 && hour < 14) timeOfDay = "中午";
    else if (hour >= 14 && hour < 18) timeOfDay = "下午";
    else if (hour >= 18 && hour < 22) timeOfDay = "晚上";
    else if (hour >= 22) timeOfDay = "深夜";

    return `今��是 ${today} 星期${dayOfWeek}，现在是${timeOfDay} ${hour}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
}
```

### 2. 分层记忆工具 (新增 7 个)

```typescript
// 日记工具
{ name: "daily_write", description: "写入今日日记" }
{ name: "daily_read", description: "读取某天的日记" }
{ name: "daily_recent", description: "读取最近几天的日记" }
{ name: "daily_list", description: "列出所有日记文件" }

// 长期记忆工具
{ name: "longterm_read", description: "读取长期记忆 (MEMORY.md)" }
{ name: "longterm_update", description: "完整更新长期记忆" }
{ name: "longterm_append", description: "追加到长期记忆的某个分类" }

// 搜索和时间
{ name: "memory_search_all", description: "搜索所有记忆" }
{ name: "time_context", description: "获取当前时间上下文" }
```

### 3. 系统提示更新

```typescript
const BASE_SYSTEM = `你是 OpenClaw V7 - 有时间感知的 Agent。

时间感知:
${layeredMemory.getTimeContext()}

分层记忆规则:
- 日记 (daily_*): 每日原始记录，工作记忆
- 长期记忆 (longterm_*): 精炼的重要信息
- memory_search_all: 搜索所有记忆

记忆策略:
- 日常事项 → daily_write (今日日记)
- 重要知识 → longterm_append (长期记忆)
- 回顾历史 → daily_read / daily_recent
- 搜索信息 → memory_search_all`;
```

## 📈 Diff 统计

```diff
 v6-agent.ts → v7-agent.ts

 + 新增 ~246 行
   - LayeredMemory 类 (~180行)
   - daily_* 工具定义 (~30行)
   - longterm_* 工具定义 (~20行)
   - 工具路由 case (~16行)

 ~ 修改 ~15 行
   - 系统提示注入时间上下文
   - 主入口显示时间信息
```

## 💡 设计洞察

> **日记 vs 长期记忆**
>
> | 维度 | 日记 (daily_*) | 长期记忆 (longterm_*) |
> |------|---------------|---------------------|
> | 存储位置 | memory/YYYY-MM-DD.md | MEMORY.md |
> | 内容类型 | 原始记录 | 精炼知识 |
> | 生命周期 | 按天归档 | 永久保存 |
> | 写入方式 | 追加 | 分类追加 |

> **时间上下文的作用**
>
> ```typescript
> getTimeContext(): string {
>   return `今天是 2024-01-15 星期一，现在是下午 14:30`;
> }
> ```
>
> - 让 Agent 知道"今天是几号"
> - 可以理解"上周三"、"明天"等相对时间
> - 可以判断是否是工作时间

> **分类追加的设计**
>
> ```markdown
> # MEMORY.md - 长期记忆
>
> ## 用户偏好
> - 喜欢简洁的回复
> - 偏好中文交流
>
> ## 项目知识
> - 使用 PostgreSQL 数据库
> - 部署在 AWS
> ```
>
> 通过分类组织，便于检索和管理。

## 🧪 验证测试

```bash
# 写入日记
npx tsx v7-agent.ts "记录一下：今天完成了 API 重构"

# 查看今日日记
npx tsx v7-agent.ts "今天的日记有什么？"

# 查看最近日记
npx tsx v7-agent.ts "最近三天我做了什么？"

# 添加长期记忆
npx tsx v7-agent.ts "记住：项目使用 PostgreSQL 数据库"

# 搜索记忆
npx tsx v7-agent.ts "搜索关于数据库的记忆"
```

## 🌟 记忆演进

V7 的分层记忆为后续版本奠定基础：

```
V7: 分层记忆
├── memory/YYYY-MM-DD.md (日记)
└── MEMORY.md (长期记忆)

V8: 心跳系统 (基于记忆的主动检查)
V9: 会话管理 (基于记忆的会话隔离)
```
