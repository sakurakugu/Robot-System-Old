import type { FeedbackRepository } from './repository';
import { 反馈服务 } from './service';
import type { FeedbackListItem } from './types';

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'feedback-1'),
}));

function 创建反馈仓库Mock(): jest.Mocked<FeedbackRepository> {
  return {
    createFeedbackEntry: jest.fn(),
    listFeedbackEntries: jest.fn(),
    getFeedbackEntryById: jest.fn(),
    updateFeedbackEntryStatus: jest.fn(),
    getFeedbackEntryCount: jest.fn(),
  };
}

function 创建反馈记录(): FeedbackListItem {
  return {
    id: 'feedback-1',
    content: '很好',
    client_type: 'web',
    device_name: 'Chrome',
    user_id: 'user-1',
    status: 'pending',
    handled_by: null,
    handled_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    username: 'tester',
    handled_by_username: null,
  };
}

describe('反馈服务', () => {
  it('submit 应校验反馈内容', async () => {
    const repository = 创建反馈仓库Mock();
    const service = new 反馈服务(repository);

    await expect(
      service.submit({ content: '   ' }, { clientType: 'web', deviceName: 'Chrome', userId: null }),
    ).rejects.toThrow('反馈内容不能为空');
  });

  it('list 应限制分页边界并返回总数', async () => {
    const repository = 创建反馈仓库Mock();
    repository.listFeedbackEntries.mockResolvedValue([创建反馈记录()]);
    repository.getFeedbackEntryCount.mockResolvedValue(1);

    const service = new 反馈服务(repository);
    const result = await service.list({ limit: 999, offset: -10, status: 'pending' });

    expect(repository.listFeedbackEntries).toHaveBeenCalledWith(200, 0, 'pending');
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('updateStatus 应在反馈不存在时报错', async () => {
    const repository = 创建反馈仓库Mock();
    repository.getFeedbackEntryById.mockResolvedValue(null);

    const service = new 反馈服务(repository);

    await expect(
      service.updateStatus('feedback-1', { status: 'resolved' }, 'user-1'),
    ).rejects.toThrow('反馈不存在');
  });
});
