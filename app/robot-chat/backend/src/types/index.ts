// WebSocket消息类型定义

export interface RobotConnection {
  robotId: string;
  websocket: any;
  connectedAt: Date;
  lastActiveAt: Date;
  metadata: {
    name?: string;
    model?: string;
    version?: string;
  };
}

// 音频相关
export interface AudioChunk {
  format: 'opus' | 'pcm' | 'mp3';
  sampleRate: 16000 | 48000;
  channels: 1 | 2;
  buffer: string; // base64编码的音频数据
}

export interface AudioResponse {
  format: 'opus' | 'mp3';
  buffer: string; // base64编码
  duration: number;
}

// 客户端消息
export type ClientMessage =
  | AudioChunkMessage
  | TextInputMessage
  | HeartbeatMessage
  | StatusMessage;

export interface AudioChunkMessage {
  type: 'audio_chunk';
  robotId: string;
  timestamp: number;
  data: AudioChunk;
}

export interface TextInputMessage {
  type: 'text_input';
  robotId: string;
  timestamp: number;
  data: {
    text: string;
    context?: string;
  };
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  robotId: string;
  timestamp: number;
  data?: any;
}

export interface StatusMessage {
  type: 'status';
  robotId: string;
  timestamp: number;
  data: {
    battery?: number;
    temperature?: number;
    position?: string;
  };
}

// 服务端消息
export type ServerMessage =
  | AudioResponseMessage
  | ActionCommandMessage
  | TextResponseMessage
  | ErrorMessage;

export interface AudioResponseMessage {
  type: 'audio_response';
  robotId: string;
  timestamp: number;
  data: AudioResponse;
}

export interface ActionCommandMessage {
  type: 'action_command';
  robotId: string;
  timestamp: number;
  data: ActionCommand;
}

export interface TextResponseMessage {
  type: 'text_response';
  robotId: string;
  timestamp: number;
  data: {
    text: string;
  };
}

export interface ErrorMessage {
  type: 'error';
  robotId: string;
  timestamp: number;
  data: {
    code: string;
    message: string;
    details?: any;
  };
}

// 动作相关
export interface Action {
  name: string;
  parameters: Record<string, any>;
  priority?: number;
}

export interface ActionCommand {
  action: string;
  parameters: Record<string, any>;
  safetyChecked: boolean;
}

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  sanitizedAction?: Action;
}

export interface SafetyRule {
  action: string;
  maxValue?: number;
  minValue?: number;
  maxFrequency?: number;
}

// AI相关
export interface ConversationContext {
  history: Message[];
  maxHistory: number;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface AIResponse {
  text: string;
  actions: Action[];
  emotions?: string[];
  metadata: {
    model: string;
    tokensUsed: number;
    responseTime: number;
  };
}

// 语音服务
export interface RecognitionResult {
  text: string;
  confidence: number;
  segments?: {
    text: string;
    startTime: number;
    endTime: number;
  }[];
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}

// LLM相关
export interface LLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface LLMResponse {
  content: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// 知识库
export interface Document {
  uuid: string;
  content: string;
  metadata: {
    title?: string;
    source?: string;
    category?: string;
    tags?: string[];
    createdAt: Date;
  };
  embedding?: number[];
}

// 日志
export interface ConversationLog {
  id: string;
  robotId: string;
  timestamp: Date;
  type: 'audio' | 'text';
  input: {
    raw?: Buffer;
    text: string;
    duration?: number;
  };
  processing: {
    asrTime?: number;
    llmTime: number;
    ttsTime?: number;
    totalTime: number;
  };
  output: {
    text: string;
    actions: Action[];
    audio?: Buffer;
  };
  metadata: {
    model: string;
    tokensUsed: number;
    cost?: number;
  };
}

// 数据库相关
export interface RobotRecord {
  uuid: string;
  name?: string;
  model?: string;
  status: 'online' | 'offline' | 'error';
  last_connected?: Date;
  created_at: Date;
  metadata?: string; // JSON string
}

export interface ConversationRecord {
  uuid: number;
  robot_id: string;
  timestamp: Date;
  type: 'audio' | 'text';
  user_input: string;
  ai_response: string;
  actions?: string; // JSON string
  processing_time: number;
  metadata?: string; // JSON string
}

export interface ActionLogRecord {
  uuid: number;
  robot_id: string;
  action_name: string;
  parameters?: string; // JSON string
  status: 'success' | 'failed' | 'rejected';
  executed_at: Date;
}
