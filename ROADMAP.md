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
| **v29-agent** | **security/ 安全审计** | **167** | **V28 + ... + V11** |
| **v30-agent** | **hybrid/ 混合搜索** | **177** | **V29 + ... + V11** |
| **v31-agent** | **poll/ 投票系统** | **187** | **V30 + ... + V11** |
| **v32-agent** | **ratelimit/ 速率限制** | **202** | **V31 + ... + V11** |
| **v33-agent** | **scanner/ 安全扫描** | **208** | **V32 + ... + V11** |
| **v34-agent** | **dedupe/ 去重缓存** | **219** | **V33 + ... + V11** |

---

## 已完成 (V34)

### V34: 去重缓存系统 ✅

**目标**: 让 Agent 能够防止重复消息和操作

**已实现:**
- ✅ `DedupeCache` - 去重缓存核心
- ✅ `DedupeCacheManager` - 多缓存管理器
- ✅ 11 个去重缓存工具
  - `dedupe_check` - 检查键是否重复
  - `dedupe_batch` - 批量检查多个键
  - `dedupe_create` - 创建新的去重缓存
  - `dedupe_get` - 获取键的详情
  - `dedupe_delete` - 从缓存中删除键
  - `dedupe_clear` - 清空缓存
  - `dedupe_list` - 列出所有缓存或缓存中的键
  - `dedupe_stats` - 获取缓存统计信息
  - `dedupe_status` - 获取去重系统状态
  - `dedupe_presets` - 获取预设配置列表
  - `dedupe_config` - 获取或更新缓存配置
- ✅ TTL 自动过期
- ✅ 最大容量限制 (LRU 淘汰)
- ✅ 多缓存实例支持
- ✅ 批量检查优化
- ✅ 命中率统计

**代码统计:**
- v34-agent/dedupe/: 4 个模块, ~2000 行
- 工具总数: 219 个 (V33 的 208 + V34 的 11)

**预设配置:**
- `short` - 1 分钟 TTL, 1000 条
- `medium` - 5 分钟 TTL, 5000 条
- `long` - 1 小时 TTL, 10000 条
- `permanent` - 永不过期, 100000 条
- `message` - 10 分钟 TTL, 2000 条 (消息去重)
- `action` - 5 分钟 TTL, 1000 条 (操作去重)

**灵感来源:** OpenClaw infra/dedupe.ts

**使用场景:**
- 消息去重
- 操作防抖
- 事件过滤
- 请求去重

---

## 已完成 (V33)

### V33: Skill 安全扫描系统 ✅

**目标**: 让 Agent 能够扫描代码和 Skill 的安全问题

**已实现:**
- ✅ `SkillScanner` - 安全扫描引擎核心
- ✅ 6 个安全扫描工具
  - `scanner_scan_dir` - 扫描目录中的代码安全问题
  - `scanner_scan_file` - 扫描单个文件的安全问题
  - `scanner_scan_source` - 扫描源码字符串的安全问题
  - `scanner_rules` - 获取扫描规则列表
  - `scanner_config` - 获取扫描器配置
  - `scanner_report` - 生成安全扫描报告
- ✅ 行级规则检测 (危险命令执行、动态代码执行、挖矿检测等)
- ✅ 源码级规则检测 (数据泄露、代码混淆、凭证窃取等)
- ✅ 多种严重级别 (Critical / Warn / Info)
- ✅ 多格式报告 (text / json / markdown)

**代码统计:**
- v33-agent/scanner/: 4 个模块, ~1500 行
- 工具总数: 208 个 (V32 的 202 + V33 的 6)

**检测规则:**
- 危险命令执行 (exec/spawn/child_process)
- 动态代码执行 (eval/Function)
- 加密货币挖矿检测
- 可疑网络连接
- 危险模块导入
- 文件系统访问
- 网络访问
- 数据泄露风险
- 代码混淆检测
- 环境变量窃取

**灵感来源:** OpenClaw skill-scanner.ts

**使用场景:**
- Skill 安全审计
- 代码安全扫描
- 恶意代码检测
- 部署前安全检查

---

## 已完成 (V32)

### V32: 速率限制与重试策略 ✅

