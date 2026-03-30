import crypto from 'crypto';
import fs from 'fs';
import type { AppVersionRepository } from './repository';
import { semverToVersionCode, versionCodeToDisplay, 更新服务 } from './service';
import type { AppVersionRecord } from './types';

function 创建应用版本仓库Mock(): jest.Mocked<AppVersionRepository> {
  const repository: jest.Mocked<AppVersionRepository> = {
    withTransaction: jest.fn(),
    createVersion: jest.fn(),
    getVersionById: jest.fn(),
    getActiveVersion: jest.fn(),
    getLatestVersion: jest.fn(),
    listVersions: jest.fn(),
    deactivateChannel: jest.fn(),
    activateVersion: jest.fn(),
    deleteVersion: jest.fn(),
  };

  repository.withTransaction.mockImplementation(async (callback) => callback(repository));

  return repository;
}

function 创建版本记录(partial: Partial<AppVersionRecord> = {}): AppVersionRecord {
  return {
    id: 1,
    version_name: '1002003',
    version_code: 1_002_003,
    channel: 'stable',
    file_name: 'stable_1002003_1002003_deadbeef.apk',
    file_size: 1024,
    file_hash: 'a'.repeat(64),
    changelog: '更新说明',
    is_active: 1,
    uploaded_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('更新服务', () => {
  beforeEach(() => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as unknown as string);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('uploadApk 应写入文件并持久化活跃版本', async () => {
    const repository = 创建应用版本仓库Mock();
    const fileBuffer = Buffer.from('apk-data');
    const fileHash = crypto.createHash('sha256').update(new Uint8Array(fileBuffer)).digest('hex').toLowerCase();
    repository.createVersion.mockResolvedValue(
      创建版本记录({
        file_hash: fileHash,
        file_size: fileBuffer.length,
      }),
    );

    const service = new 更新服务(repository);
    const result = await service.uploadApk(
      { buffer: fileBuffer, size: fileBuffer.length },
      1_002_003,
      'stable',
      fileHash,
      '更新说明',
    );

    expect(repository.deactivateChannel).toHaveBeenCalledWith('stable');
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        version_code: 1_002_003,
        channel: 'stable',
        file_hash: fileHash,
        is_active: 1,
      }),
    );
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(result.versionCode).toBe(1_002_003);
    expect(result.fileHash).toBe(fileHash);
  });

  it('checkUpdate 在没有活跃版本时应返回无更新', async () => {
    const repository = 创建应用版本仓库Mock();
    repository.getActiveVersion.mockResolvedValue(undefined);

    const service = new 更新服务(repository);
    const result = await service.checkUpdate(1_000_000, 'stable');

    expect(result.hasUpdate).toBe(false);
    expect(result.latestVersionCode).toBeNull();
    expect(result.downloadId).toBeNull();
  });

  it('deleteVersion 删除当前活跃版本后应激活最新版本', async () => {
    const repository = 创建应用版本仓库Mock();
    repository.getVersionById.mockResolvedValue(
      创建版本记录({
        id: 1,
        channel: 'stable',
        is_active: 1,
        file_name: 'stable_v1.apk',
      }),
    );
    repository.getLatestVersion.mockResolvedValue(
      创建版本记录({
        id: 2,
        is_active: 0,
        file_name: 'stable_v2.apk',
      }),
    );

    const service = new 更新服务(repository);
    const result = await service.deleteVersion(1);

    expect(result).toBe(true);
    expect(repository.deleteVersion).toHaveBeenCalledWith(1);
    expect(repository.activateVersion).toHaveBeenCalledWith(2);
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('版本工具函数应互相对应', () => {
    expect(semverToVersionCode('1.2.3')).toBe(1_002_003);
    expect(versionCodeToDisplay(1_002_003)).toBe('1.2.3');
  });
});
