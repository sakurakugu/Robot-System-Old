import { logger } from '../logger';
import { WebSocket连接注册表 } from './connection-registry';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

export interface WebSocket心跳管理器依赖 {
  连接注册表: WebSocket连接注册表;
  获取当前时间?(): number;
}

/**
 * 管理机器人连接的心跳超时检测，避免重复挂载定时器
 */
export class WebSocket心跳管理器 {
  private 心跳定时器: Map<string, NodeJS.Timeout> = new Map();
  private readonly 获取当前时间: () => number;

  constructor(private readonly 依赖: WebSocket心跳管理器依赖) {
    this.获取当前时间 = 依赖.获取当前时间 ?? (() => Date.now());
  }

  setupHeartbeat(robotId: string, channel: Channel): void {
    const key = this.构建键(robotId, channel);
    this.clearHeartbeat(robotId, channel);

    const interval = setInterval(() => {
      const connection = this.依赖.连接注册表.获取机器人连接(robotId, channel);
      if (!connection) {
        this.clearHeartbeat(robotId, channel);
        return;
      }

      const now = this.获取当前时间();
      const lastActive = connection.lastActiveAt.getTime();
      if (now - lastActive > 5 * 60 * 1000) {
        logger.warn('连接超时，自动断开', { robotId, channel });
        connection.websocket.close();
        this.clearHeartbeat(robotId, channel);
      }
    }, 60000);

    this.心跳定时器.set(key, interval);
  }

  clearHeartbeat(robotId: string, channel: Channel): void {
    const key = this.构建键(robotId, channel);
    const timer = this.心跳定时器.get(key);
    if (!timer) {
      return;
    }

    clearInterval(timer);
    this.心跳定时器.delete(key);
  }

  clearAll(): void {
    for (const timer of this.心跳定时器.values()) {
      clearInterval(timer);
    }
    this.心跳定时器.clear();
  }

  private 构建键(robotId: string, channel: Channel): string {
    return `${robotId}:${channel}`;
  }
}
