import { WebSocket连接注册表 } from './connection-registry';
import { WebSocket心跳管理器 } from './heartbeat-manager';

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function 创建机器人连接(lastActiveAt: Date = new Date()) {
  return {
    robotId: 'robot-1',
    websocket: {
      send: jest.fn(),
      close: jest.fn(),
    },
    connectedAt: new Date(),
    lastActiveAt,
    metadata: {},
    channel: 'business' as const,
  };
}

describe('WebSocket心跳管理器', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('超时连接应被自动关闭并清理定时器', () => {
    const 注册表 = new WebSocket连接注册表();
    const 连接 = 创建机器人连接(new Date(Date.now() - 6 * 60 * 1000));
    注册表.替换机器人连接('robot-1', 'business', 连接);
    const 管理器 = new WebSocket心跳管理器({
      连接注册表: 注册表,
      获取当前时间: () => Date.now(),
    });

    管理器.setupHeartbeat('robot-1', 'business');
    jest.advanceTimersByTime(60000);

    expect(连接.websocket.close).toHaveBeenCalledTimes(1);
    expect((管理器 as any).心跳定时器.size).toBe(0);
  });

  it('重复设置同一连接心跳时应先清掉旧定时器', () => {
    const 注册表 = new WebSocket连接注册表();
    注册表.替换机器人连接('robot-1', 'business', 创建机器人连接());
    const 管理器 = new WebSocket心跳管理器({
      连接注册表: 注册表,
    });

    管理器.setupHeartbeat('robot-1', 'business');
    管理器.setupHeartbeat('robot-1', 'business');

    expect((管理器 as any).心跳定时器.size).toBe(1);
  });
});
