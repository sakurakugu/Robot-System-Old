# robot-cloud - 云端服务

云端管理平台，提供 Web 界面和后端 API，支持机器人管理、大模型交互、编舞系统等功能。

## 目录结构

```
robot-cloud/
├── 前端/                        # Vue3 前端应用
│   ├── src/
│   │   ├── api/                 # API 请求
│   │   ├── assets/              # 静态资源
│   │   ├── components/          # 公共组件
│   │   ├── composables/         # 组合式函数
│   │   ├── constants/           # 常量定义
│   │   ├── modules/             # 功能模块
│   │   ├── stores/              # 状态管理
│   │   ├── utils/               # 工具函数
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── 后端/                        # Node.js 后端服务
│   ├── src/
│   │   ├── config/              # 配置
│   │   ├── core/                # 核心模块
│   │   ├── modules/             # 功能模块
│   │   ├── types/               # 类型定义
│   │   ├── app.ts
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── ecosystem.config.js      # PM2 配置
└── README.md
```

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (Vue3)                               │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   机器人管理  │   对话系统    │   编舞系统    │   角色管理    │  设置   │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       ▼             ▼             ▼             ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      后端 (Node.js + Express)                    │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│  机器人管理   │  大模型交互   │  编舞系统    │  角色管理    │  设置   │
│  WebSocket   │  ASR/TTS    │  时间线编辑   │             │         │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       ▼             ▼             ▼             ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        外部服务                                  │
├─────────────┬─────────────┬─────────────┬───────────────────────┤
│  robot-agent │  阿里云 LLM  │  阿里云 ASR  │      数据库           │
│  (WebSocket) │  (API)      │  (API)      │   (SQLite)            │
└─────────────┴─────────────┴─────────────┴───────────────────────┘
```

---

## 后端服务

### 技术栈

- **运行时**: Node.js 18+
- **框架**: Express
- **语言**: TypeScript
- **数据库**: SQLite (better-sqlite3)
- **WebSocket**: ws
- **AI 服务**: 阿里云百炼

### 功能模块

| 模块 | 功能 |
|------|------|
| 机器人管理 | 机器人注册、状态管理、WebSocket 连接 |
| 大模型交互 | LLM 对话、ASR 语音识别、TTS 语音合成 |
| 编舞系统 | 动作编排、时间线编辑、动作执行 |
| 角色管理 | 角色创建、系统提示词配置 |
| 设置 | AI 配置、系统参数 |
| WebSocket | 实时通信、消息路由 |

### 安装运行

```bash
cd 后端
npm install
cp .env.example .env
npm run dev
```

### API 接口

#### 机器人管理 `/api/v1/robots`

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/` | 获取机器人列表 |
| GET | `/:uuid` | 获取机器人详情 |
| POST | `/` | 创建机器人 |
| PUT | `/:uuid` | 更新机器人 |
| DELETE | `/:uuid` | 删除机器人 |
| GET | `/discover` | 发现局域网机器人 (mDNS) |
| POST | `/:uuid/connect` | 连接机器人 |
| POST | `/:uuid/disconnect` | 断开连接 |

#### 对话 `/api/v1/conversations`

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/:robotId/message` | 发送消息 |
| GET | `/:robotId/history` | 获取对话历史 |
| DELETE | `/:robotId/history` | 清除对话历史 |

#### 大模型配置 `/api/v1/config`

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/llm` | 获取 LLM 配置 |
| POST | `/llm` | 更新 LLM 配置 |
| GET | `/llm/providers` | 获取支持的供应商 |

#### 角色 `/api/v1/roles`

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/` | 获取角色列表 |
| POST | `/` | 创建角色 |
| PUT | `/:id` | 更新角色 |
| DELETE | `/:id` | 删除角色 |

#### 编舞 `/api/v1/choreo`

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/projects` | 获取项目列表 |
| POST | `/projects` | 创建项目 |
| GET | `/projects/:id` | 获取项目详情 |
| PUT | `/projects/:id` | 更新项目 |
| DELETE | `/projects/:id` | 删除项目 |
| POST | `/projects/:id/execute` | 执行编舞 |

### WebSocket 端点

| 端点 | 用途 |
|------|------|
| `/api/v1/interaction/connect` | 主连接 |
| `/api/v1/interaction/connect/control` | 控制通道 |
| `/api/v1/interaction/connect/business` | 业务通道 |
| `/api/v1/interaction/connect/audio_upload` | 音频上传 |
| `/api/v1/interaction/connect/audio_download` | 音频下载 |

