import { createServer } from "http";
import { 应用程序 } from "./app";
import 配置 from "./config";
import { logger } from "./core/logger";

const 应用 = new 应用程序();
const HTTP服务 = createServer(应用.应用);

// 初始化WebSocket服务（单端口，不同路径）
const basePath = 配置.ws.path || "/api/v1/interaction/connect";
应用.WebSocket服务.init(HTTP服务, { path: `${basePath}/control`, channel: "control", });
应用.WebSocket服务.init(HTTP服务, { path: `${basePath}/business`, channel: "business", });
应用.WebSocket服务.init(HTTP服务, { path: `${basePath}/audio_upload`, channel: "audio_upload", });
应用.WebSocket服务.init(HTTP服务, { path: `${basePath}/audio_download`, channel: "audio_download", });

// 启动服务器
HTTP服务.listen(配置.port, () => {
  logger.info(`HTTP/REST/WebSocket 服务启动成功`, {
    port: 配置.port,
    env: process.env.NODE_ENV || "development",
    wsBasePath: basePath,
  });
});

// 优雅关闭
process.on("SIGINT", () => {
  logger.info("收到SIGINT信号，正在关闭服务器...");
  HTTP服务.close(() => {
    logger.info("服务器已关闭");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  logger.info("收到SIGTERM信号，正在关闭服务器...");
  HTTP服务.close(() => {
    logger.info("服务器已关闭");
    process.exit(0);
  });
});

// 未捕获的异常处理
process.on("uncaughtException", (错误) => {
  logger.error("未捕获的异常", 错误);
  process.exit(1);
});

process.on("unhandledRejection", (原因: any) => {
  const 错误信息 = 原因?.message || String(原因);
  logger.error("未处理的Promise拒绝", new Error(错误信息));
});
