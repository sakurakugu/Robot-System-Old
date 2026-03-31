import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../logger';
import type { WebSocket升级请求 } from './ui-auth';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

export type WebSocket默认通道路径配置 = {
  robotPath: string;
  phonePath: string;
  webPath: string;
};

type UI鉴权接口 = {
  需要校验连接(pathname: string): boolean;
  已认证(request: WebSocket升级请求): Promise<boolean>;
};

export interface WebSocket服务端宿主依赖 {
  UI鉴权器: UI鉴权接口;
  处理连接(ws: WebSocket, req: IncomingMessage, channel: Channel): void;
}

/**
 * 管理 WebSocketServer 实例、upgrade 分发和通道初始化
 */
export class WebSocket服务端宿主 {
  private wssMap: Map<Channel, WebSocketServer> = new Map();
  private pathToChannelMap: Map<string, Channel> = new Map();
  private upgradeHandlerInstalled = false;

  constructor(private readonly 依赖: WebSocket服务端宿主依赖) {}

  init(server: Server, options: { path: string; channel: Channel }): void {
    const { path, channel } = options;
    const wss = new WebSocketServer({
      noServer: true,
    });

    wss.on('connection', (ws: WebSocket, req) => {
      this.依赖.处理连接(ws, req, channel);
    });

    this.wssMap.set(channel, wss);
    this.pathToChannelMap.set(path, channel);

    if (!this.upgradeHandlerInstalled) {
      this.upgradeHandlerInstalled = true;
      server.on('upgrade', (request, socket, head) => {
        void this.处理Upgrade请求(request, socket, head);
      });
    }

    logger.info('WebSocket服务已启动', { path, channel });
  }

  初始化默认通道(server: Server, 路径配置: WebSocket默认通道路径配置): void {
    const 通道路径组 = [
      { path: `${路径配置.robotPath}/business`, channel: 'business' as const },
      { path: `${路径配置.robotPath}/audio/upload`, channel: 'audio_upload' as const },
      { path: `${路径配置.robotPath}/audio/download`, channel: 'audio_download' as const },
      { path: `${路径配置.phonePath}/business`, channel: 'business' as const },
      { path: `${路径配置.phonePath}/audio/upload`, channel: 'audio_upload' as const },
      { path: `${路径配置.phonePath}/audio/download`, channel: 'audio_download' as const },
      { path: `${路径配置.webPath}/business`, channel: 'business' as const },
      { path: `${路径配置.webPath}/audio/upload`, channel: 'audio_upload' as const },
      { path: `${路径配置.webPath}/audio/download`, channel: 'audio_download' as const },
    ];

    for (const item of 通道路径组) {
      this.init(server, item);
    }
  }

  close(): void {
    for (const wss of this.wssMap.values()) {
      wss.close();
    }
    this.wssMap.clear();
    this.pathToChannelMap.clear();
    this.upgradeHandlerInstalled = false;
    logger.info('WebSocket服务已关闭');
  }

  private async 处理Upgrade请求(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    try {
      const pathname = new URL(request.url || '', `http://${this.获取请求主机(request)}`).pathname;
      const targetChannel = this.pathToChannelMap.get(pathname);

      if (!targetChannel) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      if (this.依赖.UI鉴权器.需要校验连接(pathname) && !(await this.依赖.UI鉴权器.已认证(request))) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const targetWss = this.wssMap.get(targetChannel);
      if (!targetWss) {
        socket.destroy();
        return;
      }

      targetWss.handleUpgrade(request, socket, head, (ws) => {
        targetWss.emit('connection', ws, request);
      });
    } catch (error) {
      logger.error('处理 WebSocket upgrade 失败', error as Error);
      try {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      } catch {
        // 忽略写回失败
      }
      socket.destroy();
    }
  }

  private 获取请求主机(request: IncomingMessage): string {
    const host = request.headers.host;
    if (Array.isArray(host)) {
      return host[0] || 'localhost';
    }
    return host || 'localhost';
  }
}
