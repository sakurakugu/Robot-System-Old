import type { QueryResultRow } from 'pg';
import type { 可查询数据库, 可事务数据库 } from '../../core/db/client';
import type { AppVersionRecord, ReleaseChannel } from './types';

type 创建版本输入 = {
  version_name: string;
  version_code: number;
  channel: ReleaseChannel;
  file_name: string;
  file_size: number;
  file_hash: string;
  changelog: string | null;
  is_active: number;
};

type 可用数据库 = 可查询数据库 | 可事务数据库;

function 支持事务(database: 可用数据库): database is 可事务数据库 {
  return typeof (database as 可事务数据库).transaction === 'function';
}

export interface AppVersionRepository {
  withTransaction<T>(callback: (repository: AppVersionRepository) => Promise<T>): Promise<T>;
  createVersion(data: 创建版本输入): Promise<AppVersionRecord>;
  getVersionById(id: number): Promise<AppVersionRecord | undefined>;
  getActiveVersion(channel: ReleaseChannel): Promise<AppVersionRecord | undefined>;
  getLatestVersion(channel: ReleaseChannel): Promise<AppVersionRecord | undefined>;
  listVersions(channel?: ReleaseChannel): Promise<AppVersionRecord[]>;
  deactivateChannel(channel: ReleaseChannel): Promise<void>;
  activateVersion(id: number): Promise<void>;
  deleteVersion(id: number): Promise<void>;
}

export class PostgresAppVersionRepository implements AppVersionRepository {
  constructor(private readonly database: 可用数据库) {}

  async withTransaction<T>(callback: (repository: AppVersionRepository) => Promise<T>): Promise<T> {
    if (!支持事务(this.database)) {
      return callback(this);
    }

    return this.database.transaction(async (transactionDatabase) => {
      return callback(new PostgresAppVersionRepository(transactionDatabase));
    });
  }

  async createVersion(data: 创建版本输入): Promise<AppVersionRecord> {
    const result = await this.database.query<AppVersionRecord>(
      `INSERT INTO app_versions
        (version_name, version_code, channel, file_name, file_size, file_hash, changelog, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.version_name,
        data.version_code,
        data.channel,
        data.file_name,
        data.file_size,
        data.file_hash,
        data.changelog,
        data.is_active,
      ],
    );

    const record = result.rows[0];
    if (!record) {
      throw new Error('创建版本记录失败');
    }
    return record;
  }

  getVersionById(id: number): Promise<AppVersionRecord | undefined> {
    return this.queryOne<AppVersionRecord>(
      'SELECT * FROM app_versions WHERE id = $1 LIMIT 1',
      [id],
    );
  }

  getActiveVersion(channel: ReleaseChannel): Promise<AppVersionRecord | undefined> {
    return this.queryOne<AppVersionRecord>(
      `SELECT * FROM app_versions
       WHERE channel = $1 AND is_active = 1
       ORDER BY version_code DESC
       LIMIT 1`,
      [channel],
    );
  }

  getLatestVersion(channel: ReleaseChannel): Promise<AppVersionRecord | undefined> {
    return this.queryOne<AppVersionRecord>(
      `SELECT * FROM app_versions
       WHERE channel = $1
       ORDER BY version_code DESC, uploaded_at DESC
       LIMIT 1`,
      [channel],
    );
  }

  async listVersions(channel?: ReleaseChannel): Promise<AppVersionRecord[]> {
    const result = channel
      ? await this.database.query<AppVersionRecord>(
          `SELECT * FROM app_versions
           WHERE channel = $1
           ORDER BY version_code DESC, uploaded_at DESC`,
          [channel],
        )
      : await this.database.query<AppVersionRecord>(
          `SELECT * FROM app_versions
           ORDER BY version_code DESC, uploaded_at DESC`,
        );

    return result.rows;
  }

  async deactivateChannel(channel: ReleaseChannel): Promise<void> {
    await this.database.query(
      'UPDATE app_versions SET is_active = 0 WHERE channel = $1',
      [channel],
    );
  }

  async activateVersion(id: number): Promise<void> {
    await this.database.query(
      'UPDATE app_versions SET is_active = 1 WHERE id = $1',
      [id],
    );
  }

  async deleteVersion(id: number): Promise<void> {
    await this.database.query(
      'DELETE FROM app_versions WHERE id = $1',
      [id],
    );
  }

  private async queryOne<T extends QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | undefined> {
    const result = await this.database.query<T>(sql, params);
    return result.rows[0];
  }
}
