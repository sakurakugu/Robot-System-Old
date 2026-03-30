import { logger } from '../../core/logger';
import { uuidv7 } from '../../core/utils/helpers';
import type { ServerMessage } from '../../types';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

export interface WebSocketSDK模式网关依赖 {
  发送到机器人(robotId: string, message: ServerMessage, channel: Channel): boolean;
  发送到UI(robotId: string, message: ServerMessage, channel: Channel): void;
  发送错误(robotId: string, code: string, message: string, channel: Channel): void;
}

/**
 * 处理 UI 发起的 SDK 模式控制与机器人返回的 SDK 模式响应
 */
export class WebSocketSDK模式网关 {
  constructor(private readonly 依赖: WebSocketSDK模式网关依赖) {}

  async handleSdkModeSet(robotId: string, data: any): Promise<void> {
    try {
      const sdkMode = data?.sdkMode;
      logger.info('收到SDK模式设置请求', { robotId, sdkMode });

      const requestId = uuidv7();
      const success = this.依赖.发送到机器人(robotId, {
        type: 'sdk_mode_set',
        robotId,
        timestamp: Date.now(),
        data: { requestId, sdkMode },
      }, 'business');

      if (!success) {
        this.依赖.发送错误(robotId, 'ROBOT_OFFLINE', '机器人未连接', 'business');
      }
    } catch (error: any) {
      logger.error('处理SDK模式设置失败', error, { robotId });
      this.依赖.发送错误(robotId, 'SDK_MODE_ERROR', error.message || 'SDK模式设置失败', 'business');
    }
  }

  async handleSdkModeGet(robotId: string): Promise<void> {
    try {
      logger.info('收到SDK模式获取请求', { robotId });

      const requestId = uuidv7();
      const success = this.依赖.发送到机器人(robotId, {
        type: 'sdk_mode_get',
        robotId,
        timestamp: Date.now(),
        data: { requestId },
      }, 'business');

      if (!success) {
        this.依赖.发送错误(robotId, 'ROBOT_OFFLINE', '机器人未连接', 'business');
      }
    } catch (error: any) {
      logger.error('处理SDK模式获取失败', error, { robotId });
      this.依赖.发送错误(robotId, 'SDK_MODE_ERROR', error.message || 'SDK模式获取失败', 'business');
    }
  }

  async handleSdkModeResponse(robotId: string, data: any): Promise<void> {
    try {
      logger.info('收到SDK模式响应，转发到UI', { robotId, data });
      this.依赖.发送到UI(robotId, {
        type: 'sdk_mode_response',
        robotId,
        timestamp: Date.now(),
        data,
      }, 'business');
    } catch (error: any) {
      logger.error('处理SDK模式响应失败', error, { robotId });
    }
  }
}
