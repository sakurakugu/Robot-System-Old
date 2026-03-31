import type { ServerMessage } from '../../shared/types';
import type { ChoreoWSMessage } from './types';

type 编舞消息通道 = 'control' | 'business' | 'audio_upload' | 'audio_download';

export interface 编舞底层消息宿主 {
  sendToRobot(robotId: string, message: ServerMessage, channel?: 编舞消息通道): boolean;
  broadcast(message: ServerMessage, channel?: 编舞消息通道): void;
}

export interface 编舞执行消息网关 {
  发送到机器人(robotId: string, message: ServerMessage): boolean;
  广播执行消息(message: ChoreoWSMessage): void;
}

export function 创建编舞执行消息网关(
  消息宿主: Pick<编舞底层消息宿主, 'sendToRobot' | 'broadcast'>,
): 编舞执行消息网关 {
  return {
    发送到机器人: (robotId, message) => 消息宿主.sendToRobot(robotId, message, 'business'),
    广播执行消息: (message) => {
      消息宿主.broadcast(message as ServerMessage, 'business');
    },
  };
}