**目标**: 让 Agent 能够控制 API 调用频率，实现智能重试

**已实现:**
- ✅ `RateLimitEngine` - 速率限制引擎核心
- ✅ 15 个速率限制工具
  - `ratelimit_create` - 创建速率限制器
  - `ratelimit_delete` - 删除限制器
  - `ratelimit_reset` - 重置限制器状态
  - `ratelimit_list` - 列出所有限制器
  - `ratelimit_get` - 获取限制器详情
  - `ratelimit_check` - 检查是否允许请求
  - `ratelimit_consume` - 消耗请求配额
  - `ratelimit_wait` - 等待可用配额
  - `ratelimit_stats` - 获取统计信息
  - `ratelimit_status` - 获取引擎状态
  - `ratelimit_presets` - 获取预设配置
  - `ratelimit_config` - 获取/更新配置
  - `ratelimit_retry` - 使用重试策略执行操作
  - `ratelimit_delay` - 计算重试延迟
- ✅ 多种限流策略 (Token Bucket / Sliding Window / Fixed Window)
- ✅ 多种重试策略 (Fixed / Exponential / Linear / Decorrelated Jitter)
- ✅ 预设配置 (low/medium/high/api/strict)

**代码统计:**
- v32-agent/ratelimit/: 5 个模块, ~3000 行
- 工具总数: 202 个 (V31 的 187 + V32 的 15)

**灵感来源:** OpenClaw ratelimit 相关实现

**使用场景:**
- API 调用限流
- 自动重试
- 流量控制
- 配额管理

---

## 已完成 (V31)

### V31: 投票系统 ✅

**目标**: 让 Agent 能够创建和管理投票，支持群组决策

**已实现:**
- ✅ `PollEngine` - 投票引擎核心
- ✅ 10 个投票工具
  - `poll_create` - 创建投票
  - `poll_vote` - 投票
  - `poll_get` - 获取投票详情
  - `poll_result` - 获取投票结果
  - `poll_close` - 关闭投票
  - `poll_cancel` - 取消投票
  - `poll_list` - 列出投票
  - `poll_stats` - 获取统计
  - `poll_delete` - 删除投票
  - `poll_check_expired` - 检查过期投票
- ✅ 单选/多选投票
- ✅ 限时投票
- ✅ 匿名投票
- ✅ 投票修改
- ✅ 结果统计
- ✅ 自动过期检测

**代码统计:**
- v31-agent/poll/: 5 个模块, ~2000 行
- 工具总数: 187 个 (V30 的 177 + V31 的 10)

**灵感来源:** OpenClaw polls.ts

**使用场景:**
- 群组决策
- 意见收集
- 投票统计
- 民意调查

---

## 已完成 (V30)

### V30: 混合搜索系统 ✅

**目标**: 结合向量搜索和关键词搜索，实现更精准的检索

**已实现:**
- ✅ `HybridSearchEngine` - 混合搜索引擎核心
- ✅ `FTSEngine` - 全文搜索引擎 (SQLite FTS5)
- ✅ 10 个混合搜索工具
  - `hybrid_search` - 混合搜索 (向量 + 关键词)
  - `hybrid_vector_search` - 仅向量搜索
  - `hybrid_keyword_search` - 仅关键词搜索
  - `hybrid_index` - 索引文档
  - `hybrid_index_batch` - 批量索引
  - `hybrid_delete` - 删除文档
  - `hybrid_status` - 获取引擎状态
  - `hybrid_stats` - 搜索统计
  - `hybrid_history` - 搜索历史
  - `hybrid_clear` - 清空索引
- ✅ 智能权重调整 (基于查询特征)
- ✅ 结果合并 (向量和关键词)
- ✅ 多样性重排序
- ✅ V27 Embedding 集成

**代码统计:**
- v30-agent/hybrid/: 5 个模块, ~4500 行
- 工具总数: 177 个 (V29 的 167 + V30 的 10)

**特性:**
- 向量搜索 (V27 Embedding 集成)
- 关键词搜索 (SQLite FTS5)
- 智能权重调整 (技术术语 vs 自然语言)
- 结果多样性优化
- 批量索引支持
- 搜索历史追踪

