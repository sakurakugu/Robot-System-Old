import type { 可查询数据库 } from '../../infra/db/client';
import type { ActionLogRecord, ActionStatus, ConversationRecord, 对话类型 } from '../../types';

export type 对话上下文消息 = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type 创建对话记录输入 = {
  robot_id: string;
  conversation_id?: string;
  type: 对话类型;
  user_input: string;
  ai_response: string;
  actions?: unknown;
  processing_time?: number;
  metadata?: unknown;
};

type 创建动作日志输入 = {
  robot_id: string;
  conversation_id?: string;
  action_name: string;
  parameters?: unknown;
  status: ActionStatus;
  result_detail?: unknown;
};

export interface ConversationRepository {
  createConversation(data: 创建对话记录输入): Promise<void>;
  getRecentConversationMessages(robotId: string, rounds: number): Promise<对话上下文消息[]>;
  listConversations(robotId: string, limit: number, offset: number): Promise<ConversationRecord[]>;
  clearConversations(robotId: string): Promise<void>;
  createActionLog(data: 创建动作日志输入): Promise<void>;
  listActionLogs(robotId: string, limit: number, offset: number): Promise<ActionLogRecord[]>;
}

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly database: 可查询数据库) {}

  async createConversation(data: 创建对话记录输入): Promise<void> {
    await this.database.query(
      `INSERT INTO conversations
        (robot_id, conversation_id, timestamp, type, user_input, ai_response, actions, processing_time, metadata)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8)`,
      [
        data.robot_id,
        data.conversation_id ?? null,
        data.type,
        data.user_input,
        data.ai_response,
        data.actions === undefined ? null : JSON.stringify(data.actions),
        data.processing_time ?? null,
        data.metadata === undefined ? null : JSON.stringify(data.metadata),
      ],
    );
  }

  async getRecentConversationMessages(robotId: string, rounds: number): Promise<对话上下文消息[]> {
    const safeRounds = Math.max(1, Math.floor(rounds));
    const result = await this.database.query<{
      user_input: string;
      ai_response: string;
      timestamp: string;
    }>(
      `SELECT user_input, ai_response, timestamp
       FROM conversations
       WHERE robot_id = $1
       ORDER BY timestamp DESC, uuid DESC
       LIMIT $2`,
      [robotId, safeRounds],
    );

    return result.rows.reverse().flatMap((row) => {
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

  async listConversations(robotId: string, limit: number, offset: number): Promise<ConversationRecord[]> {
    const result = await this.database.query<ConversationRecord>(
      `SELECT * FROM conversations
       WHERE robot_id = $1
       ORDER BY timestamp DESC
       LIMIT $2 OFFSET $3`,
      [robotId, limit, offset],
    );
    return result.rows;
  }

  async clearConversations(robotId: string): Promise<void> {
    await this.database.query(
      'DELETE FROM conversations WHERE robot_id = $1',
      [robotId],
    );
  }

  async createActionLog(data: 创建动作日志输入): Promise<void> {
    await this.database.query(
      `INSERT INTO action_logs
        (robot_id, conversation_id, action_name, parameters, status, result_detail, executed_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        data.robot_id,
        data.conversation_id ?? null,
        data.action_name,
        data.parameters === undefined ? JSON.stringify({}) : JSON.stringify(data.parameters),
        data.status,
        data.result_detail === undefined ? null : JSON.stringify(data.result_detail),
      ],
    );
  }

  async listActionLogs(robotId: string, limit: number, offset: number): Promise<ActionLogRecord[]> {
    const result = await this.database.query<ActionLogRecord>(
      `SELECT * FROM action_logs
       WHERE robot_id = $1
       ORDER BY executed_at DESC
       LIMIT $2 OFFSET $3`,
      [robotId, limit, offset],
    );
    return result.rows;
  }
}
