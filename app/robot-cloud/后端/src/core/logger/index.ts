import fs from 'fs';
import path from 'path';
import winston from 'winston';
import 配置 from '../../config';

/**
 * 日志服务
 */
class 日志器 {
  private 日志: winston.Logger;

  constructor() {
    const 日志目录 = 配置.logging.dir;

    // 确保日志目录存在
    if (!fs.existsSync(日志目录)) {
      fs.mkdirSync(日志目录, { recursive: true });
    }

    this.日志 = winston.createLogger({
      level: 配置.logging.level,
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DDTHH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.printf((信息) => {
          const { timestamp, level, message, service, ...rest } = 信息 as any;
          const 现在 = new Date();
          const 偏移分钟 = -现在.getTimezoneOffset();
          const 符号 = 偏移分钟 >= 0 ? '+' : '-';
          const 绝对值 = Math.abs(偏移分钟);
          const 小时 = String(Math.floor(绝对值 / 60)).padStart(2, '0');
          const 分钟 = String(绝对值 % 60).padStart(2, '0');
          const 时间戳 = `${timestamp}${符号}${小时}:${分钟}`;
          const 排序后 = {
            timestamp: 时间戳,
            level,
            message,
            service,
            ...rest,
          };
          return JSON.stringify(排序后);
        })
      ),
      defaultMeta: { service: 'robot-cloud' },
      transports: [
        new winston.transports.File({
          filename: path.join(日志目录, 'error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(日志目录, 'combined.log'),
          maxsize: 10 * 1024 * 1024,
          maxFiles: 10,
        }),
      ],
    });

    // 开发环境输出到控制台
    if (配置.nodeEnv !== 'production') {
      this.日志.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        })
      );
    }
  }

  info(消息: string, 元数据?: any): void {
    this.日志.info(消息, 元数据);
  }

  warn(消息: string, 元数据?: any): void {
    this.日志.warn(消息, 元数据);
  }

  error(消息: string, 错误?: Error, 元数据?: any): void {
    this.日志.error(消息, {
      error: 错误?.message,
      stack: 错误?.stack,
      ...元数据,
    });
  }

  debug(消息: string, 元数据?: any): void {
    this.日志.debug(消息, 元数据);
  }

  /**
   * 记录对话日志
   */
  记录对话(数据: {
    robotId: string;
    input: string;
    output: string;
    processingTime: number;
    actions?: any[];
  }): void {
    this.info('对话记录', {
      type: 'interaction',
      ...数据,
    });
  }

  /**
   * 记录动作日志
   */
  记录动作(数据: {
    robotId: string;
    action: string;
    parameters: any;
    status: string;
  }): void {
    this.info('动作执行', {
      type: 'action',
      ...数据,
    });
  }
}

export default 日志器;
