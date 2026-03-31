import type { RobotRecord, 音频路由配置 } from '../../features/机器人管理/types';
import type { ServerMessage } from '../../shared/types';
import { logger } from '../logger';

export const 默认音频路由配置: 音频路由配置 = {
  mode: 'robot',
  targetPhoneDeviceId: null,
  fallback: 'robot',
  updatedAt: '',
};

export interface 音频路由网关依赖 {
  获取机器人记录(robotId: string): Promise<RobotRecord | undefined>;
  解析活跃手机会话(robotId: string, phoneDeviceId: string): string | undefined;
  发送到机器人(robotId: string, message: ServerMessage, channel: 'audio_download'): boolean;
  定向发送到UI(
    robotId: string,
    phoneSessionId: string,
    message: ServerMessage,
    channel: 'audio_download',
  ): boolean;
}

/**
 * 负责读取机器人音频路由配置，并按策略分发音频下载消息
 */
export class 音频路由网关 {
  constructor(private readonly 依赖: 音频路由网关依赖) {}

  async getAudioRouteConfig(robotId: string): Promise<音频路由配置> {
    const robot = await this.依赖.获取机器人记录(robotId);
    const raw = robot?.audio_route_config;
    if (!raw) {
      return 默认音频路由配置;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<音频路由配置>;
      return {
        mode: parsed.mode === 'phone' || parsed.mode === 'mute' ? parsed.mode : 'robot',
        targetPhoneDeviceId: typeof parsed.targetPhoneDeviceId === 'string' && parsed.targetPhoneDeviceId.trim()
          ? parsed.targetPhoneDeviceId.trim()
          : null,
        fallback: parsed.fallback === 'drop' ? 'drop' : 'robot',
        updatedAt: parsed.updatedAt || '',
      };
    } catch {
      return 默认音频路由配置;
    }
  }

  sendAudioMessageByRoute(robotId: string, route: 音频路由配置, message: ServerMessage): void {
    if (route.mode === 'mute') {
      return;
    }

    if (route.mode === 'robot') {
      this.依赖.发送到机器人(robotId, message, 'audio_download');
      return;
    }

    const phoneDeviceId = route.targetPhoneDeviceId;
    if (!phoneDeviceId) {
      this.发送回退消息(robotId, message, route.fallback, '未配置目标手机');
      return;
    }

    const sessionId = this.依赖.解析活跃手机会话(robotId, phoneDeviceId);
    if (!sessionId) {
      this.发送回退消息(robotId, message, route.fallback, '目标手机不在线');
      return;
    }

    const sent = this.依赖.定向发送到UI(robotId, sessionId, message, 'audio_download');
    if (!sent) {
      this.发送回退消息(robotId, message, route.fallback, '目标会话无可用连接');
    }
  }

  shouldSendFinalAudioResponse(robotId: string, route: 音频路由配置): boolean {
    if (route.mode !== 'phone') {
      return true;
    }

    const phoneDeviceId = route.targetPhoneDeviceId;
    if (!phoneDeviceId) {
      return route.fallback === 'robot';
    }

    const activeSession = this.依赖.解析活跃手机会话(robotId, phoneDeviceId);
    if (activeSession) {
      return false;
    }

    return route.fallback === 'robot';
  }

  private 发送回退消息(
    robotId: string,
    message: ServerMessage,
    fallback: 'drop' | 'robot',
    reason: string,
  ): void {
    if (fallback === 'robot') {
      logger.info('音频路由回退到机器狗', { robotId, reason });
      this.依赖.发送到机器人(robotId, message, 'audio_download');
      return;
    }

    logger.info('音频路由丢弃', { robotId, reason });
  }
}
