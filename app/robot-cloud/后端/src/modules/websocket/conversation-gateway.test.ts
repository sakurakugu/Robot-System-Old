import type { ConversationRepository } from '../大模型交互/repository';
import type { RoleRecord } from '../角色管理/types';
import type { RobotRecord, 音频路由配置 } from '../机器人管理/types';
import { WebSocket对话网关 } from './conversation-gateway';

jest.mock('../../core/utils/helpers', () => ({
  hasVisionTag: jest.fn(() => false),
  parseNormalizedTargetPosition: jest.fn(() => null),
  RateLimiter: jest.fn().mockImplementation(() => ({
    check: jest.fn(() => true),
  })),
  removeActionTags: jest.fn((text: string) => text.replace(/\{\{action=[^}]+\}\}/g, '')),
  removeTargetTags: jest.fn((text: string) => text.replace(/\{\{target=[^}]+\}\}/g, '')),
  removeVisionTags: jest.fn((text: string) => text.replace(/\{\{vision=true\}\}/g, '')),
  uuidv7: jest.fn(() => 'generated-conversation-id'),
}));

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    记录对话: jest.fn(),
  },
}));

function 创建机器人记录(partial: Partial<RobotRecord> = {}): RobotRecord {
  return {
    uuid: 'robot-1',
    name: '一号狗',
    model: 'spark-mini',
    version: '1.0.0',
    motion_control_version: '2.0.0',
    server_version: '3.0.0',
    ip: '192.168.1.10',
    group_name: '默认组',
    tags: null,
    sn: 'SN-001',
    role_uuid: 'role-1',
    audio_route_config: null,
    status: 'offline',
    last_connected_at: null,
    registered_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function 创建角色记录(partial: Partial<RoleRecord> = {}): RoleRecord {
  return {
    uuid: 'role-1',
    name: '默认角色',
    description: '说明',
    llm_provider: 'aliyun',
    llm_model: 'qwen-plus',
    temperature: 0.7,
    system_prompt: '系统提示',
    asr_provider: 'aliyun',
    asr_model: 'aliyun-model',
    voice: 'xiaoyun',
    intent_strategy: 'default',
    max_history: 10,
    is_default: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function 创建音频路由(partial: Partial<音频路由配置> = {}): 音频路由配置 {
  return {
    mode: 'robot',
    targetPhoneDeviceId: null,
    fallback: 'robot',
    updatedAt: '',
    ...partial,
  };
}

function 创建依赖() {
  return {
    获取机器人记录: jest.fn().mockResolvedValue(创建机器人记录()),
    获取角色记录: jest.fn().mockResolvedValue(创建角色记录()),
    获取对话服务: jest.fn().mockReturnValue({
      处理消息: jest.fn(),
      处理视觉消息: jest.fn(),
    }),
    获取机器人服务: jest.fn().mockReturnValue({
      拍照: jest.fn(),
    }),
    ttsService: {
      synthesize: jest.fn(),
      synthesizeStream: jest.fn(),
    } as any,
    获取音频路由配置: jest.fn().mockResolvedValue(创建音频路由()),
    发送音频消息: jest.fn(),
    是否发送最终音频响应: jest.fn().mockReturnValue(true),
    发送到机器人: jest.fn(),
    广播消息: jest.fn(),
    发送到UI: jest.fn(),
    发送错误: jest.fn(),
    写入动作日志: jest.fn<Promise<void>, [Parameters<ConversationRepository['createActionLog']>[0]]>().mockResolvedValue(undefined),
    写入对话记录: jest.fn<Promise<void>, [Parameters<ConversationRepository['createConversation']>[0]]>().mockResolvedValue(undefined),
  };
}

describe('WebSocket对话网关', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('处理音频转写结果时应先通知 UI 再写入待处理输入队列', async () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocket对话网关(依赖 as any);

    await 网关.handleAudioTranscript('robot-1', '你好', {
      asrTime: 120,
      durationMs: 500,
      sessionId: 'session-1',
    });

    expect(依赖.发送到UI).toHaveBeenCalledWith('robot-1', expect.objectContaining({
      type: 'asr_transcript',
      data: {
        text: '你好',
        sessionId: 'session-1',
        durationMs: 500,
        asrTime: 120,
      },
    }), 'business');

    const 待处理输入 = (网关 as any).pendingInputs.get('robot-1');
    expect(待处理输入).toEqual(expect.objectContaining({
      text: '你好',
      inputType: 'audio',
      conversationId: 'session-1',
      audioMeta: {
        asrTime: 120,
        durationMs: 500,
        sessionId: 'session-1',
      },
    }));
  });

  it('机器人未配置角色时应向 UI 返回对话错误', async () => {
    const 依赖 = 创建依赖();
    依赖.获取机器人记录.mockResolvedValue(创建机器人记录({
      role_uuid: null,
    }));
    const 网关 = new WebSocket对话网关(依赖 as any);

    await 网关.handleTextInput('robot-1', '你好');
    await (网关 as any).flushUserText('robot-1');

    expect(依赖.发送到UI).toHaveBeenCalledWith('robot-1', expect.objectContaining({
      type: 'error',
      data: expect.objectContaining({
        code: 'NO_ROLE_CONFIGURED',
      }),
    }), 'business');
  });

  it('处理 TTS 输入时应清理标记并按音频路由发送流式消息', async () => {
    const 依赖 = 创建依赖();
    依赖.ttsService.synthesizeStream.mockImplementation(
      async (text: string, _ttsOptions: any, onChunk: (chunk: { seq: number; base64: string; format: 'mp3' }) => void) => {
        onChunk({
          seq: 1,
          base64: 'chunk-1',
          format: 'mp3',
        });
        return {
          audio: 'final-audio',
          duration: 123,
          format: 'mp3',
        };
      },
    );
    const 网关 = new WebSocket对话网关(依赖 as any);

    await 网关.handleTTSInput('robot-1', '你好{{action=wave}}{{meaning=false}}{{vision=true}}');

    expect(依赖.ttsService.synthesizeStream).toHaveBeenCalledWith(
      '你好',
      undefined,
      expect.any(Function),
    );
    expect(依赖.发送音频消息).toHaveBeenCalledTimes(4);
    expect(依赖.发送音频消息).toHaveBeenNthCalledWith(1, 'robot-1', 创建音频路由(), expect.objectContaining({
      type: 'audio_stream_start',
    }));
    expect(依赖.发送音频消息).toHaveBeenNthCalledWith(2, 'robot-1', 创建音频路由(), expect.objectContaining({
      type: 'audio_stream_chunk',
    }));
    expect(依赖.发送音频消息).toHaveBeenNthCalledWith(3, 'robot-1', 创建音频路由(), expect.objectContaining({
      type: 'audio_stream_end',
    }));
    expect(依赖.发送音频消息).toHaveBeenNthCalledWith(4, 'robot-1', 创建音频路由(), expect.objectContaining({
      type: 'audio_response',
    }));
  });
});
