import type { ConversationRepository } from '../大模型交互/repository';
import { WebSocket手动命令网关 } from './manual-command-gateway';

jest.mock('../../core/utils/helpers', () => ({
  uuidv7: jest.fn(() => 'generated-command-id'),
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
    发送错误: jest.fn(),
    广播消息: jest.fn(),
    写入动作日志: jest.fn<Promise<void>, [Parameters<ConversationRepository['createActionLog']>[0]]>().mockResolvedValue(undefined),
  };
}

describe('WebSocket手动命令网关', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('处理动作输入时应下发动作并写入动作日志', async () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocket手动命令网关(依赖 as any);

    await 网关.handleActionInput('robot-1', 'sit_down', { speed: 1 });

    expect(依赖.发送到机器人).toHaveBeenCalledWith('robot-1', expect.objectContaining({
      type: 'action_command',
      conversationId: 'generated-command-id',
      data: {
        action: 'sit_down',
        parameters: { speed: 1 },
        safetyChecked: true,
      },
    }), 'business');
    expect(依赖.写入动作日志).toHaveBeenCalledWith({
      robot_id: 'robot-1',
      conversation_id: 'generated-command-id',
      action_name: 'sit_down',
      parameters: { speed: 1 },
      status: 'success',
      result_detail: {
        source: 'manual_action_input',
        safetyChecked: true,
      },
    });
    expect(依赖.广播消息).toHaveBeenCalledWith('robot-1', expect.objectContaining({
      type: 'text_response',
      data: {
        text: '动作已发送: sit_down',
        noTTS: true,
      },
    }), 'business');
  });

  it('控制指令非法时应返回 INVALID_CONTROL', async () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocket手动命令网关(依赖 as any);

    await 网关.handleControlInput('robot-1', {
      command: 'jump',
    });

    expect(依赖.发送错误).toHaveBeenCalledWith('robot-1', 'INVALID_CONTROL', '控制指令无效', 'business');
  });

  it('音频控制发送失败时应返回机器人离线错误', async () => {
    const 依赖 = 创建依赖();
    依赖.发送到机器人.mockReturnValue(false);
    const 网关 = new WebSocket手动命令网关(依赖 as any);

    await 网关.handleAudioControl('robot-1', {
      enabled: true,
    });

    expect(依赖.发送到机器人).toHaveBeenCalledWith('robot-1', expect.objectContaining({
      type: 'audio_control',
      data: {
        enabled: true,
        source: 'ui',
      },
    }), 'business');
    expect(依赖.发送错误).toHaveBeenCalledWith('robot-1', 'ROBOT_OFFLINE', '机器人未连接', 'business');
  });
});
