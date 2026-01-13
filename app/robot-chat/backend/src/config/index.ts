import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  // 服务配置
  port: number;
  nodeEnv: string;

  // WebSocket配置
  ws: {
    path: string;
    maxConnections: number;
  };

  // AI服务配置
  llm: {
    provider: 'openai' | 'anthropic' | 'tongyi' | 'deepseek';
    openai?: {
      apiKey: string;
      model: string;
      baseUrl?: string;
    };
  };

  // 语音识别配置
  asr: {
    provider: 'xunfei' | 'aliyun' | 'azure';
    xunfei?: {
      appId: string;
      apiKey: string;
      apiSecret: string;
    };
  };

  // 语音合成配置
  tts: {
    provider: 'xunfei' | 'aliyun' | 'azure';
    xunfei?: {
      appId: string;
      apiKey: string;
      apiSecret: string;
    };
  };

  // 数据库配置
  database: {
    type: 'sqlite' | 'postgresql';
    path?: string;
    url?: string;
  };

  // 日志配置
  logging: {
    level: string;
    dir: string;
  };

  // 安全配置
  security: {
    jwtSecret: string;
    rateLimit: {
      max: number;
      windowMs: number;
    };
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  ws: {
    path: process.env.WS_PATH || '/api/conversation/connect',
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '100', 10),
  },

  llm: {
    provider: (process.env.LLM_PROVIDER as any) || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4',
      baseUrl: process.env.OPENAI_BASE_URL,
    },
  },

  asr: {
    provider: (process.env.ASR_PROVIDER as any) || 'xunfei',
    xunfei: {
      appId: process.env.XUNFEI_ASR_APP_ID || '',
      apiKey: process.env.XUNFEI_ASR_API_KEY || '',
      apiSecret: process.env.XUNFEI_ASR_API_SECRET || '',
    },
  },

  tts: {
    provider: (process.env.TTS_PROVIDER as any) || 'xunfei',
    xunfei: {
      appId: process.env.XUNFEI_TTS_APP_ID || '',
      apiKey: process.env.XUNFEI_TTS_API_KEY || '',
      apiSecret: process.env.XUNFEI_TTS_API_SECRET || '',
    },
  },

  database: {
    type: (process.env.DB_TYPE as any) || 'sqlite',
    path: process.env.DB_PATH || path.join(__dirname, '../../data/conversations.db'),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    },
  },
};

export default config;
