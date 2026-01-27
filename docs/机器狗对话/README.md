# 机器狗对话管理系统

基于实时通信和AI大模型的智能对话平台，支持多台机器狗同时进行自然语言交互和动作控制。

## 📋 目录结构

```
app/robot-chat/cloud/backend/
├── src/                      # 源代码
│   ├── index.ts              # 应用入口
│   ├── config/               # 配置管理
│   ├── database/             # 数据库服务
│   ├── routes/               # REST API路由
│   ├── services/             # 业务服务层
│   │   ├── action-controller.ts    # 动作安全控制
│   │   ├── conversation-engine.ts  # 对话引擎
│   │   └── llm-service.ts          # LLM服务
│   ├── types/                # TypeScript类型定义
│   ├── utils/                # 工具函数
│   └── websocket/            # WebSocket服务
├── client/                   # Python客户端
├── test/                     # 测试脚本
├── QUICKSTART.md             # 快速开始指南
└── README.md                 # 本文件
```

## ✨ 核心功能

- 🎤 **实时通信**：基于WebSocket的双向实时通信
- 🤖 **AI对话**：集成OpenAI GPT-4等大语言模型
- 🛡️ **动作安全**：白名单机制、参数验证、频率限制
- 📊 **数据记录**：SQLite数据库存储对话历史和动作日志
- 🔌 **REST API**：完整的管理接口
- 🐍 **Python客户端**：开箱即用的WebSocket客户端

## 🚀 快速开始

### 1. 安装依赖

```bash
cd app/robot-chat/cloud/backend
npm install
```

### 2. 配置环境

```bash
cp .env.example .env
# 编辑 .env 文件，填入 OpenAI API Key
```

最小配置示例：
```env
PORT=3000
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4
```

### 3. 启动服务

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm run build
npm start
```

### 4. 测试

使用Python客户端：
```bash
cd client
pip install websockets
python robot_client.py
```

使用测试脚本：
```bash
cd test
python test_simple.py
```

## 📡 API接口

### WebSocket接口

**连接地址**：`ws://localhost:3001/api/conversation/connect`

**客户端消息格式**：
```json
{
  "type": "text_input",
  "robotId": "uuid",
  "timestamp": 1234567890,
  "data": {
    "text": "你好"
  }
}
```

**服务端响应**：
```json
{
  "type": "text_response",
  "robotId": "uuid",
  "timestamp": 1234567890,
  "data": {
    "text": "你好主人！"
  }
}
```

**动作指令**：
```json
{
  "type": "action_command",
  "robotId": "uuid",
  "timestamp": 1234567890,
  "data": {
    "action": "sit_down",
    "parameters": {},
    "safetyChecked": true
  }
}
```

### REST API

- `GET /api/health` - 健康检查
- `GET /api/status` - 系统状态
- `GET /api/robots` - 获取所有机器狗
- `GET /api/robots/:robotId` - 获取指定机器狗信息
- `GET /api/conversations/:robotId?limit=50&offset=0` - 获取对话历史

## 🎮 支持的动作

系统支持以下安全动作：

| 动作 | 说明 | 参数 |
|------|------|------|
| stand_up | 站起来 | 无 |
| sit_down | 坐下 | 无 |
| turn_left | 左转 | angle (最大720度) |
| turn_right | 右转 | angle (最大720度) |
| shake_hand | 握手 | 无 |
| wave | 挥手 | 无 |
| nod | 点头 | 无 |
| dance | 跳舞 | 无 |
| walk_forward | 前进 | steps (最大3步) |
| walk_backward | 后退 | steps (最大3步) |

所有动作都经过安全检查，包括：
- ✅ 动作白名单验证
- ✅ 参数范围限制
- ✅ 执行频率控制（10次/分钟）
- ✅ 自动参数修正

## 🔧 技术栈

**后端**：
- Node.js + TypeScript
- Express.js（HTTP服务）
- ws（WebSocket）
- better-sqlite3（数据库）
- Winston（日志）
- Axios（HTTP客户端）

**AI服务**：
- OpenAI GPT-4 / GPT-3.5
- 可扩展支持其他LLM

**客户端**：
- Python 3.8+
- websockets库

## 📝 对话示例

```
用户: 你好
AI: 你好主人！我是你的机器狗助手，有什么可以帮到你的吗？

用户: 坐下
AI: 好的主人[ACTION:sit_down()]
🤖 执行动作: sit_down

用户: 向前走两步
AI: 好的，我来走两步[ACTION:walk_forward(steps=2)]
🤖 执行动作: walk_forward，参数: {steps: 2}

用户: 转个圈
AI: 好的，我来转一圈[ACTION:turn_left(angle=360)]
🤖 执行动作: turn_left，参数: {angle: 360}
```

## 🔐 安全机制

1. **动作白名单**：只允许执行预定义的安全动作
2. **参数限制**：自动限制和修正超出范围的参数
3. **频率控制**：防止过度频繁执行动作（10次/分钟）
4. **自动拒绝**：危险动作会被自动拒绝并返回说明

## 📊 数据库设计

使用SQLite存储：

- **robots** - 机器狗注册表
- **conversations** - 对话历史
- **action_logs** - 动作执行记录
- **system_logs** - 系统日志

## 🛠️ 开发指南

### 添加新的LLM提供商

编辑 [src/services/llm-service.ts](src/services/llm-service.ts)：

```typescript
async chat(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
  switch (this.provider) {
    case 'openai':
      return this.chatOpenAI(messages, options);
    case 'your-provider':  // 添加新提供商
      return this.chatYourProvider(messages, options);
    // ...
  }
}
```

### 添加新的动作

编辑 [src/services/action-controller.ts](src/services/action-controller.ts)：

```typescript
private readonly ALLOWED_ACTIONS = new Set([
  'stand_up',
  'sit_down',
  // ... 现有动作
  'your_new_action',  // 添加新动作
]);
```

### 自定义提示词

编辑 [src/services/llm-service.ts](src/services/llm-service.ts) 中的 `getSystemPrompt()` 方法。

## 📦 部署

### 使用PM2

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 使用Docker（TODO）

```bash
docker build -t robot-dog-conversation .
docker run -p 3000:3000 robot-dog-conversation
```

## 🔜 待实现功能

- [ ] 语音识别（ASR）- 支持讯飞/阿里云
- [ ] 语音合成（TTS）- 支持讯飞/阿里云
- [ ] 知识库系统（RAG）
- [ ] 多模态输入（图像识别）
- [ ] 多机器狗协作
- [ ] 更多LLM支持（Claude、通义千问等）

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📮 联系方式

如有问题，请提交Issue或查看[技术文档](../../docs/机器狗对话/技术文档.md)。

---

**注意**：请确保你有有效的OpenAI API Key，并妥善保管不要泄露。
