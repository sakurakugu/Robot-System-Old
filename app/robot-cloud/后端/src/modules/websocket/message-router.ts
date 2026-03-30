import { logger } from '../../core/logger';
import type { ClientMessage } from '../../types';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';
type WebSocket角色 = string | undefined;

export interface WebSocket消息路由器依赖 {
  等待机器人初始化完成(robotId: string): Promise<void>;
  刷新UI会话活跃时间(ws: object): void;
  更新机器人活跃时间(robotId: string, channel: Channel): void;
  发送错误(robotId: string, code: string, message: string, channel: Channel): void;
  处理文本输入(robotId: string, text: string, ttsOptions?: any, conversationId?: string): Promise<void>;
  处理TTS输入(robotId: string, text: string, ttsOptions?: any, conversationId?: string): Promise<void>;
  处理音频控制(robotId: string, data: any): Promise<void>;
  处理音频开始(robotId: string, data: any): Promise<void>;
  处理音频块(robotId: string, data: any): Promise<void>;
  处理音频结束(robotId: string, data: any): Promise<void>;
  处理心跳(robotId: string): void;
  处理状态(robotId: string, msg: any): void;
  处理机器人注册(robotId: string, data: any): Promise<void>;
  处理动作输入(robotId: string, action: string, parameters?: Record<string, any>): Promise<void>;
  处理控制输入(robotId: string, data: any): Promise<void>;
  处理SDK模式设置(robotId: string, data: any): Promise<void>;
  处理SDK模式获取(robotId: string): Promise<void>;
  处理SDK模式响应(robotId: string, data: any): Promise<void>;
}

/**
 * 负责 WebSocket 消息的协议校验、解析和分发
 */
export class WebSocket消息路由器 {
  private static readonly 允许消息类型: Record<Channel, Set<string>> = {
    control: new Set([]),
    business: new Set([
      'text_input',
      'tts_input',
      'action_input',
      'audio_control',
      'robot_register',
      'video_subscribe',
      'video_unsubscribe',
      'heartbeat',
      'status',
      'control_input',
      'camera_response',
      'sdk_mode_set',
      'sdk_mode_get',
      'sdk_mode_response',
      'volume_response',
      'config_response',
      'log_mark_response',
      'package_download_response',
    ]),
    audio_upload: new Set(['audio_start', 'audio_chunk', 'audio_end', 'heartbeat']),
    audio_download: new Set(['heartbeat']),
  };

  constructor(private readonly 依赖: WebSocket消息路由器依赖) {}

  async handleMessage(
    robotId: string,
    data: Buffer,
    channel: Channel,
    ws?: object,
    role?: WebSocket角色,
  ): Promise<void> {
    try {
      if (role !== 'ui') {
        await this.依赖.等待机器人初始化完成(robotId);
      }

      if (role === 'ui' && ws) {
        this.依赖.刷新UI会话活跃时间(ws);
      }

      const message: ClientMessage = JSON.parse(data.toString());
      if (!this.isAllowedMessageType(channel, (message as any).type)) {
        logger.warn('消息通道不匹配', { robotId, channel, type: (message as any).type });
        this.依赖.发送错误(robotId, 'CHANNEL_MISMATCH', '消息通道不匹配', channel);
        return;
      }

      this.依赖.更新机器人活跃时间(robotId, channel);

      switch (message.type) {
        case 'text_input':
          await this.依赖.处理文本输入(
            robotId,
            message.data.text,
            (message as any).data?.ttsOptions,
            (message as any).data?.conversationId || (message as any).conversationId,
          );
          break;
        case 'tts_input':
          await this.依赖.处理TTS输入(
            robotId,
            (message as any).data?.text,
            (message as any).data?.ttsOptions,
            (message as any).data?.conversationId || (message as any).conversationId,
          );
          break;
        case 'audio_control':
          await this.依赖.处理音频控制(robotId, (message as any).data);
          break;
        case 'audio_start':
          await this.依赖.处理音频开始(robotId, (message as any).data);
          break;
        case 'audio_chunk':
          await this.依赖.处理音频块(robotId, message.data);
          break;
        case 'audio_end':
          await this.依赖.处理音频结束(robotId, (message as any).data);
          break;
        case 'heartbeat':
          this.依赖.处理心跳(robotId);
          break;
        case 'status':
          this.依赖.处理状态(robotId, message);
          break;
        case 'robot_register':
          await this.依赖.处理机器人注册(robotId, message.data);
          break;
        case 'video_subscribe':
          break;
        case 'video_unsubscribe':
          break;
        case 'action_input':
          await this.依赖.处理动作输入(robotId, (message as any).data?.action, (message as any).data?.parameters);
          break;
        case 'control_input':
          await this.依赖.处理控制输入(robotId, (message as any).data);
          break;
        case 'sdk_mode_set':
          await this.依赖.处理SDK模式设置(robotId, (message as any).data);
          break;
        case 'sdk_mode_get':
          await this.依赖.处理SDK模式获取(robotId);
          break;
        case 'sdk_mode_response':
          await this.依赖.处理SDK模式响应(robotId, (message as any).data);
          break;
        default:
          logger.warn('未知的消息类型', { robotId, type: (message as any).type });
      }
    } catch (error: any) {
      logger.error('处理消息失败', error, { robotId });
      this.依赖.发送错误(robotId, 'MESSAGE_PARSE_ERROR', '消息解析失败', channel);
    }
  }

  private isAllowedMessageType(channel: Channel, type: string): boolean {
    return WebSocket消息路由器.允许消息类型[channel]?.has(type) ?? false;
  }
}
