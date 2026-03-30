import { WebSocket消息路由器 } from './message-router';

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
    等待机器人初始化完成: jest.fn().mockResolvedValue(undefined),
    刷新UI会话活跃时间: jest.fn(),
    更新机器人活跃时间: jest.fn(),
    发送错误: jest.fn(),
    处理文本输入: jest.fn().mockResolvedValue(undefined),
    处理TTS输入: jest.fn().mockResolvedValue(undefined),
    处理音频控制: jest.fn().mockResolvedValue(undefined),
    处理音频开始: jest.fn().mockResolvedValue(undefined),
    处理音频块: jest.fn().mockResolvedValue(undefined),
    处理音频结束: jest.fn().mockResolvedValue(undefined),
    处理心跳: jest.fn(),
    处理状态: jest.fn(),
    处理机器人注册: jest.fn().mockResolvedValue(undefined),
    处理动作输入: jest.fn().mockResolvedValue(undefined),
    处理控制输入: jest.fn().mockResolvedValue(undefined),
    处理SDK模式设置: jest.fn().mockResolvedValue(undefined),
    处理SDK模式获取: jest.fn().mockResolvedValue(undefined),
    处理SDK模式响应: jest.fn().mockResolvedValue(undefined),
  };
}

describe('WebSocket消息路由器', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应在业务通道分发 text_input 并刷新 UI 活跃时间', async () => {
    const 依赖 = 创建依赖();
    const 路由器 = new WebSocket消息路由器(依赖 as any);
    const ws = {};

    await 路由器.handleMessage(
      'robot-1',
      Buffer.from(JSON.stringify({
        type: 'text_input',
        robotId: 'robot-1',
        timestamp: Date.now(),
        data: {
          text: '你好',
          ttsOptions: {
            stream: false,
          },
          conversationId: 'conv-1',
        },
      })),
      'business',
      ws,
      'ui',
    );

    expect(依赖.刷新UI会话活跃时间).toHaveBeenCalledWith(ws);
    expect(依赖.更新机器人活跃时间).toHaveBeenCalledWith('robot-1', 'business');
    expect(依赖.处理文本输入).toHaveBeenCalledWith('robot-1', '你好', { stream: false }, 'conv-1');
  });

  it('消息通道不匹配时应返回 CHANNEL_MISMATCH', async () => {
    const 依赖 = 创建依赖();
    const 路由器 = new WebSocket消息路由器(依赖 as any);

    await 路由器.handleMessage(
      'robot-1',
      Buffer.from(JSON.stringify({
        type: 'text_input',
        robotId: 'robot-1',
        timestamp: Date.now(),
        data: {
          text: '你好',
        },
      })),
      'audio_upload',
    );

    expect(依赖.发送错误).toHaveBeenCalledWith('robot-1', 'CHANNEL_MISMATCH', '消息通道不匹配', 'audio_upload');
    expect(依赖.处理文本输入).not.toHaveBeenCalled();
  });

  it('消息解析失败时应返回 MESSAGE_PARSE_ERROR', async () => {
    const 依赖 = 创建依赖();
    const 路由器 = new WebSocket消息路由器(依赖 as any);

    await 路由器.handleMessage(
      'robot-1',
      Buffer.from('not-json'),
      'business',
    );

    expect(依赖.发送错误).toHaveBeenCalledWith('robot-1', 'MESSAGE_PARSE_ERROR', '消息解析失败', 'business');
  });
});
