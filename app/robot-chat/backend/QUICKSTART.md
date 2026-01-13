# 快速开始指南

## 1. 安装依赖

```bash
cd app/backend-conversation
npm install
```

## 2. 配置环境变量

复制示例配置文件并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件，至少需要配置：

```env
# OpenAI配置（必须）
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4

# 其他配置使用默认值即可
```

## 3. 启动服务

### 开发模式

```bash
npm run dev
# 或
./start.sh
```

### 生产模式

```bash
# 构建
npm run build

# 启动
npm start
# 或
./start.sh prod
```

### 使用PM2部署

```bash
# 构建
npm run build

# 使用PM2启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs robot-dog-conversation

# 停止
pm2 stop robot-dog-conversation

# 重启
pm2 restart robot-dog-conversation
```

## 4. 测试连接

### 测试HTTP接口

```bash
curl http://localhost:3001/api/health
```

### 使用Python客户端测试

```bash
cd client
pip install websockets
python robot_client.py
```

然后输入文本进行对话测试：

```
你: 你好
你: 坐下
你: 向前走两步
```

## 5. API接口

### REST API

- `GET /api/health` - 健康检查
- `GET /api/status` - 系统状态
- `GET /api/robots` - 获取所有机器狗
- `GET /api/robots/:robotId` - 获取指定机器狗信息
- `GET /api/conversations/:robotId` - 获取对话历史

### WebSocket API

连接地址：`ws://localhost:3001/api/conversation/connect`

客户端消息格式：
```json
{
  "type": "text_input",
  "robotId": "xxx-xxx-xxx",
  "timestamp": 1234567890,
  "data": {
    "text": "你好"
  }
}
```

服务端响应格式：
```json
{
  "type": "text_response",
  "robotId": "xxx-xxx-xxx",
  "timestamp": 1234567890,
  "data": {
    "text": "你好主人！"
  }
}
```

## 6. 目录结构

```
app/backend-conversation/
├── src/
│   ├── index.ts              # 应用入口
│   ├── config/               # 配置
│   ├── database/             # 数据库
│   ├── routes/               # REST API路由
│   ├── services/             # 业务服务
│   │   ├── action-controller.ts    # 动作控制
│   │   ├── conversation-engine.ts  # 对话引擎
│   │   └── llm-service.ts          # LLM服务
│   ├── types/                # TypeScript类型
│   ├── utils/                # 工具函数
│   └── websocket/            # WebSocket服务
├── client/                   # Python客户端
│   ├── robot_client.py
│   └── README.md
├── data/                     # 数据目录（自动创建）
│   └── conversations.db
├── logs/                     # 日志目录（自动创建）
├── package.json
├── tsconfig.json
└── .env                      # 环境配置
```

## 7. 常见问题

### Q: OpenAI API调用失败？
A: 检查 `.env` 中的 `OPENAI_API_KEY` 是否正确配置。

### Q: 端口被占用？
A: 修改 `.env` 中的 `PORT` 配置。

### Q: WebSocket连接失败？
A: 确保服务器已启动，并检查防火墙设置。

### Q: 如何集成实际的机器狗SDK？
A: 在 Python客户端的 `execute_action` 方法中调用你的机器狗SDK。

## 8. 下一步开发

目前已实现核心功能：
- ✅ WebSocket通信
- ✅ AI对话（OpenAI GPT）
- ✅ 动作安全控制
- ✅ 数据库存储
- ✅ REST API接口

待实现功能：
- ⏳ 语音识别（ASR）
- ⏳ 语音合成（TTS）
- ⏳ 知识库（RAG）
- ⏳ 多模态支持

欢迎贡献代码！
