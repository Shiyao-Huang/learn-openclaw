---
name: tingwu
description: 通义听悟 - 智能语音转录服务，支持说话人识别、多语言混合、时间戳
homepage: https://tingwu.aliyun.com/
metadata:
  {
    "openclaw":
      {
        "emoji": "🎙️",
        "requires": {
          "bins": ["ffmpeg", "uv"],
          "env": [
            "ALIBABA_CLOUD_ACCESS_KEY_ID",
            "ALIBABA_CLOUD_ACCESS_KEY_SECRET",
            "TINGWU_APP_KEY"
          ]
        },
        "primaryEnv": "TINGWU_APP_KEY",
        "mcp": {
          "command": "/opt/homebrew/bin/uv",
          "args": ["--directory", "/Users/swmt/work/help/tools", "run", "tingwu_mcp.py"],
          "env": {
            "ALIBABA_CLOUD_ACCESS_KEY_ID": "${ALIBABA_CLOUD_ACCESS_KEY_ID}",
            "ALIBABA_CLOUD_ACCESS_KEY_SECRET": "${ALIBABA_CLOUD_ACCESS_KEY_SECRET}",
            "TINGWU_APP_KEY": "${TINGWU_APP_KEY}",
            "COS_BUCKET": "${COS_BUCKET}",
            "COS_REGION": "${COS_REGION}",
            "TENCENT_SECRET_ID": "${TENCENT_SECRET_ID}",
            "TENCENT_SECRET_KEY": "${TENCENT_SECRET_KEY}"
          }
        }
      }
  }
---

# 通义听悟 (Tingwu)

阿里云通义听悟语音转录服务，支持：
- 🎤 说话人识别（自动识别多人对话）
- 🌍 多语言混合识别（中英日粤韩德法俄等）
- ⏱️ 精确时间戳
- 📹 视频自动转音频

## MCP 工具

### `process_media` - 智能处理媒体文件

统一入口，自动处理完整流程：
1. 检测输入类型（视频/音频/URL）
2. 视频自动转换为音频
3. 本地文件自动上传到云存储
4. 调用通义听悟进行转录

```
参数:
  input_path: 本地文件路径或 HTTP/HTTPS URL
  source_language: 语言设置
    - "multilingual" (默认): 多语种混合
    - "cn": 中文
    - "en": 英文
    - "yue": 粤语
    - "ja": 日语
    - "ko": 韩语
    - "auto": 自动识别
  wait_for_completion: 是否等待完成 (默认 true)
  output_dir: 输出目录（可选，保存 JSON 和文本结果）
```

### `get_task_status` - 查询任务状态

用于异步模式下查询转录任务进度和获取结果。

```
参数:
  task_id: 任务ID
  output_dir: 输出目录（可选）
  save_results: 是否保存结果文件 (默认 true)
```

## 使用示例

### 转录本地视频
```
process_media("/path/to/video.mp4")
```

### 转录音频 URL
```
process_media("https://example.com/audio.mp3")
```

### 指定语言和输出目录
```
process_media(
  input_path="/path/to/meeting.m4a",
  source_language="cn",
  output_dir="/path/to/output"
)
```

### 异步模式（长时间任务）
```
# 1. 提交任务
process_media("/path/to/long-video.mp4", wait_for_completion=false)
# 返回: 任务ID

# 2. 稍后查询
get_task_status("task-id-xxx", output_dir="/path/to/output")
```

## 环境变量

需要在 `.env` 或环境中配置：

```bash
# 阿里云通义听悟
ALIBABA_CLOUD_ACCESS_KEY_ID=xxx
ALIBABA_CLOUD_ACCESS_KEY_SECRET=xxx
TINGWU_APP_KEY=xxx

# 腾讯云 COS（用于上传本地文件）
COS_BUCKET=xxx
COS_REGION=xxx
TENCENT_SECRET_ID=xxx
TENCENT_SECRET_KEY=xxx
```

## 依赖

- **ffmpeg**: 视频转音频
- **uv**: Python 包管理器
- **腾讯云 COS**: 本地文件上传（获取公开 URL）