**灵感来源:** OpenClaw memory/hybrid.ts

**使用场景:**
- 代码搜索
- 文档检索
- 知识库查询
- 语义搜索 + 精确匹配

详见: [docs/v30-混合搜索.md](./docs/v30-混合搜索.md)

---

## 已完成 (V29)

### V29: 安全审计系统 ✅

**目标**: 让 Agent 能够自动检测和修复安全问题

**已实现:**
- ✅ `SecurityEngine` - 安全审计引擎核心
- ✅ 8 个安全审计工具
  - `security_audit` - 执行完整安全审计
  - `security_check_permissions` - 检查文件权限
  - `security_check_config` - 检查配置安全
  - `security_check_secrets` - 扫描密钥泄露
  - `security_status` - 获取系统状态
  - `security_fix` - 自动修复安全问题
  - `security_report` - 生成安全报告
  - `security_history` - 获取审计历史
- ✅ 严重级别: critical / warn / info
- ✅ 自动修复建议
- ✅ 多格式报告 (text/json/markdown)

**代码统计:**
- v29-agent/security/: 3 个模块, ~2000 行
- 工具总数: 167 个 (V28 的 159 + V29 的 8)

**安全检查:**
- 文件权限检查 (world-writable 检测)
- .env 文件权限检查
- 敏感文件权限检查 (credentials.json, private.key 等)
- .gitignore 完整性检查
- Git 追踪检查 (.env 是否被提交)
- 密钥泄露扫描 (API Keys, Tokens, Passwords 等)

**灵感来源:** OpenClaw security/ 模块

**使用场景:**
- 部署前安全检查
- 定期安全扫描
- 权限审计
- 密钥泄露检测

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

## 计划中 (V34+)

### V34: 向量数据库集成 (计划中)

- 支持 Pinecone
- 支持 Weaviate
- 支持 Chroma
- 支持 Milvus
- 统一的 VectorDB 接口

### V35: 实时语音识别 (计划中)

- 流式语音输入
- 实时转录
- 语音活动检测 (VAD)
- 多说话人识别

### 备选方向

- **SQLite 向量存储** - 简化向量存储，无外部依赖 (参考 OpenClaw sqlite-vec.ts)
- **批量嵌入处理** - 参考 OpenClaw batch-gemini.ts / batch-openai.ts
- **增强记忆管理** - 参考 OpenClaw qmd-manager.ts
- **Skill 安全扫描** - 参考 OpenClaw skill-scanner.ts
- **Gmail/邮件集成** - 需要 OAuth 配置，复杂度较高

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
| **v29-security.test.ts** | **32** | **V29** |
| **v30-hybrid.test.ts** | **21** | **V30** |
| **v31-poll.test.ts** | **34** | **V31** |
| **benchmark-evolution.test.ts** | **111** | **V11-V20 跨版本** |
| **合计** | **679** | |

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
- [x] **V29 安全审计系统 (2026-02-15)** ⭐
- [x] V29 安全审计测试 (2026-02-15, 32 个测试)
- [x] **V30 混合搜索系统 (2026-02-16)** ⭐
- [x] V30 混合搜索测试 (2026-02-16, 21 个测试)
- [x] **V31 投票系统 (2026-02-16)** ⭐
- [x] V31 投票系统测试 (2026-02-16, 34 个测试)
- [x] **V32 速率限制与重试策略 (2026-02-16)** ⭐
- [ ] V32 速率限制测试 (待添加)
- [ ] 统一错误处理
- [ ] 文档国际化

---

## 版本历史

| 日期 | 版本 | 主要更新 |
|------|------|----------|
| 2026-02-17 | V34 | 去重缓存系统 (Dedupe/去重) |
| 2026-02-17 | V33 | Skill 安全扫描系统 (Scanner) |
| 2026-02-16 | V32 | 速率限制与重试策略 (Rate Limit/Retry) |
| 2026-02-16 | V31 | 投票系统 (Poll/Voting) |
| 2026-02-16 | V30 | 混合搜索系统 (Vector + FTS) |
| 2026-02-15 | V29 | 安全审计系统 (Security/Audit) |
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

*Last updated: 2026-02-17 - V34 去重缓存系统完成*
