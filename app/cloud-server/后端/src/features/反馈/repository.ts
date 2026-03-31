import type { QueryResultRow } from 'pg';
import type { 可查询数据库 } from '../../infra/db/client';
import type { FeedbackListItem, FeedbackStatus } from './types';

export interface FeedbackRepository {
  createFeedbackEntry(data: {
    id: string;
    content: string;
    client_type: string;
    device_name: string;
    user_id: string | null;
  }): Promise<void>;
  listFeedbackEntries(limit: number, offset: number, status?: FeedbackStatus): Promise<FeedbackListItem[]>;
  getFeedbackEntryById(id: string): Promise<FeedbackListItem | null>;
  updateFeedbackEntryStatus(id: string, status: FeedbackStatus, handledBy: string | null): Promise<void>;
  getFeedbackEntryCount(status?: FeedbackStatus): Promise<number>;
}

export class PostgresFeedbackRepository implements FeedbackRepository {
  constructor(private readonly database: 可查询数据库) {}

  async createFeedbackEntry(data: {
    id: string;
    content: string;
    client_type: string;
    device_name: string;
    user_id: string | null;
  }): Promise<void> {
    await this.database.query(
      `INSERT INTO feedback_entries
        (id, content, client_type, device_name, user_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [data.id, data.content, data.client_type, data.device_name, data.user_id],
    );
  }

  async listFeedbackEntries(limit: number, offset: number, status?: FeedbackStatus): Promise<FeedbackListItem[]> {
    if (status) {
      const result = await this.database.query<FeedbackListItem>(
        `SELECT
           f.*,
           u.username AS username,
           hu.username AS handled_by_username
         FROM feedback_entries f
         LEFT JOIN users u ON u.id = f.user_id
         LEFT JOIN users hu ON hu.id = f.handled_by
         WHERE f.status = $1
         ORDER BY f.created_at DESC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset],
      );
      return result.rows;
    }

    const result = await this.database.query<FeedbackListItem>(
      `SELECT
         f.*,
         u.username AS username,
         hu.username AS handled_by_username
       FROM feedback_entries f
       LEFT JOIN users u ON u.id = f.user_id
       LEFT JOIN users hu ON hu.id = f.handled_by
       ORDER BY f.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  }

  async getFeedbackEntryById(id: string): Promise<FeedbackListItem | null> {
    const result = await this.database.query<FeedbackListItem>(
      `SELECT
         f.*,
         u.username AS username,
         hu.username AS handled_by_username
       FROM feedback_entries f
       LEFT JOIN users u ON u.id = f.user_id
       LEFT JOIN users hu ON hu.id = f.handled_by
       WHERE f.id = $1
       LIMIT 1`,
      [id],
    );
    return result.rows[0] || null;
  }

  async updateFeedbackEntryStatus(id: string, status: FeedbackStatus, handledBy: string | null): Promise<void> {
    if (status === 'pending') {
      await this.database.query(
        `UPDATE feedback_entries
         SET status = $1, handled_by = NULL, handled_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [status, id],
      );
      return;
    }

    await this.database.query(
      `UPDATE feedback_entries
       SET status = $1, handled_by = $2, handled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status, handledBy, id],
    );
  }

  async getFeedbackEntryCount(status?: FeedbackStatus): Promise<number> {
    if (status) {
      const row = await this.queryOne<{ total: number }>(
        'SELECT COUNT(1)::int AS total FROM feedback_entries WHERE status = $1',
        [status],
      );
      return Number(row?.total || 0);
    }

    const row = await this.queryOne<{ total: number }>(
      'SELECT COUNT(1)::int AS total FROM feedback_entries',
    );
    return Number(row?.total || 0);
  }

  private async queryOne<T extends QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | undefined> {
    const result = await this.database.query<T>(sql, params);
    return result.rows[0];
  }
}
