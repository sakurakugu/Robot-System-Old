import Database from 'better-sqlite3';
import path from 'path';
import config from '../config';
import { ConversationRecord, RobotRecord } from '../types';

class DatabaseService {
  private db: Database.Database;

  constructor() {
    this.init();
  }

  private init() {
    const dbPath = config.database.path!;
    const dbDir = path.dirname(dbPath);

    // 确保数据目录存在
    if (!require('fs').existsSync(dbDir)) {
      require('fs').mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    // 系统设置表（用于持久化运行时配置）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 机器狗注册表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS robots (
        uuid TEXT PRIMARY KEY,
        name TEXT,
        model TEXT,
        status TEXT DEFAULT 'offline',
        last_connected DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);

    // 对话历史表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        uuid INTEGER PRIMARY KEY AUTOINCREMENT,
        robot_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        type TEXT CHECK(type IN ('audio', 'text')),
        user_input TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        actions TEXT,
        processing_time INTEGER,
        metadata TEXT,
        FOREIGN KEY (robot_id) REFERENCES robots(uuid)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_robot_id 
      ON conversations(robot_id);
      
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp 
      ON conversations(timestamp);
    `);

    // 知识库文档表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        uuid TEXT PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        embedding_vector BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 系统日志表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        robot_id TEXT,
        message TEXT NOT NULL,
        stack_trace TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);

    // 动作执行记录
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS action_logs (
        uuid INTEGER PRIMARY KEY AUTOINCREMENT,
        robot_id TEXT NOT NULL,
        action_name TEXT NOT NULL,
        parameters TEXT,
        status TEXT CHECK(status IN ('success', 'failed', 'rejected')) DEFAULT 'success',
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_robots_status ON robots(status);
      CREATE INDEX IF NOT EXISTS idx_conversations_robot_id ON conversations(robot_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
      CREATE INDEX IF NOT EXISTS idx_action_logs_robot_id ON action_logs(robot_id);
      CREATE INDEX IF NOT EXISTS idx_action_logs_executed_at ON action_logs(executed_at);
    `);

    console.log('数据库初始化完成');
  }

  // 设置管理
  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value);
  }

  getSetting(key: string): string | undefined {
    const stmt = this.db.prepare(`SELECT value FROM settings WHERE key = ?`);
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value;
  }

  getAllSettings(): Record<string, string> {
    const stmt = this.db.prepare(`SELECT key, value FROM settings`);
    const rows = stmt.all() as { key: string; value: string }[];
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  // 机器狗管理
  registerRobot(robot: Partial<RobotRecord>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO robots (uuid, name, model, status, last_connected, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      robot.uuid,
      robot.name || null,
      robot.model || null,
      robot.status || 'offline',
      robot.last_connected?.toISOString() || new Date().toISOString(),
      robot.metadata ? JSON.stringify(robot.metadata) : null
    );
  }

  updateRobotStatus(robotId: string, status: 'online' | 'offline' | 'error'): void {
    const stmt = this.db.prepare(`
      UPDATE robots 
      SET status = ?, last_connected = CURRENT_TIMESTAMP 
      WHERE uuid = ?
    `);
    stmt.run(status, robotId);
  }

  getRobot(robotId: string): RobotRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM robots WHERE uuid = ?');
    return stmt.get(robotId) as RobotRecord | undefined;
  }

  getAllRobots(): RobotRecord[] {
    const stmt = this.db.prepare('SELECT * FROM robots ORDER BY last_connected DESC');
    return stmt.all() as RobotRecord[];
  }

  // 对话记录
  insertConversation(data: Omit<ConversationRecord, 'uuid'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (robot_id, timestamp, type, user_input, ai_response, actions, processing_time, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.robot_id,
      data.timestamp.toISOString(),
      data.type,
      data.user_input,
      data.ai_response,
      data.actions ? JSON.stringify(data.actions) : null,
      data.processing_time,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    return result.lastInsertRowid as number;
  }

  getConversationHistory(robotId: string, limit = 50, offset = 0): ConversationRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE robot_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(robotId, limit, offset) as ConversationRecord[];
  }

  updateRobot(uuid: string, data: Partial<RobotRecord>): RobotRecord | undefined {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name ?? null);
    }
    if (data.model !== undefined) {
      fields.push('model = ?');
      values.push(data.model ?? null);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.last_connected !== undefined) {
      fields.push('last_connected = ?');
      values.push(data.last_connected ? data.last_connected.toISOString() : new Date().toISOString());
    }
    if (data.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(data.metadata ?? null);
    }
    if (fields.length === 0) {
      return this.getRobot(uuid);
    }
    const stmt = this.db.prepare(`UPDATE robots SET ${fields.join(', ')} WHERE uuid = ?`);
    stmt.run(...values, uuid);
    return this.getRobot(uuid);
  }

  deleteRobot(uuid: string): void {
    const stmt = this.db.prepare('DELETE FROM robots WHERE uuid = ?');
    stmt.run(uuid);
  }

  // 动作日志
  logAction(robotId: string, actionName: string, parameters: any, status: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO action_logs (robot_id, action_name, parameters, status, executed_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(robotId, actionName, JSON.stringify(parameters), status);
  }

  // 关闭数据库连接
  close(): void {
    this.db.close();
  }
}

export default DatabaseService;
