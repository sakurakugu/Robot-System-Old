import { createServer } from "http";
import { 应用程序 } from "./app";
import 配置 from "./config";
import { logger } from "./core/logger";

const 应用 = new 应用程序();
const HTTP服务 = createServer(应用.应用);

// 初始化WebSocket服务（不同角色使用不同路径）
const robotPath = 配置.ws.robotPath;
const phonePath = 配置.ws.phonePath;
const webPath = 配置.ws.webPath;

// 机器人连接通道
应用.WebSocket服务.init(HTTP服务, { path: `${robotPath}/business`, channel: "business" });
应用.WebSocket服务.init(HTTP服务, { path: `${robotPath}/audio/upload`, channel: "audio_upload" });
应用.WebSocket服务.init(HTTP服务, { path: `${robotPath}/audio/download`, channel: "audio_download" });

// 手机端连接通道
应用.WebSocket服务.init(HTTP服务, { path: `${phonePath}/business`, channel: "business" });

// 前端 Web 连接通道
应用.WebSocket服务.init(HTTP服务, { path: `${webPath}/business`, channel: "business" });
应用.WebSocket服务.init(HTTP服务, { path: `${webPath}/audio/upload`, channel: "audio_upload" });
应用.WebSocket服务.init(HTTP服务, { path: `${webPath}/audio/download`, channel: "audio_download" });

// 启动服务器
HTTP服务.listen(配置.port, () => {
  logger.info(`HTTP/REST/WebSocket 服务启动成功`, {
    port: 配置.port,
    env: process.env.NODE_ENV || "development",
    wsPaths: { robotPath, phonePath, webPath },
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
