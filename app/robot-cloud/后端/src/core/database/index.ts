import Database from 'better-sqlite3';
import path from 'path';
import 配置 from '../../config';
import type {
  ActionStatus,
  ConversationRecord,
  RobotRecord,
  RoleRecord,
  对话类型,
  机器人状态
} from '../../types';

/**
 * 数据库服务
 * 统一管理所有数据库操作
 */
class 数据库服务 {
  private 数据库!: Database.Database;

  constructor() {
    this.初始化();
  }

  private 初始化() {
    const 数据库路径 = 配置.database.path!;
    const 数据库目录 = path.dirname(数据库路径);

    // 确保数据目录存在
    if (!require('fs').existsSync(数据库目录)) {
      require('fs').mkdirSync(数据库目录, { recursive: true });
    }

    this.数据库 = new Database(数据库路径);
    this.创建表();
  }

  /**
   * 创建所有表（全新设计，无需迁移）
   */
  private 创建表(): void {
    // 系统设置表（统一存储所有配置，替代原来的 settings 和 params 表）
    this.数据库.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 角色表
    this.数据库.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        uuid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        llm_provider TEXT,
        llm_model TEXT,
        temperature REAL DEFAULT 0.7,
        system_prompt TEXT,
        voice TEXT,
        asr_provider TEXT,
        asr_model TEXT,
        intent_strategy TEXT,
        max_history INTEGER DEFAULT 10,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 机器狗注册表
    this.数据库.exec(`
      CREATE TABLE IF NOT EXISTS robots (
        uuid TEXT PRIMARY KEY,
        name TEXT,
        model TEXT,
        version TEXT,
        ip TEXT,
        group_name TEXT,
        tags TEXT,
        sn TEXT,
        role_id TEXT,
        status TEXT DEFAULT 'offline',
        last_connected DATETIME,
        registered_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(uuid) ON DELETE SET NULL
      )
    `);

    // 对话历史表
    this.数据库.exec(`
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
        FOREIGN KEY (robot_id) REFERENCES robots(uuid) ON DELETE CASCADE
      )
    `);

    // 动作执行记录
    this.数据库.exec(`
      CREATE TABLE IF NOT EXISTS action_logs (
        uuid INTEGER PRIMARY KEY AUTOINCREMENT,
        robot_id TEXT NOT NULL,
        action_name TEXT NOT NULL,
        parameters TEXT,
        status TEXT CHECK(status IN ('success', 'failed', 'rejected')) DEFAULT 'success',
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (robot_id) REFERENCES robots(uuid) ON DELETE CASCADE
      )
    `);

    // 创建索引
    this.数据库.exec(`
      CREATE INDEX IF NOT EXISTS idx_robots_status ON robots(status);
      CREATE INDEX IF NOT EXISTS idx_robots_group ON robots(group_name);
      CREATE INDEX IF NOT EXISTS idx_conversations_robot_id ON conversations(robot_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
      CREATE INDEX IF NOT EXISTS idx_action_logs_robot_id ON action_logs(robot_id);
      CREATE INDEX IF NOT EXISTS idx_action_logs_executed_at ON action_logs(executed_at);
    `);

    // 数据库迁移：添加 is_default 列（如果不存在）
    this.migrateDatabase();

    // 初始化默认角色
    this.initializeDefaultRole();

    console.log('数据库初始化完成');
  }

  /**
   * 数据库迁移
   */
  private migrateDatabase(): void {
    // 检查 roles 表是否有 is_default 列
    const tableInfo = this.数据库.prepare("PRAGMA table_info(roles)").all() as Array<{ name: string }>;
    const hasIsDefault = tableInfo.some(col => col.name === 'is_default');
    const hasAsrProvider = tableInfo.some(col => col.name === 'asr_provider');
    const hasAsrModel = tableInfo.some(col => col.name === 'asr_model');

    if (!hasIsDefault) {
      console.log('正在迁移数据库：添加 is_default 列...');
      this.数据库.exec('ALTER TABLE roles ADD COLUMN is_default INTEGER DEFAULT 0');
      console.log('数据库迁移完成');
    }

    if (!hasAsrProvider) {
      console.log('正在迁移数据库：添加 asr_provider 列...');
      this.数据库.exec('ALTER TABLE roles ADD COLUMN asr_provider TEXT');
    }

    if (!hasAsrModel) {
      console.log('正在迁移数据库：添加 asr_model 列...');
      this.数据库.exec('ALTER TABLE roles ADD COLUMN asr_model TEXT');
    }

    if (!hasIsDefault || !hasAsrProvider || !hasAsrModel) {
      console.log('数据库迁移完成');
    }
  }

