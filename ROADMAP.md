# Learn OpenClaw - Roadmap

> 从单文件 Agent 到自进化智能体

---

## 已完成 (V0-V15)

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
| V16 | 工作流引擎 | ✅ |

---

## 模块化版本 (v11-agent ~ v16-agent)

每个版本都是独立可运行的模块化实现，渐进式继承：

| 目录 | 新增模块 | 继承 |
|------|----------|------|
| v11-agent | 基础模块化架构 | - |
| v12-agent | security/ 安全策略 | V11 |
| v13-agent | evolution/ 自进化 | V12 + V11 |
| v14-agent | plugin/ 插件系统 | V13 + V12 + V11 |
| v15-agent | multimodel/ 多模型 | V14 + V13 + V12 + V11 |
| v16-agent | workflow/ DAG引擎 | V15 + V14 + V13 + V12 + V11 |

---

## 已完成 (V16)

### V16: 工作流引擎 ✅

**目标**: 复杂任务的自动化编排

- ✅ DAG 任务图 (workflow/dag.ts)
- ✅ Mermaid → DAG 解析 (MermaidParser)
- ✅ 并行执行识别 (ExecutionPlanner)
- ✅ 条件分支支持 (yes/no 边)
- ✅ 错误恢复 (重���机制)
- ✅ 6 个工作流工具

---

## 计划中 (V17+)

### V17: 外部集成

**目标**: 与外部服务深度集成

- MCP 协议支持
- Webhook 触发器
- API 网关

---

## 已完成版本详情

### ~~V15: 多模型协作~~ ✅

**实现内容**:
- 模型注册表: 统一管理多个模型提供商
- 任务分类器: 自动识别任务类型
- 智能路由: 根据任务选择最合适的模型
- 成本追踪: 记录和优化 API 成本
- 降级机制: 主模型失败时自动切换备用
- 5 个新工具: model_list/route/config/stats/switch

详见: [docs/v15-多模型协作.md](./docs/v15-多模型协作.md)

---

### ~~V14: 插件系统~~ ✅

**实现内容**:
- 插件接口: 统一的插件定义规范
- 工具热插拔: 运行时加载/卸载工具
- 配置 Schema: 插件配置验证
- 生命周期钩子: 插件可以响应 Agent 事件
- 内置插件: weather, calculator, timestamp
- 5 个新工具: plugin_list/load/unload/config/info

详见: [docs/v14-插件系统.md](./docs/v14-插件系统.md)

---

### ~~V13.5: 上下文压缩~~ ✅

**实现内容**:
- 滑动窗口: 保留最近 N 轮完整对话
- 智能摘要: 旧对话自动压缩成摘要
- 工具截断: 长输出自动截断
- 重要性评分: 按优先级保留内容
- 4 个新工具: context_status/compress/config/summary

详见: [docs/v13.5-上下文压缩.md](./docs/v13.5-上下文压缩.md)

---

### ~~V13: 自进化系统~~ ✅

**实现内容**:
- 行为模式分析: 从内省日志识别工具调用模式
- 策略自动调整: 根据使用情况优化安全策略
- 性能优化建议: 识别低效模式并改进
- 进化历史追踪: 记录所有优化决策
- 5 个新工具: evolve_analyze/suggest/apply/status/history

详见: [docs/v13-自进化系统.md](./docs/v13-自进化系统.md)

---

### ~~V12: 安全策略系统~~ ✅

**实现内容**:
- 工具风险分级: safe (21个) / confirm (19个) / dangerous (5个)
- 信任等级权限: owner/trusted/normal/restricted
- 审计日志系统: 记录所有非 safe 操作
- 敏感数据保护: 自动识别和遮蔽 API key、密码等
- 5 个新工具: security_check/audit/policy/mask/context

详见: [docs/v12-安全策略系统.md](./docs/v12-安全策略系统.md)

---

### ~~V11: Channel 系统~~ ✅

**实现内容**:
- Channel 接口和 ChannelManager
- 内置渠道: Console, Telegram (骨架), Discord (骨架)
- 用户信任等级: owner/trusted/normal/restricted
- 渠道配置持久化 (.channels.json)
- 6 个新工具: channel_list/send/status/config/start/stop

详见: [docs/v11-Channel系统.md](./docs/v11-Channel系统.md)

---

## 技术债务

- [x] 完善测试覆盖 (V11-V15 测试已添加)
- [x] 性能优化 - 上下文压缩 (V13.5)
- [ ] 统一错误处理
- [ ] 文档国际化
- [ ] 代码模块化重构 (v12+ 单文件过大)

---

## 贡献指南

1. 每个版本保持独立可运行
2. 新功能先写文档再写代码
3. 安全相关改动需要 review

---

*Last updated: 2026-02-10*
