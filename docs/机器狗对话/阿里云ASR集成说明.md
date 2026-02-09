# 阿里云 Fun-ASR-realtime 语音识别集成说明

## 概述

系统已集成阿里云的 Fun-ASR-realtime 实时语音识别服务，支持在全局和角色级别配置语音识别模型。

## 功能特性

### 1. 支持的 ASR 提供商

- **xunfei**: 讯飞语音识别
- **openai**: OpenAI Whisper
- **aliyun**: 阿里云 Fun-ASR-realtime（新增）

### 2. 阿里云 Fun-ASR-realtime 优势

- **多语种支持**: 支持中文（普通话及多种方言）、英文、日语
- **多格式兼容**: 支持 pcm、wav、mp3、opus、speex、aac、amr 等音频格式
- **高准确率**: 适用于会议、直播、教学等场景
- **实时识别**: 边说边出文字，低延迟
- **多种模型**:
  - `fun-asr-realtime`: 稳定版（推荐）
  - `fun-asr-realtime-2025-11-07`: 快照版
  - `gummy-realtime-v1`: 多语种支持
  - `paraformer-realtime-v2`: 高精度识别

## 配置说明

### 1. 全局配置

编辑 `.env` 文件，配置阿里云 ASR：

```env
# 语音识别服务配置
ASR_PROVIDER=aliyun

# 阿里云 Fun-ASR-realtime 配置
ALIYUN_ASR_API_KEY=your-dashscope-api-key
ALIYUN_ASR_MODEL=fun-asr-realtime
ALIYUN_ASR_BASE_URL=wss://dashscope.aliyuncs.com/api-ws/v1/inference
```

**获取 API Key:**

1. 访问 [阿里云百炼平台](https://bailian.console.aliyun.com/)
2. 在 API Key 管理页面创建或查看 API Key
3. 将 API Key 填入 `ALIYUN_ASR_API_KEY` 配置项

**地域说明:**

- 中国内地: `wss://dashscope.aliyuncs.com/api-ws/v1/inference`
- 国际（新加坡）: `wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference`

### 2. 角色级别配置

通过角色管理 API 可以为每个角色单独配置 ASR 提供商和模型：

#### 创建角色时配置 ASR

```bash
POST /api/v1/roles
Content-Type: application/json

{
  "name": "阿里云语音助手",
  "description": "使用阿里云 ASR 的机器狗助手",
  "asr_provider": "aliyun",
  "asr_model": "fun-asr-realtime",
  "llm_provider": "tongyi",
  "llm_model": "qwen-plus",
  "voice": "zh-CN-XiaoxiaoNeural"
}
```

#### 更新角色的 ASR 配置

```bash
PATCH /api/v1/roles/{roleId}
Content-Type: application/json

{
  "asr_provider": "aliyun",
  "asr_model": "gummy-realtime-v1"
}
```

### 3. 数据库结构

roles 表新增字段：

- `asr_provider`: 语音识别提供商（xunfei/openai/aliyun）
- `asr_model`: 语音识别模型名称

## 使用说明

### 优先级规则

系统在选择 ASR 服务时遵循以下优先级：

1. **角色级别配置**（最高优先级）
   - 如果机器人绑定的角色配置了 `asr_provider` 和 `asr_model`，则使用角色配置

2. **全局配置**（默认）
   - 如果角色未配置 ASR，则使用 `.env` 中的全局配置

### 工作流程

```
语音输入 → 检查机器人角色 → 获取ASR配置 → 调用对应的ASR服务 → 返回文本
            ↓                    ↓
         角色已配置?          使用角色配置
            ↓                    ↓
            否                使用全局配置
            ↓
       使用全局配置
```

## 使用场景

### 场景1：全局使用阿里云 ASR

适用于所有机器人都使用阿里云语音识别的场景。

1. 在 `.env` 中设置 `ASR_PROVIDER=aliyun`
2. 配置 `ALIYUN_ASR_API_KEY`
3. 重启服务

### 场景2：不同角色使用不同 ASR

适用于需要针对不同场景优化的情况。

1. 创建多个角色，每个角色配置不同的 `asr_provider` 和 `asr_model`
2. 将机器人分配到对应的角色
3. 系统会自动使用角色配置的 ASR（如果角色未配置，则使用全局配置）

**示例：**

- **会议记录角色**: 使用 `aliyun` + `fun-asr-realtime`（高准确率）
- **快速交互角色**: 使用 `aliyun` + `gummy-chat-v1`（低成本，快速响应）
- **多语种角色**: 使用 `aliyun` + `gummy-realtime-v1`（支持多语种）

## 可用的阿里云 ASR 模型

### Fun-ASR 系列

- `fun-asr-realtime`: 稳定版，支持中英日三语混合识别
- `fun-asr-realtime-2025-11-07`: 最新快照版

### Gummy 系列

- `gummy-realtime-v1`: 长语音流式识别，支持多语种
- `gummy-chat-v1`: 短语音交互（1分钟内），低成本

### Paraformer 系列

- `paraformer-realtime-v2`: 高精度识别
- `paraformer-realtime-8k-v2`: 适用于电话录音（8kHz）

## 技术实现

### 连接流程

1. 建立 WebSocket 连接到阿里云服务
2. 发送开始消息，包含模型和参数配置
3. 分块发送音频数据（每次约 100ms 的音频）
4. 接收实时识别结果
5. 发送结束消息，关闭连接

### 音频处理

- 自动从 WAV 文件中提取 PCM 数据
- 自动检测采样率
- 支持 16kHz 采样率（推荐）

### 错误处理

- 自动重连机制（在应用层实现）
- 详细的错误信息返回
- 超时保护

## 最佳实践

### 1. 模型选择

- **会议/直播**: 使用 `fun-asr-realtime` 或 `paraformer-realtime-v2`
- **多语种场景**: 使用 `gummy-realtime-v1`
- **电话录音**: 使用 `paraformer-realtime-8k-v2`
- **短语音交互**: 使用 `gummy-chat-v1`

### 2. 性能优化

- 使用正确的采样率（8kHz 音频不要升采样）
- 配置合适的音频格式
- 考虑使用热词功能提升专有名词识别率

### 3. 成本控制

- `gummy-chat-v1` 是短音频场景的低成本选择
- 根据实际需求选择合适的模型
- 关注限流规则（RPS: 10-20）

## 价格

- Fun-ASR: 0.00033元/秒（中国内地）
- Gummy 长语音: 0.00033元/秒（中国内地）
- Gummy 短语音: 0.00015元/秒（中国内地）
- Paraformer: 0.00024元/秒（中国内地）

## 参考文档

- [阿里云实时语音识别文档](https://help.aliyun.com/zh/model-studio/real-time-speech-recognition)
- [Fun-ASR API 参考](https://help.aliyun.com/zh/model-studio/fun-asr-real-time-speech-recognition-api-reference/)
- [获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key)

## 故障排查

### 问题1: 连接失败

**原因**: API Key 未配置或不正确

**解决**: 检查 `.env` 中的 `ALIYUN_ASR_API_KEY` 配置

### 问题2: 识别结果为空

**原因**: 音频格式不支持或采样率不匹配

**解决**: 确保音频为 WAV 格式，采样率为 16kHz

### 问题3: 限流错误

**原因**: 超过模型的 RPS 限制

**解决**: 降低请求频率，或升级服务配额
