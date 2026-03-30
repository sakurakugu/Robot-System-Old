import crypto from 'crypto';
import fs from 'fs';
import type { RobotPackageRepository } from './repository';
import { semverToVersionCode, versionCodeToDisplay, 机器人包服务 } from './service';
import type { RobotPackageRecord } from './types';

function 创建机器人包仓库Mock(): jest.Mocked<RobotPackageRepository> {
  const repository: jest.Mocked<RobotPackageRepository> = {
    withTransaction: jest.fn(),
    createVersion: jest.fn(),
    getVersionById: jest.fn(),
    listVersions: jest.fn(),
    deactivateChannel: jest.fn(),
    activateVersion: jest.fn(),
    deleteVersion: jest.fn(),
    getActiveVersion: jest.fn(),
  };

  repository.withTransaction.mockImplementation(async (callback) => callback(repository));

  return repository;
}

function 创建机器人包记录(partial: Partial<RobotPackageRecord> = {}): RobotPackageRecord {
  return {
    id: 1,
    version_code: 1_002_003,
    channel: 'stable',
    changelog: '机器人包更新',
    is_active: 1,
    uploaded_at: '2026-01-01T00:00:00.000Z',
    agent_file_name: 'stable_1002003_agent_deadbeef.tar.gz',
    agent_file_size: 100,
    agent_file_hash: 'a'.repeat(64),
    server_file_name: 'stable_1002003_server_deadbeef.tar.gz',
    server_file_size: 200,
    server_file_hash: 'b'.repeat(64),
    common_file_name: 'stable_1002003_common_deadbeef.tar.gz',
    common_file_size: 300,
    common_file_hash: 'c'.repeat(64),
    ...partial,
  };
}

function 计算哈希(buffer: Buffer): string {
  return crypto.createHash('sha256').update(new Uint8Array(buffer)).digest('hex').toLowerCase();
}

describe('机器人包服务', () => {
  beforeEach(() => {
    jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as unknown as string);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('uploadPackages 应写入文件并持久化活跃版本', async () => {
    const repository = 创建机器人包仓库Mock();
    const agentBuffer = Buffer.from('agent-data');
    const commonBuffer = Buffer.from('common-data');

    repository.createVersion.mockResolvedValue(
      创建机器人包记录({
        agent_file_hash: 计算哈希(agentBuffer),
        common_file_hash: 计算哈希(commonBuffer),
        server_file_name: null,
        server_file_size: null,
        server_file_hash: null,
      }),
    );

    const service = new 机器人包服务(repository);
    const result = await service.uploadPackages(
      [
        {
          type: 'agent',
          buffer: agentBuffer,
          size: agentBuffer.length,
          hash: 计算哈希(agentBuffer),
        },
        {
          type: 'common',
          buffer: commonBuffer,
          size: commonBuffer.length,
          hash: 计算哈希(commonBuffer),
        },
      ],
      1_002_003,
      'stable',
      '机器人包更新',
    );

    expect(repository.deactivateChannel).toHaveBeenCalledWith('stable');
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        version_code: 1_002_003,
        channel: 'stable',
        agent_file_name: expect.stringContaining('_agent_'),
        common_file_name: expect.stringContaining('_common_'),
        server_file_name: null,
      }),
    );
    expect(fs.promises.writeFile).toHaveBeenCalledTimes(2);
    expect(result.agent?.fileHash).toBe(计算哈希(agentBuffer));
    expect(result.common?.fileHash).toBe(计算哈希(commonBuffer));
  });

  it('getPackageFilePath 应返回活跃版本文件路径', async () => {
    const repository = 创建机器人包仓库Mock();
    repository.getActiveVersion.mockResolvedValue(
      创建机器人包记录({
        agent_file_name: 'agent.tar.gz',
        server_file_name: null,
        server_file_size: null,
        server_file_hash: null,
      }),
    );

    const service = new 机器人包服务(repository);
    const filePath = await service.getPackageFilePath('agent', 'stable');

    expect(filePath).toContain('robot-packages');
    expect(filePath).toContain('agent');
    expect(filePath).toContain('agent.tar.gz');
  });

  it('deleteVersion 应删除物理文件并移除版本记录', async () => {
    const repository = 创建机器人包仓库Mock();
    repository.getVersionById.mockResolvedValue(创建机器人包记录());

    const service = new 机器人包服务(repository);
    await service.deleteVersion(1);

    expect(fs.promises.unlink).toHaveBeenCalledTimes(3);
    expect(repository.deleteVersion).toHaveBeenCalledWith(1);
  });

  it('版本工具函数应互相对应', () => {
    expect(semverToVersionCode('1.2.3')).toBe(1_002_003);
    expect(versionCodeToDisplay(1_002_003)).toBe('1.2.3');
  });
});
