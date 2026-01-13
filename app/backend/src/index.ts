import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import util from 'util';
import { CONFIG } from './config';
import { initMainDatabase } from './database';
import choreoApiRoutes from './routes/choreo-api';
import sharedApiRoutes from './routes/shared-api';
import { pythonExecutor } from './services/python-executor';
import { WebSocketService } from './services/websocket';

async function main() {
  const logDir = path.join(__dirname, '../../..', 'logs');
  const logFile = path.join(logDir, 'backend.log');
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {}
  const stream = fs.createWriteStream(logFile, { flags: 'a' });
  const origLog = console.log;
  const origErr = console.error;
  const write = (level: 'INFO' | 'ERROR', args: any[]) => {
    try {
      const line = `[${new Date().toISOString()}] ${level} ${util.format.apply(null, args)}\n`;
      stream.write(line);
    } catch {}
  };
  console.log = (...args: any[]) => {
    origLog(...args);
    write('INFO', args);
  };
  console.error = (...args: any[]) => {
    origErr(...args);
    write('ERROR', args);
  };

  console.log('启动机器人狗控制系统后端...');
  console.log(`数据目录: ${CONFIG.DATA_DIR}`);
  console.log(`项目目录: ${CONFIG.PROJECTS_DIR}`);

  // 初始化数据库
  await initMainDatabase();
  console.log('数据库已初始化');

  // 创建 Express 应用
  const app = express();

  // 中间件
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // 日志中间件
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // API 路由
  app.use('/api/choreo', choreoApiRoutes);
  app.use('/api/shared', sharedApiRoutes);

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 创建 HTTP 服务器
  const server = http.createServer(app);

  // 初始化 WebSocket 服务
  const wsService = new WebSocketService(server);
  console.log('WebSocket 服务已初始化');
  
  // 连接Python执行器事件到WebSocket
  pythonExecutor.on('output', ({ executionId, data }) => {
    wsService.broadcast({
      type: 'execution_output',
      data: { executionId, output: data, timestamp: new Date().toISOString() },
    });
  });

  pythonExecutor.on('error', ({ executionId, error }) => {
    wsService.broadcast({
      type: 'execution_error',
      data: { executionId, error, timestamp: new Date().toISOString() },
    });
  });

  pythonExecutor.on('complete', ({ executionId, code }) => {
    wsService.broadcast({
      type: 'execution_complete',
      data: { executionId, code, timestamp: new Date().toISOString() },
    });
  });
  
  // 启动服务器
  server.listen(CONFIG.SERVER.PORT, CONFIG.SERVER.HOST, () => {
    console.log(`\n🚀 服务器正在运行!`);
    console.log(`   HTTP: http://${CONFIG.SERVER.HOST}:${CONFIG.SERVER.PORT}`);
    console.log(`   WebSocket: ws://${CONFIG.SERVER.HOST}:${CONFIG.SERVER.PORT}`);
    console.log(`\n   按 Ctrl+C 停止\n`);
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n正在关闭...');
    pythonExecutor.cleanup(); // 清理Python子进程
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('启动服务器失败:', error);
  process.exit(1);
});
