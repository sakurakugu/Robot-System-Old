import { AliyunStreamingASR } from '../../features/大模型交互/aliyun-streaming-asr';
import type { RobotRecord } from '../../features/机器人管理/types';
import type { RoleRecord } from '../../features/角色管理/types';
import { 音频会话管理器 } from './audio-session-manager';

jest.mock('opusscript', () => {
  const MockOpus = jest.fn().mockImplementation(() => ({
    decode: jest.fn(),
    delete: jest.fn(),
  }));
  Object.assign(MockOpus, {
    Application: {
      VOIP: 2048,
    },
  });
  return {
    __esModule: true,
    default: MockOpus,
  };
});

jest.mock('../大模型交互/aliyun-streaming-asr', () => ({
  AliyunStreamingASR: jest.fn(),
}));

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
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
    role_uuid: null,
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

function 等待异步任务(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}

function 创建流式识别实例(partial: Partial<{
  start: jest.Mock;
  pushAudio: jest.Mock;
  finish: jest.Mock;
  getStatus: jest.Mock;
}> = {}) {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    pushAudio: jest.fn(),
    finish: jest.fn().mockResolvedValue(''),
    getStatus: jest.fn().mockReturnValue('connected'),
    ...partial,
  };
}

describe('音频会话管理器', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('处理音频开始时应读取角色 ASR 配置但不强制启用流式识别', async () => {
    const asrService = {
      转录Wav: jest.fn(),
    } as any;
    const 发送错误 = jest.fn();
    const 处理音频转写结果 = jest.fn();
    const 管理器 = new 音频会话管理器({
      获取机器人记录: jest.fn().mockResolvedValue(创建机器人记录({
        role_uuid: 'role-1',
      })),
      获取角色记录: jest.fn().mockResolvedValue(创建角色记录({
        asr_provider: 'custom-asr',
        asr_model: 'custom-model',
      })),
      asrService,
      发送错误,
      处理音频转写结果,
    });

    await 管理器.handleAudioStart('robot-1', {
      sessionId: 'session-1',
      format: 'pcm',
      sampleRate: 16000,
      channels: 1,
      frameDurationMs: 20,
    });

    expect(管理器.获取会话('session-1')).toEqual(expect.objectContaining({
      asrOptions: {
        provider: 'custom-asr',
        model: 'custom-model',
      },
    }));
    expect(AliyunStreamingASR as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('流式 ASR 启动失败时应通过错误回调通知业务通道', async () => {
    const 流式识别实例 = 创建流式识别实例({
      start: jest.fn().mockRejectedValue(new Error('启动失败')),
    });
    (AliyunStreamingASR as unknown as jest.Mock).mockImplementation(() => 流式识别实例);

    const asrService = {
      转录Wav: jest.fn(),
    } as any;
    const 发送错误 = jest.fn();
    const 管理器 = new 音频会话管理器({
      获取机器人记录: jest.fn().mockResolvedValue(创建机器人记录({
        role_uuid: 'role-1',
      })),
      获取角色记录: jest.fn().mockResolvedValue(创建角色记录()),
      asrService,
      发送错误,
      处理音频转写结果: jest.fn(),
    });

    await 管理器.handleAudioStart('robot-1', {
      sessionId: 'session-1',
      format: 'pcm',
      sampleRate: 16000,
      channels: 1,
      frameDurationMs: 20,
    });
    await 等待异步任务();

    expect(发送错误).toHaveBeenCalledWith('robot-1', 'ASR_START_ERROR', '启动失败');
  });

  it('流式 ASR 失败后应降级到批量 ASR 并继续回调转写结果', async () => {
    const 流式识别实例 = 创建流式识别实例({
      finish: jest.fn().mockRejectedValue(new Error('流式失败')),
    });
    (AliyunStreamingASR as unknown as jest.Mock).mockImplementation(() => 流式识别实例);

    const asrService = {
      转录Wav: jest.fn().mockResolvedValue(' 你好 '),
    } as any;
    const 处理音频转写结果 = jest.fn().mockResolvedValue(undefined);
    const 管理器 = new 音频会话管理器({
      获取机器人记录: jest.fn().mockResolvedValue(创建机器人记录({
        role_uuid: 'role-1',
      })),
      获取角色记录: jest.fn().mockResolvedValue(创建角色记录()),
      asrService,
      发送错误: jest.fn(),
      处理音频转写结果,
    });

    await 管理器.handleAudioStart('robot-1', {
      sessionId: 'session-1',
      format: 'pcm',
      sampleRate: 16000,
      channels: 1,
      frameDurationMs: 20,
    });
    await 管理器.handleAudioChunk('robot-1', {
      sessionId: 'session-1',
      format: 'pcm',
      sampleRate: 16000,
      channels: 1,
      frameDurationMs: 20,
      buffer: Buffer.from('pcm-audio').toString('base64'),
    });
    await 管理器.handleAudioEnd('robot-1', {
      sessionId: 'session-1',
    });

    expect(asrService.转录Wav).toHaveBeenCalledWith(expect.any(Buffer), {
      provider: 'aliyun',
      model: 'aliyun-model',
    });
    expect(处理音频转写结果).toHaveBeenCalledWith(
      'robot-1',
      '你好',
      expect.objectContaining({
        sessionId: 'session-1',
        durationMs: 20,
      }),
    );
  });
});
