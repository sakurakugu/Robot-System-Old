// 对话和动作相关类型定义

// 动作相关
export interface Action {
  name: string;                    // 动作名称
  parameters: Record<string, any>; // 动作参数
  priority?: number;               // 动作优先级，数值越大优先级越高
}

export interface ActionCommand {
  action: string;                  // 动作名称
  parameters: Record<string, any>; // 动作参数
  safetyChecked: boolean;          // 是否通过安全检查
}

// 安全检查结果
export interface SafetyCheckResult {
  safe: boolean;            // 是否安全
  reason?: string;          // 不安全原因
  sanitizedAction?: Action; // 如果不安全，提供一个安全的替代动作
}

// 安全检查规则
export interface SafetyRule {
  action: string;
  maxValue?: number;
  minValue?: number;
  maxFrequency?: number;
}

// ============ AI 类型 ============

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

export interface AI响应 {
  text: string;
  actions: Action[];
  emotions?: string[];
  metadata: {
    model: string;
    tokensUsed: number;
    responseTime: number;
    vision?: boolean;      // 是否包含视觉识别
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
  stream?: boolean;
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
