import type { WebSocket } from 'ws';
import type { RobotConnection, ServerMessage, WsChannel } from '../../shared/types';
import { logger } from '../logger';

type Channel = WsChannel;
type 可发送连接 = Pick<WebSocket, 'send' | 'close'> & object;

export type UISocketMeta = {
  robotId: string;
  channel: Channel;
  phoneSessionId?: string;
  phoneDeviceId?: string;
  lastActiveAt: number;
};

/**
 * WebSocket 连接注册表
 * 负责管理机器人连接、UI 订阅连接和手机会话索引
 */
export class WebSocket连接注册表 {
  private robotConnections: Map<string, Map<Channel, RobotConnection>> = new Map();
  private uiConnections: Map<string, Map<Channel, Set<可发送连接>>> = new Map();
  private uiSocketMeta: WeakMap<可发送连接, UISocketMeta> = new WeakMap();
  private phoneSessionIndex: Map<string, Map<string, Map<string, number>>> = new Map();

  注册UI连接(
    robotId: string,
    channel: Channel,
    ws: 可发送连接,
    meta: Omit<UISocketMeta, 'robotId' | 'channel' | 'lastActiveAt'>,
  ): number {
    if (!this.uiConnections.has(robotId)) {
      this.uiConnections.set(robotId, new Map());
    }

    const byChannel = this.uiConnections.get(robotId)!;
    if (!byChannel.has(channel)) {
      byChannel.set(channel, new Set());
    }

    byChannel.get(channel)!.add(ws);
    this.uiSocketMeta.set(ws, {
      robotId,
      channel,
      phoneSessionId: meta.phoneSessionId,
      phoneDeviceId: meta.phoneDeviceId,
      lastActiveAt: Date.now(),
    });

    if (meta.phoneSessionId && meta.phoneDeviceId) {
      this.写入或刷新手机会话索引(robotId, meta.phoneDeviceId, meta.phoneSessionId);
    }

    return byChannel.get(channel)!.size;
  }

  替换机器人连接(robotId: string, channel: Channel, connection: RobotConnection): RobotConnection | undefined {
    if (!this.robotConnections.has(robotId)) {
      this.robotConnections.set(robotId, new Map());
    }

    const byChannel = this.robotConnections.get(robotId)!;
    const existing = byChannel.get(channel);
    byChannel.set(channel, connection);
    return existing;
  }

  获取机器人连接(robotId: string, channel: Channel): RobotConnection | undefined {
    return this.robotConnections.get(robotId)?.get(channel);
  }

  更新机器人活跃时间(robotId: string, channel: Channel): void {
    const connection = this.获取机器人连接(robotId, channel);
    if (connection) {
      connection.lastActiveAt = new Date();
    }
  }

  刷新UI会话活跃时间(ws: 可发送连接): void {
    const meta = this.uiSocketMeta.get(ws);
    if (!meta) {
      return;
    }

    meta.lastActiveAt = Date.now();
    this.uiSocketMeta.set(ws, meta);

    if (meta.phoneDeviceId && meta.phoneSessionId) {
      this.写入或刷新手机会话索引(meta.robotId, meta.phoneDeviceId, meta.phoneSessionId);
    }
  }

  移除UI连接(robotId: string, channel: Channel, ws: 可发送连接): void {
    this.移除手机会话索引(ws);

    const byChannel = this.uiConnections.get(robotId);
    if (!byChannel) {
      return;
    }

    const uiSet = byChannel.get(channel);
    if (uiSet) {
      uiSet.delete(ws);
      if (uiSet.size === 0) {
        byChannel.delete(channel);
      }
    }

    if (byChannel.size === 0) {
      this.uiConnections.delete(robotId);
    }
  }

  移除机器人连接(
    robotId: string,
    channel: Channel,
    ws: 可发送连接,
  ): { 已移除: boolean; 已完全断开: boolean } {
    const connections = this.robotConnections.get(robotId);
    if (!connections) {
      return { 已移除: false, 已完全断开: false };
    }

    const current = connections.get(channel);
    if (!current || current.websocket !== ws) {
      return { 已移除: false, 已完全断开: false };
    }

    connections.delete(channel);
    if (connections.size === 0) {
      this.robotConnections.delete(robotId);
      return { 已移除: true, 已完全断开: true };
    }

    return { 已移除: true, 已完全断开: false };
  }

  获取UI连接数(robotId: string, channel: Channel): number {
    return this.uiConnections.get(robotId)?.get(channel)?.size ?? 0;
  }

