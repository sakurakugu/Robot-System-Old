import dotenv from 'dotenv';
import path from 'path';
import type { ASR供应商枚举, LLM供应商枚举, LLM供应商配置 } from '../modules/大模型管理/types';

dotenv.config();

export interface 配置 {
  // 服务配置
  port: number;
  nodeEnv: string;

  // WebSocket配置
  ws: {
    robotPath: string;
    phonePath: string;
    webPath: string;
    maxConnections: number;
  };

  // AI服务配置
  llm: {
    provider: LLM供应商枚举;
    providers: Record<LLM供应商枚举, LLM供应商配置>;
  };

  // 语音识别配置
  asr: {
    provider: ASR供应商枚举;
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
const 默认供应商: Record<LLM供应商枚举, LLM供应商配置> = {
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
  aliyun: {
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
  port: parseInt(process.env.PORT || '9000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  ws: {
    robotPath: process.env.WS_ROBOT_PATH || '/api/v1/robot',
    phonePath: process.env.WS_PHONE_PATH || '/api/v1/phone',
    webPath: process.env.WS_WEB_PATH || '/api/v1/web',
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '100', 10),
  },

  llm: {
    provider: 'aliyun',
    providers: { ...默认供应商 },
  },

  asr: {
    provider: 'aliyun',
    xunfei: {
      appId: '',
      apiKey: '',
      apiSecret: '',
    },
    openai: {
      apiKey: '',
      model: 'whisper-1',
      baseUrl: 'https://api.openai.com/v1',
      language: 'zh',
      prompt: '',
    },
    aliyun: {
      apiKey: '',
      model: 'fun-asr-realtime',
      baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference',
    },
  },

  tts: {
    provider: 'edge',
    xunfei: {
      appId: '',
      apiKey: '',
      apiSecret: '',
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
