import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import type { 机器人包服务 } from '../机器人包管理/service';
import type { RobotPackageInfo } from '../机器人包管理/types';
import type { 机器人命令服务接口 } from '../../infra/websocket/robot-command-gateway';
import type { RoleRecord } from '../角色管理/types';
import type { RobotRepository } from './repository';
import { 机器人服务 } from './service';
import type { RobotRecord } from './types';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'robot-1'),
  validate: jest.fn(() => true),
}));

const spawnMock = jest.mocked(spawn);

function 创建子进程Mock(options: { stdout?: string; stderr?: string; code?: number } = {}) {
  const { stdout = '', stderr = '', code = 0 } = options;
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: jest.Mock;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();

  setImmediate(() => {
    if (stdout) {
      child.stdout.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      child.stderr.emit('data', Buffer.from(stderr));
    }
    child.emit('close', code);
  });

  return child;
}

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

function 创建机器人命令服务Mock(): jest.Mocked<机器人命令服务接口> {
  return {
    请求机器人拍照: jest.fn(),
    请求获取机器人音量: jest.fn(),
    请求设置机器人音量: jest.fn(),
    请求设置机器人静音: jest.fn(),
    请求获取机器人配置: jest.fn(),
    请求更新机器人配置: jest.fn(),
    请求设置SDK模式: jest.fn(),
    请求获取SDK模式: jest.fn(),
    请求日志标记: jest.fn(),
    请求推送安装包: jest.fn(),
  };
}

function 创建机器人包服务Mock(): jest.Mocked<Pick<机器人包服务, 'getActive'>> {
  return {
    getActive: jest.fn(),
  };
}

function 创建机器人包信息(partial: Partial<RobotPackageInfo> = {}): RobotPackageInfo {
  return {
    id: 1,
    versionCode: 1000,
    channel: 'stable',
    changelog: null,
    isActive: true,
    uploadedAt: '2026-01-01T00:00:00.000Z',
    agent: {
      fileName: 'agent.tar.gz',
      fileSize: 1024,
      fileHash: 'agent-hash',
    },
    server: null,
    common: null,
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
    spawnMock.mockReset();
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

  it('创建机器人 在有 IP 时不应再复制机器人端源码', async () => {
    spawnMock
      .mockImplementationOnce(() => 创建子进程Mock({
        stdout: JSON.stringify({
          success: true,
          connected: true,
        }),
      }) as unknown as ReturnType<typeof spawn>)
      .mockImplementationOnce(() => 创建子进程Mock({
        stdout: JSON.stringify({
          success: true,
          output: 'remote-uuid',
        }),
      }) as unknown as ReturnType<typeof spawn>);

    const repository = 创建机器人仓库Mock();
    repository.getRobot.mockImplementation(async (uuid) => {
      if (uuid !== 'remote-uuid') {
        return undefined;
      }
      return 创建机器人记录({
        uuid: 'remote-uuid',
        ip: '192.168.1.20',
        role_uuid: null,
      });
    });
    repository.getRoleById.mockResolvedValue(undefined);

    const service = new 机器人服务(repository);
    const result = await service.创建机器人({
      name: '远程狗',
      ip: '192.168.1.20',
    });

    expect(result.uuid).toBe('remote-uuid');
    expect(repository.upsertRobot).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 'remote-uuid',
        ip: '192.168.1.20',
      }),
    );
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock.mock.calls.some(([, args]) => Array.isArray(args) && args[1] === 'copy')).toBe(false);
  });

  it('更新机器人 在不存在时应报错', async () => {
    const repository = 创建机器人仓库Mock();
    repository.getRobot.mockResolvedValue(undefined);

    const service = new 机器人服务(repository);

    await expect(service.更新机器人('robot-404', { name: '新名字' })).rejects.toThrow('机器人不存在');
  });

  it('获取音量 应通过机器人命令服务查询机器人状态', async () => {
    const repository = 创建机器人仓库Mock();
    const 机器人命令服务 = 创建机器人命令服务Mock();
    repository.getRobot.mockResolvedValue(创建机器人记录());
    机器人命令服务.请求获取机器人音量.mockResolvedValue({
      success: true,
      data: {
        volume: 42,
        muted: true,
      },
    });

    const service = new 机器人服务(repository, { 机器人命令服务 });
    const result = await service.获取音量('robot-1');

    expect(result).toEqual({
      volume: 42,
      muted: true,
    });
    expect(机器人命令服务.请求获取机器人音量).toHaveBeenCalledWith('robot-1');
  });

  it('更新固件 应通过机器人命令服务推送安装包', async () => {
    const repository = 创建机器人仓库Mock();
    const 机器人命令服务 = 创建机器人命令服务Mock();
    const 机器人包服务Mock = 创建机器人包服务Mock();
    repository.getRobot.mockResolvedValue(创建机器人记录());
    机器人包服务Mock.getActive.mockResolvedValue(创建机器人包信息({
      agent: {
        fileName: 'agent.tar.gz',
        fileSize: 1024,
        fileHash: 'agent-hash',
      },
      common: {
        fileName: 'common.tar.gz',
        fileSize: 2048,
        fileHash: 'common-hash',
      },
    }));
    机器人命令服务.请求推送安装包.mockResolvedValue({
      success: true,
      downloaded: ['agent', 'common'],
    });

    const service = new 机器人服务(repository, {
      机器人命令服务,
      机器人包服务: 机器人包服务Mock,
    });
    const result = await service.更新固件('robot-1');

    expect(result).toEqual({
      downloaded: ['agent', 'common'],
    });
    expect(机器人命令服务.请求推送安装包).toHaveBeenCalledWith(
      'robot-1',
      {
        agent: '/api/v1/robot-packages/download/agent?channel=stable',
        common: '/api/v1/robot-packages/download/common?channel=stable',
      },
      {
        agent: 'agent-hash',
        common: 'common-hash',
      },
    );
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
