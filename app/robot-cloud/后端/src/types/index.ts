/**
 * 统一类型定义
 * 所有模块共用的类型在此定义，确保前后端一致性
 */

// ============ 基础类型 ============

export type 对话类型 = 'audio' | 'text';
export type ActionStatus = 'success' | 'failed' | 'rejected';

// ============ 数据库实体 ============

/**
 * 对话记录
 */
export interface ConversationRecord {
  uuid: number;
  robot_id: string;
  conversation_id: string | null;
  timestamp: string;
  type: 对话类型;
  user_input: string;
  ai_response: string;
  actions: string | null; // JSON 字符串
  processing_time: number | null;
  metadata: string | null; // JSON 字符串
}

/**
 * 动作日志记录
 */
export interface ActionLogRecord {
  uuid: number;
  robot_id: string;
  conversation_id: string | null;
  action_name: string;
  parameters: string | null; // JSON 字符串
  status: ActionStatus;
  result_detail: string | null;
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

// ============ DTO 类型 ============

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
    motion_control_version?: string;
    robot_server_version?: string;
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
  buffer: string; // base64 编码
}

export interface AudioStart {
  format: 'opus' | 'pcm';
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
    metadata?: {
      version?: string; // robot-agent 版本
      motion_control_version?: string;
      robot_server_version?: string;
      [key: string]: any;
    };
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
  | AudioControlMessage
  | SdkModeSetMessage
  | SdkModeGetMessage
  | SdkModeResponseMessage;

export interface SdkModeSetMessage extends BaseClientMessage {
  type: 'sdk_mode_set';
  data: {
    mode: number;
  };
}

export interface SdkModeGetMessage extends BaseClientMessage {
  type: 'sdk_mode_get';
  data?: any;
}

export interface SdkModeResponseMessage extends BaseClientMessage {
  type: 'sdk_mode_response';
  data: {
    mode: number;
    result: 'success' | 'failure';
  };
}

// 服务端消息
export interface ServerMessage {
  type: string;
  robotId: string;
  timestamp: number;
  conversationId?: string;
  data?: any;
  error?: string;
}

/**
 * 音频响应
 */
export interface AudioResponse {
  buffer: string;  // base64 编码
  format: string;
  duration?: number;
  sampleRate?: number;
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