  /**
   * 初始化默认角色（如果不存在）
   */
  private initializeDefaultRole(): void {
    const existingDefault = this.数据库.prepare('SELECT * FROM roles WHERE is_default = 1').get() as RoleRecord | undefined;

    if (!existingDefault) {
      const defaultRoleId = 'default-role';
      const systemPrompt = `你是一只可爱的机器狗AI助手。你可以：
1. 与用户进行自然对话
2. 执行一些基本动作来配合对话
3. 使用视觉识别功能查看周围环境
4. 如果收到的是无意义或莫名其妙的词语就发送："{{meaning=false}}"

可用动作列表：
- stand_up: 站起来
- sit_down: 坐下、蹲下、趴下
- shake_hand: 握手、挥手、点头
- dance: 跳舞
- jump: 跳跃
- two_leg_once: 双腿站立一次
- dance: 跳舞
- move: 移动控制（前后左右移动或转向）

当用户要求你做动作时，请在回复中使用{{action=动作名称}}或{{action=动作名称,参数名=值}}格式，例如：
- 用户："坐下" -> 回复："好的主人{{action=sit_down}}"
- 用户："向前走" -> 回复："好的，我向前走{{action=move,vx=0.2,duration=2}}"
- 用户："后退" -> 回复："好的，我后退{{action=move,vx=-0.2,duration=2}}"
- 用户："向左移动" -> 回复："好的，我向左移{{action=move,vy=0.2,duration=2}}"
- 用户："向右移动" -> 回复："好的，我向右移{{action=move,vy=-0.2,duration=2}}"
- 用户："左转" -> 回复："好的，我左转{{action=move,yaw_rate=0.3,duration=2}}"
- 用户："右转" -> 回复："好的，我右转{{action=move,yaw_rate=-0.3,duration=2}}"

move动作参数说明：
- vx: 前后速度（-0.3到0.3，正数向前，负数向后）
- vy: 左右速度（-0.2到0.2，正数向左，负数向右）
- yaw_rate: 转向角速度（-0.5到0.5，正数左转，负数右转）
- duration: 持续时间（秒），建议1-3秒

move动作参数说明：
- vx: 前后速度（-0.3到0.3，正数向前，负数向后）
- vy: 左右速度（-0.2到0.2，正数向左，负数向右）
- yaw_rate: 转向角速度（-0.5到0.5，正数左转，负数右转）
- duration: 持续时间（秒），建议1-3秒

视觉识别功能：
当用户明确询问关于视觉、环境、周围物体等问题时，就发送{{vision=true}}

注意事项：
1. 保持友好、可爱的语气，说话简短一点
2. 移动速度要适中，不要太快（vx建议0.15-0.25，vy建议0.15-0.2，yaw_rate建议0.2-0.4）
3. 移动时间不要太长（建议1-3秒）
4. 如果用户要求危险动作，要委婉拒绝
5. 一次回复中可以包含多个动作标记`;

      const stmt = this.数据库.prepare(`
        INSERT INTO roles (uuid, name, description, temperature, system_prompt, max_history, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `);

      stmt.run(
        defaultRoleId,
        '默认角色',
        '系统默认的机器狗AI助手角色，无法删除和修改',
        0.7,
        systemPrompt,
        10
      );

      console.log('已创建默认角色');
    }
  }

  // ==================== 设置管理 ====================