### 大模型交互流程

```
用户语音输入
     │
     ▼
┌─────────────┐
│  robot-agent │
│  音频采集     │
│  Opus 编码    │
└──────┬──────┘
       │ WebSocket
       ▼
┌─────────────┐
│  后端        │
│  音频接收     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  阿里云 ASR  │
│  语音转文字  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  阿里云 LLM  │
│  对话生成    │
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌─────────────┐ ┌─────────────┐
│  阿里云 TTS  │ │  动作指令    │
│  文字转语音  │ │  发送到机器狗 │
└──────┬──────┘ └─────────────┘
       │
       ▼
┌─────────────┐
│  robot-agent │
│  音频播放     │
└─────────────┘
```

---

## 前端应用

### 技术栈

- **框架**: Vue 3
- **构建工具**: Vite
- **语言**: TypeScript
- **UI 库**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router

### 功能模块

| 模块 | 路径 | 功能 |
|------|------|------|
| 机器人管理 | `/robots` | 机器人列表、添加、编辑、删除 |
| 机器人操作 | `/robots/:id/operation` | 实时控制、对话、视频流 |
| 编舞系统 | `/choreo` | 动作编排、时间线编辑 |
| 角色管理 | `/roles` | 角色配置、系统提示词 |
| 设置 | `/settings` | AI 配置、系统参数 |
| 对话 | `/conversation` | 与机器人对话 |

### 安装运行

```bash
cd 前端
npm install
npm run dev
```

访问 `http://localhost:5174`

### 目录结构详解

```
前端/src/
├── api/                     # API 请求封装
│   ├── index.ts             # API 导出
│   └── request.ts           # Axios 封装
├── components/              # 公共组件
│   ├── DevTopFab.vue        # 开发工具浮动按钮
│   ├── JoystickPad.vue      # 虚拟摇杆
│   └── PageHeader.vue       # 页面头部
├── composables/             # 组合式函数
│   └── useWebSocket.ts      # WebSocket Hook
├── modules/                 # 功能模块
│   ├── choreo/              # 编舞系统
│   ├── conversation/        # 对话系统
│   ├── knowledge/           # 知识库
│   ├── layouts/             # 布局
│   ├── robot/               # 机器人管理
│   ├── role/                # 角色管理
│   ├── settings/            # 设置
│   └── websocket/           # WebSocket 状态
├── stores/                  # 全局状态
│   └── theme.ts             # 主题状态
└── utils/                   # 工具函数
    ├── date.ts              # 日期处理
    ├── format.ts            # 格式化
    ├── storage.ts           # 本地存储
    └── validator.ts         # 验证器
```

### 编舞系统

编舞系统是一个可视化动作编排工具，支持时间线编辑。

#### 功能

- 创建和管理编舞项目
- 时间线可视化编辑
- 动作轨道和音频轨道
- 预览和执行编舞
- 多机器人同步执行

#### 组件

| 组件 | 功能 |
|------|------|
| TimelineEditor | 时间线编辑器主组件 |
| ActionTrack | 动作轨道 |
| AudioTrack | 音频轨道 |
| ActionSelectorDialog | 动作选择对话框 |
| RobotPreview | 机器人预览 |

### 机器人操作页面

机器人操作页面提供实时控制功能：

- **视频流**: 实时查看机器人摄像头
- **虚拟摇杆**: 触摸控制机器人移动
- **对话**: 语音/文字对话
- **动作按钮**: 快捷动作执行
- **状态显示**: 电量、温度、位置等

### 配置代理

修改 `vite.config.ts` 以连接到不同的后端服务器：

```typescript
server: {
  port: 5174,
  proxy: {
    '/api': {
      target: 'http://localhost:9000',
      changeOrigin: true
    }
  }
}
```

---

## 部署

### 开发环境

```bash
# 后端
cd 后端
npm run dev

# 前端
cd 前端
npm run dev
```

### 生产环境

使用 PM2 管理后端进程：

```bash
cd 后端
npm run build
pm2 start ecosystem.config.js
```

前端构建：

```bash
cd 前端
npm run build
# 将 dist 目录部署到静态服务器
```

### 环境变量

后端 `.env` 文件：

```env
PORT=9000
DATABASE_PATH=./data/robot-cloud.db

```
