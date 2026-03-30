import type { RoleRecord } from '../角色管理/types';
import type { RobotRepository } from './repository';
import { 机器人服务 } from './service';
import type { RobotRecord } from './types';

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'robot-1'),
  validate: jest.fn(() => true),
}));

function 创建机器人仓库Mock(): jest.Mocked<RobotRepository> {
  return {
    countRobots: jest.fn(),
    listRobots: jest.fn(),
    getRobot: jest.fn(),
    listGroups: jest.fn(),
    upsertRobot: jest.fn(),
    updateRobot: jest.fn(),
    deleteRobot: jest.fn(),
    resetAllRobotsStatusToOffline: jest.fn(),
    getRoleById: jest.fn(),
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
    system_prompt: '你好',
    asr_provider: 'aliyun',
    asr_model: 'fun-asr-realtime',
    voice: 'xiaoyun',
    intent_strategy: 'default',
    max_history: 10,
    is_default: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function 创建机器人记录(partial: Partial<RobotRecord> = {}): RobotRecord {
  return {
    uuid: 'robot-1',
    name: '一号狗',
    model: 'spark-mini',
    version: null,
    motion_control_version: null,
    server_version: null,
    ip: '192.168.1.10',
    group_name: '默认组',
    tags: '["indoors","demo"]',
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

describe('机器人服务', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('获取所有机器人 应解析 tags 并附带角色信息', async () => {
    const repository = 创建机器人仓库Mock();
    repository.listRobots.mockResolvedValue([创建机器人记录()]);
    repository.getRoleById.mockResolvedValue(创建角色记录());

    const service = new 机器人服务(repository);
    const result = await service.获取所有机器人();

    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual(['indoors', 'demo']);
    expect(result[0].role?.uuid).toBe('role-1');
  });

  it('创建机器人 在无 IP 时应直接写入数据库并返回结果', async () => {
    const repository = 创建机器人仓库Mock();
    repository.getRobot.mockResolvedValue(
      创建机器人记录({
        uuid: 'robot-1',
        ip: null,
        tags: '["lab"]',
        role_uuid: null,
      }),
    );
    repository.getRoleById.mockResolvedValue(undefined);

    const service = new 机器人服务(repository);
    const result = await service.创建机器人({
      name: '实验狗',
      tags: ['lab'],
    });

    expect(repository.upsertRobot).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 'robot-1',
        name: '实验狗',
        ip: null,
        tags: '["lab"]',
        status: 'offline',
      }),
    );
    expect(result.uuid).toBe('robot-1');
    expect(result.tags).toEqual(['lab']);
  });

  it('更新机器人 在不存在时应报错', async () => {
    const repository = 创建机器人仓库Mock();
    repository.getRobot.mockResolvedValue(undefined);

    const service = new 机器人服务(repository);

    await expect(service.更新机器人('robot-404', { name: '新名字' })).rejects.toThrow('机器人不存在');
  });

  it('更新音频路由配置 在 phone 模式缺少目标设备时应报错', async () => {
    const repository = 创建机器人仓库Mock();
    repository.getRobot.mockResolvedValue(
      创建机器人记录({
        audio_route_config: null,
      }),
    );

    const service = new 机器人服务(repository);

    await expect(
      service.更新音频路由配置('robot-1', {
        mode: 'phone',
        targetPhoneDeviceId: null,
      }),
    ).rejects.toThrow('phone 模式下必须指定 targetPhoneDeviceId');
  });

  it('更新音频路由配置 应持久化新配置', async () => {
    const repository = 创建机器人仓库Mock();
    repository.getRobot.mockResolvedValue(
      创建机器人记录({
        audio_route_config: JSON.stringify({
          mode: 'robot',
          targetPhoneDeviceId: null,
          fallback: 'robot',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      }),
    );

    const service = new 机器人服务(repository);
    const result = await service.更新音频路由配置('robot-1', {
      mode: 'phone',
      targetPhoneDeviceId: 'phone-1',
      fallback: 'drop',
    });

    expect(result.mode).toBe('phone');
    expect(result.targetPhoneDeviceId).toBe('phone-1');
    expect(result.fallback).toBe('drop');
    expect(repository.updateRobot).toHaveBeenCalledWith(
      'robot-1',
      expect.objectContaining({
        audio_route_config: expect.stringContaining('"mode":"phone"'),
      }),
    );
  });
});
