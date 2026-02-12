import type { ASR供应商枚举 } from '../大模型管理/types';
import { Action } from '../机器人交互/types';
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

// 语音识别选项
export interface ASROptions {
  language?: string;
  prompt?: string;
  provider?: ASR供应商枚举;
  model?: string;
}
