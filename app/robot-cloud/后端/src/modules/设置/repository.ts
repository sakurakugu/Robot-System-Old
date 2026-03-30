import type { QueryResultRow } from 'pg';
import type { 可查询数据库 } from '../../core/db/client';

type 设置行 = {
  key: string;
  value: string;
};

export interface SettingsRepository {
  getSetting(key: string): Promise<string | undefined>;
  getSettings(keys: string[]): Promise<Record<string, string>>;
  getAllSettings(): Promise<Record<string, string>>;
  setSetting(key: string, value: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;
}

export class PostgresSettingsRepository implements SettingsRepository {
  constructor(private readonly database: 可查询数据库) {}

  async getSetting(key: string): Promise<string | undefined> {
    const row = await this.queryOne<{ value: string }>(
      'SELECT value FROM settings WHERE key = $1 LIMIT 1',
      [key],
    );
    return row?.value;
  }

  async getSettings(keys: string[]): Promise<Record<string, string>> {
    if (keys.length === 0) {
      return {};
    }

    const result = await this.database.query<设置行>(
      'SELECT key, value FROM settings WHERE key = ANY($1::text[])',
      [keys],
    );
    return this.toMap(result.rows);
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const result = await this.database.query<设置行>(
      'SELECT key, value FROM settings',
    );
    return this.toMap(result.rows);
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.database.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [key, value],
    );
  }

  async deleteSetting(key: string): Promise<void> {
    await this.database.query(
      'DELETE FROM settings WHERE key = $1',
      [key],
    );
  }

  private async queryOne<T extends QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | undefined> {
    const result = await this.database.query<T>(sql, params);
    return result.rows[0];
  }

  private toMap(rows: 设置行[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  }
}
