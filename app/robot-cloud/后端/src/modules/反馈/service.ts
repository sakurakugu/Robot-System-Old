import { v7 as uuidv7 } from 'uuid';
import type DatabaseService from '../../core/database';
import type { FeedbackListQuery, FeedbackStatus, SubmitFeedbackInput, UpdateFeedbackStatusInput } from './types';

export class 反馈服务 {
  constructor(private database: DatabaseService) {}
  private readonly validStatuses: FeedbackStatus[] = ['pending', 'processing', 'resolved'];

  submit(input: SubmitFeedbackInput, context: {
    clientType: string;
    deviceName: string;
    userId: string | null;
  }) {
    const content = String(input.content || '').trim();
    if (!content) {
      throw new Error('反馈内容不能为空');
    }

    const id = uuidv7();
    this.database.createFeedbackEntry({
      id,
      content,
      client_type: context.clientType,
      device_name: context.deviceName,
      user_id: context.userId,
    });

    return { id };
  }

  list(query: FeedbackListQuery) {
    const limit = Number.isFinite(Number(query.limit)) ? Number(query.limit) : 20;
    const offset = Number.isFinite(Number(query.offset)) ? Number(query.offset) : 0;
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const safeOffset = Math.max(offset, 0);
    const status = this.parseStatus(query.status);
    const items = this.database.listFeedbackEntries(safeLimit, safeOffset, status);
    const total = this.database.getFeedbackEntryCount(status);
    return {
      items,
      total,
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  detail(id: string) {
    const record = this.database.getFeedbackEntryById(id);
    if (!record) {
      throw new Error('反馈不存在');
    }
    return record;
  }

  updateStatus(id: string, input: UpdateFeedbackStatusInput, operatorUserId: string | null) {
    const status = this.parseStatus(input.status);
    if (!status) {
      throw new Error('反馈状态不合法');
    }
    const existing = this.database.getFeedbackEntryById(id);
    if (!existing) {
      throw new Error('反馈不存在');
    }
    this.database.updateFeedbackEntryStatus(id, status, operatorUserId);
    return this.detail(id);
  }

  private parseStatus(value: unknown): FeedbackStatus | undefined {
    const status = String(value || '').trim() as FeedbackStatus;
    if (!status) {
      return undefined;
    }
    if (!this.validStatuses.includes(status)) {
      throw new Error('反馈状态不合法');
    }
    return status;
  }
}
