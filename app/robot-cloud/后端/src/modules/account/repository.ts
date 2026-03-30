import type { QueryResultRow } from 'pg';
import type { 可查询数据库, 可事务数据库 } from '../../core/db/client';
import type { AccountRole, ClientType, UserRecord, UserSessionRecord } from './types';

type 创建用户输入 = {
  id: string;
  username: string;
  password_hash: string;
  role: AccountRole;
};

type 创建会话输入 = {
  id: string;
  user_id: string;
  token_hash: string;
  client_type: ClientType;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
};

type 可用数据库 = 可查询数据库 | 可事务数据库;

function 支持事务(database: 可用数据库): database is 可事务数据库 {
  return typeof (database as 可事务数据库).transaction === 'function';
}

export interface AccountRepository {
  withTransaction<T>(callback: (repository: AccountRepository) => Promise<T>): Promise<T>;
  lockUsersTable(): Promise<void>;
  countUsers(): Promise<number>;
  countUsersByRole(role: AccountRole): Promise<number>;
  createUser(data: 创建用户输入): Promise<void>;
  getUserById(id: string): Promise<UserRecord | undefined>;
  getUserByUsername(username: string): Promise<UserRecord | undefined>;
  listUsers(): Promise<UserRecord[]>;
  touchUserLogin(id: string): Promise<void>;
  updateUserRole(id: string, role: AccountRole): Promise<void>;
  createUserSession(data: 创建会话输入): Promise<void>;
  getUserSessionById(id: string): Promise<UserSessionRecord | undefined>;
  getUserSessionByTokenHash(tokenHash: string): Promise<UserSessionRecord | undefined>;
  listUserSessions(userId: string): Promise<UserSessionRecord[]>;
  touchUserSession(id: string): Promise<void>;
  revokeUserSession(id: string): Promise<void>;
}

export class PostgresAccountRepository implements AccountRepository {
  constructor(private readonly database: 可用数据库) {}

  async withTransaction<T>(callback: (repository: AccountRepository) => Promise<T>): Promise<T> {
    if (!支持事务(this.database)) {
      return callback(this);
    }

    return this.database.transaction(async (transactionDatabase) => {
      return callback(new PostgresAccountRepository(transactionDatabase));
    });
  }

  async lockUsersTable(): Promise<void> {
    await this.database.query('LOCK TABLE users IN EXCLUSIVE MODE');
  }

  async countUsers(): Promise<number> {
    const row = await this.queryOne<{ count: number }>(
      'SELECT COUNT(1)::int AS count FROM users',
    );
    return Number(row?.count || 0);
  }

  async countUsersByRole(role: AccountRole): Promise<number> {
    const row = await this.queryOne<{ count: number }>(
      'SELECT COUNT(1)::int AS count FROM users WHERE role = $1',
      [role],
    );
    return Number(row?.count || 0);
  }

  async createUser(data: 创建用户输入): Promise<void> {
    await this.database.query(
      `INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [data.id, data.username, data.password_hash, data.role],
    );
  }

  getUserById(id: string): Promise<UserRecord | undefined> {
    return this.queryOne<UserRecord>('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  }

  getUserByUsername(username: string): Promise<UserRecord | undefined> {
    return this.queryOne<UserRecord>('SELECT * FROM users WHERE username = $1 LIMIT 1', [username]);
  }

  async listUsers(): Promise<UserRecord[]> {
    const result = await this.database.query<UserRecord>(
      'SELECT * FROM users ORDER BY created_at ASC',
    );
    return result.rows;
  }

  async touchUserLogin(id: string): Promise<void> {
    await this.database.query(
      `UPDATE users
       SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id],
    );
  }

  async updateUserRole(id: string, role: AccountRole): Promise<void> {
    await this.database.query(
      `UPDATE users
       SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [role, id],
    );
  }

  async createUserSession(data: 创建会话输入): Promise<void> {
    await this.database.query(
      `INSERT INTO user_sessions
        (id, user_id, token_hash, client_type, device_name, ip_address, user_agent, created_at, last_seen_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)`,
      [
        data.id,
        data.user_id,
        data.token_hash,
        data.client_type,
        data.device_name,
        data.ip_address,
        data.user_agent,
        data.expires_at,
      ],
    );
  }

  getUserSessionById(id: string): Promise<UserSessionRecord | undefined> {
    return this.queryOne<UserSessionRecord>(
      'SELECT * FROM user_sessions WHERE id = $1 LIMIT 1',
      [id],
    );
  }

  getUserSessionByTokenHash(tokenHash: string): Promise<UserSessionRecord | undefined> {
    return this.queryOne<UserSessionRecord>(
      'SELECT * FROM user_sessions WHERE token_hash = $1 LIMIT 1',
      [tokenHash],
    );
  }

  async listUserSessions(userId: string): Promise<UserSessionRecord[]> {
    const result = await this.database.query<UserSessionRecord>(
      `SELECT * FROM user_sessions
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY last_seen_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async touchUserSession(id: string): Promise<void> {
    await this.database.query(
      `UPDATE user_sessions
       SET last_seen_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND revoked_at IS NULL`,
      [id],
    );
  }

  async revokeUserSession(id: string): Promise<void> {
    await this.database.query(
      `UPDATE user_sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND revoked_at IS NULL`,
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
