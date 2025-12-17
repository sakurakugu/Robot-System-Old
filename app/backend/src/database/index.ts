import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { PATHS, CONFIG } from '../config';

const sqlite = sqlite3.verbose(); // 使用 verbose 模式以获得更详细的调试信息

// 基础数据库类
export class Database {
  private db: sqlite3.Database | null = null;

  constructor(private dbPath: string) { } // 数据库文件路径

  // 打开数据库连接
  async open(): Promise<void> {
    // 确保目录存在
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 打开数据库连接
    return new Promise((resolve, reject) => {
      this.db = new sqlite.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // 关闭数据库连接
  async close(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // 执行SQL语句（不返回结果）
  async run(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) throw new Error('Database not opened');
    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // 查询单条记录
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (!this.db) throw new Error('Database not opened');
    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  // 查询多条记录
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database not opened');
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }
}

// 主数据库单例
let mainDatabase: Database | null = null;

// 获取主数据库实例
export async function getMainDatabase(): Promise<Database> {
  if (!mainDatabase) {
    mainDatabase = new Database(PATHS.mainDb);
    await mainDatabase.open();

    // 启用外键支持
    await mainDatabase.run('PRAGMA foreign_keys = ON');
  }
  return mainDatabase;
}

// 初始化主数据库表结构
export async function initMainDatabase(): Promise<void> {
  const db = await getMainDatabase();

  // 用户表
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      uuid TEXT PRIMARY KEY,                                             -- 用户唯一标识(uuidv7)
      username TEXT NOT NULL,                                            -- 用户名
      password_hash TEXT,                                                -- 密码哈希值
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),   -- 创建时间(UTC时间, ISO 8601格式)
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))    -- 更新时间(UTC时间, ISO 8601格式)
    )
  `);

  // 创建默认用户
  const defaultUser = await db.get(
    'SELECT * FROM users WHERE uuid = ?',
    ['00000000-0000-0000-0000-000000000000']
  );

  if (!defaultUser) {
    await db.run(
      'INSERT INTO users (uuid, username) VALUES (?, ?)',
      ['00000000-0000-0000-0000-000000000000', 'default']
    );
  }

  // 工程索引表
  await db.run(`
    CREATE TABLE IF NOT EXISTS project_index (
      uuid TEXT PRIMARY KEY,                                              -- 工程唯一标识(uuidv7)
      user_uuid TEXT NOT NULL,                                            -- 所属用户UUID
      name TEXT NOT NULL,                                                 -- 工程名称
      description TEXT,                                                   -- 工程描述
      folder_path TEXT NOT NULL,                                          -- 工程文件夹路径
      thumbnail_path TEXT,                                                -- 工程缩略图路径
      last_opened TEXT,                                                   -- 最后打开时间(UTC时间, ISO 8601格式)
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),    -- 创建时间(UTC时间, ISO 8601格式)
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),    -- 更新时间(UTC时间, ISO 8601格式)
      FOREIGN KEY (user_uuid) REFERENCES users(uuid)                      -- 外键：关联 users 表的 uuid
    )
  `);

  await db.run('CREATE INDEX IF NOT EXISTS idx_user_uuid ON project_index(user_uuid)');          // 为 user_uuid 创建索引
  await db.run('CREATE INDEX IF NOT EXISTS idx_last_opened ON project_index(last_opened DESC)'); // 为 last_opened 创建索引
}

// 工程数据库管理
export class ProjectDatabase extends Database {
  async initTables(): Promise<void> {
    // 工程配置表
    await this.run(`
      CREATE TABLE IF NOT EXISTS project_config (
        key TEXT PRIMARY KEY,                                             -- 配置项键
        value TEXT NOT NULL,                                              -- 配置项值
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))   -- 更新时间(UTC时间, ISO 8601格式)
      )
    `);

    // 机器人表
    await this.run(`
      CREATE TABLE IF NOT EXISTS robots (
        uuid TEXT PRIMARY KEY,                                              -- 机器人唯一标识(uuidv7)
        name TEXT NOT NULL,                                                 -- 机器人名称
        robot_ip TEXT NOT NULL,                                             -- 机器人IP地址
        local_ip TEXT NOT NULL,                                             -- 本地IP地址
        local_port INTEGER NOT NULL,                                        -- 本地端口
        group_name TEXT,                                                    -- 机器人分组名称
        status TEXT DEFAULT 'offline',                                      -- 机器人状态(online/offline)
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),    -- 创建时间(UTC时间, ISO 8601格式)
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))     -- 更新时间(UTC时间, ISO 8601格式)
      )
    `);

    await this.run('CREATE INDEX IF NOT EXISTS idx_robot_name ON robots(name)');        // 为 name 创建索引
    await this.run('CREATE INDEX IF NOT EXISTS idx_robot_group ON robots(group_name)'); // 为 group_name 创建索引

  }
}
