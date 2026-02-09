# Learn OpenClaw - Roadmap

> 从单文件 Agent 到多渠道安全运行时

---

## 已完成 (V0-V12)

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

---

## 计划中 (V13+)

### V13: 自进化系统

**目标**: 基于内省和审计数据自动优化行为

- 行为模式优化: 识别低效模式并改进
- 自动调整策略: 根据使用情况调整安全策略
- 学习用户偏好: 记住用户习惯和偏好
- 自我修复: 检测并修复常见问题

---

## 已完成版本详情

### ~~V11: Channel 系统~~ ✅

**实现内容**:
- Channel 接口和 ChannelManager
- 内置渠道: Console, Telegram (骨架), Discord (骨架)
- 用户信任等级: owner/trusted/normal/restricted
- 渠道配置持久化 (.channels.json)
- 6 个新工具: channel_list/send/status/config/start/stop

详见: [docs/v11-Channel系统.md](./docs/v11-Channel系统.md)

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

## 技术债务

- [ ] 统一错误处理
- [ ] 完善测试覆盖
- [ ] 性能优化（大文件、长对话）
- [ ] 文档国际化

---

## 贡献指南

1. 每个版本保持独立可运行
2. 新功能先写文档再写代码
3. 安全相关改动需要 review

---

*Last updated: 2026-02-10*
