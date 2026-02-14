# Learn OpenClaw - Roadmap

> 从单文件 Agent 到自进化智能体

---

## 已完成 (V0-V21)

| 版本 | 核心能力 | 状态 |
|------|----------|------|
| V0 | Bash 即一切 | ✅ |
| V1 | 安全文件工具 | ✅ |
| V2 | 本地向量记忆 | ✅ |
| V3 | 任务规划 | ✅ |
| V4 | 子代理协调 | ✅ |
| V5 | Skill 系统 | ✅ |
| V5.5 | Hook 生命周期 | ✅ |
| V6 | 身份与灵魂 | ✅ |
| V7 | 分层记忆 | ✅ |
| V8 | 心跳主动性 | ✅ |
| V9 | 会话管理 | ✅ |
| V10 | 内省系统 | ✅ |
| V11 | Channel 系统 | ✅ |
| V12 | 安全策略系统 | ✅ |
| V13 | 自进化系统 | ✅ |
| V13.5 | 上下文压缩 | ✅ |
| V14 | 插件系统 | ✅ |
| V15 | 多模型协作 | ✅ |
| V16 | 工作流引擎 | ✅ |
| V17 | 外部集成 | ✅ |
| V18 | 团队协作 | ✅ |
| V19 | 持久化与恢复 | ✅ |
| V20 | 浏览器自动化 | ✅ |
| **V21** | **定时任务与提醒系统** | ✅ |

---

## 模块化版本 (v11-agent ~ v21-agent)

| 目录 | 新增模块 | 工具数 | 继承 |
|------|----------|--------|------|
| v11-agent | 基础模块化架构 | 28 | - |
| v12-agent | security/ 安全策略 | 28 | V11 |
| v13-agent | evolution/ 自进化 | 28 | V12 + V11 |
| v14-agent | plugins/ 插件系统 | 28 | V13 + V12 + V11 |
| v15-agent | multimodel/ 多模型 | 28 | V14 + V13 + V12 + V11 |
| v16-agent | workflow/ DAG引擎 | 28 | V15 + ... + V11 |
| v17-agent | external/ Web集成 | 30 | V16 + ... + V11 |
| v18-agent | collaboration/ 团队 | 30 | V17 + ... + V11 |
| v19-agent | persistence/ 持久化 | 32 | V18 + ... + V11 |
| v20-agent | browser/ 浏览器自动化 | 41 | V19 + ... + V11 |
| **v21-agent** | **cron/ 定时任务系统** | **50** | **V20 + ... + V11** |
| **v22-agent** | **sandbox/ 代码沙箱** | **55** | **V21 + ... + V11** |
| **v23-agent** | **vision/ 图像理解** | **123** | **V22 + ... + V11** |
| **v24-agent** | **audio/ 语音能力** | **129** | **V23 + ... + V11** |
| **v25-agent** | **stt/ 语音识别** | **134** | **V24 + ... + V11** |
| **v26-agent** | **canvas/ 显示系统** | **143** | **V25 + ... + V11** |
| **v27-agent** | **embedding/ 向量嵌入** | **153** | **V26 + ... + V11** |
| **v28-agent** | **link/ 链接理解** | **159** | **V27 + ... + V11** |

---

## 已完成 (V28)

### V28: 链接理解系统 ✅

**目标**: 让 Agent 能够自动提取、获取和理解链接内容

**已实现:**
- ✅ `LinkUnderstandingEngine` - 链接理解引擎核心
- ✅ 6 个链接理解工具
  - `link_extract` - 从消息中提取链接
  - `link_fetch` - 获取单个链接内容
  - `link_batch_fetch` - 批量获取链接内容
  - `link_status` - 获取系统状态
  - `link_clear_cache` - 清除缓存
  - `link_validate` - 验证 URL 安全性
- ✅ 智能链接提取 (支持 Markdown 语法)
- ✅ URL 安全验证 (过滤私有 IP 和 localhost)
- ✅ 内容获取 (fetch API)
- ✅ 智能缓存 (1 小时 TTL)
- ✅ 批量处理支持

**代码统计:**
- v28-agent/link/: 8 个模块, ~2000 行
- 工具总数: 159 个

**安全特性:**
- 私有 IP 过滤 (防止 SSRF)
- Localhost 过滤
- 超时控制
- 内容大小限制

**使用场景:**
- 自动链接分析
- 内容摘要生成
- 链接预览
- 安全过滤

详见: [docs/v28-链接理解系统.md](./docs/v28-链接理解系统.md)

---

## 已完成 (V27)

