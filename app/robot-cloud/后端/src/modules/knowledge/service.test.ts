import type { KnowledgeRepository } from './repository';
import { KnowledgeService } from './service';
import type { KnowledgeEntryRecord } from './types';

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'knowledge-1'),
}));

function 创建知识仓库Mock(): jest.Mocked<KnowledgeRepository> {
  return {
    listKnowledgeEntries: jest.fn(),
    createKnowledgeEntry: jest.fn(),
    getKnowledgeEntry: jest.fn(),
    updateKnowledgeEntry: jest.fn(),
    deleteKnowledgeEntry: jest.fn(),
  };
}

function 创建知识记录(): KnowledgeEntryRecord {
  return {
    id: 'knowledge-1',
    title: '标题',
    content: '内容',
    tags: '["a","b"]',
    created_by: 'user-1',
    updated_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('KnowledgeService', () => {
  it('list 应将 tags JSON 转为数组', async () => {
    const repository = 创建知识仓库Mock();
    repository.listKnowledgeEntries.mockResolvedValue([创建知识记录()]);

    const service = new KnowledgeService(repository);
    const result = await service.list();

    expect(result[0].tags).toEqual(['a', 'b']);
    expect(result[0].createdBy).toBe('user-1');
  });

  it('create 应校验标题和内容', async () => {
    const repository = 创建知识仓库Mock();
    const service = new KnowledgeService(repository);

    await expect(service.create({ title: ' ', content: '内容' }, 'user-1')).rejects.toThrow('标题不能为空');
    await expect(service.create({ title: '标题', content: ' ' }, 'user-1')).rejects.toThrow('内容不能为空');
  });

  it('update 不存在的知识条目时应报错', async () => {
    const repository = 创建知识仓库Mock();
    repository.getKnowledgeEntry.mockResolvedValue(undefined);

    const service = new KnowledgeService(repository);

    await expect(service.update('knowledge-1', { title: '新标题' }, 'user-1')).rejects.toThrow('知识条目不存在');
  });
});
