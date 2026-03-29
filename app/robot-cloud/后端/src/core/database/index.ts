import Database from 'better-sqlite3';
import path from 'path';
import 配置 from '../../config';
import type { AccountRole, UserRecord, UserSessionRecord } from '../../modules/account/types';
import type { KnowledgeEntryRecord } from '../../modules/knowledge/types';
import type { FeedbackListItem, FeedbackStatus } from '../../modules/反馈/types';
import type { RobotRecord, 机器人状态 } from '../../modules/机器人管理/types';
import type { RoleRecord } from '../../modules/角色管理/types';
import type { ActionLogRecord, ActionStatus, ConversationRecord, 对话类型 } from '../../types';
import { 默认系统提示词 } from '../const';
import { logger } from '../logger';
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

    // 用户账号表
    this.数据库.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin', 'super_admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME
      )
    `);

    // 用户登录会话表（用于多端登录设备追踪）
    this.数据库.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        client_type TEXT NOT NULL DEFAULT 'unknown',
        device_name TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 知识库条目表
    this.数据库.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        created_by TEXT,
        updated_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    this.数据库.exec(`
      CREATE TABLE IF NOT EXISTS feedback_entries (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        client_type TEXT NOT NULL DEFAULT 'unknown',
        device_name TEXT,
        user_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'resolved')),
        handled_by TEXT,
        handled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
        motion_control_version TEXT,
        server_version TEXT,
        ip TEXT,
        group_name TEXT,
        tags TEXT,
        sn TEXT,
        role_uuid TEXT,
        audio_route_config TEXT,
        status TEXT DEFAULT 'offline',
        last_connected_at DATETIME,
        registered_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_uuid) REFERENCES roles(uuid) ON DELETE SET NULL
      )
    `);

    // 对话历史表
    this.数据库.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        uuid INTEGER PRIMARY KEY AUTOINCREMENT,
        robot_id TEXT NOT NULL,
        conversation_id TEXT,
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
        conversation_id TEXT,
        action_name TEXT NOT NULL,
        parameters TEXT,
        status TEXT CHECK(status IN ('success', 'failed', 'rejected')) DEFAULT 'success',
        result_detail TEXT,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (robot_id) REFERENCES robots(uuid) ON DELETE CASCADE
      )
    `);

    // 数据库迁移：添加 is_default 列（如果不存在）
    this.migrateDatabase();

    // 创建索引
    this.数据库.exec(`
      CREATE INDEX IF NOT EXISTS idx_robots_status ON robots(status);
      CREATE INDEX IF NOT EXISTS idx_robots_group ON robots(group_name);
      CREATE INDEX IF NOT EXISTS idx_conversations_robot_id ON conversations(robot_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON conversations(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
      CREATE INDEX IF NOT EXISTS idx_action_logs_robot_id ON action_logs(robot_id);
      CREATE INDEX IF NOT EXISTS idx_action_logs_conversation_id ON action_logs(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_action_logs_executed_at ON action_logs(executed_at);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_knowledge_entries_updated_at ON knowledge_entries(updated_at);
      CREATE INDEX IF NOT EXISTS idx_feedback_entries_created_at ON feedback_entries(created_at);
      CREATE INDEX IF NOT EXISTS idx_feedback_entries_user_id ON feedback_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_entries_status ON feedback_entries(status);
    `);

    // 初始化默认角色
    this.initializeDefaultRole();

    logger.info('数据库初始化完成');
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
    const feedbackTableInfo = this.数据库.prepare("PRAGMA table_info(feedback_entries)").all() as Array<{ name: string }>;
    const hasFeedbackStatus = feedbackTableInfo.some(col => col.name === 'status');
    const hasFeedbackHandledBy = feedbackTableInfo.some(col => col.name === 'handled_by');
    const hasFeedbackHandledAt = feedbackTableInfo.some(col => col.name === 'handled_at');
    const hasFeedbackUpdatedAt = feedbackTableInfo.some(col => col.name === 'updated_at');
    const robotsTableInfo = this.数据库.prepare("PRAGMA table_info(robots)").all() as Array<{ name: string }>;
    const hasAudioRouteConfig = robotsTableInfo.some(col => col.name === 'audio_route_config');
    const conversationsTableInfo = this.数据库.prepare("PRAGMA table_info(conversations)").all() as Array<{ name: string }>;
    const hasConversationId = conversationsTableInfo.some(col => col.name === 'conversation_id');
    const actionLogsTableInfo = this.数据库.prepare("PRAGMA table_info(action_logs)").all() as Array<{ name: string }>;
    const hasActionConversationId = actionLogsTableInfo.some(col => col.name === 'conversation_id');
    const hasActionResultDetail = actionLogsTableInfo.some(col => col.name === 'result_detail');

    if (!hasIsDefault) {
      logger.info('正在迁移数据库：添加 is_default 列...');
      this.数据库.exec('ALTER TABLE roles ADD COLUMN is_default INTEGER DEFAULT 0');
      logger.info('数据库迁移完成');
    }

    if (!hasAsrProvider) {
      logger.info('正在迁移数据库：添加 asr_provider 列...');
      this.数据库.exec('ALTER TABLE roles ADD COLUMN asr_provider TEXT');
    }

    if (!hasAsrModel) {
      logger.info('正在迁移数据库：添加 asr_model 列...');
      this.数据库.exec('ALTER TABLE roles ADD COLUMN asr_model TEXT');
    }

    if (!hasFeedbackStatus) {
      logger.info('正在迁移数据库：添加 feedback status 列...');
      this.数据库.exec("ALTER TABLE feedback_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
    }

    if (!hasFeedbackHandledBy) {
      logger.info('正在迁移数据库：添加 feedback handled_by 列...');
      this.数据库.exec('ALTER TABLE feedback_entries ADD COLUMN handled_by TEXT');
    }

    if (!hasFeedbackHandledAt) {
      logger.info('正在迁移数据库：添加 feedback handled_at 列...');
      this.数据库.exec('ALTER TABLE feedback_entries ADD COLUMN handled_at DATETIME');
    }

    if (!hasFeedbackUpdatedAt) {
      logger.info('正在迁移数据库：添加 feedback updated_at 列...');
      this.数据库.exec('ALTER TABLE feedback_entries ADD COLUMN updated_at DATETIME');
      this.数据库.exec(`
        UPDATE feedback_entries
        SET updated_at = COALESCE(created_at, datetime('now'))
        WHERE updated_at IS NULL
      `);
    }

    if (!hasAudioRouteConfig) {
      logger.info('正在迁移数据库：添加 audio_route_config 列...');
      this.数据库.exec('ALTER TABLE robots ADD COLUMN audio_route_config TEXT');
    }

    if (!hasConversationId) {
      logger.info('正在迁移数据库：添加 conversations.conversation_id 列...');
      this.数据库.exec('ALTER TABLE conversations ADD COLUMN conversation_id TEXT');
      this.数据库.exec(`
        UPDATE conversations
        SET conversation_id = json_extract(metadata, '$.conversationId')
        WHERE conversation_id IS NULL AND metadata IS NOT NULL AND json_valid(metadata)
      `);
      this.数据库.exec('CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON conversations(conversation_id)');
    }

    if (!hasActionConversationId) {
      logger.info('正在迁移数据库：添加 action_logs.conversation_id 列...');
      this.数据库.exec('ALTER TABLE action_logs ADD COLUMN conversation_id TEXT');
      this.数据库.exec('CREATE INDEX IF NOT EXISTS idx_action_logs_conversation_id ON action_logs(conversation_id)');
    }

    if (!hasActionResultDetail) {
      logger.info('正在迁移数据库：添加 action_logs.result_detail 列...');
      this.数据库.exec('ALTER TABLE action_logs ADD COLUMN result_detail TEXT');
    }
    if (
      !hasIsDefault
      || !hasAsrProvider
      || !hasAsrModel
      || !hasFeedbackStatus
      || !hasFeedbackHandledBy
      || !hasFeedbackHandledAt
      || !hasFeedbackUpdatedAt
      || !hasAudioRouteConfig
      || !hasConversationId
      || !hasActionConversationId
      || !hasActionResultDetail
    ) {
      logger.info('数据库迁移完成');
    }

    // 统一 ASR 默认厂商为阿里云，修复历史空值
    this.数据库.exec(`
      UPDATE roles
      SET asr_provider = 'aliyun'
      WHERE asr_provider IS NULL OR TRIM(asr_provider) = ''
    `);
  }

  /**
   * 初始化默认角色（如果不存在）
   */
  private initializeDefaultRole(): void {
    const existingDefault = this.数据库.prepare('SELECT * FROM roles WHERE is_default = 1').get() as RoleRecord | undefined;

    // 创建默认角色和其 系统提示词
    if (!existingDefault) {
      const defaultRoleId = 'default-role';
      const systemPrompt = 默认系统提示词;

      const stmt = this.数据库.prepare(`
        INSERT INTO roles (uuid, name, description, temperature, system_prompt, asr_provider, max_history, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `);

      stmt.run(
        defaultRoleId,
        '默认角色',
        '系统默认的机器狗AI助手角色，无法删除和修改',
        0.7,
        systemPrompt,
        'aliyun',
        10
      );

      logger.info('已创建默认角色');
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
      INSERT INTO robots (uuid, name, model, version, motion_control_version, server_version, ip, group_name, tags, sn, role_uuid, audio_route_config, status, last_connected_at, registered_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(uuid) DO UPDATE SET
        name = COALESCE(excluded.name, robots.name),
        model = COALESCE(excluded.model, robots.model),
        version = COALESCE(excluded.version, robots.version),
        motion_control_version = COALESCE(excluded.motion_control_version, robots.motion_control_version),
        server_version = COALESCE(excluded.server_version, robots.server_version),
        ip = COALESCE(excluded.ip, robots.ip),
        group_name = COALESCE(excluded.group_name, robots.group_name),
        tags = COALESCE(excluded.tags, robots.tags),
        sn = COALESCE(excluded.sn, robots.sn),
        role_uuid = COALESCE(excluded.role_uuid, robots.role_uuid),
        audio_route_config = COALESCE(excluded.audio_route_config, robots.audio_route_config),
        status = COALESCE(excluded.status, robots.status),
        last_connected_at = COALESCE(excluded.last_connected_at, robots.last_connected_at),
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      robot.uuid,
      robot.name ?? null,
      robot.model ?? null,
      robot.version ?? null,
      robot.motion_control_version ?? null,
      robot.server_version ?? null,
      robot.ip ?? null,
      robot.group_name ?? null,
      Array.isArray(robot.tags) ? JSON.stringify(robot.tags) : robot.tags ?? null,
      robot.sn ?? null,
      robot.role_uuid ?? null,
      robot.audio_route_config ?? null,
      robot.status ?? 'offline',
      robot.last_connected_at ?? null,
      robot.registered_at ?? null
    );
  }

  /**
   * 重置所有机器人状态为离线（用于服务器启动时）
   */
  resetAllRobotsStatusToOffline(): void {
    const stmt = this.数据库.prepare(`
      UPDATE robots
      SET status = 'offline'
    `);
    stmt.run();
    logger.info('已重置所有机器人状态为离线');
  }

  /**
   * 更新机器人状态
   */
  updateRobotStatus(robotId: string, status: 机器人状态): void {
    const stmt = this.数据库.prepare(`
      UPDATE robots
      SET status = ?, last_connected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
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
    const stmt = this.数据库.prepare('SELECT * FROM robots ORDER BY last_connected_at DESC');
    return stmt.all() as RobotRecord[];
  }

  /**
   * 更新机器人
   */
  updateRobot(uuid: string, data: Partial<RobotRecord>): RobotRecord | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = ['name', 'model', 'version', 'motion_control_version', 'server_version', 'ip', 'group_name', 'tags', 'sn', 'role_uuid', 'audio_route_config', 'status', 'last_connected_at'];

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
      data.asr_provider ?? 'aliyun',
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
    const unbindStmt = this.数据库.prepare('UPDATE robots SET role_uuid = NULL WHERE role_uuid = ?');
    unbindStmt.run(uuid);

    // 删除角色
    const stmt = this.数据库.prepare('DELETE FROM roles WHERE uuid = ?');
    stmt.run(uuid);
  }

  /**
   * 获取使用该角色的所有机器人
   */
  getRobotsByRole(roleId: string): RobotRecord[] {
    const stmt = this.数据库.prepare('SELECT * FROM robots WHERE role_uuid = ?');
    return stmt.all(roleId) as RobotRecord[];
  }

  // ==================== 对话记录管理 ====================

  /**
   * 插入对话记录
   */
  insertConversation(data: {
    robot_id: string;
    conversation_id?: string;
    type: 对话类型;
    user_input: string;
    ai_response: string;
    actions?: any;
    processing_time?: number;
    metadata?: any;
  }): number {
    const stmt = this.数据库.prepare(`
      INSERT INTO conversations (robot_id, conversation_id, timestamp, type, user_input, ai_response, actions, processing_time, metadata)
      VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.robot_id,
      data.conversation_id ?? null,
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
   * 获取最近若干轮对话消息，用于回灌 LLM 上下文
   */
  getRecentConversationMessages(robotId: string, rounds = 10): Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }> {
    const safeRounds = Math.max(1, Math.floor(rounds));
    const stmt = this.数据库.prepare(`
      SELECT user_input, ai_response, timestamp
      FROM conversations
      WHERE robot_id = ?
      ORDER BY timestamp DESC, uuid DESC
      LIMIT ?
    `);
    const rows = stmt.all(robotId, safeRounds) as Array<{
      user_input: string;
      ai_response: string;
      timestamp: string;
    }>;

    return rows.reverse().flatMap((row) => {
      const timestamp = new Date(row.timestamp);
      return [
        {
          role: 'user' as const,
          content: row.user_input,
          timestamp,
        },
        {
          role: 'assistant' as const,
          content: row.ai_response,
          timestamp,
        },
      ];
    });
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
  insertActionLog(
    robotId: string,
    actionName: string,
    parameters: any,
    status: ActionStatus,
    options?: {
      conversationId?: string;
      resultDetail?: any;
    }
  ): void {
    const stmt = this.数据库.prepare(`
      INSERT INTO action_logs (robot_id, conversation_id, action_name, parameters, status, result_detail, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(
      robotId,
      options?.conversationId ?? null,
      actionName,
      JSON.stringify(parameters),
      status,
      options?.resultDetail === undefined ? null : JSON.stringify(options.resultDetail)
    );
  }

  /**
   * 获取动作日志
   */
  getActionLogs(robotId: string, limit = 50, offset = 0): ActionLogRecord[] {
    const stmt = this.数据库.prepare(`
      SELECT * FROM action_logs
      WHERE robot_id = ?
      ORDER BY executed_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(robotId, limit, offset) as ActionLogRecord[];
  }

  // ==================== 账号管理 ====================

  countUsers(): number {
    const stmt = this.数据库.prepare('SELECT COUNT(1) as count FROM users');
    const row = stmt.get() as { count: number };
    return row.count || 0;
  }

  countUsersByRole(role: AccountRole): number {
    const stmt = this.数据库.prepare('SELECT COUNT(1) as count FROM users WHERE role = ?');
    const row = stmt.get(role) as { count: number };
    return row.count || 0;
  }

  createUser(data: { id: string; username: string; password_hash: string; role: AccountRole }): void {
    const stmt = this.数据库.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(data.id, data.username, data.password_hash, data.role);
  }

  getUserById(id: string): UserRecord | undefined {
    const stmt = this.数据库.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as UserRecord | undefined;
  }

  getUserByUsername(username: string): UserRecord | undefined {
    const stmt = this.数据库.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as UserRecord | undefined;
  }

  listUsers(): UserRecord[] {
    const stmt = this.数据库.prepare('SELECT * FROM users ORDER BY created_at ASC');
    return stmt.all() as UserRecord[];
  }

  touchUserLogin(id: string): void {
    const stmt = this.数据库.prepare(`
      UPDATE users
      SET last_login_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(id);
  }

  updateUserRole(id: string, role: AccountRole): void {
    const stmt = this.数据库.prepare(`
      UPDATE users
      SET role = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(role, id);
  }

  createUserSession(data: {
    id: string;
    user_id: string;
    token_hash: string;
    client_type: string;
    device_name: string | null;
    ip_address: string | null;
    user_agent: string | null;
    expires_at: string;
  }): void {
    const stmt = this.数据库.prepare(`
      INSERT INTO user_sessions (id, user_id, token_hash, client_type, device_name, ip_address, user_agent, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `);
    stmt.run(
      data.id,
      data.user_id,
      data.token_hash,
      data.client_type,
      data.device_name,
      data.ip_address,
      data.user_agent,
      data.expires_at
    );
  }

  getUserSessionById(id: string): UserSessionRecord | undefined {
    const stmt = this.数据库.prepare('SELECT * FROM user_sessions WHERE id = ?');
    return stmt.get(id) as UserSessionRecord | undefined;
  }

  getUserSessionByTokenHash(tokenHash: string): UserSessionRecord | undefined {
    const stmt = this.数据库.prepare(`
      SELECT * FROM user_sessions
      WHERE token_hash = ?
      LIMIT 1
    `);
    return stmt.get(tokenHash) as UserSessionRecord | undefined;
  }

  listUserSessions(userId: string): UserSessionRecord[] {
    const stmt = this.数据库.prepare(`
      SELECT * FROM user_sessions
      WHERE user_id = ? AND revoked_at IS NULL
      ORDER BY last_seen_at DESC
    `);
    return stmt.all(userId) as UserSessionRecord[];
  }

  touchUserSession(id: string): void {
    const stmt = this.数据库.prepare(`
      UPDATE user_sessions
      SET last_seen_at = datetime('now')
      WHERE id = ? AND revoked_at IS NULL
    `);
    stmt.run(id);
  }

  revokeUserSession(id: string): void {
    const stmt = this.数据库.prepare(`
      UPDATE user_sessions
      SET revoked_at = datetime('now')
      WHERE id = ? AND revoked_at IS NULL
    `);
    stmt.run(id);
  }

  // ==================== 知识库管理 ====================

  createKnowledgeEntry(data: {
    id: string;
    title: string;
    content: string;
    tags: string;
    created_by: string | null;
    updated_by: string | null;
  }): void {
    const stmt = this.数据库.prepare(`
      INSERT INTO knowledge_entries (id, title, content, tags, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(data.id, data.title, data.content, data.tags, data.created_by, data.updated_by);
  }

  listKnowledgeEntries(): KnowledgeEntryRecord[] {
    const stmt = this.数据库.prepare(`
      SELECT * FROM knowledge_entries
      ORDER BY updated_at DESC
    `);
    return stmt.all() as KnowledgeEntryRecord[];
  }

  getKnowledgeEntry(id: string): KnowledgeEntryRecord | undefined {
    const stmt = this.数据库.prepare('SELECT * FROM knowledge_entries WHERE id = ?');
    return stmt.get(id) as KnowledgeEntryRecord | undefined;
  }

  updateKnowledgeEntry(
    id: string,
    data: { title?: string; content?: string; tags?: string; updated_by?: string | null }
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.content !== undefined) {
      fields.push('content = ?');
      values.push(data.content);
    }
    if (data.tags !== undefined) {
      fields.push('tags = ?');
      values.push(data.tags);
    }
    if (data.updated_by !== undefined) {
      fields.push('updated_by = ?');
      values.push(data.updated_by);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push("updated_at = datetime('now')");
    const stmt = this.数据库.prepare(`UPDATE knowledge_entries SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values, id);
  }

  deleteKnowledgeEntry(id: string): void {
    const stmt = this.数据库.prepare('DELETE FROM knowledge_entries WHERE id = ?');
    stmt.run(id);
  }

  createFeedbackEntry(data: {
    id: string;
    content: string;
    client_type: string;
    device_name: string;
    user_id: string | null;
  }): void {
    const stmt = this.数据库.prepare(`
      INSERT INTO feedback_entries (id, content, client_type, device_name, user_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `);
    stmt.run(data.id, data.content, data.client_type, data.device_name, data.user_id);
  }

  listFeedbackEntries(limit = 100, offset = 0, status?: FeedbackStatus): FeedbackListItem[] {
    if (status) {
      const stmt = this.数据库.prepare(`
        SELECT
          f.*,
          u.username AS username,
          hu.username AS handled_by_username
        FROM feedback_entries f
        LEFT JOIN users u ON u.id = f.user_id
        LEFT JOIN users hu ON hu.id = f.handled_by
        WHERE f.status = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(status, limit, offset) as FeedbackListItem[];
    }

    const stmt = this.数据库.prepare(`
      SELECT
        f.*,
        u.username AS username,
        hu.username AS handled_by_username
      FROM feedback_entries f
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN users hu ON hu.id = f.handled_by
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as FeedbackListItem[];
  }

  getFeedbackEntryById(id: string): FeedbackListItem | null {
    const stmt = this.数据库.prepare(`
      SELECT
        f.*,
        u.username AS username,
        hu.username AS handled_by_username
      FROM feedback_entries f
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN users hu ON hu.id = f.handled_by
      WHERE f.id = ?
      LIMIT 1
    `);
    return (stmt.get(id) as FeedbackListItem | undefined) || null;
  }

  updateFeedbackEntryStatus(id: string, status: FeedbackStatus, handledBy: string | null): void {
    if (status === 'pending') {
      const stmt = this.数据库.prepare(`
        UPDATE feedback_entries
        SET status = ?, handled_by = NULL, handled_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(status, id);
      return;
    }

    const stmt = this.数据库.prepare(`
      UPDATE feedback_entries
      SET status = ?, handled_by = ?, handled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(status, handledBy, id);
  }

  getFeedbackEntryCount(status?: FeedbackStatus): number {
    if (status) {
      const stmt = this.数据库.prepare('SELECT COUNT(1) AS total FROM feedback_entries WHERE status = ?');
      const row = stmt.get(status) as { total: number } | undefined;
      return Number(row?.total || 0);
    }

    const stmt = this.数据库.prepare('SELECT COUNT(1) AS total FROM feedback_entries');
    const row = stmt.get() as { total: number } | undefined;
    return Number(row?.total || 0);
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
