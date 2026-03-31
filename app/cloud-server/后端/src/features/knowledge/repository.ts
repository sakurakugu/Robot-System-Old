import type { QueryResultRow } from 'pg';
import type { 可查询数据库 } from '../../infra/db/client';
import type { KnowledgeEntryRecord } from './types';

export interface KnowledgeRepository {
  listKnowledgeEntries(): Promise<KnowledgeEntryRecord[]>;
  createKnowledgeEntry(data: {
    id: string;
    title: string;
    content: string;
    tags: string;
    created_by: string | null;
    updated_by: string | null;
  }): Promise<void>;
  getKnowledgeEntry(id: string): Promise<KnowledgeEntryRecord | undefined>;
  updateKnowledgeEntry(
    id: string,
    data: { title?: string; content?: string; tags?: string; updated_by?: string | null },
  ): Promise<void>;
  deleteKnowledgeEntry(id: string): Promise<void>;
}

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly database: 可查询数据库) {}

  async listKnowledgeEntries(): Promise<KnowledgeEntryRecord[]> {
    const result = await this.database.query<KnowledgeEntryRecord>(
      `SELECT * FROM knowledge_entries
       ORDER BY updated_at DESC`,
    );
    return result.rows;
  }

  async createKnowledgeEntry(data: {
    id: string;
    title: string;
    content: string;
    tags: string;
    created_by: string | null;
    updated_by: string | null;
  }): Promise<void> {
    await this.database.query(
      `INSERT INTO knowledge_entries
        (id, title, content, tags, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [data.id, data.title, data.content, data.tags, data.created_by, data.updated_by],
    );
  }

  getKnowledgeEntry(id: string): Promise<KnowledgeEntryRecord | undefined> {
    return this.queryOne<KnowledgeEntryRecord>(
      'SELECT * FROM knowledge_entries WHERE id = $1 LIMIT 1',
      [id],
    );
  }

  async updateKnowledgeEntry(
    id: string,
    data: { title?: string; content?: string; tags?: string; updated_by?: string | null },
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      fields.push(`title = $${values.length + 1}`);
      values.push(data.title);
    }
    if (data.content !== undefined) {
      fields.push(`content = $${values.length + 1}`);
      values.push(data.content);
    }
    if (data.tags !== undefined) {
      fields.push(`tags = $${values.length + 1}`);
      values.push(data.tags);
    }
    if (data.updated_by !== undefined) {
      fields.push(`updated_by = $${values.length + 1}`);
      values.push(data.updated_by);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await this.database.query(
      `UPDATE knowledge_entries
       SET ${fields.join(', ')}
       WHERE id = $${values.length}`,
      values,
    );
  }

  async deleteKnowledgeEntry(id: string): Promise<void> {
    await this.database.query('DELETE FROM knowledge_entries WHERE id = $1', [id]);
  }

  private async queryOne<T extends QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | undefined> {
    const result = await this.database.query<T>(sql, params);
    return result.rows[0];
  }
}
