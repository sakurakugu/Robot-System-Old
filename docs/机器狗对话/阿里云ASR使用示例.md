# 阿里云 ASR 使用示例

## 示例 1: 全局使用阿里云 ASR

### 步骤 1: 配置环境变量

编辑 `app/robot-cloud/后端/.env` 文件：

```env
# 设置 ASR 提供商为阿里云
ASR_PROVIDER=aliyun

# 配置阿里云 API Key
ALIYUN_ASR_API_KEY=sk-xxxxxxxxxxxxx
ALIYUN_ASR_MODEL=fun-asr-realtime
ALIYUN_ASR_BASE_URL=wss://dashscope.aliyuncs.com/api-ws/v1/inference
```

### 步骤 2: 重启服务

```bash
# 重启后端服务
cd app/robot-cloud/后端
npm run dev
```

### 步骤 3: 测试

1. 打开前端应用
2. 连接机器狗
3. 点击语音按钮，对机器狗说话
4. 查看识别结果

---

## 示例 2: 创建使用阿里云 ASR 的角色

### 步骤 1: 通过 API 创建角色

```bash
curl -X POST http://localhost:9000/api/v1/roles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "阿里云语音助手",
    "description": "使用阿里云 Fun-ASR 的智能助手",
    "asr_provider": "aliyun",
    "asr_model": "fun-asr-realtime",
    "llm_provider": "tongyi",
    "llm_model": "qwen-plus",
    "voice": "zh-CN-XiaoxiaoNeural",
    "temperature": 0.7,
    "max_history": 10
  }'
```

### 步骤 2: 将机器狗绑定到该角色

```bash
curl -X PATCH http://localhost:9000/api/v1/robots/{robotId} \
  -H "Content-Type: application/json" \
  -d '{
    "role_id": "角色UUID"
  }'
```

### 步骤 3: 测试

该机器狗现在会使用阿里云 Fun-ASR 进行语音识别。

---

## 示例 3: 为不同场景配置不同的 ASR

### 场景说明

- **会议记录机器人**：使用高精度的 `fun-asr-realtime`
- **快速交互机器人**：使用低成本的 `gummy-chat-v1`
- **多语种机器人**：使用 `gummy-realtime-v1`

### 创建会议记录角色

```bash
curl -X POST http://localhost:9000/api/v1/roles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "会议记录助手",
    "description": "高精度语音识别，适合会议记录",
    "asr_provider": "aliyun",
    "asr_model": "fun-asr-realtime",
    "llm_provider": "tongyi",
    "llm_model": "qwen-plus"
  }'
```

### 创建快速交互角色

```bash
curl -X POST http://localhost:9000/api/v1/roles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "快速交互助手",
    "description": "快速响应，适合短语音交互",
    "asr_provider": "aliyun",
    "asr_model": "gummy-chat-v1",
    "llm_provider": "tongyi",
    "llm_model": "qwen-turbo"
  }'
```

### 创建多语种角色

```bash
curl -X POST http://localhost:9000/api/v1/roles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "多语种助手",
    "description": "支持中英日韩法等多种语言",
    "asr_provider": "aliyun",
    "asr_model": "gummy-realtime-v1",
    "llm_provider": "tongyi",
    "llm_model": "qwen-plus"
  }'
```

---

## 示例 4: 更新现有角色的 ASR 配置

假设你已经有一个角色，现在想改用阿里云 ASR：

```bash
curl -X PATCH http://localhost:9000/api/v1/roles/{roleId} \
  -H "Content-Type: application/json" \
  -d '{
    "asr_provider": "aliyun",
    "asr_model": "fun-asr-realtime"
  }'
```

---

## 示例 5: 混合使用不同的 ASR 提供商

你可以为不同的角色配置不同的 ASR 提供商：

### 角色 A: 使用阿里云

```json
{
  "name": "阿里云助手",
  "asr_provider": "aliyun",
  "asr_model": "fun-asr-realtime"
}
```

### 角色 B: 使用 OpenAI

```json
{
  "name": "OpenAI 助手",
  "asr_provider": "openai",
  "asr_model": "whisper-1"
}
```

### 角色 C: 使用讯飞

```json
{
  "name": "讯飞助手",
  "asr_provider": "xunfei"
}
```

### 角色 D: 使用全局配置

```json
{
  "name": "默认助手",
  "asr_provider": null,
  "asr_model": null
}
```

这样，你可以根据不同场景和需求，灵活选择最合适的 ASR 服务。

---

## 示例 6: 前端集成示例

如果你想在前端 UI 中让用户选择 ASR 模型，可以在角色管理界面添加选择器：

```vue
<template>
  <el-form-item label="语音识别服务">
    <el-select v-model="form.asr_provider" placeholder="选择 ASR 提供商">
      <el-option label="使用全局配置" :value="null" />
      <el-option label="阿里云" value="aliyun" />
      <el-option label="OpenAI" value="openai" />
      <el-option label="讯飞" value="xunfei" />
    </el-select>
  </el-form-item>

  <el-form-item label="ASR 模型" v-if="form.asr_provider === 'aliyun'">
    <el-select v-model="form.asr_model" placeholder="选择模型">
      <el-option label="Fun-ASR (推荐)" value="fun-asr-realtime" />
      <el-option label="Fun-ASR 最新版" value="fun-asr-realtime-2025-11-07" />
      <el-option label="Gummy 长语音" value="gummy-realtime-v1" />
      <el-option label="Gummy 短语音" value="gummy-chat-v1" />
      <el-option label="Paraformer V2" value="paraformer-realtime-v2" />
      <el-option label="Paraformer 8kHz" value="paraformer-realtime-8k-v2" />
    </el-select>
  </el-form-item>
</template>
```

---

## 常见问题

### Q1: 如何知道当前使用的是哪个 ASR 服务？

查看后端日志，在语音识别时会输出使用的提供商和模型信息。

### Q2: 角色配置的 ASR 会覆盖全局配置吗？

是的，如果角色配置了 `asr_provider`，会优先使用角色配置。如果角色的 `asr_provider` 为 null，则使用全局配置。

### Q3: 可以为每个机器人单独配置 ASR 吗？

不可以直接为机器人配置，但可以通过为机器人分配不同的角色来实现相同效果。

### Q4: 如何测试不同的 ASR 模型效果？

创建多个测试角色，每个角色使用不同的 ASR 配置，然后切换机器人的角色进行测试对比。

### Q5: 如果角色配置了不存在的 ASR 模型会怎样？

系统会返回错误信息，建议在配置前参考文档确认模型名称的正确性。
