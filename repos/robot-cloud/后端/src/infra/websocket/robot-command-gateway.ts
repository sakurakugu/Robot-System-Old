import type { RobotConnection } from '../../shared/types';
import { uuidv7 } from '../../shared/utils/helpers';
import {
  WebSocket请求响应跟踪器,
  type 可监听消息连接,
} from './request-response-tracker';

type 机器人命令请求消息 = {
  type: string;
  robotId: string;
  timestamp: number;
  data: Record<string, unknown>;
};

type 机器人请求等待选项 = {
  请求类型: string;
  响应类型: string;
  数据?: Record<string, unknown>;
  发送失败消息: string;
  超时毫秒: number;
  超时消息: string;
};

export type 机器人命令通用结果<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type 机器人音量数据 = {
  volume: number;
  muted: boolean;
};

export type 机器人音量结果 = 机器人命令通用结果<机器人音量数据>;

export type 机器人拍照结果 = {
  success: boolean;
  image?: string;
  format?: string;
  error?: string;
};

export type 机器人SDK模式结果 = {
  success: boolean;
  sdkMode?: boolean;
  error?: string;
};

export type 机器人日志标记结果 = {
  success: boolean;
  marker?: string;
  error?: string;
};

export type 机器人安装包下载路径 = {
  agent?: string;
  server?: string;
  common?: string;
};

export type 机器人安装包哈希 = {
  agent?: string;
  server?: string;
  common?: string;
};

export type 机器人安装包推送结果 = {
  success: boolean;
  downloaded?: string[];
  error?: string;
};

export interface 机器人命令服务接口 {
  请求机器人拍照(robotId: string): Promise<机器人拍照结果>;
  请求获取机器人音量(robotId: string): Promise<机器人音量结果>;
  请求设置机器人音量(robotId: string, volume: number): Promise<机器人命令通用结果>;
  请求设置机器人静音(robotId: string, mute: boolean): Promise<机器人命令通用结果>;
  请求获取机器人配置(robotId: string): Promise<机器人命令通用结果>;
  请求更新机器人配置(robotId: string, config: unknown): Promise<机器人命令通用结果>;
  请求设置SDK模式(robotId: string, sdkMode: boolean): Promise<机器人SDK模式结果>;
  请求获取SDK模式(robotId: string): Promise<机器人SDK模式结果>;
  请求日志标记(robotId: string, message?: string): Promise<机器人日志标记结果>;
  请求推送安装包(
    robotId: string,
    downloadPaths: 机器人安装包下载路径,
    hashes: 机器人安装包哈希,
  ): Promise<机器人安装包推送结果>;
}

export interface 机器人命令网关依赖 {
  获取业务连接(robotId: string): RobotConnection;
  发送消息(robotId: string, message: 机器人命令请求消息): boolean;
  请求响应跟踪器?: WebSocket请求响应跟踪器;
  生成请求ID?(): string;
  获取当前时间?(): number;
}

/**
 * 机器人命令请求/响应网关
 * 统一封装通过 business 通道发送命令并等待机器人响应的逻辑
 */
export class 机器人命令网关 implements 机器人命令服务接口 {
  private readonly 请求响应跟踪器: WebSocket请求响应跟踪器;
  private readonly 生成请求ID: () => string;
  private readonly 获取当前时间: () => number;

  constructor(private readonly 依赖: 机器人命令网关依赖) {
    this.请求响应跟踪器 = 依赖.请求响应跟踪器 ?? new WebSocket请求响应跟踪器();
    this.生成请求ID = 依赖.生成请求ID ?? (() => uuidv7());
    this.获取当前时间 = 依赖.获取当前时间 ?? (() => Date.now());
  }

