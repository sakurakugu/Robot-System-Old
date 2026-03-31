import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import type { RobotConnection, ServerMessage } from '../../shared/types';
import { isValidRobotId, uuidv7 } from '../../shared/utils/helpers';
import { logger } from '../logger';
import { WebSocket连接注册表 } from './connection-registry';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

export interface WebSocket连接生命周期管理器依赖 {
  连接注册表: WebSocket连接注册表;
  记录机器人初始化任务(robotId: string, task: Promise<void>): void;
  同步机器人在线状态(robotId: string): Promise<void>;
  标记机器人离线(robotId: string): Promise<void>;
  处理消息(
    robotId: string,
    data: Buffer,
    channel: Channel,
    ws?: WebSocket,
    role?: string,
  ): Promise<void>;
  发送到机器人(robotId: string, message: ServerMessage, channel: Channel): boolean;
  开始心跳检测(robotId: string, channel: Channel): void;
  停止心跳检测(robotId: string, channel: Channel): void;
}

/**
 * 负责处理 WebSocket 连接建立、关闭和连接期事件绑定
 */
export class WebSocket连接生命周期管理器 {
  constructor(private readonly 依赖: WebSocket连接生命周期管理器依赖) {}

  handleConnection(ws: WebSocket, req: IncomingMessage, channel: Channel): void {
    const 上下文 = this.解析连接上下文(req);
    let { robotId, role } = 上下文;

    if (上下文.isPhoneSession) {
      robotId = 上下文.phoneId!;
    } else if (!robotId || !isValidRobotId(robotId)) {
      robotId = uuidv7();
      logger.info('生成新的机器狗ID', { robotId });
    }

    if (role === 'ui') {
      const uiCount = this.依赖.连接注册表.注册UI连接(robotId, channel, ws, {
        phoneSessionId: 上下文.phoneSessionId,
        phoneDeviceId: 上下文.phoneDeviceId,
      });
      logger.info('UI连接建立', {
        robotId,
        channel,
        uiCount,
        phoneSessionId: 上下文.phoneSessionId,
        phoneDeviceId: 上下文.phoneDeviceId,
      });
    } else {
      const existingConnection = this.依赖.连接注册表.获取机器人连接(robotId, channel);
      if (existingConnection && existingConnection.websocket !== ws) {
        logger.info('关闭旧的机器人连接', { robotId, channel });
        try {
          existingConnection.websocket.close(1000, '新连接已建立');
        } catch {
          // 忽略关闭错误
        }
      }

      const connection: RobotConnection = {
        robotId,
        websocket: ws,
        connectedAt: new Date(),
        lastActiveAt: new Date(),
        metadata: {},
        channel,
      };
      this.依赖.连接注册表.替换机器人连接(robotId, channel, connection);
    }

    if (role !== 'ui' && !上下文.isPhoneSession) {
      this.依赖.记录机器人初始化任务(robotId, this.依赖.同步机器人在线状态(robotId));
    }

    if (上下文.isPhoneSession) {
      logger.info('手机端独立连接建立', {
        phoneId: robotId,
        channel,
        ip: req.socket.remoteAddress,
        role: role || 'ui',
      });
    } else if (role !== 'ui') {
      logger.info('机器人连接建立', {
        robotId,
        channel,
        ip: req.socket.remoteAddress,
        role: role || 'robot',
      });
    }

    if (role !== 'ui' && channel === 'business') {
      this.依赖.发送到机器人(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        data: {
          text: `连接成功！你的机器狗ID是: ${robotId}`,
        },
      }, channel);
    }

    ws.on('message', (data: Buffer) => {
      void this.依赖.处理消息(robotId, data, channel, ws, role);
    });

    ws.on('close', () => {
      if (role === 'ui') {
        this.依赖.连接注册表.移除UI连接(robotId, channel, ws);
        logger.info('UI连接关闭', { robotId, channel });
        return;
      }

      this.handleDisconnection(robotId, channel, ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket错误', error, { robotId });
    });

    if (role !== 'ui') {
      this.依赖.开始心跳检测(robotId, channel);
    }
  }

  handleDisconnection(robotId: string, channel: Channel, ws: WebSocket): void {
    this.依赖.停止心跳检测(robotId, channel);

    const 结果 = this.依赖.连接注册表.移除机器人连接(robotId, channel, ws);
    if (!结果.已移除) {
      return;
    }

    if (结果.已完全断开) {
      void this.依赖.标记机器人离线(robotId);
      logger.info('机器人连接断开', { robotId, channel });
    }
  }

  private 解析连接上下文(req: IncomingMessage): {
    robotId: string | null;
    role: string;
    phoneId?: string;
    phoneSessionId?: string;
    phoneDeviceId?: string;
    isPhoneSession: boolean;
  } {
    const url = new URL(req.url || '', `http://${this.获取请求主机(req)}`);
    let robotId = url.searchParams.get('robotId');
    let role = (url.searchParams.get('role') || '').toLowerCase();

    if (url.pathname.includes('/api/v1/robot')) {
      role = 'robot';
    } else if (url.pathname.includes('/api/v1/web') || url.pathname.includes('/api/v1/phone')) {
      role = 'ui';
    }

    const phoneId = url.searchParams.get('phoneId') || undefined;
    const phoneSessionId = url.searchParams.get('phoneSessionId') || phoneId || undefined;
    const rawPhoneDeviceId = url.searchParams.get('phoneDeviceId') || undefined;
    const phoneDeviceId = rawPhoneDeviceId?.trim() || undefined;
    const isPhoneSession = !!(phoneId && role === 'ui');

    return {
      robotId,
      role,
      phoneId,
      phoneSessionId,
      phoneDeviceId,
      isPhoneSession,
    };
  }

  private 获取请求主机(req: IncomingMessage): string {
    const host = req.headers.host;
    if (Array.isArray(host)) {
      return host[0] || 'localhost';
    }
    return host || 'localhost';
  }
}
