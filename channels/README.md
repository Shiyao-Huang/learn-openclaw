# OpenClaw Channel 系统 - 飞书接入指南

## 快速开始

### 1. 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 创建企业自建应用
3. 获取 `App ID` 和 `App Secret`

### 2. 配置应用权限

在「权限管理」中开启以下权限：

**消息与群组**
- `im:message` - 获取与发送单聊、群组消息
- `im:message:send_as_bot` - 以应用身份发送消息
- `im:chat:readonly` - 获取群组信息

**通讯录**
- `contact:user.base:readonly` - 获取用户基本信息（可选）

### 3. 配置事件订阅

在「事件订阅」中：

1. 设置请求地址: `http://your-server:3000/webhook/feishu`
2. 订阅以下事件:
   - `im.message.receive_v1` - 接收消息
   - `im.message.message_read_v1` - 消息已读（可选）

### 4. 配置环境变量

在 `.env` 文件中添加：

```bash
# 飞书配置
FEISHU_APP_ID=cli_xxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_WEBHOOK_PORT=3000

# 可选：事件加密
FEISHU_ENCRYPT_KEY=your_encrypt_key
FEISHU_VERIFICATION_TOKEN=your_verification_token
```

### 5. 安装依赖

```bash
npm install @larksuiteoapi/node-sdk
```

### 6. 在 Agent 中注册

```typescript
import { FeishuChannel } from './channels/feishu-channel';

// 注册飞书渠道
channelManager.register(new FeishuChannel());

// 配置渠道
channelManager.configure('feishu', {
  enabled: true,
  groupPolicy: 'mention-only',  // 群聊只响应 @ 消息
  dmPolicy: 'all',              // 私聊全部响应
});

// 启动
await channelManager.startAll();
```

## 消息类型支持

| 类型 | 接收 | 发送 | 说明 |
|------|------|------|------|
| 文本 | ✅ | ✅ | 纯文本消息 |
| 富文本 | ✅ | ✅ | 支持 @、链接等 |
| 卡片 | ❌ | ✅ | 交互式卡片消息 |
| 图片 | ⚠️ | ❌ | 接收时返回类型提示 |
| 文件 | ⚠️ | ❌ | 接收时返回类型提示 |

## API 示例

### 发送文本消息

```typescript
const feishu = channelManager.get('feishu') as FeishuChannel;

// 发送到群聊
await feishu.send('oc_xxxxx', '你好，这是一条测试消息');

// 发送到用户
await feishu.send('ou_xxxxx', '你好，这是私聊消息');
```

### 发送富文本消息

```typescript
await feishu.sendRichText('oc_xxxxx', {
  post: {
    zh_cn: {
      title: '消息标题',
      content: [
        [
          { tag: 'text', text: '这是一段文字，' },
          { tag: 'a', text: '点击链接', href: 'https://example.com' },
        ],
        [
          { tag: 'at', user_id: 'ou_xxxxx', user_name: '张三' },
          { tag: 'text', text: ' 请查看' },
        ],
      ],
    },
  },
});
```

### 发送卡片消息

```typescript
await feishu.sendCard('oc_xxxxx', {
  config: { wide_screen_mode: true },
  header: {
    title: { tag: 'plain_text', content: '任务提醒' },
    template: 'blue',
  },
  elements: [
    {
      tag: 'div',
      text: { tag: 'plain_text', content: '你有一个新任务需要处理' },
    },
    {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '查看详情' },
          type: 'primary',
          url: 'https://example.com/task/123',
        },
      ],
    },
  ],
});
```

### 回复消息

```typescript
// 在消息处理器中
channelManager.onMessage(async (ctx) => {
  if (ctx.channel === 'feishu') {
    const feishu = channelManager.get('feishu') as FeishuChannel;
    await feishu.reply(ctx.messageId, '收到你的消息了！');
  }
});
```

### 添加表情回应

```typescript
await feishu.addReaction(messageId, 'THUMBSUP');  // 👍
await feishu.addReaction(messageId, 'SMILE');     // 😊
```

## 常见问题

### Q: Webhook 验证失败？

确保：
1. 服务器可以被飞书访问（需要公网 IP 或内网穿透）
2. `FEISHU_VERIFICATION_TOKEN` 配置正确
3. 端口没有被防火墙阻挡

### Q: 消息发送失败？

检查：
1. 应用权限是否已开启
2. 机器人是否已加入目标群聊
3. `App ID` 和 `App Secret` 是否正确

### Q: 如何在本地测试？

使用内网穿透工具：
```bash
# 使用 ngrok
ngrok http 3000

# 或使用 localtunnel
npx localtunnel --port 3000
```

然后将生成的公网地址配置到飞书事件订阅中。

## 参考链接

- [飞书开放平台文档](https://open.feishu.cn/document/home/index)
- [Node SDK 文档](https://github.com/larksuite/node-sdk)
- [消息类型说明](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message/create_json)
- [事件订阅指南](https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM)