  解析活跃手机会话(robotId: string, phoneDeviceId: string): string | undefined {
    const deviceMap = this.phoneSessionIndex.get(robotId)?.get(phoneDeviceId);
    if (!deviceMap || deviceMap.size === 0) {
      return undefined;
    }

    let latestSessionId: string | undefined;
    let latestTs = -1;
    for (const [sessionId, ts] of deviceMap.entries()) {
      if (ts > latestTs) {
        latestTs = ts;
        latestSessionId = sessionId;
      }
    }

    return latestSessionId;
  }

  发送到机器人(robotId: string, message: ServerMessage, channel: Channel = 'business'): boolean {
    const connection = this.获取机器人连接(robotId, channel);
    if (!connection) {
      logger.warn('机器人未连接，无法发送', { robotId, channel });
      return false;
    }

    try {
      connection.websocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('发送到机器人失败', this.转成错误对象(error), { robotId });
      return false;
    }
  }

  广播到机器人和UI(robotId: string, message: ServerMessage, channel: Channel = 'business'): void {
    this.发送到机器人(robotId, message, channel);
    this.发送到UI(robotId, message, channel);
  }

  发送到UI(robotId: string, message: ServerMessage, channel: Channel = 'business'): void {
    const byChannel = this.uiConnections.get(robotId)?.get(channel);
    if (!byChannel || byChannel.size === 0) {
      return;
    }

    for (const uiWs of byChannel.values()) {
      try {
        uiWs.send(JSON.stringify(message));
      } catch (error) {
        logger.error('发送消息到UI失败', this.转成错误对象(error), { robotId });
      }
    }
  }

  定向发送到UI(
    robotId: string,
    phoneSessionId: string,
    message: ServerMessage,
    channel: Channel = 'business',
  ): boolean {
    const byChannel = this.uiConnections.get(robotId)?.get(channel);
    if (!byChannel || byChannel.size === 0) {
      return false;
    }

    let sent = false;
    for (const uiWs of byChannel.values()) {
      const meta = this.uiSocketMeta.get(uiWs);
      if (!meta || meta.phoneSessionId !== phoneSessionId) {
        continue;
      }

      try {
        uiWs.send(JSON.stringify(message));
        sent = true;
      } catch (error) {
        logger.error('定向发送消息到UI失败', this.转成错误对象(error), { robotId, phoneSessionId });
      }
    }

    return sent;
  }

  广播到全部UI(message: ServerMessage, channel: Channel = 'business'): void {
    for (const [robotId, channelMap] of this.uiConnections) {
      const uiSet = channelMap.get(channel);
      if (!uiSet || uiSet.size === 0) {
        continue;
      }

      for (const uiWs of uiSet) {
        try {
          uiWs.send(JSON.stringify(message));
        } catch (error) {
          logger.error('广播消息到UI失败', this.转成错误对象(error), { robotId });
        }
      }
    }
  }

  获取连接映射(): Map<string, Map<Channel, RobotConnection>> {
    return this.robotConnections;
  }

  获取在线机器人数量(): number {
    let count = 0;
    for (const connections of this.robotConnections.values()) {
      if (connections.size > 0) {
        count += 1;
      }
    }
    return count;
  }

  private 写入或刷新手机会话索引(robotId: string, phoneDeviceId: string, phoneSessionId: string): void {
    if (!this.phoneSessionIndex.has(robotId)) {
      this.phoneSessionIndex.set(robotId, new Map());
    }

    const deviceMap = this.phoneSessionIndex.get(robotId)!;
    if (!deviceMap.has(phoneDeviceId)) {
      deviceMap.set(phoneDeviceId, new Map());
    }

    deviceMap.get(phoneDeviceId)!.set(phoneSessionId, Date.now());
  }

  private 移除手机会话索引(ws: 可发送连接): void {
    const meta = this.uiSocketMeta.get(ws);
    if (!meta?.phoneDeviceId || !meta.phoneSessionId) {
      return;
    }

    const deviceMap = this.phoneSessionIndex.get(meta.robotId);
    const sessionMap = deviceMap?.get(meta.phoneDeviceId);
    if (sessionMap) {
      sessionMap.delete(meta.phoneSessionId);
      if (sessionMap.size === 0) {
        deviceMap!.delete(meta.phoneDeviceId);
      }
    }

    if (deviceMap && deviceMap.size === 0) {
      this.phoneSessionIndex.delete(meta.robotId);
    }
  }

  private 转成错误对象(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
