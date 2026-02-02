/**
 * 统一类型定义
 * 所有模块共用的类型在此定义，确保前后端一致性
 */

// ============ 基础类型 ============

export type RobotStatus = 'online' | 'offline' | 'error';
export type ConversationType = 'audio' | 'text';
export type ActionStatus = 'success' | 'failed' | 'rejected';

// ============ 数据库实体 ============

/**
 * 机器人记录
 */
export interface RobotRecord {
  uuid: string;
  name: string | null;
  model: string | null;
  version: string | null;
  ip: string | null;
  group_name: string | null;
  tags: string | null; // JSON array string
  sn: string | null;
  role_id: string | null;
  status: RobotStatus;
  last_connected: string | null;
  registered_at: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * 角色记录
 */
export interface RoleRecord {
  uuid: string;
  name: string;
  description: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  temperature: number;
  system_prompt: string | null;
  voice: string | null;
  intent_strategy: string | null;
  max_history: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

/**
 * 对话记录
 */
export interface ConversationRecord {
  uuid: number;
  robot_id: string;
  timestamp: string;
  type: ConversationType;
  user_input: string;
  ai_response: string;
  actions: string | null; // JSON string
  processing_time: number | null;
  metadata: string | null; // JSON string
}

/**
 * 动作日志记录
 */
export interface ActionLogRecord {
  uuid: number;
  robot_id: string;
  action_name: string;
  parameters: string | null; // JSON string
  status: ActionStatus;
  executed_at: string;
}

/**
 * 系统设置记录
 */
export interface SettingRecord {
  key: string;
  value: string;
  updated_at: string;
}

// ============ API 响应类型 ============

/**
 * 标准 API 响应
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 机器人 API 响应（带解析后的字段）
 */
export interface RobotResponse extends Omit<RobotRecord, 'tags'> {
  tags: string[];
  role?: RoleRecord | null;
}

// ============ DTO 类型 ============

/**
 * 创建机器人 DTO
 */
export interface CreateRobotDto {
  name?: string;
  ip?: string;
  group_name?: string;
  model?: string;
  sn?: string;
  tags?: string[];
}

/**
 * 更新机器人 DTO
 */
export interface UpdateRobotDto {
  name?: string;
  model?: string;
  ip?: string;
  group_name?: string;
  sn?: string;
  tags?: string[];
  role_id?: string | null;
}

/**
 * 创建角色 DTO
 */
export interface CreateRoleDto {
  name: string;
  description?: string;
  llm_provider?: string;
  llm_model?: string;
  temperature?: number;
  system_prompt?: string;
  voice?: string;
  intent_strategy?: string;
  max_history?: number;
}

/**
 * 更新角色 DTO
 */
export interface UpdateRoleDto {
  name?: string;
  description?: string;
  llm_provider?: string;
  llm_model?: string;
  temperature?: number;
  system_prompt?: string;
  voice?: string;
  intent_strategy?: string;
  max_history?: number;
}

// ============ WebSocket 类型 ============

export type WsChannel = 'control' | 'business' | 'audio_upload' | 'audio_download';

/**
 * WebSocket 连接信息
 */
export interface RobotConnection {
  robotId: string;
  websocket: any;
  connectedAt: Date;
  lastActiveAt: Date;
  channel?: WsChannel;
  metadata: {
    name?: string;
    model?: string;
    version?: string;
  };
}

// ============ 消息类型 ============

export interface AudioChunk {
  format: 'opus' | 'pcm' | 'mp3';
  sampleRate: 16000 | 48000;
  channels: 1 | 2;
  sessionId?: string;
  seq?: number;
  frameDurationMs?: number;
  buffer: string; // base64
}

export interface AudioStart {
  format: 'opus';
  sampleRate: 16000 | 48000;
  channels: 1 | 2;
  frameDurationMs: number;
  sessionId: string;
}

export interface AudioEnd {
  sessionId: string;
  reason?: 'silence' | 'max_length' | 'manual' | 'error';
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  stream?: boolean;
}

// 客户端消息基础类型
interface BaseClientMessage {
  robotId: string;
  timestamp: number;
}

export interface TextInputMessage extends BaseClientMessage {
  type: 'text_input';
  data: {
    text: string;
    context?: string;
    ttsOptions?: TTSOptions;
    conversationId?: string;
  };
}

export interface AudioStartMessage extends BaseClientMessage {
  type: 'audio_start';
  data: AudioStart;
}

export interface AudioChunkMessage extends BaseClientMessage {
  type: 'audio_chunk';
  data: AudioChunk;
}

export interface AudioEndMessage extends BaseClientMessage {
  type: 'audio_end';
  data: AudioEnd;
}

export interface HeartbeatMessage extends BaseClientMessage {
  type: 'heartbeat';
  data?: any;
}

export interface StatusMessage extends BaseClientMessage {
  type: 'status';
  data: {
    battery?: number;
    temperature?: number;
    position?: string;
  };
}

export interface RobotRegisterMessage extends BaseClientMessage {
  type: 'robot_register';
  data: {
    name?: string;
    model?: string;
    version?: string;
    metadata?: any;
  };
}

export interface TTSInputMessage extends BaseClientMessage {
  type: 'tts_input';
  data: {
    text: string;
    ttsOptions?: TTSOptions;
    conversationId?: string;
  };
}

export interface VideoSubscribeMessage extends BaseClientMessage {
  type: 'video_subscribe';
}

export interface VideoUnsubscribeMessage extends BaseClientMessage {
  type: 'video_unsubscribe';
}

export interface ActionInputMessage extends BaseClientMessage {
  type: 'action_input';
  data: {
    action: string;
    parameters?: Record<string, any>;
  };
}

export interface ControlInputMessage extends BaseClientMessage {
  type: 'control_input';
  data: {
    command: string;
    parameters?: Record<string, any>;
  };
}

export interface AudioControlMessage extends BaseClientMessage {
  type: 'audio_control';
  data: {
    action: 'start' | 'stop' | 'pause' | 'resume';
  };
}

export type ClientMessage =
  | TextInputMessage
  | AudioStartMessage
  | AudioChunkMessage
  | AudioEndMessage
  | HeartbeatMessage
  | StatusMessage
  | RobotRegisterMessage
  | TTSInputMessage
  | VideoSubscribeMessage
  | VideoUnsubscribeMessage
  | ActionInputMessage
  | ControlInputMessage
  | AudioControlMessage;

// 服务端消息
export interface ServerMessage {
  type: string;
  robotId: string;
  timestamp: number;
  conversationId?: string;
  data?: any;
  error?: string;
}

// ============ AI/LLM 类型 ============

export type LLMProvider = 'openai' | 'anthropic' | 'tongyi' | 'deepseek' | 'bigmodel';

export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ConversationContext {
  history: Message[];
  maxHistory: number;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
}

export interface Action {
  name: string;
  parameters: Record<string, any>;
  priority?: number;
}

export interface AIResponse {
  text: string;
  actions: Action[];
  metadata?: {
    model?: string;
    tokensUsed?: number;
    responseTime?: number;
  };
}

/**
 * 音频响应
 */
export interface AudioResponse {
  buffer: string;  // base64 encoded
  format: string;
  duration?: number;
  sampleRate?: number;
}

/**
 * 安全检查规则
 */
export interface SafetyRule {
  action: string;
  maxValue?: number;
  minValue?: number;
}

/**
 * 安全检查结果
 */
export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  sanitizedAction?: Action;
}

/**
 * LLM 调用选项
 */
export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}
