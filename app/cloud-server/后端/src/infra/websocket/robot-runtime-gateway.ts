import type { RobotRecord } from '../../features/机器人管理/types';
import type {
  RobotConnection,
  RobotRegisterMessage,
  ServerMessage,
  StatusMessage,
} from '../../shared/types';
import { logger } from '../logger';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';
type 机器人状态消息 = Pick<StatusMessage, 'robotId' | 'data'> & Partial<Pick<StatusMessage, 'timestamp'>>;
type 机器人注册数据 = RobotRegisterMessage['data'];

export interface WebSocket机器人运行网关依赖 {
  获取机器人记录(robotId: string): Promise<RobotRecord | undefined>;
  更新机器人记录(robotId: string, data: Partial<RobotRecord>): Promise<void>;
  新增或更新机器人记录(data: Partial<RobotRecord> & { uuid: string }): Promise<void>;
  获取业务连接(robotId: string): RobotConnection | undefined;
  发送到机器人(robotId: string, message: ServerMessage, channel: Channel): boolean;
  发送到UI(robotId: string, message: ServerMessage, channel: Channel): void;
  发送错误(robotId: string, code: string, message: string, channel: Channel): void;
}

/**
 * 管理机器人运行时状态同步、注册和状态广播
 */
export class WebSocket机器人运行网关 {
  constructor(private readonly 依赖: WebSocket机器人运行网关依赖) {}

  async 同步机器人在线状态(robotId: string): Promise<void> {
    try {
      const existing = await this.依赖.获取机器人记录(robotId);
      if (existing) {
        await this.依赖.更新机器人记录(robotId, { status: 'online' });
      } else {
        await this.依赖.新增或更新机器人记录({
          uuid: robotId,
          status: 'online',
        });
      }
    } catch (error) {
      logger.error(
        '同步机器人在线状态失败',
        error instanceof Error ? error : new Error(String(error)),
        { robotId },
      );
    }
  }

  async 标记机器人离线(robotId: string): Promise<void> {
    try {
      await this.依赖.更新机器人记录(robotId, { status: 'offline' });
    } catch (error) {
      logger.error(
        '更新机器人离线状态失败',
        error instanceof Error ? error : new Error(String(error)),
        { robotId },
      );
    }
  }

  handleHeartbeat(robotId: string): void {
    logger.debug('收到心跳', { robotId });
  }

  handleStatus(robotId: string, msg: 机器人状态消息): void {
    const payload = {
      robotId: msg.robotId || robotId,
      timestamp: msg.timestamp,
      data: msg.data || {},
    };
    logger.debug('收到状态更新', { robotId, payload });

    try {
      const levelNum = this.解析电量(payload.data.battery ?? payload.data.level);
      if (levelNum !== undefined) {
        this.依赖.发送到UI(payload.robotId || robotId, {
          type: 'battery_status',
          robotId: payload.robotId || robotId,
          timestamp: Date.now(),
          data: {
            level: Math.round(levelNum),
          },
        }, 'control');
      }
    } catch (error) {
      logger.error('广播电量状态失败', this.转成错误对象(error), { robotId });
    }

    try {
      this.依赖.发送到UI(payload.robotId || robotId, {
        type: 'status_update',
        robotId: payload.robotId || robotId,
        timestamp: Date.now(),
        data: payload.data || {},
      }, 'control');
    } catch (error) {
      logger.error('广播状态更新失败', this.转成错误对象(error), { robotId });
    }
  }

  async handleRobotRegister(robotId: string, data: 机器人注册数据): Promise<void> {
    logger.info('收到机器人注册', { robotId, data });

    try {
      const { name, model, version } = data;
      const metadata = data?.metadata && typeof data.metadata === 'object' ? data.metadata : {};
      const agentVersion = typeof version === 'string' && version ? version : metadata.agent_version;
      const motionControlVersion =
        typeof metadata.motion_control_version === 'string' ? metadata.motion_control_version : undefined;
      const robotServerVersion =
        typeof metadata.robot_server_version === 'string' ? metadata.robot_server_version : undefined;

      const robot = await this.依赖.获取机器人记录(robotId);

      await this.依赖.新增或更新机器人记录({
        uuid: robotId,
        name: name || robot?.name || null,
        model: model || robot?.model || null,
        version: agentVersion || robot?.version || null,
        motion_control_version: motionControlVersion || robot?.motion_control_version || null,
        server_version: robotServerVersion || robot?.server_version || null,
        status: 'online',
        last_connected_at: new Date().toISOString(),
      });

      const connection = this.依赖.获取业务连接(robotId);
      if (connection) {
        connection.metadata = {
          name: name || connection.metadata.name,
          model: model || connection.metadata.model,
          version: agentVersion || connection.metadata.version,
          motion_control_version: motionControlVersion || connection.metadata.motion_control_version,
          robot_server_version: robotServerVersion || connection.metadata.robot_server_version,
        };
      }

      logger.info('客户端注册成功', {
        robotId,
        name,
        model,
        agentVersion,
        motionControlVersion,
        robotServerVersion,
      });

      this.依赖.发送到机器人(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        data: {
          text: `客户端注册成功！欢迎 ${name || '机器狗'}`,
        },
      }, 'business');
    } catch (error) {
      logger.error('处理客户端注册失败', this.转成错误对象(error), { robotId });
      this.依赖.发送错误(robotId, 'REGISTER_ERROR', this.提取错误消息(error, '机器人注册失败'), 'business');
    }
  }

  private 解析电量(value: unknown): number | undefined {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  }

  private 转成错误对象(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private 提取错误消息(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