  /**
   * 设置配置项
   */
  setSetting(key: string, value: string): void {
    const stmt = this.数据库.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value);
  }

  /**
   * 获取配置项
   */
  getSetting(key: string): string | undefined {
    const stmt = this.数据库.prepare(`SELECT value FROM settings WHERE key = ?`);
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value;
  }

  /**
   * 获取所有配置
   */
  getAllSettings(): Record<string, string> {
    const stmt = this.数据库.prepare(`SELECT key, value FROM settings`);
    const rows = stmt.all() as { key: string; value: string }[];
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  /**
   * 删除配置项
   */
  deleteSetting(key: string): void {
    const stmt = this.数据库.prepare(`DELETE FROM settings WHERE key = ?`);
    stmt.run(key);
  }

  // ==================== 机器人管理 ====================

  /**
   * 注册/更新机器人
   */
  upsertRobot(robot: Partial<RobotRecord> & { uuid: string }): void {
    const stmt = this.数据库.prepare(`
      INSERT INTO robots (uuid, name, model, version, ip, group_name, tags, sn, role_id, status, last_connected, registered_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(uuid) DO UPDATE SET
        name = COALESCE(excluded.name, robots.name),
        model = COALESCE(excluded.model, robots.model),
        version = COALESCE(excluded.version, robots.version),
        ip = COALESCE(excluded.ip, robots.ip),
        group_name = COALESCE(excluded.group_name, robots.group_name),
        tags = COALESCE(excluded.tags, robots.tags),
        sn = COALESCE(excluded.sn, robots.sn),
        role_id = COALESCE(excluded.role_id, robots.role_id),
        status = COALESCE(excluded.status, robots.status),
        last_connected = COALESCE(excluded.last_connected, robots.last_connected),
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      robot.uuid,
      robot.name ?? null,
      robot.model ?? null,
      robot.version ?? null,
      robot.ip ?? null,
      robot.group_name ?? null,
      Array.isArray(robot.tags) ? JSON.stringify(robot.tags) : robot.tags ?? null,
      robot.sn ?? null,
      robot.role_id ?? null,
      robot.status ?? 'offline',
      robot.last_connected ?? null,
      robot.registered_at ?? null
    );
  }

  /**
   * 更新机器人状态
   */
  updateRobotStatus(robotId: string, status: 机器人状态): void {
    const stmt = this.数据库.prepare(`
      UPDATE robots
      SET status = ?, last_connected = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE uuid = ?
    `);
    stmt.run(status, robotId);
  }

  /**
   * 获取机器人
   */
  getRobot(robotId: string): RobotRecord | undefined {
    const stmt = this.数据库.prepare('SELECT * FROM robots WHERE uuid = ?');
    return stmt.get(robotId) as RobotRecord | undefined;
  }

  /**
   * 获取所有机器人
   */
  getAllRobots(): RobotRecord[] {
    const stmt = this.数据库.prepare('SELECT * FROM robots ORDER BY last_connected DESC');
    return stmt.all() as RobotRecord[];
  }

  /**
   * 更新机器人
   */
  updateRobot(uuid: string, data: Partial<RobotRecord>): RobotRecord | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = ['name', 'model', 'version', 'ip', 'group_name', 'tags', 'sn', 'role_id', 'status', 'last_connected'];

    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        fields.push(`${field} = ?`);
        let value = (data as any)[field];
        // 特殊处理 tags 数组
        if (field === 'tags' && Array.isArray(value)) {
          value = JSON.stringify(value);
        }
        values.push(value ?? null);
      }
    }

    if (fields.length === 0) {
      return this.getRobot(uuid);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const stmt = this.数据库.prepare(`UPDATE robots SET ${fields.join(', ')} WHERE uuid = ?`);
    stmt.run(...values, uuid);
    return this.getRobot(uuid);
  }

  /**
   * 删除机器人（级联删除对话和动作日志）
   */
  deleteRobot(uuid: string): void {
    const stmt = this.数据库.prepare('DELETE FROM robots WHERE uuid = ?');
    stmt.run(uuid);
  }

  /**
   * 获取所有分组
   */
  getAllGroups(): string[] {
    const stmt = this.数据库.prepare('SELECT DISTINCT group_name FROM robots WHERE group_name IS NOT NULL ORDER BY group_name');
    const rows = stmt.all() as { group_name: string }[];
    return rows.map(r => r.group_name);
  }

  // ==================== 角色管理 ====================

  /**
   * 创建角色
   */
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
  }): RoleRecord | undefined {
    const stmt = this.数据库.prepare(`
      INSERT INTO roles (uuid, name, description, llm_provider, llm_model, temperature, system_prompt, voice, asr_provider, asr_model, intent_strategy, max_history, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.uuid,
      data.name,
      data.description ?? null,
      data.llm_provider ?? null,
      data.llm_model ?? null,
      data.temperature ?? 0.7,
      data.system_prompt ?? null,
      data.voice ?? null,
      data.asr_provider ?? null,
      data.asr_model ?? null,
      data.intent_strategy ?? null,
      data.max_history ?? 10,
      data.is_default ?? 0
    );
    return this.getRole(data.uuid);
  }

  /**
   * 获取角色
   */
  getRole(uuid: string): RoleRecord | undefined {
    const stmt = this.数据库.prepare('SELECT * FROM roles WHERE uuid = ?');
    return stmt.get(uuid) as RoleRecord | undefined;
  }

  /**
   * 获取所有角色
   */
  getAllRoles(): RoleRecord[] {
    const stmt = this.数据库.prepare('SELECT * FROM roles ORDER BY created_at DESC');
    return stmt.all() as RoleRecord[];
  }

  /**
   * 更新角色
   */
  updateRole(uuid: string, data: Partial<Omit<RoleRecord, 'uuid' | 'created_at' | 'updated_at'>>): RoleRecord | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = ['name', 'description', 'llm_provider', 'llm_model', 'temperature', 'system_prompt', 'voice', 'asr_provider', 'asr_model', 'intent_strategy', 'max_history'];

    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push((data as any)[field] ?? null);
      }
    }

    if (fields.length === 0) {
      return this.getRole(uuid);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const stmt = this.数据库.prepare(`UPDATE roles SET ${fields.join(', ')} WHERE uuid = ?`);
    stmt.run(...values, uuid);
    return this.getRole(uuid);
  }

  /**
   * 删除角色（自动解绑关联的机器人）
   */
  deleteRole(uuid: string): void {
    // 解绑所有使用该角色的机器人
    const unbindStmt = this.数据库.prepare('UPDATE robots SET role_id = NULL WHERE role_id = ?');
    unbindStmt.run(uuid);

    // 删除角色
    const stmt = this.数据库.prepare('DELETE FROM roles WHERE uuid = ?');
    stmt.run(uuid);
  }

  /**
   * 获取使用该角色的所有机器人
   */
  getRobotsByRole(roleId: string): RobotRecord[] {
    const stmt = this.数据库.prepare('SELECT * FROM robots WHERE role_id = ?');
    return stmt.all(roleId) as RobotRecord[];
  }

  // ==================== 对话记录管理 ====================

  /**
   * 插入对话记录
   */
  insertConversation(data: {
    robot_id: string;
    type: 对话类型;
    user_input: string;
    ai_response: string;
    actions?: any;
    processing_time?: number;
    metadata?: any;
  }): number {
    const stmt = this.数据库.prepare(`
      INSERT INTO conversations (robot_id, timestamp, type, user_input, ai_response, actions, processing_time, metadata)
      VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.robot_id,
      data.type,
      data.user_input,
      data.ai_response,
      data.actions ? JSON.stringify(data.actions) : null,
      data.processing_time ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * 获取对话历史
   */
  getConversations(robotId: string, limit = 50, offset = 0): ConversationRecord[] {
    const stmt = this.数据库.prepare(`
      SELECT * FROM conversations
      WHERE robot_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(robotId, limit, offset) as ConversationRecord[];
  }

  /**
   * 清空对话历史
   */
  clearConversations(robotId: string): void {
    const stmt = this.数据库.prepare('DELETE FROM conversations WHERE robot_id = ?');
    stmt.run(robotId);
  }

  // ==================== 动作日志管理 ====================

  /**
   * 插入动作日志
   */
  insertActionLog(robotId: string, actionName: string, parameters: any, status: ActionStatus): void {
    const stmt = this.数据库.prepare(`
      INSERT INTO action_logs (robot_id, action_name, parameters, status, executed_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(robotId, actionName, JSON.stringify(parameters), status);
  }

  /**
   * 获取动作日志
   */
  getActionLogs(robotId: string, limit = 50, offset = 0) {
    const stmt = this.数据库.prepare(`
      SELECT * FROM action_logs
      WHERE robot_id = ?
      ORDER BY executed_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(robotId, limit, offset);
  }

  // ==================== 工具方法 ====================

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.数据库.close();
  }

  /**
   * 获取原始数据库实例（用于高级操作）
   */
  getDb(): Database.Database {
    return this.数据库;
  }
}

export default 数据库服务;
