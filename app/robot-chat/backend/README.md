# 机器狗对话管理系统

基于实时通信的智能对话平台，支持多台机器狗同时进行语音交互。

## 功能特性

- 🎤 实时音频/文字输入处理
- 🗣️ 语音识别与合成（支持讯飞、阿里云等）
- 🤖 AI大模型对话（支持OpenAI、Claude等）
- 🐕 机器狗动作控制
- 🔐 安全的动作白名单机制
- 📚 知识库检索增强（RAG）
- 📊 完整的日志和监控

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的API密钥
```

### 开发模式

```bash
npm run dev
```

### 生产构建

```bash
npm run build
npm start
```

## 项目结构

```
src/
├── index.ts              # 应用入口
├── config/               # 配置管理
├── websocket/            # WebSocket服务
├── services/             # 业务服务
│   ├── asr/             # 语音识别
│   ├── tts/             # 语音合成
│   ├── llm/             # AI模型
│   └── action/          # 动作控制
├── database/             # 数据库
├── routes/               # REST API路由
├── utils/                # 工具函数
└── types/                # TypeScript类型定义
```

## API文档

详见 [API接口文档](../../docs/编舞系统/API接口文档.md)

## License

MIT
