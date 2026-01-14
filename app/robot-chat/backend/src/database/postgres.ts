import { Pool, PoolConfig } from 'pg';

export type PgRobot = {
  uuid: string;
  name?: string | null;
  model?: string | null;
  status?: 'online' | 'offline' | 'connecting' | 'error' | 'error' | string | null;
  last_connected?: string | null;
  robot_ip?: string | null;
  local_ip?: string | null;
  local_port?: number | null;
  group_name?: string | null;
};

export class PostgresService {
  private pool: Pool;
  private initialized = false;

  constructor() {
    const ssl = process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined;
    const connectionString = process.env.DATABASE_URL || process.env.PGURL;
    if (connectionString) {
      this.pool = new Pool({ connectionString, ssl });
      return;
    }
    const cfg: PoolConfig = {
      host: process.env.PGHOST,
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
      user: process.env.PGUSER,
      database: process.env.PGDATABASE,
      ssl,
    };
    if (typeof process.env.PGPASSWORD === 'string') {
      cfg.password = process.env.PGPASSWORD;
    }
    this.pool = new Pool(cfg);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.ensureTables();
    this.initialized = true;
  }

  private async ensureTables(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS robots (
        uuid TEXT PRIMARY KEY,
        name TEXT,
        model TEXT,
        status TEXT DEFAULT 'offline',
        last_connected TIMESTAMP NULL,
        robot_ip TEXT,
        local_ip TEXT,
        local_port INTEGER,
        group_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.pool.query(sql);
  }

  async getAllRobots(): Promise<PgRobot[]> {
    await this.init();
    const res = await this.pool.query('SELECT * FROM robots ORDER BY COALESCE(last_connected, created_at) DESC');
    return res.rows.map((r) => ({
      uuid: r.uuid,
      name: r.name || null,
      model: r.model || null,
      status: r.status || 'offline',
      last_connected: r.last_connected ? new Date(r.last_connected).toISOString() : null,
      robot_ip: r.robot_ip || null,
      local_ip: r.local_ip || null,
      local_port: r.local_port ?? null,
      group_name: r.group_name || null,
    }));
  }

  async getRobot(uuid: string): Promise<PgRobot | null> {
    await this.init();
    const res = await this.pool.query('SELECT * FROM robots WHERE uuid = $1', [uuid]);
    const r = res.rows[0];
    if (!r) return null;
    return {
      uuid: r.uuid,
      name: r.name || null,
      model: r.model || null,
      status: r.status || 'offline',
      last_connected: r.last_connected ? new Date(r.last_connected).toISOString() : null,
      robot_ip: r.robot_ip || null,
      local_ip: r.local_ip || null,
      local_port: r.local_port ?? null,
      group_name: r.group_name || null,
    };
  }

  async createRobot(data: Omit<PgRobot, 'uuid'> & { uuid?: string }): Promise<PgRobot> {
    await this.init();
    const uuid = data.uuid || crypto.randomUUID();
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO robots (uuid, name, model, status, last_connected, robot_ip, local_ip, local_port, group_name, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (uuid) DO UPDATE SET
        name = EXCLUDED.name,
        model = EXCLUDED.model,
        status = EXCLUDED.status,
        last_connected = EXCLUDED.last_connected,
        robot_ip = EXCLUDED.robot_ip,
        local_ip = EXCLUDED.local_ip,
        local_port = EXCLUDED.local_port,
        group_name = EXCLUDED.group_name
      RETURNING *;
    `;
    const res = await this.pool.query(sql, [
      uuid,
      data.name ?? null,
      data.model ?? null,
      data.status ?? 'offline',
      data.last_connected ? new Date(data.last_connected).toISOString() : null,
      data.robot_ip ?? null,
      data.local_ip ?? null,
      data.local_port ?? null,
      data.group_name ?? null,
      now,
    ]);
    const r = res.rows[0];
    return {
      uuid: r.uuid,
      name: r.name || null,
      model: r.model || null,
      status: r.status || 'offline',
      last_connected: r.last_connected ? new Date(r.last_connected).toISOString() : null,
      robot_ip: r.robot_ip || null,
      local_ip: r.local_ip || null,
      local_port: r.local_port ?? null,
      group_name: r.group_name || null,
    };
  }

  async updateRobot(uuid: string, data: Partial<PgRobot>): Promise<PgRobot | null> {
    await this.init();
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = $${i++}`);
      values.push(v);
    }
    if (fields.length === 0) {
      const r = await this.getRobot(uuid);
      return r;
    }
    const sql = `UPDATE robots SET ${fields.join(', ')} WHERE uuid = $${i} RETURNING *`;
    values.push(uuid);
    const res = await this.pool.query(sql, values);
    const r = res.rows[0];
    if (!r) return null;
    return {
      uuid: r.uuid,
      name: r.name || null,
      model: r.model || null,
      status: r.status || 'offline',
      last_connected: r.last_connected ? new Date(r.last_connected).toISOString() : null,
      robot_ip: r.robot_ip || null,
      local_ip: r.local_ip || null,
      local_port: r.local_port ?? null,
      group_name: r.group_name || null,
    };
  }

  async deleteRobot(uuid: string): Promise<void> {
    await this.init();
    await this.pool.query('DELETE FROM robots WHERE uuid = $1', [uuid]);
  }
}
