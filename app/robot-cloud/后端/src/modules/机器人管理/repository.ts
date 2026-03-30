import type { QueryResultRow } from 'pg';
import type { 可查询数据库 } from '../../core/db/client';
import type { RoleRecord } from '../角色管理/types';
import type { RobotRecord } from './types';

type 机器人写入数据 = Partial<RobotRecord> & { uuid: string };

const 可更新字段: Array<keyof RobotRecord> = [
  'name',
  'model',
  'version',
  'motion_control_version',
  'server_version',
  'ip',
  'group_name',
  'tags',
  'sn',
  'role_uuid',
  'audio_route_config',
  'status',
  'last_connected_at',
];

export interface RobotRepository {
  listRobots(): Promise<RobotRecord[]>;
  getRobot(uuid: string): Promise<RobotRecord | undefined>;
  listGroups(): Promise<string[]>;
  upsertRobot(data: 机器人写入数据): Promise<void>;
  updateRobot(uuid: string, data: Partial<RobotRecord>): Promise<void>;
  deleteRobot(uuid: string): Promise<void>;
  getRoleById(uuid: string): Promise<RoleRecord | undefined>;
}

export class PostgresRobotRepository implements RobotRepository {
  constructor(private readonly database: 可查询数据库) {}

  async listRobots(): Promise<RobotRecord[]> {
    const result = await this.database.query<RobotRecord>(
      'SELECT * FROM robots ORDER BY last_connected_at DESC NULLS LAST, created_at DESC',
    );
    return result.rows;
  }

  getRobot(uuid: string): Promise<RobotRecord | undefined> {
    return this.queryOne<RobotRecord>(
      'SELECT * FROM robots WHERE uuid = $1 LIMIT 1',
      [uuid],
    );
  }

  async listGroups(): Promise<string[]> {
    const result = await this.database.query<{ group_name: string }>(
      `SELECT DISTINCT group_name
       FROM robots
       WHERE group_name IS NOT NULL
       ORDER BY group_name`,
    );
    return result.rows.map((row) => row.group_name);
  }

  async upsertRobot(data: 机器人写入数据): Promise<void> {
    await this.database.query(
      `INSERT INTO robots
        (uuid, name, model, version, motion_control_version, server_version, ip, group_name, tags, sn,
         role_uuid, audio_route_config, status, last_connected_at, registered_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
       ON CONFLICT(uuid) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, robots.name),
         model = COALESCE(EXCLUDED.model, robots.model),
         version = COALESCE(EXCLUDED.version, robots.version),
         motion_control_version = COALESCE(EXCLUDED.motion_control_version, robots.motion_control_version),
         server_version = COALESCE(EXCLUDED.server_version, robots.server_version),
         ip = COALESCE(EXCLUDED.ip, robots.ip),
         group_name = COALESCE(EXCLUDED.group_name, robots.group_name),
         tags = COALESCE(EXCLUDED.tags, robots.tags),
         sn = COALESCE(EXCLUDED.sn, robots.sn),
         role_uuid = COALESCE(EXCLUDED.role_uuid, robots.role_uuid),
         audio_route_config = COALESCE(EXCLUDED.audio_route_config, robots.audio_route_config),
         status = COALESCE(EXCLUDED.status, robots.status),
         last_connected_at = COALESCE(EXCLUDED.last_connected_at, robots.last_connected_at),
         updated_at = CURRENT_TIMESTAMP`,
      [
        data.uuid,
        data.name ?? null,
        data.model ?? null,
        data.version ?? null,
        data.motion_control_version ?? null,
        data.server_version ?? null,
        data.ip ?? null,
        data.group_name ?? null,
        data.tags ?? null,
        data.sn ?? null,
        data.role_uuid ?? null,
        data.audio_route_config ?? null,
        data.status ?? 'offline',
        data.last_connected_at ?? null,
        data.registered_at ?? null,
      ],
    );
  }

  async updateRobot(uuid: string, data: Partial<RobotRecord>): Promise<void> {
    const 赋值片段: string[] = [];
    const 参数: unknown[] = [];

    for (const field of 可更新字段) {
      if (data[field] !== undefined) {
        参数.push(data[field] ?? null);
        赋值片段.push(`${field} = $${参数.length}`);
      }
    }

    if (赋值片段.length === 0) {
      return;
    }

    参数.push(uuid);
    await this.database.query(
      `UPDATE robots
       SET ${赋值片段.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE uuid = $${参数.length}`,
      参数,
    );
  }

  async deleteRobot(uuid: string): Promise<void> {
    await this.database.query(
      'DELETE FROM robots WHERE uuid = $1',
      [uuid],
    );
  }

  getRoleById(uuid: string): Promise<RoleRecord | undefined> {
    return this.queryOne<RoleRecord>(
      'SELECT * FROM roles WHERE uuid = $1 LIMIT 1',
      [uuid],
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