  private async 发送请求并等待机器人响应<T响应>(
    robotId: string,
    选项: 机器人请求等待选项,
  ): Promise<T响应> {
    const connection = this.依赖.获取业务连接(robotId);
    const requestId = this.生成请求ID();

    const success = this.依赖.发送消息(robotId, {
      type: 选项.请求类型,
      robotId,
      timestamp: this.获取当前时间(),
      data: {
        requestId,
        ...(选项.数据 || {}),
      },
    });

    if (!success) {
      throw new Error(选项.发送失败消息);
    }

    return this.请求响应跟踪器.等待响应<T响应>(this.获取可监听连接(connection), {
      超时毫秒: 选项.超时毫秒,
      超时消息: 选项.超时消息,
      连接关闭消息: '机器人连接已关闭',
      匹配器: (message) => {
        if (message.type !== 选项.响应类型) {
          return undefined;
        }

        const data = message.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          return undefined;
        }

        if ((data as Record<string, unknown>).requestId !== requestId) {
          return undefined;
        }

        return data as T响应;
      },
    });
  }

  private 获取可监听连接(connection: RobotConnection): 可监听消息连接 {
    const { websocket } = connection;
    if (!websocket.on || !websocket.off) {
      throw new Error('机器人连接不支持响应监听');
    }

    return {
      on: websocket.on.bind(websocket),
      off: websocket.off.bind(websocket),
    };
  }

  请求机器人拍照(robotId: string): Promise<机器人拍照结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'camera_capture',
      响应类型: 'camera_response',
      发送失败消息: '发送拍照命令失败',
      超时毫秒: 30000,
      超时消息: '拍照请求超时',
    });
  }

  请求获取机器人音量(robotId: string): Promise<机器人音量结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'volume_get',
      响应类型: 'volume_response',
      发送失败消息: '发送获取音量命令失败',
      超时毫秒: 30000,
      超时消息: '获取音量请求超时',
    });
  }

  请求设置机器人音量(robotId: string, volume: number): Promise<机器人命令通用结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'volume_set',
      响应类型: 'volume_response',
      数据: { volume },
      发送失败消息: '发送设置音量命令失败',
      超时毫秒: 30000,
      超时消息: '设置音量请求超时',
    });
  }

  请求设置机器人静音(robotId: string, mute: boolean): Promise<机器人命令通用结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'volume_mute',
      响应类型: 'volume_response',
      数据: { mute },
      发送失败消息: '发送设置静音命令失败',
      超时毫秒: 30000,
      超时消息: '设置静音请求超时',
    });
  }

  请求获取机器人配置(robotId: string): Promise<机器人命令通用结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'config_get',
      响应类型: 'config_response',
      发送失败消息: '发送获取配置命令失败',
      超时毫秒: 30000,
      超时消息: '获取配置请求超时',
    });
  }

  请求更新机器人配置(
    robotId: string,
    config: unknown,
  ): Promise<机器人命令通用结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'config_update',
      响应类型: 'config_response',
      数据: { config },
      发送失败消息: '发送更新配置命令失败',
      超时毫秒: 30000,
      超时消息: '更新配置请求超时',
    });
  }

  请求设置SDK模式(robotId: string, sdkMode: boolean): Promise<机器人SDK模式结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'sdk_mode_set',
      响应类型: 'sdk_mode_response',
      数据: { sdkMode },
      发送失败消息: '发送设置SDK模式命令失败',
      超时毫秒: 30000,
      超时消息: '设置SDK模式请求超时',
    });
  }

  请求获取SDK模式(robotId: string): Promise<机器人SDK模式结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'sdk_mode_get',
      响应类型: 'sdk_mode_response',
      发送失败消息: '发送获取SDK模式命令失败',
      超时毫秒: 30000,
      超时消息: '获取SDK模式请求超时',
    });
  }

  请求日志标记(robotId: string, message: string = ''): Promise<机器人日志标记结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'log_mark',
      响应类型: 'log_mark_response',
      数据: { message },
      发送失败消息: '发送日志标记命令失败',
      超时毫秒: 10000,
      超时消息: '日志标记请求超时',
    });
  }

  请求推送安装包(
    robotId: string,
    downloadPaths: 机器人安装包下载路径,
    hashes: 机器人安装包哈希,
  ): Promise<机器人安装包推送结果> {
    return this.发送请求并等待机器人响应(robotId, {
      请求类型: 'package_download',
      响应类型: 'package_download_response',
      数据: { downloadPaths, hashes },
      发送失败消息: '发送推送安装包命令失败',
      超时毫秒: 300000,
      超时消息: '推送安装包请求超时',
    });
  }
}
