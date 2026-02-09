# Learn OpenClaw - Roadmap

> 从单文件 Agent 到多渠道安全运行时

---

## 已完成 (V0-V10)

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

---

## 计划中 (V11+)

### V11: Channel 系统 - 多渠道接入

**目标**: Agent 能通过多个社交平台与用户交互

| Channel | 优先级 | 场景 | 复杂度 |
|---------|--------|------|--------|
| Discord | 🔴 高 | 社区/群组 | 中 |
| Telegram | 🔴 高 | 个人/群组 | 低 |
| 飞书 (Feishu) | 🔴 高 | 国内企业 | 中 |
| MeltBook | 🟡 后续 | 待定 | - |

**核心设计**:
```typescript
interface Channel {
  name: string;
  send(message: string): Promise<void>;
  onMessage(handler: (msg: Message) => void): void;
  // 权限检查
  canExecute(action: string, context: Context): boolean;
}
```

**参考**: OpenClaw 已有 channel ���现，可借鉴其架构。

---

### V12: 安全策略系统

**目标**: 建立完整的安全边界和审计机制

#### 1. 权限分级

| 级别 | 动作类型 | 处理方式 |
|------|----------|----------|
| 🟢 Safe | 读文件、搜索、内部计算 | 直接执行 |
| 🟡 Confirm | 写文件、发消息、调 API | 需确认 |
| 🔴 Dangerous | 删除、执行命令、外部发布 | 双重确认 |

#### 2. 上下文感知

```typescript
interface SecurityContext {
  channel: string;        // discord | telegram | feishu
  isGroup: boolean;       // 群聊 vs 私聊
  userId: string;         // 谁在操作
  trustLevel: number;     // 信任等级
}
```

- **私聊**: 更宽松，可访问个人数据
- **群聊**: 更严格，不暴露敏感信息
- **公开频道**: 最严格，只读模式

#### 3. 审计日��

```typescript
interface AuditLog {
  timestamp: number;
  action: string;
  channel: string;
  userId: string;
  approved: boolean;
  result: "success" | "denied" | "error";
}
```

#### 4. 敏感数据保护

- 自动识别并遮蔽敏感信息（API key、密码、个人信息）
- 群聊中不暴露私人文件内容
- 跨 channel 数据隔离

---

### V13+: 自进化 (基于 V10 内省)

- 行为模式优化
- 自动调整策略
- 学习用户偏好

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

*Last updated: 2026-02-09*
