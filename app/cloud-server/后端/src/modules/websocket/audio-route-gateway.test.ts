import type { ServerMessage } from '../../types';
import type { RobotRecord, 音频路由配置 } from '../机器人管理/types';
import { 默认音频路由配置, 音频路由网关 } from './audio-route-gateway';

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

function 创建消息(): ServerMessage {
  return {
    type: 'audio_response',
    robotId: 'robot-1',
    timestamp: Date.now(),
    data: {
      format: 'mp3',
      audio: 'base64-audio',
    },
  } as ServerMessage;
}

function 创建路由(partial: Partial<音频路由配置> = {}): 音频路由配置 {
  return {
    ...默认音频路由配置,
    ...partial,
  };
}

describe('音频路由网关', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应读取并解析持久化的音频路由配置', async () => {
    const 网关 = new 音频路由网关({
      获取机器人记录: jest.fn().mockResolvedValue(创建机器人记录({
        audio_route_config: JSON.stringify({
          mode: 'phone',
          targetPhoneDeviceId: 'phone-1',
          fallback: 'drop',
          updatedAt: '2026-03-30T00:00:00.000Z',
        }),
      })),
      解析活跃手机会话: jest.fn(),
      发送到机器人: jest.fn(),
      定向发送到UI: jest.fn(),
    });

    await expect(网关.getAudioRouteConfig('robot-1')).resolves.toEqual({
      mode: 'phone',
      targetPhoneDeviceId: 'phone-1',
      fallback: 'drop',
      updatedAt: '2026-03-30T00:00:00.000Z',
    });
  });

  it('目标手机不可用且允许回退时应发送到机器狗', () => {
    const 发送到机器人 = jest.fn();
    const 网关 = new 音频路由网关({
      获取机器人记录: jest.fn(),
      解析活跃手机会话: jest.fn().mockReturnValue(undefined),
      发送到机器人,
      定向发送到UI: jest.fn(),
    });

    const 消息 = 创建消息();
    网关.sendAudioMessageByRoute('robot-1', 创建路由({
      mode: 'phone',
      targetPhoneDeviceId: 'phone-1',
      fallback: 'robot',
    }), 消息);

    expect(发送到机器人).toHaveBeenCalledWith('robot-1', 消息, 'audio_download');
  });

  it('目标手机在线时应定向发送且不再回落最终音频响应', () => {
    const 定向发送到UI = jest.fn().mockReturnValue(true);
    const 网关 = new 音频路由网关({
      获取机器人记录: jest.fn(),
      解析活跃手机会话: jest.fn().mockReturnValue('session-1'),
      发送到机器人: jest.fn(),
      定向发送到UI,
    });

    const 消息 = 创建消息();
    const 路由 = 创建路由({
      mode: 'phone',
      targetPhoneDeviceId: 'phone-1',
      fallback: 'robot',
    });

    网关.sendAudioMessageByRoute('robot-1', 路由, 消息);

    expect(定向发送到UI).toHaveBeenCalledWith('robot-1', 'session-1', 消息, 'audio_download');
    expect(网关.shouldSendFinalAudioResponse('robot-1', 路由)).toBe(false);
  });
});
