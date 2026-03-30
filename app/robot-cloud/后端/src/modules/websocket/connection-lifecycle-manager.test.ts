import { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';
import { WebSocket连接注册表 } from './connection-registry';
import { WebSocket连接生命周期管理器 } from './connection-lifecycle-manager';

jest.mock('../../core/utils/helpers', () => ({
  isValidRobotId: jest.fn(() => true),
  uuidv7: jest.fn(() => 'generated-robot-id'),
}));

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

class 假WebSocket extends EventEmitter {
  readyState = 1;
  send = jest.fn();
  close = jest.fn();
}

function 创建请求(url: string) {
  return {
    url,
    headers: {
      host: 'localhost',
    },
    socket: {
      remoteAddress: '127.0.0.1',
    },
  } as unknown as IncomingMessage;
}

function 等待异步任务(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}

function 创建依赖() {
  return {
    连接注册表: new WebSocket连接注册表(),
    记录机器人初始化任务: jest.fn(),
    同步机器人在线状态: jest.fn().mockResolvedValue(undefined),
    标记机器人离线: jest.fn().mockResolvedValue(undefined),
    处理消息: jest.fn().mockResolvedValue(undefined),
    发送到机器人: jest.fn().mockReturnValue(true),
    开始心跳检测: jest.fn(),
    停止心跳检测: jest.fn(),
  };
}

describe('WebSocket连接生命周期管理器', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('处理机器人连接时应注册连接、启动初始化任务并绑定消息处理', async () => {
    const 依赖 = 创建依赖();
    const 管理器 = new WebSocket连接生命周期管理器(依赖 as any);
    const ws = new 假WebSocket();

    管理器.handleConnection(ws as any, 创建请求('/api/v1/robot?robotId=robot-1'), 'business');
    ws.emit('message', Buffer.from('{"type":"heartbeat"}'));
    await 等待异步任务();

    expect(依赖.连接注册表.获取机器人连接('robot-1', 'business')?.websocket).toBe(ws);
    expect(依赖.记录机器人初始化任务).toHaveBeenCalledWith('robot-1', expect.any(Promise));
    expect(依赖.发送到机器人).toHaveBeenCalledWith('robot-1', expect.objectContaining({
      type: 'text_response',
    }), 'business');
    expect(依赖.开始心跳检测).toHaveBeenCalledWith('robot-1', 'business');
    expect(依赖.处理消息).toHaveBeenCalledWith('robot-1', expect.any(Buffer), 'business', ws, 'robot');
  });

  it('处理机器人断开时应停止心跳并在完全断开后标记离线', async () => {
    const 依赖 = 创建依赖();
    const 管理器 = new WebSocket连接生命周期管理器(依赖 as any);
    const ws = new 假WebSocket();

    依赖.连接注册表.替换机器人连接('robot-1', 'business', {
      robotId: 'robot-1',
      websocket: ws,
      connectedAt: new Date(),
      lastActiveAt: new Date(),
      metadata: {},
      channel: 'business',
    });

    管理器.handleDisconnection('robot-1', 'business', ws as any);
    await 等待异步任务();

    expect(依赖.停止心跳检测).toHaveBeenCalledWith('robot-1', 'business');
    expect(依赖.标记机器人离线).toHaveBeenCalledWith('robot-1');
  });

  it('处理 UI 连接时应注册 UI 集合且不启动机器人初始化', () => {
    const 依赖 = 创建依赖();
    const 管理器 = new WebSocket连接生命周期管理器(依赖 as any);
    const ws = new 假WebSocket();

    管理器.handleConnection(ws as any, 创建请求('/api/v1/web?robotId=robot-1&role=ui'), 'business');

    expect(依赖.连接注册表.获取UI连接数('robot-1', 'business')).toBe(1);
    expect(依赖.记录机器人初始化任务).not.toHaveBeenCalled();
    expect(依赖.开始心跳检测).not.toHaveBeenCalled();
  });
});
