import { Pool, types, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import 配置 from '../../config';

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(21, (value) => Number(value));
types.setTypeParser(23, (value) => Number(value));

export type 查询参数 = readonly unknown[];

export interface 可查询数据库 {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: 查询参数,
  ): Promise<QueryResult<T>>;
}

export interface 可事务数据库 extends 可查询数据库 {
  transaction<T>(callback: (database: 可查询数据库) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class PostgreSQL事务客户端 implements 可查询数据库 {
  constructor(private readonly client: PoolClient) {}

  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: 查询参数 = [],
  ): Promise<QueryResult<T>> {
    return this.client.query<T>(sql, params as any[]);
  }
}

export class PostgreSQL数据库客户端 implements 可事务数据库 {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: 配置.database.host,
      port: 配置.database.port,
      user: 配置.database.user,
      password: 配置.database.password,
      database: 配置.database.database,
      connectionString: 配置.database.connectionString,
    });
  }

  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: 查询参数 = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params as any[]);
  }

  async transaction<T>(callback: (database: 可查询数据库) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const database = new PostgreSQL事务客户端(client);
      const result = await callback(database);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // 忽略回滚阶段的异常，保留原始错误
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
