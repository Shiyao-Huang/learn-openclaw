# V26: Canvas 显示系统

> 让 Agent 能够展示交互式 UI

---

## 概述

V26 在 V25 的基础上增加了 Canvas 显示系统，让 Agent 能够：

- 展示 HTML 页面
- 导航到 URL
- 执行 JavaScript 代码
- 截取页面快照
- 提供实时热重载

这是实现 **AI to UI (A2UI)** 的基础能力。

---

## 核心组件

### CanvasEngine

Canvas 的核心引擎，提供以下功能：

```typescript
import { CanvasEngine, createDefaultConfig } from "./v26-agent/canvas/index.js";

const engine = new CanvasEngine({
  port: 3777,
  host: "127.0.0.1",
  rootDir: "./canvas",
  liveReload: true,
});

await engine.start();
```

### 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| port | number | 3777 | HTTP 服务器端口 |
| host | string | "127.0.0.1" | 监听地址 |
| rootDir | string | "./canvas" | 静态文件根目录 |
| liveReload | boolean | true | 启用热重载 |
| screenshotDir | string | "./screenshots" | 截图输出目录 |
| viewportWidth | number | 1280 | 视口宽度 |
| viewportHeight | number | 720 | 视口高度 |

---

## 工具列表

V26 新增 **9 个 Canvas 工具**：

### 1. canvas_present

展示 Canvas 内容 (URL 或 HTML)

```typescript
// 展示 HTML
await engine.present({
  content: "<html><body><h1>Hello</h1></body></html>",
  contentType: "html",
});

// 打开 URL
await engine.present({
  content: "https://example.com",
  contentType: "url",
});
```

### 2. canvas_navigate

导航到指定 URL

```typescript
await engine.navigate({
  url: "https://example.com",
  waitMs: 1000, // 等待 1 秒
});
```

### 3. canvas_eval

在 Canvas 中执行 JavaScript

```typescript
// 获取页面标题
const result = await engine.eval({
  code: "document.title",
});

// 操作 DOM
await engine.eval({
  code: "document.querySelector('#btn').click()",
});
```

### 4. canvas_snapshot

截取 Canvas 快照

```typescript
// 全页面截图
await engine.snapshot({
  fullPage: true,
  format: "png",
});

// 元素截图
await engine.snapshot({
  selector: "#chart",
  format: "jpeg",
  quality: 80,
});
```

### 5. canvas_hide

隐藏 Canvas

```typescript
// 只隐藏，不关闭服务器
await engine.hide();

// 隐藏并关闭服务器
await engine.hide({ shutdown: true });
```

### 6. canvas_status

获取 Canvas 状态

```typescript
const status = await engine.status();
// {
//   running: true,
//   currentUrl: "https://...",
//   title: "Page Title",
//   port: 3777,
//   connections: 2,
//   screenshotCount: 5
// }
```

### 7. canvas_history

获取操作历史

```typescript
const history = engine.getHistory(100);
// [{ id, action, timestamp, success, details }, ...]
```

### 8. canvas_screenshots

获取截图列表

```typescript
const screenshots = engine.getScreenshots();
// [{ id, path, width, height, format, size }, ...]
```

### 9. canvas_clear

清除历史记录

```typescript
engine.clearHistory();
```

---

## 实现细节

### 轻量级架构

V26 采用轻量级架构设计：

```
┌─────────────────────────────────────────────────┐
│                   CanvasEngine                   │
├─────────────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────────────────┐   │
│ │ HTTP Server │  │   WebSocket (Reload)    │   │
│ │   (port)    │  │   /__canvas__/ws        │   │
│ └─────────────┘  └─────────────────────────┘   │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │              Puppeteer Browser              │ │
│ │  - Page Navigation                          │ │
│ │  - JavaScript Execution                     │ │
│ │  - Screenshot                               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │              File Watcher (chokidar)        │ │
│ │  - Live Reload                              │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 热重载机制

当 `liveReload: true` 时：

1. HTTP 服务器自动在 HTML 中注入 WebSocket 脚本
2. 文件监听器 (chokidar) 监控 `rootDir` 变化
3. 变化时通过 WebSocket 广播 `reload` 消息
4. 客户端收到消息后刷新页面

### 截图实现

使用 Puppeteer 进行截图：

- 支持 PNG 和 JPEG 格式
- 支持全页面或特定元素
- 支持自定义视口大小
- 自动保存到 `screenshotDir`

---

## 依赖

V26 Canvas 系统依赖以下包：

```json
{
  "dependencies": {
    "ws": "^8.0.0",
    "chokidar": "^3.5.0",
    "puppeteer": "^21.0.0"
  }
}
```

安装依赖：

```bash
npm install ws chokidar puppeteer
```

---

## 使用场景

### 1. 数据可视化展示

```typescript
// 生成图表 HTML
const chartHtml = generateChart(data);

// 展示图表
await engine.present({
  content: chartHtml,
  contentType: "html",
});

// 截图保存
await engine.snapshot({
  format: "png",
  outputPath: "./reports/chart.png",
});
```

### 2. 交互式仪表盘

```typescript
// 展示仪表盘
await engine.present({
  content: dashboardHtml,
  contentType: "html",
});

// 定期更新数据
setInterval(async () => {
  await engine.eval({
    code: `updateDashboard(${JSON.stringify(newData)})`,
  });
}, 5000);
```

### 3. UI 原型预览

```typescript
// 展示原型
await engine.present({
  content: prototypeHtml,
  contentType: "html",
});

// 获取用户输入
const result = await engine.eval({
  code: "document.querySelector('#feedback').value",
});
```

### 4. 报告生成

```typescript
// 展示报告
await engine.present({
  content: reportHtml,
  contentType: "html",
});

// 全页面截图
await engine.snapshot({
  fullPage: true,
  format: "pdf", // 或使用 png
});
```

---

## 与 OpenClaw Canvas 的区别

| 特性 | learn-openclaw V26 | OpenClaw Canvas |
|------|-------------------|-----------------|
| 架构 | 独立 HTTP 服务器 | Gateway 集成 |
| A2UI | 不支持 | 完整支持 |
| 节点管理 | 无 | 有 |
| 适用场景 | 单机使用 | 分布式/生产 |

V26 是简化版本，适合学习和独立使用。完整功能请使用 OpenClaw。

---

## 代码统计

- **v26-agent/canvas/**: 5 个模块, ~2500 行
- **新增工具**: 9 个
- **总工具数**: 143 个

---

## 测试覆盖

```bash
npm test -- --run tests/v26-canvas.test.ts
```

测试覆盖：
- 配置和默认值
- 工具定义验证
- 引擎生命周期
- HTML 展示
- 导航和执行
- 截图功能
- 错误处理

---

*Last updated: 2026-02-13*
