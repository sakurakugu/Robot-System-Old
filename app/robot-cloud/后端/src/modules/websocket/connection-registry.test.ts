import { EventEmitter } from 'events';
import type { RobotConnection, ServerMessage } from '../../types';
import { WebSocket连接注册表 } from './connection-registry';

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

class 假WebSocket extends EventEmitter {
  send = jest.fn();
  close = jest.fn();
}

function 创建机器人连接(ws: 假WebSocket): RobotConnection {
  return {
    robotId: 'robot-1',
    websocket: ws,
    connectedAt: new Date('2026-03-30T00:00:00.000Z'),
    lastActiveAt: new Date('2026-03-30T00:00:00.000Z'),
    channel: 'business',
    metadata: {},
  };
}

function 创建消息(): ServerMessage {
  return {
    type: 'text_response',
    robotId: 'robot-1',
    timestamp: 1234567890,
    data: {
      text: 'hello',
    },
  };
}

describe('WebSocket连接注册表', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应维护机器人连接并统计在线数量', () => {
    const 注册表 = new WebSocket连接注册表();
    const ws = new 假WebSocket();

    expect(注册表.获取在线机器人数量()).toBe(0);

    注册表.替换机器人连接('robot-1', 'business', 创建机器人连接(ws));

    expect(注册表.获取机器人连接('robot-1', 'business')?.websocket).toBe(ws);
    expect(注册表.获取在线机器人数量()).toBe(1);

    const 结果 = 注册表.移除机器人连接('robot-1', 'business', ws);
    expect(结果).toEqual({ 已移除: true, 已完全断开: true });
    expect(注册表.获取在线机器人数量()).toBe(0);
  });

  it('应维护 UI 会话索引并支持定向发送', () => {
    const 注册表 = new WebSocket连接注册表();
    const ws = new 假WebSocket();

    注册表.注册UI连接('robot-1', 'audio_download', ws, {
      phoneDeviceId: 'phone-1',
      phoneSessionId: 'session-1',
    });

    expect(注册表.获取UI连接数('robot-1', 'audio_download')).toBe(1);
    expect(注册表.解析活跃手机会话('robot-1', 'phone-1')).toBe('session-1');
    expect(注册表.定向发送到UI('robot-1', 'session-1', 创建消息(), 'audio_download')).toBe(true);
    expect(ws.send).toHaveBeenCalled();

    注册表.移除UI连接('robot-1', 'audio_download', ws);
    expect(注册表.解析活跃手机会话('robot-1', 'phone-1')).toBeUndefined();
  });

  it('应同时广播到机器人和对应 UI', () => {
    const 注册表 = new WebSocket连接注册表();
    const 机器人ws = new 假WebSocket();
    const uiWs = new 假WebSocket();

    注册表.替换机器人连接('robot-1', 'business', 创建机器人连接(机器人ws));
    注册表.注册UI连接('robot-1', 'business', uiWs, {});

    注册表.广播到机器人和UI('robot-1', 创建消息(), 'business');

    expect(机器人ws.send).toHaveBeenCalled();
    expect(uiWs.send).toHaveBeenCalled();
  });
});
