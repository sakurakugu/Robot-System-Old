import fs from 'fs';
import path from 'path';
import winston from 'winston';
import 配置 from '../../config';

const LEVEL_NAME_CN: Record<string, string> = {
  debug: '调试',
  info: '信息',
  warn: '警告',
  error: '错误',
};

const LEVEL_COLOR: Record<string, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const RESET_COLOR = '\x1b[0m';

function 获取中文等级(level: string): string {
  const key = level.toLowerCase();
  return LEVEL_NAME_CN[key] ?? level;
}

function 格式化本地时间(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  return `${hh}:${mm}:${ss}.${ms}`;
}

function 格式化文件时间(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offH = pad(Math.floor(abs / 60));
  const offM = pad(abs % 60);
  let iso = `${year}-${month}-${day}T${hh}:${mm}:${ss}.${ms}${sign}${offH}:${offM}`;
  if (iso.endsWith('Z') || iso.endsWith('z')) {
    iso = iso.slice(0, -1) + '+00:00';
  }
  return iso;
}

function 解析控制台输出(): boolean {
  if (process.env.FORCE_CONSOLE_LOGS === '1') {
    return true;
  }
  return Boolean(process.stdout?.isTTY || process.stderr?.isTTY);
}

function 构建元数据(rest: Record<string, any>): string {
  const cleaned = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(cleaned).length === 0) {
    return '';
  }
  return ` ${JSON.stringify(cleaned)}`;
}

/**
 * 日志服务
 */
class Logger {
  private 日志: winston.Logger;

  constructor() {
    const 日志目录 = 配置.logging.dir;

    // 确保日志目录存在
    if (!fs.existsSync(日志目录)) {
      fs.mkdirSync(日志目录, { recursive: true });
    }

    const 文件格式 = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.printf((信息) => {
        const { timestamp, level, message, service, ...rest } = 信息 as any;
        const time = 格式化文件时间(new Date(timestamp || Date.now()));
        const levelCN = 获取中文等级(level);
        const serviceTag = `${service ?? ''}`;
        const meta = 构建元数据(rest);
        return `[${time}] [${levelCN}] [${serviceTag}] ${message}${meta}`;
      })
    );

    const 控制台格式 = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.printf((信息) => {
        const { timestamp, level, message, service, ...rest } = 信息 as any;
        const time = 格式化本地时间(new Date(timestamp || Date.now()));
        const levelCN = 获取中文等级(level);
        const color = LEVEL_COLOR[level.toLowerCase()] ?? '';
        const coloredLevel = color ? `${color}${levelCN}${RESET_COLOR}` : `${levelCN}`;
        const serviceTag = `${service ?? ''}`;
        const meta = 构建元数据(rest);
        return `[${time}] [${coloredLevel}] [${serviceTag}] ${message}${meta}`;
      })
    );

    this.日志 = winston.createLogger({
      level: 配置.logging.level,
      format: 文件格式,
      defaultMeta: { service: 'robot-cloud' },
      transports: [
        new winston.transports.File({
          filename: path.join(日志目录, 'error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          format: 文件格式,
        }),
        new winston.transports.File({
          filename: path.join(日志目录, 'combined.log'),
          maxsize: 10 * 1024 * 1024,
          maxFiles: 10,
          format: 文件格式,
        }),
      ],
    });

    if (解析控制台输出()) {
      this.日志.add(
        new winston.transports.Console({
          format: 控制台格式,
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

  error(消息: string): void;
  error(消息: string, 错误: Error): void;
  error(消息: string, 错误: unknown): void;
  error(消息: string, 元数据: Record<string, any>): void;
  error(消息: string, 错误: Error, 元数据: Record<string, any>): void;
  error(
    消息: string,
    第二个?: Error | Record<string, any> | unknown,
    第三个?: Record<string, any>
  ): void {
    let 错误: Error | undefined;
    let 元数据: Record<string, any> | undefined;

    if (第二个 instanceof Error) {
      错误 = 第二个;
      元数据 = 第三个;
    } else if (第二个 && typeof 第二个 === 'object') {
      元数据 = 第二个 as Record<string, any>;
    } else if (第二个 !== undefined) {
      错误 = new Error(String(第二个));
    }

    this.日志.error(消息, {
      ...(错误 && {
        error: 错误.message,
        stack: 错误.stack,
      }),
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

export const logger = new Logger();

export default Logger;