### V27: 向量嵌入增强 ✅

**目标**: 让 Agent 拥有语义理解和搜索能力

**已实现:**
- ✅ `EmbeddingEngine` - 嵌入引擎核心
- ✅ 支持 OpenAI Embeddings API (云端)
- ✅ 支持本地 Jaccard 相似度 (离线 fallback)
- ✅ 10 个 Embedding 工具
  - `embedding_embed` - 文本转向量嵌入
  - `embedding_search` - 语义搜索
  - `embedding_index` - 内容索引
  - `embedding_status` - 系统状态
  - `embedding_clear` - 清除存储
  - `embedding_similarity` - 相似度计算
  - `embedding_batch_embed` - 批量嵌入
  - `embedding_get` - 获取向量条目
  - `embedding_delete` - 删除向量条目
  - `embedding_list_providers` - 列出提供者
- ✅ 智能缓存机制
- ✅ 批处理优化
- ✅ 内存和 SQLite 向量存储
- ✅ 自动文本分块

**代码统计:**
- v27-agent/embedding/: 6 个模块, ~4000 行
- 工具总数: 153 个

**使用场景:**
- 语义搜索
- 相似度计算
- 内容索引和检索
- RAG (检索增强生成)

**依赖:**
- OpenAI API Key (可选): 用于云端 Embeddings
- 无额外依赖 (本地模式完全离线)

详见: [docs/v27-向量嵌入增强.md](./docs/v27-向量嵌入增强.md)

---

## 已完成 (V26)

### V26: Canvas 显示系统 ✅

**目标**: 让 Agent 能够展示交互式 UI

**已实现:**
- ✅ `CanvasEngine` - Canvas 核心引擎
- ✅ 本地 HTTP 服务器 (提供 HTML 页面)
- ✅ Puppeteer 截图和 JavaScript 执行
- ✅ 热重载支持 (WebSocket + chokidar)
- ✅ 9 个 Canvas 工具
  - `canvas_present` - 展示内容 (URL/HTML)
  - `canvas_navigate` - 导航到 URL
  - `canvas_eval` - 执行 JavaScript
  - `canvas_snapshot` - 截取快照
  - `canvas_hide` - 隐藏 Canvas
  - `canvas_status` - 获取状态
  - `canvas_history` - 操作历史
  - `canvas_screenshots` - 截图列表
  - `canvas_clear` - 清除历史
- ✅ 支持 PNG/JPEG 截图格式
- ✅ 支持全页面和元素截图

**代码统计:**
- v26-agent/canvas/: 5 个模块, ~2500 行
- 工具总数: 143 个

**使用场景:**
- 数据可视化展示
- 交互式仪表盘
- AI 生成的 UI 原型
- 报告生成

**依赖:**
- ws: WebSocket 服务器
- chokidar: 文件监听 (热重载)
- puppeteer: 浏览器自动化 (截图/JS执行)

详见: [docs/v26-Canvas显示系统.md](./docs/v26-Canvas显示系统.md)

---

## 已完成 (V25)

### V25: 语音识别 (STT) ✅

**目标**: 让 Agent 能够将语音转换为文字

**已实现:**
- ✅ `STTEngine` - 语音识别引擎
- ✅ `STTManager` - 统一管理器
- ✅ 支持 OpenAI Whisper API (云端)
- ✅ 支持本地 Whisper CLI (离线)
- ✅ 5 个 STT 工具
  - `stt_transcribe` - 语音转文字
  - `stt_list_models` - 获取可用模型
  - `stt_history` - 转录历史
  - `stt_supported_formats` - 支持的格式
  - `stt_clear_history` - 清除历史
- ✅ 支持多种音频格式 (mp3/wav/m4a/webm/ogg/flac/aac)
- ✅ 支持时间戳输出
- ✅ 历史记录追踪

**代码统计:**
- v25-agent/stt/: 5 个模块, ~1200 行
- v25-agent/speech/: 4 个模块, ~600 行
- 工具总数: 134 个

**使用场景:**
- 会议记录转录
- 视频字幕生成
- 语音笔记转换
- 电话录音转录
- 播客内容转录

**依赖:**
- OpenAI API Key (可选): 用于云端 Whisper
- openai-whisper: `pip install openai-whisper` (本地)

详见: [docs/v25-语音识别.md](./docs/v25-语音识别.md)

---

## 已完成 (V24)

### V24: 语音能力 (TTS) ✅

**目标**: 让 Agent 能够将文字转换为语音

