import { WebSocketSDK模式网关 } from './sdk-mode-gateway';

jest.mock('../../core/utils/helpers', () => ({
  uuidv7: jest.fn(() => 'generated-sdk-request-id'),
}));

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function 创建依赖() {
  return {
    发送到机器人: jest.fn().mockReturnValue(true),
    发送到UI: jest.fn(),
    发送错误: jest.fn(),
  };
}

describe('WebSocketSDK模式网关', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('处理 SDK 模式设置时应附带 requestId 转发给机器人', async () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocketSDK模式网关(依赖 as any);

    await 网关.handleSdkModeSet('robot-1', {
      sdkMode: true,
    });

    expect(依赖.发送到机器人).toHaveBeenCalledWith('robot-1', {
      type: 'sdk_mode_set',
      robotId: 'robot-1',
      timestamp: expect.any(Number),
      data: {
        requestId: 'generated-sdk-request-id',
        sdkMode: true,
      },
    }, 'business');
  });

  it('处理旧版 SDK 模式设置载荷时应规范成 sdkMode 布尔值', async () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocketSDK模式网关(依赖 as any);

    await 网关.handleSdkModeSet('robot-1', {
      mode: 1,
    });

    expect(依赖.发送到机器人).toHaveBeenCalledWith('robot-1', expect.objectContaining({
      type: 'sdk_mode_set',
      data: {
        requestId: 'generated-sdk-request-id',
        sdkMode: true,
      },
    }), 'business');
  });

  it('处理 SDK 模式获取发送失败时应返回离线错误', async () => {
    const 依赖 = 创建依赖();
    依赖.发送到机器人.mockReturnValue(false);
    const 网关 = new WebSocketSDK模式网关(依赖 as any);

    await 网关.handleSdkModeGet('robot-1');

    expect(依赖.发送错误).toHaveBeenCalledWith('robot-1', 'ROBOT_OFFLINE', '机器人未连接', 'business');
  });

  it('处理 SDK 模式响应时应转发到 UI', async () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocketSDK模式网关(依赖 as any);

    await 网关.handleSdkModeResponse('robot-1', {
      sdkMode: false,
    });

    expect(依赖.发送到UI).toHaveBeenCalledWith('robot-1', {
      type: 'sdk_mode_response',
      robotId: 'robot-1',
      timestamp: expect.any(Number),
      data: {
        sdkMode: false,
      },
    }, 'business');
  });

  it('处理旧版 SDK 模式响应时应补齐 sdkMode 字段后转发', async () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocketSDK模式网关(依赖 as any);

    await 网关.handleSdkModeResponse('robot-1', {
      mode: 0,
      result: 'success',
    });

    expect(依赖.发送到UI).toHaveBeenCalledWith('robot-1', {
      type: 'sdk_mode_response',
      robotId: 'robot-1',
      timestamp: expect.any(Number),
      data: {
        mode: 0,
        result: 'success',
        sdkMode: false,
      },
    }, 'business');
  });
});
