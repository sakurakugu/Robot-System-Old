# 更新日志

## 2026-02-09 - 阿里云 Fun-ASR-realtime 语音识别集成

### 新增功能

#### 1. 阿里云 ASR 支持

- 集成阿里云 Fun-ASR-realtime 实时语音识别服务
- 支持多种模型选择：
  - `fun-asr-realtime`: 稳定版，支持中英日三语
  - `fun-asr-realtime-2025-11-07`: 最新快照版
  - `gummy-realtime-v1`: 多语种长语音识别
  - `gummy-chat-v1`: 短语音快速交互（1分钟内）
  - `paraformer-realtime-v2`: 高精度识别
  - `paraformer-realtime-8k-v2`: 电话录音专用（8kHz）

#### 2. 角色级别 ASR 配置

- 在角色管理中新增 `asr_provider` 和 `asr_model` 字段
- 支持为不同角色配置不同的 ASR 服务
- 配置优先级：角色配置 > 全局配置

#### 3. 混合 ASR 方案

- 允许在同一系统中同时使用多种 ASR 服务
- 可以根据场景需求灵活选择最合适的 ASR 提供商
- 支持的 ASR 提供商：
  - `aliyun`: 阿里云 Fun-ASR（新增）
  - `openai`: OpenAI Whisper
  - `xunfei`: 讯飞语音识别

### 技术实现

#### 后端改动

1. **配置文件** (`src/config/index.ts`)
   - 添加 `aliyun` ASR 配置项
   - 支持配置 API Key、模型、WebSocket 地址

2. **ASR 服务** (`src/modules/机器人交互/asr-service.ts`)
   - 实现阿里云 Fun-ASR WebSocket 接口
   - 支持动态切换 ASR 提供商和模型
   - 增强 ASROptions 接口，支持 provider 和 model 参数

3. **WebSocket 服务** (`src/modules/websocket/service.ts`)
   - 在音频处理时获取机器人角色的 ASR 配置
   - 优先使用角色配置的 ASR，否则使用全局配置

4. **数据库** (`src/core/database/index.ts`)
   - roles 表新增 `asr_provider` 和 `asr_model` 字段
   - 添加数据库迁移逻辑，自动添加新字段

5. **类型定义** (`src/types/index.ts`)
   - RoleRecord 接口添加 ASR 相关字段
   - CreateRoleDto 和 UpdateRoleDto 支持 ASR 配置

6. **角色服务** (`src/modules/role/service.ts`)
   - createRole 和 updateRole 方法支持 ASR 参数

#### 环境变量

新增环境变量（`.env.example`）：

```env
# 阿里云 Fun-ASR-realtime 配置
ALIYUN_ASR_API_KEY=your-dashscope-api-key
ALIYUN_ASR_MODEL=fun-asr-realtime
ALIYUN_ASR_BASE_URL=wss://dashscope.aliyuncs.com/api-ws/v1/inference
```

### 使用文档

- [阿里云 ASR 集成说明](./docs/机器狗对话/阿里云ASR集成说明.md)
- [阿里云 ASR 使用示例](./docs/机器狗对话/阿里云ASR使用示例.md)

### 配置示例

#### 全局配置

```env
ASR_PROVIDER=aliyun
ALIYUN_ASR_API_KEY=sk-xxxxxxxxxxxxx
ALIYUN_ASR_MODEL=fun-asr-realtime
```

#### 角色配置

```bash
# 创建使用阿里云 ASR 的角色
POST /api/v1/roles
{
  "name": "阿里云语音助手",
  "asr_provider": "aliyun",
  "asr_model": "fun-asr-realtime",
  "llm_provider": "tongyi",
  "llm_model": "qwen-plus"
}
```

### API 变更

#### 角色管理 API

**创建角色** (`POST /api/v1/roles`)

请求体新增字段：

```typescript
{
  asr_provider?: string;  // 'xunfei' | 'openai' | 'aliyun'
  asr_model?: string;     // ASR 模型名称
}
```

**更新角色** (`PATCH /api/v1/roles/:id`)

请求体新增字段：

```typescript
{
  asr_provider?: string;
  asr_model?: string;
}
```

**获取角色** (`GET /api/v1/roles/:id`)

响应体新增字段：

```typescript
{
  asr_provider: string | null;
  asr_model: string | null;
}
```

### 数据库变更

#### roles 表

新增字段：

```sql
ALTER TABLE roles ADD COLUMN asr_provider TEXT;
ALTER TABLE roles ADD COLUMN asr_model TEXT;
```

字段说明：

- `asr_provider`: 语音识别提供商（'xunfei' | 'openai' | 'aliyun'）
- `asr_model`: ASR 模型名称

### 兼容性说明

- **向后兼容**: 现有角色的 `asr_provider` 和 `asr_model` 为 null，会自动使用全局配置
- **数据库迁移**: 启动时自动执行，无需手动操作
- **零影响升级**: 不影响现有功能，完全向后兼容

### 测试建议

1. **全局配置测试**
   - 配置 `.env` 中的 `ASR_PROVIDER=aliyun`
   - 重启服务
   - 测试语音识别功能

2. **角色配置测试**
   - 创建使用阿里云 ASR 的角色
   - 将机器人绑定到该角色
   - 测试语音识别功能

3. **混合配置测试**
   - 创建多个角色，使用不同的 ASR 提供商
   - 切换机器人角色，验证 ASR 切换正确

### 性能影响

- WebSocket 连接开销：每次语音识别需要建立一次 WebSocket 连接
- 音频处理：自动从 WAV 提取 PCM，性能影响可忽略
- 数据库查询：角色查询增加，但有索引支持，影响微小

### 已知限制

1. 阿里云 ASR 限流：10-20 RPS，根据模型不同
2. 需要有效的阿里云 API Key（百炼平台）
3. 仅支持实时语音识别，暂不支持录音文件批量识别
4. WebSocket 连接需要稳定的网络环境

### 后续计划

- [ ] 支持热词配置
- [ ] 支持语气词过滤
- [ ] 支持情感识别
- [ ] 前端 UI 添加 ASR 模型选择器
- [ ] 添加 ASR 性能监控和统计

### 相关链接

- [阿里云实时语音识别文档](https://help.aliyun.com/zh/model-studio/real-time-speech-recognition)
- [Fun-ASR API 参考](https://help.aliyun.com/zh/model-studio/fun-asr-real-time-speech-recognition-api-reference/)
- [获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key)
