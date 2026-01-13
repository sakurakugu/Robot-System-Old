# 机器狗对话系统 - Web前端调试界面

## 功能特性

- 🔌 WebSocket实时通信
- 💬 文本对话测试
- 🤖 机器狗状态监控
- 📊 性能统计（延迟、消息数）
- 🎨 暗色/亮色主题自适应

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5174

### 构建生产版本

```bash
npm run build
```

## 使用说明

1. **连接服务器**：点击"连接服务器"按钮建立WebSocket连接
2. **发送消息**：在输入框输入文本，按Enter或点击"发送"按钮
3. **查看响应**：AI的回复和执行的动作会显示在对话区域
4. **查看统计**：侧边栏显示消息数和平均延迟等统计信息

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia
- WebSocket API

## 配置

修改 [vite.config.ts](vite.config.ts) 中的代理配置以连接到不同的后端服务器：

```typescript
server: {
  port: 5174,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

## 项目结构

```
frontend/
├── src/
│   ├── App.vue              # 主应用组件
│   ├── main.ts              # 应用入口
│   ├── style.css            # 全局样式
│   └── composables/
│       └── useWebSocket.ts  # WebSocket连接管理
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 开发建议

- 使用Vue DevTools调试组件状态
- 打开浏览器控制台查看WebSocket消息日志
- 使用Network面板监控WebSocket连接状态
