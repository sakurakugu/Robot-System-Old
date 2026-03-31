import type { QueryResultRow } from 'pg';
import type { 可事务数据库, 可查询数据库 } from '../../infra/db/client';
import type { ReleaseChannel, RobotPackageRecord } from './types';

type 创建机器人包版本输入 = {
  version_code: number;
  channel: ReleaseChannel;
  changelog: string | null;
  is_active: number;
  agent_file_name: string | null;
  agent_file_size: number | null;
  agent_file_hash: string | null;
  server_file_name: string | null;
  server_file_size: number | null;
  server_file_hash: string | null;
  common_file_name: string | null;
  common_file_size: number | null;
  common_file_hash: string | null;
};

type 可用数据库 = 可查询数据库 | 可事务数据库;

function 支持事务(database: 可用数据库): database is 可事务数据库 {
  return typeof (database as 可事务数据库).transaction === 'function';
}

export interface RobotPackageRepository {
  withTransaction<T>(callback: (repository: RobotPackageRepository) => Promise<T>): Promise<T>;
  createVersion(data: 创建机器人包版本输入): Promise<RobotPackageRecord>;
  getVersionById(id: number): Promise<RobotPackageRecord | undefined>;
  listVersions(channel?: ReleaseChannel): Promise<RobotPackageRecord[]>;
  deactivateChannel(channel: ReleaseChannel): Promise<void>;
  activateVersion(id: number): Promise<void>;
  deleteVersion(id: number): Promise<void>;
  getActiveVersion(channel: ReleaseChannel): Promise<RobotPackageRecord | undefined>;
}

export class PostgresRobotPackageRepository implements RobotPackageRepository {
  constructor(private readonly database: 可用数据库) {}

  async withTransaction<T>(callback: (repository: RobotPackageRepository) => Promise<T>): Promise<T> {
    if (!支持事务(this.database)) {
      return callback(this);
    }

    return this.database.transaction(async (transactionDatabase) => {
      return callback(new PostgresRobotPackageRepository(transactionDatabase));
    });
  }

  async createVersion(data: 创建机器人包版本输入): Promise<RobotPackageRecord> {
    const result = await this.database.query<RobotPackageRecord>(
      `INSERT INTO robot_package_versions
        (version_code, channel, changelog, is_active,
         agent_file_name, agent_file_size, agent_file_hash,
         server_file_name, server_file_size, server_file_hash,
         common_file_name, common_file_size, common_file_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        data.version_code,
        data.channel,
        data.changelog,
        data.is_active,
        data.agent_file_name,
        data.agent_file_size,
        data.agent_file_hash,
        data.server_file_name,
        data.server_file_size,
        data.server_file_hash,
        data.common_file_name,
        data.common_file_size,
        data.common_file_hash,
      ],
    );

    const record = result.rows[0];
    if (!record) {
      throw new Error('创建机器人包版本失败');
    }
    return record;
  }

  getVersionById(id: number): Promise<RobotPackageRecord | undefined> {
    return this.queryOne<RobotPackageRecord>(
      'SELECT * FROM robot_package_versions WHERE id = $1 LIMIT 1',
      [id],
    );
  }

  async listVersions(channel?: ReleaseChannel): Promise<RobotPackageRecord[]> {
    const result = channel
      ? await this.database.query<RobotPackageRecord>(
          `SELECT * FROM robot_package_versions
           WHERE channel = $1
           ORDER BY version_code DESC, id DESC`,
          [channel],
        )
      : await this.database.query<RobotPackageRecord>(
          `SELECT * FROM robot_package_versions
           ORDER BY version_code DESC, id DESC`,
        );

    return result.rows;
  }

  async deactivateChannel(channel: ReleaseChannel): Promise<void> {
    await this.database.query(
      'UPDATE robot_package_versions SET is_active = 0 WHERE channel = $1',
      [channel],
    );
  }

  async activateVersion(id: number): Promise<void> {
    await this.database.query(
      'UPDATE robot_package_versions SET is_active = 1 WHERE id = $1',
      [id],
    );
  }

  async deleteVersion(id: number): Promise<void> {
    await this.database.query(
      'DELETE FROM robot_package_versions WHERE id = $1',
      [id],
    );
  }

  getActiveVersion(channel: ReleaseChannel): Promise<RobotPackageRecord | undefined> {
    return this.queryOne<RobotPackageRecord>(
      `SELECT * FROM robot_package_versions
       WHERE channel = $1 AND is_active = 1
       ORDER BY id DESC
       LIMIT 1`,
      [channel],
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