**已实现:**
- ✅ `TTSEngine` - 文字转语音引擎
- ✅ `AudioPlayer` - 音频播放器
- ✅ 支持 Edge TTS (免费, 多语言)
- ✅ 支持 macOS 本地 TTS
- ✅ 6 个语音工具
  - `tts_synthesize` - 文字转语音
  - `tts_list_voices` - 获取可用语音
  - `tts_history` - TTS 历史记录
  - `tts_delete` - 删除音频文件
  - `audio_play` - 播放音频
  - `audio_volume` - 音量控制
- ✅ 多语言语音支持 (中/英/日)
- ✅ 音频缓存机制
- ✅ 历史记录持久化

**代码统计:**
- v24-agent/audio/: 5 个模块, ~2500 行
- 工具总数: 129 个

**使用场景:**
- 朗读长文本
- 语音提醒
- 辅助阅读
- 多语言发音

**依赖:**
- edge-tts: `pip install edge-tts`
- ffprobe (可选): 用于获取音频时长

详见: [docs/v24-语音能力.md](./docs/v24-语音能力.md)

---

## 已完成 (V21)

### V21: 定时任务与提醒系统 ✅

**目标**: 让 Agent 能够自主安排任务和提醒

**已实现:**
- ✅ `CronManager` - 定时任务管理器
- ✅ 三种调度方式: at(一次性)/every(周期性)/cron(表达式)
- ✅ 两种载荷类型: systemEvent/agentTurn
- ✅ 6 个 Cron 任务工具
- ✅ 3 个提醒管理工具
- ✅ 任务执行历史追踪
- ✅ 磁盘持久化存储

**代码统计:**
- v21-agent/cron/: 5 个模块, ~2800 行
- 工具总数: 50 个

**使用场景:**
- 定时健康检查
- 定期数据备份
- 一次性提醒
- 周期性报告生成

详见: [docs/v21-定时任务系统.md](./docs/v21-定时任务系统.md)

---

## 已完成 (V20)

### V20: 浏览器自动化 ✅

**目标**: 让 Agent 能够控制真实浏览器

**已实现:**
- ✅ `BrowserController` - 浏览器生命周期管理
- ✅ 9 个浏览器自动化工具
- ✅ 基于 CDP (Chrome DevTools Protocol)
- ✅ 支持 Chrome/Chromium/Edge
- ✅ 无头和有头模式

详见: [docs/v20-浏览器自动化.md](./docs/v20-浏览器自动化.md)

---

## 已完成 (V22)

### V22: 代码执行沙箱 ✅

**目标**: 安全地执行用户代码

**已实现:**
- ✅ `SandboxRunner` - 代码执行运行器
- ✅ 支持 4 种语言: Python, JavaScript, TypeScript, Bash
- ✅ 代码安全扫描 (危险导入、eval、系统调用)
- ✅ 资源限制 (执行时间、内存、输出大小)
- ✅ 5 个沙箱管理工具
- ✅ 依赖安装支持 (pip/npm)
- ✅ 执行历史追踪

**代码统计:**
- v22-agent/sandbox/: 6 个模块, ~2800 行
- 工具总数: 55 个

**安全特性:**
- 自动代码扫描 (扫描 Python/JS/TS/Bash)
- 危险导入检测 (os, subprocess, child_process 等)
- eval/exec 拦截
- 文件系统访问控制
- 网络访问控制
- 资源限制强制执行

---

## 已完成 (V23)

### V23: 图像理解 ✅

**目标**: 让 Agent 能够理解和分析图像

**已实现:**
- ✅ `VisionAnalyzer` - 图像分析器
- ✅ 支持多种图像源: 本地路径、URL、base64
- ✅ 多模态分析 (图像 + 文本提示)
- ✅ OCR 文字识别
- ✅ 图像对比
- ✅ 5 个 Vision 工具
- ✅ 分析历史追踪

**代码统计:**
- v23-agent/vision/: 5 个模块, ~2400 行
- 工具总数: 123 个

**支持格式:**
- JPEG/JPG
- PNG
- GIF
- WebP

**使用场景:**
- 分析截图内容
- 提取图像文字
- 对比 UI 变化
- 理解视觉输入

---

## 计划中 (V29+)

### V29: 向量数据库集成 (计划中)

- 支持 Pinecone
- 支持 Weaviate
- 支持 Chroma
- 支持 Milvus
- 统一的 VectorDB 接口

### V30: 实时语音识别 (计划中)

- 流式语音输入
- 实时转录
- 语音活动检测 (VAD)
- 多说话人识别

---

## 测试覆盖

