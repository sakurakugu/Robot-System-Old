import type { ConversationRepository } from '../../features/大模型交互/repository';
import type {
  ActionInputMessage,
  AudioControlMessage,
  ControlInputMessage,
  ServerMessage,
} from '../../shared/types';
import { uuidv7 } from '../../shared/utils/helpers';
import { logger } from '../logger';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';
type 动作输入参数 = ActionInputMessage['data']['parameters'];
type 控制输入数据 = ControlInputMessage['data'];
type 音频控制数据 = AudioControlMessage['data'];

export interface WebSocket手动命令网关依赖 {
  发送到机器人(robotId: string, message: ServerMessage, channel: Channel): boolean;
  发送错误(robotId: string, code: string, message: string, channel: Channel): void;
  广播消息(robotId: string, message: ServerMessage, channel: Channel): void;
  写入动作日志(data: Parameters<ConversationRepository['createActionLog']>[0]): Promise<void>;
}

/**
 * 处理来自 UI 的动作、控制和音频控制命令
 */
export class WebSocket手动命令网关 {
  constructor(private readonly 依赖: WebSocket手动命令网关依赖) {}

  async handleActionInput(
    robotId: string,
    action: string,
    parameters?: 动作输入参数,
  ): Promise<void> {
    try {
      const traceId = uuidv7();
      logger.info('收到动作输入', { robotId, action, parameters });

      if (!action || typeof action !== 'string') {
        this.依赖.发送错误(robotId, 'INVALID_ACTION', '动作名称无效', 'business');
        return;
      }

      this.依赖.发送到机器人(robotId, {
        type: 'action_command',
        robotId,
        timestamp: Date.now(),
        conversationId: traceId,
        data: {
          action,
          parameters: parameters || {},
          safetyChecked: true,
        },
      }, 'business');

      await this.依赖.写入动作日志({
        robot_id: robotId,
        conversation_id: traceId,
        action_name: action,
        parameters: parameters || {},
        status: 'success',
        result_detail: {
          source: 'manual_action_input',
          safetyChecked: true,
        },
      });

      this.依赖.广播消息(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        conversationId: traceId,
        data: {
          text: `动作已发送: ${action}`,
          noTTS: true,
        },
      }, 'business');

      logger.info('动作指令已发送，不生成TTS', { robotId, action });
    } catch (error) {
      logger.error('处理动作输入失败', this.转成错误对象(error), { robotId, action });
      this.依赖.发送错误(robotId, 'ACTION_ERROR', this.提取错误消息(error, '动作处理失败'), 'business');
    }
  }

  async handleControlInput(robotId: string, data: 控制输入数据): Promise<void> {
    try {
      const command = data?.command;
      if (!command) {
        this.依赖.发送错误(robotId, 'INVALID_CONTROL', '控制指令无效', 'business');
        return;
      }

      if (!['joystick', 'joystick_stop', 'estop'].includes(command)) {
        this.依赖.发送错误(robotId, 'INVALID_CONTROL', '控制指令无效', 'business');
        return;
      }

      const payload = {
        command: command as 'joystick' | 'joystick_stop' | 'estop',
        channel: data?.channel,
        mode: data?.mode,
        x: data?.x,
        y: data?.y,
        speed: data?.speed,
        joystick: data?.joystick,
      };

      const sent = this.依赖.发送到机器人(robotId, {
        type: 'control_command',
        robotId,
        timestamp: Date.now(),
        data: payload,
      }, 'business');

      if (!sent) {
        this.依赖.发送错误(robotId, 'ROBOT_OFFLINE', '机器人未连接', 'business');
      }
    } catch (error) {
      logger.error('处理控制输入失败', this.转成错误对象(error), { robotId });
      this.依赖.发送错误(robotId, 'CONTROL_ERROR', this.提取错误消息(error, '控制处理失败'), 'business');
    }
  }

  async handleAudioControl(robotId: string, data: 音频控制数据): Promise<void> {
    try {
      const enabled = Boolean(data?.enabled);
      const sent = this.依赖.发送到机器人(robotId, {
        type: 'audio_control',
        robotId,
        timestamp: Date.now(),
        data: { enabled, source: 'ui' },
      }, 'business');

      if (!sent) {
        this.依赖.发送错误(robotId, 'ROBOT_OFFLINE', '机器人未连接', 'business');
      }
    } catch (error) {
      logger.error('处理音频控制失败', this.转成错误对象(error), { robotId });
      this.依赖.发送错误(robotId, 'AUDIO_CONTROL_ERROR', this.提取错误消息(error, '音频控制失败'), 'business');
    }
  }

  private 转成错误对象(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private 提取错误消息(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
