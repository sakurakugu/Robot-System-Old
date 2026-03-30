import type { RoleRepository } from './repository';
import { 角色服务 } from './service';
import type { RoleRecord } from './types';

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'role-1'),
}));

function 创建角色仓库Mock(): jest.Mocked<RoleRepository> {
  return {
    createRole: jest.fn(),
    getDefaultRole: jest.fn(),
    getRole: jest.fn(),
    getAllRoles: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    getRobotsByRole: jest.fn(),
  };
}

function 创建角色记录(partial: Partial<RoleRecord> = {}): RoleRecord {
  return {
    uuid: 'role-1',
    name: '测试角色',
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

describe('角色服务', () => {
  it('createRole 应创建并返回角色', async () => {
    const repository = 创建角色仓库Mock();
    repository.createRole.mockResolvedValue(创建角色记录());

    const service = new 角色服务(repository);
    const result = await service.createRole({ name: '测试角色' });

    expect(repository.createRole).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 'role-1',
        name: '测试角色',
      }),
    );
    expect(result.uuid).toBe('role-1');
  });

  it('deleteRole 不应删除默认角色', async () => {
    const repository = 创建角色仓库Mock();
    repository.getRole.mockResolvedValue(创建角色记录({ is_default: 1 }));

    const service = new 角色服务(repository);

    await expect(service.deleteRole('role-1')).rejects.toThrow('默认角色无法删除');
  });

  it('deleteRole 在角色被机器人使用时应报错', async () => {
    const repository = 创建角色仓库Mock();
    repository.getRole.mockResolvedValue(创建角色记录());
    repository.getRobotsByRole.mockResolvedValue([{ uuid: 'robot-1', name: '一号狗' }]);

    const service = new 角色服务(repository);

    await expect(service.deleteRole('role-1')).rejects.toThrow('有 1 个机器人正在使用此角色，无法删除');
  });
});
