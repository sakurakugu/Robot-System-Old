import type { QueryResultRow } from 'pg';
import type { 可查询数据库 } from '../../infra/db/client';
import type { RoleRecord } from './types';

export interface RoleRobotRecord {
  uuid: string;
  name: string | null;
}

export interface RoleRepository {
  createRole(data: {
    uuid: string;
    name: string;
    description?: string;
    llm_provider?: string;
    llm_model?: string;
    temperature?: number;
    system_prompt?: string;
    voice?: string;
    asr_provider?: string;
    asr_model?: string;
    intent_strategy?: string;
    max_history?: number;
    is_default?: number;
  }): Promise<RoleRecord | undefined>;
  getDefaultRole(): Promise<RoleRecord | undefined>;
  getRole(uuid: string): Promise<RoleRecord | undefined>;
  getAllRoles(): Promise<RoleRecord[]>;
  updateRole(
    uuid: string,
    data: Partial<Omit<RoleRecord, 'uuid' | 'created_at' | 'updated_at'>>,
  ): Promise<RoleRecord | undefined>;
  deleteRole(uuid: string): Promise<void>;
  getRobotsByRole(roleId: string): Promise<RoleRobotRecord[]>;
}

export class PostgresRoleRepository implements RoleRepository {
  constructor(private readonly database: 可查询数据库) {}

  async createRole(data: {
    uuid: string;
    name: string;
    description?: string;
    llm_provider?: string;
    llm_model?: string;
    temperature?: number;
    system_prompt?: string;
    voice?: string;
    asr_provider?: string;
    asr_model?: string;
    intent_strategy?: string;
    max_history?: number;
    is_default?: number;
  }): Promise<RoleRecord | undefined> {
    await this.database.query(
      `INSERT INTO roles
        (uuid, name, description, llm_provider, llm_model, temperature, system_prompt, voice, asr_provider, asr_model, intent_strategy, max_history, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        data.uuid,
        data.name,
        data.description ?? null,
        data.llm_provider ?? null,
        data.llm_model ?? null,
        data.temperature ?? 0.7,
        data.system_prompt ?? null,
        data.voice ?? null,
        data.asr_provider ?? 'aliyun',
        data.asr_model ?? null,
        data.intent_strategy ?? null,
        data.max_history ?? 10,
        data.is_default ?? 0,
      ],
    );

    return this.getRole(data.uuid);
  }

  getRole(uuid: string): Promise<RoleRecord | undefined> {
    return this.queryOne<RoleRecord>('SELECT * FROM roles WHERE uuid = $1 LIMIT 1', [uuid]);
  }

  getDefaultRole(): Promise<RoleRecord | undefined> {
    return this.queryOne<RoleRecord>(
      `SELECT *
       FROM roles
       WHERE is_default = 1 OR uuid = 'default-role'
       ORDER BY is_default DESC, created_at ASC
       LIMIT 1`,
    );
  }

  async getAllRoles(): Promise<RoleRecord[]> {
    const result = await this.database.query<RoleRecord>(
      'SELECT * FROM roles ORDER BY created_at DESC',
    );
    return result.rows;
  }

  async updateRole(
    uuid: string,
    data: Partial<Omit<RoleRecord, 'uuid' | 'created_at' | 'updated_at'>>,
  ): Promise<RoleRecord | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowedFields: Array<keyof Omit<RoleRecord, 'uuid' | 'created_at' | 'updated_at'>> = [
      'name',
      'description',
      'llm_provider',
      'llm_model',
      'temperature',
      'system_prompt',
      'voice',
      'asr_provider',
      'asr_model',
      'intent_strategy',
      'max_history',
      'is_default',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${values.length + 1}`);
        values.push(data[field] ?? null);
      }
    }

    if (fields.length === 0) {
      return this.getRole(uuid);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(uuid);

    await this.database.query(
      `UPDATE roles
       SET ${fields.join(', ')}
       WHERE uuid = $${values.length}`,
      values,
    );

    return this.getRole(uuid);
  }

  async deleteRole(uuid: string): Promise<void> {
    await this.database.query('DELETE FROM roles WHERE uuid = $1', [uuid]);
  }

  async getRobotsByRole(roleId: string): Promise<RoleRobotRecord[]> {
    const result = await this.database.query<RoleRobotRecord>(
      'SELECT uuid, name FROM robots WHERE role_uuid = $1',
      [roleId],
    );
    return result.rows;
  }

  private async queryOne<T extends QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | undefined> {
    const result = await this.database.query<T>(sql, params);
    return result.rows[0];
  }
}
