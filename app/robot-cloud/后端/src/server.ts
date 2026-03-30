import { spawn } from "child_process";
import { createServer } from "http";
import path from "path";
import { 应用程序 } from "./app";
import 配置 from "./config";
import { logger } from "./core/logger";

function 执行子进程(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const 子进程 = spawn(command, args, {
      stdio: "inherit",
      cwd,
    });

    子进程.once("error", reject);
    子进程.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`子进程退出码异常: ${code ?? "unknown"}`));
    });
  });
}

async function 执行数据库迁移(): Promise<void> {
  const 脚本路径 = path.resolve(__dirname, "../scripts/node-pg-migrate.cjs");
  logger.info("开始执行数据库迁移...");
  await 执行子进程(process.execPath, [脚本路径, "up"], path.resolve(__dirname, ".."));
  logger.info("数据库迁移执行完成");
}

async function main(): Promise<void> {
  await logger.初始化();
  await 执行数据库迁移();

  const 应用 = await 应用程序.create();
  const HTTP服务 = createServer(应用.应用);

  // 初始化WebSocket服务（不同角色使用不同路径）
  const robotPath = 配置.ws.robotPath;
  const phonePath = 配置.ws.phonePath;
  const webPath = 配置.ws.webPath;
  应用.WebSocket服务.初始化默认通道(HTTP服务, { robotPath, phonePath, webPath });

  // 启动服务器
  HTTP服务.listen(配置.port, () => {
    logger.info("HTTP/REST/WebSocket 服务启动成功", {
      port: 配置.port,
      env: process.env.NODE_ENV || "development",
      wsPaths: { robotPath, phonePath, webPath },
    });
  });

  // 优雅关闭
  let 正在关闭 = false;

  const 优雅关闭 = (信号: string) => {
    if (正在关闭) {
      return;
    }
    正在关闭 = true;

    logger.info(`收到${信号}信号，正在关闭服务器...`);
    HTTP服务.close(async () => {
      try {
        await 应用.close();
        logger.info("服务器已关闭");
        process.exit(0);
      } catch (错误) {
        logger.error("关闭应用资源失败", 错误 as Error);
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => {
    优雅关闭("SIGINT");
  });

  process.on("SIGTERM", () => {
    优雅关闭("SIGTERM");
  });
}

void main().catch((错误) => {
  logger.error("服务启动失败", 错误 as Error);
  process.exit(1);
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
