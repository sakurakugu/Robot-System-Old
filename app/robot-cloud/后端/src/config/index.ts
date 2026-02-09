import dotenv from 'dotenv';
import path from 'path';
import type { LLMProvider } from '../types';

dotenv.config();

export interface LLM供应商配置 {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface 配置 {
  // 服务配置
  port: number;
  ports: {
    http: number;
    control: number;
    business: number;
    audioUpload: number;
    audioDownload: number;
  };
  nodeEnv: string;

  // WebSocket配置
  ws: {
    path: string;
    maxConnections: number;
  };

  // AI服务配置
  llm: {
    provider: LLMProvider;
    providers: Record<LLMProvider, LLM供应商配置>;
  };

  // 语音识别配置
  asr: {
    provider: 'xunfei' | 'openai' | 'aliyun';
    xunfei?: {
      appId: string;
      apiKey: string;
      apiSecret: string;
    };
    openai?: {
      apiKey: string;
      model: string;
      baseUrl?: string;
      language?: string;
      prompt?: string;
    };
    aliyun?: {
      apiKey: string;
      model: string;
      baseUrl?: string;
    };
  };

  // 语音合成配置
  tts: {
    provider: 'xunfei' | 'edge';
    xunfei?: {
      appId: string;
      apiKey: string;
      apiSecret: string;
    };
  };

  // 数据库配置
  database: {
    type: 'sqlite';
    path: string;
  };

  // 日志配置
  logging: {
    level: string;
    dir: string;
  };
}

/**
 * 默认 LLM 供应商配置
 */
const 默认供应商: Record<LLMProvider, LLM供应商配置> = {
  openai: {
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    apiKey: '',
    model: 'claude-3-haiku-20240307',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  tongyi: {
    apiKey: '',
    model: 'qwen-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  deepseek: {
    apiKey: '',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  bigmodel: {
    apiKey: '',
    model: 'glm-4-flash',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
};

const 配置: 配置 = {
  port: parseInt(process.env.PORT || '9004', 10),
  ports: {
    http: parseInt(process.env.PORT || '9004', 10),
    control: parseInt(process.env.CONTROL_PORT || '9000', 10),
    business: parseInt(process.env.BUSINESS_PORT || '9001', 10),
    audioUpload: parseInt(process.env.AUDIO_UPLOAD_PORT || '9002', 10),
    audioDownload: parseInt(process.env.AUDIO_DOWNLOAD_PORT || '9003', 10),
  },
  nodeEnv: process.env.NODE_ENV || 'development',

  ws: {
    path: process.env.WS_PATH || '/api/v1/interaction/connect',
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '100', 10),
  },

  llm: {
    provider: (process.env.LLM_PROVIDER as LLMProvider) || 'tongyi',
    providers: { ...默认供应商 },
  },

  asr: {
    provider: (process.env.ASR_PROVIDER as any) || 'xunfei',
    xunfei: {
      appId: process.env.XUNFEI_ASR_APP_ID || '',
      apiKey: process.env.XUNFEI_ASR_API_KEY || '',
      apiSecret: process.env.XUNFEI_ASR_API_SECRET || '',
    },
    openai: {
      apiKey: process.env.OPENAI_ASR_API_KEY || '',
      model: process.env.OPENAI_ASR_MODEL || 'whisper-1',
      baseUrl: process.env.OPENAI_ASR_BASE_URL || 'https://api.openai.com/v1',
      language: process.env.OPENAI_ASR_LANGUAGE || 'zh',
      prompt: process.env.OPENAI_ASR_PROMPT || '',
    },
    aliyun: {
      apiKey: process.env.ALIYUN_ASR_API_KEY || '',
      model: process.env.ALIYUN_ASR_MODEL || 'fun-asr-realtime',
      baseUrl: process.env.ALIYUN_ASR_BASE_URL || 'wss://dashscope.aliyuncs.com/api-ws/v1/inference',
    },
  },

  tts: {
    provider: (process.env.TTS_PROVIDER as any) || 'edge',
    xunfei: {
      appId: process.env.XUNFEI_TTS_APP_ID || '',
      apiKey: process.env.XUNFEI_TTS_API_KEY || '',
      apiSecret: process.env.XUNFEI_TTS_API_SECRET || '',
    },
  },

  database: {
    type: 'sqlite',
    path: process.env.DB_PATH || path.join(__dirname, '../../data/robot.db'),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || path.join(__dirname, '../../data/logs'),
  },
};

export default 配置;
