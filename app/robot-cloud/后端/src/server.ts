import { createServer } from 'http';
import { 应用程序 } from './app';
import 配置 from './config';

const 应用 = new 应用程序();
const HTTP服务器 = createServer(应用.应用);
const 控制服务器 = createServer();
const 业务服务器 = createServer();
const 音频上传服务器 = createServer();
const 音频下载服务器 = createServer();

// 初始化WebSocket服务（多端口拆分）
应用.网络套接字服务.init(控制服务器, { path: 配置.ws.path, channel: 'control' });
应用.网络套接字服务.init(业务服务器, { path: 配置.ws.path, channel: 'business' });
应用.网络套接字服务.init(音频上传服务器, { path: 配置.ws.path, channel: 'audio_upload' });
应用.网络套接字服务.init(音频下载服务器, { path: 配置.ws.path, channel: 'audio_download' });
if (配置.ws.path !== '/api/v1/interaction/connect') {
  应用.网络套接字服务.init(控制服务器, { path: '/api/v1/interaction/connect', channel: 'control' });
  应用.网络套接字服务.init(业务服务器, { path: '/api/v1/interaction/connect', channel: 'business' });
  应用.网络套接字服务.init(音频上传服务器, { path: '/api/v1/interaction/connect', channel: 'audio_upload' });
  应用.网络套接字服务.init(音频下载服务器, { path: '/api/v1/interaction/connect', channel: 'audio_download' });
}

// 启动服务器
HTTP服务器.listen(配置.ports.http, () => {
  应用.logger.info(`HTTP/REST 服务启动成功`, {
    port: 配置.ports.http,
    env: process.env.NODE_ENV || 'development',
  });
});

控制服务器.listen(配置.ports.control, () => {
  应用.logger.info(`控制通道服务启动成功`, {
    port: 配置.ports.control,
    wsPath: 配置.ws.path,
  });
});

业务服务器.listen(配置.ports.business, () => {
  应用.logger.info(`业务通道服务启动成功`, {
    port: 配置.ports.business,
    wsPath: 配置.ws.path,
  });
});

音频上传服务器.listen(配置.ports.audioUpload, () => {
  应用.logger.info(`音频上传通道服务启动成功`, {
    port: 配置.ports.audioUpload,
    wsPath: 配置.ws.path,
  });
});

音频下载服务器.listen(配置.ports.audioDownload, () => {
  应用.logger.info(`音频下载通道服务启动成功`, {
    port: 配置.ports.audioDownload,
    wsPath: 配置.ws.path,
  });
});

// 优雅关闭
process.on('SIGINT', () => {
  应用.logger.info('收到SIGINT信号，正在关闭服务器...');
  HTTP服务器.close(() => {
    控制服务器.close(() => {
      业务服务器.close(() => {
        音频上传服务器.close(() => {
          音频下载服务器.close(() => {
            应用.logger.info('服务器已关闭');
            process.exit(0);
          });
        });
      });
    });
  });
});

process.on('SIGTERM', () => {
  应用.logger.info('收到SIGTERM信号，正在关闭服务器...');
  HTTP服务器.close(() => {
    控制服务器.close(() => {
      业务服务器.close(() => {
        音频上传服务器.close(() => {
          音频下载服务器.close(() => {
            应用.logger.info('服务器已关闭');
            process.exit(0);
          });
        });
      });
    });
  });
});

// 未捕获的异常处理
process.on('uncaughtException', (错误) => {
  应用.logger.error('未捕获的异常', 错误);
  process.exit(1);
});

process.on('unhandledRejection', (原因: any) => {
  const 错误信息 = 原因?.message || String(原因);
  应用.logger.error('未处理的Promise拒绝', new Error(错误信息));
});