| 测试文件 | 测试数 | 覆盖版本 |
|----------|--------|---------|
| v7-layered-memory.test.ts | 15 | V7 |
| v8-heartbeat.test.ts | 15 | V8 |
| v9-session.test.ts | 20 | V9 |
| v10-introspection.test.ts | 16 | V10 |
| v11-channel.test.ts | 8 | V11 |
| v12-security.test.ts | 16 | V12 |
| v13-evolution.test.ts | 13 | V13 |
| v13.5-compression.test.ts | 14 | V13.5 |
| v14-plugin.test.ts | 14 | V14 |
| v15-multimodel.test.ts | 119 | V15 |
| v16-workflow.test.ts | 13 | V16 |
| v17-external.test.ts | 11 | V17 |
| v18-collaboration.test.ts | 13 | V18 |
| v19-persistence.test.ts | 14 | V19 |
| v20-browser.test.ts | 7 | V20 |
| **v21-cron.test.ts** | **17** | **V21** |
| **v22-sandbox.test.ts** | **18** | **V22** |
| **v23-vision.test.ts** | **19** | **V23** |
| **v24-audio.test.ts** | **9** | **V24** |
| **v25-stt.test.ts** | **25** | **V25** |
| **v26-canvas.test.ts** | **20** | **V26** |
| **v27-embedding.test.ts** | **25** | **V27** |
| **v28-link.test.ts** | **20** | **V28** |
| **benchmark-evolution.test.ts** | **111** | **V11-V20 跨版本** |
| **合计** | **592** | |

---

## 技术债务

- [x] 完善测试覆盖 (V7-V20 全版本测试已添加)
- [x] 性能优化 - 上下文压缩 (V13.5)
- [x] V16 工作流测试 (2026-02-11)
- [x] V15 多模型测试 (2026-02-12, 119 个测试)
- [x] V18 协作测试修复 (2026-02-12, cleanup bug fix)
- [x] Claw→Skill 术语统一 (2026-02-12, V11-V18)
- [x] SkillLoader skillDir→skillsDir 属性名修复 (2026-02-12)
- [x] 跨版本 Benchmark 测试套件 (2026-02-12, 111 个测试)
- [x] V19 持久化系统 (2026-02-12)
- [x] 迭代优化: 5 项关键修复 (2026-02-12)
- [x] V20 浏览器自动化 (2026-02-12)
- [x] **V21 定时任务系统 (2026-02-12)** ⭐
- [x] **V22 代码执行沙箱 (2026-02-12)** ⭐
- [x] V21 定时任务测试 (2026-02-12)
- [x] V22 沙箱测试 (2026-02-12)
- [x] **V23 图像理解 (2026-02-12)** ⭐
- [x] V23 图像理解测试 (2026-02-12)
- [x] **V24 语音能力/TTS (2026-02-12)** ⭐
- [x] V24 语音能力测试 (2026-02-12)
- [x] V25 语音识别 (STT)
- [x] V26 Canvas 显示系统 (2026-02-13) ⭐
- [x] V26 Canvas 测试 (2026-02-13)
- [x] **V27 向量嵌入增强 (2026-02-14)** ⭐
- [x] V27 向量嵌入测试 (2026-02-14)
- [x] **V28 链接理解系统 (2026-02-14)** ⭐
- [x] V28 链接理解测试 (2026-02-14)
- [ ] 统一错误处理
- [ ] 文档国际化

---

## 版本历史

| 日期 | 版本 | 主要更新 |
|------|------|----------|
| 2026-02-14 | V28 | 链接理解系统 (Link/Fetch) |
| 2026-02-14 | V27 | 向量嵌入增强 (Embedding/语义搜索) |
| 2026-02-13 | V26 | Canvas 显示系统 (UI展示/截图) |
| 2026-02-13 | V25 | 语音识别 (STT/语音转文字) |
| 2026-02-12 | V24 | 语音能力/TTS (文字转语音) |
| 2026-02-12 | V23 | 图像理解 (Vision/OCR) |
| 2026-02-12 | V22 | 代码执行沙箱 (Python/JS/TS/Bash) |
| 2026-02-12 | V21 | 定时任务与提醒系统 |
| 2026-02-12 | V20 | 浏览器自动化 |
| 2026-02-12 | V19 | 持久化与恢复系统 |
| 2026-02-11 | V18 | 团队协作系统 |
| 2026-02-10 | V17 | 外部集成 (web_search/web_fetch) |
| 2026-02-10 | V16 | 工作流引擎 |

---

*Last updated: 2026-02-14 - V28 完成*
