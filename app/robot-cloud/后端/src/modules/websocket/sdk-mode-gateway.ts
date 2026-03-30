import { logger } from '../../core/logger';
import { uuidv7 } from '../../core/utils/helpers';
import type { SdkModeResponseMessage, SdkModeSetMessage, ServerMessage } from '../../types';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';
type SDK模式设置数据 = SdkModeSetMessage['data'];
type SDK模式响应数据 = SdkModeResponseMessage['data'];

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

  async handleSdkModeSet(robotId: string, data: SDK模式设置数据): Promise<void> {
    try {
      const sdkMode = this.解析SDK模式(data);
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
    } catch (error) {
      logger.error('处理SDK模式设置失败', this.转成错误对象(error), { robotId });
      this.依赖.发送错误(robotId, 'SDK_MODE_ERROR', this.提取错误消息(error, 'SDK模式设置失败'), 'business');
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
    } catch (error) {
      logger.error('处理SDK模式获取失败', this.转成错误对象(error), { robotId });
      this.依赖.发送错误(robotId, 'SDK_MODE_ERROR', this.提取错误消息(error, 'SDK模式获取失败'), 'business');
    }
  }

  async handleSdkModeResponse(robotId: string, data: SDK模式响应数据): Promise<void> {
    try {
      const 规范化数据 = this.规范化SDK模式响应(data);
      logger.info('收到SDK模式响应，转发到UI', { robotId, data: 规范化数据 });
      this.依赖.发送到UI(robotId, {
        type: 'sdk_mode_response',
        robotId,
        timestamp: Date.now(),
        data: 规范化数据,
      }, 'business');
    } catch (error) {
      logger.error('处理SDK模式响应失败', this.转成错误对象(error), { robotId });
    }
  }

  private 解析SDK模式(data: SDK模式设置数据): boolean | undefined {
    if (typeof data?.sdkMode === 'boolean') {
      return data.sdkMode;
    }

    if (typeof data?.mode === 'number') {
      return data.mode !== 0;
    }

    return undefined;
  }

  private 规范化SDK模式响应(data: SDK模式响应数据): SDK模式响应数据 {
    const sdkMode = this.解析SDK模式(data);
    return sdkMode === undefined ? data : { ...data, sdkMode };
  }

  private 转成错误对象(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private 提取错误消息(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
