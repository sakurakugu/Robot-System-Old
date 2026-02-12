
// ============ LLM 相关类型 ============

export const 所有LLM供应商 = ['openai', 'anthropic', 'aliyun', 'deepseek', 'bigmodel'] as const;
export type LLM供应商枚举 = typeof 所有LLM供应商[number];

export const 所有ASR供应商 = ['xunfei', 'openai', 'aliyun'] as const;
export type ASR供应商枚举 = typeof 所有ASR供应商[number];

export type 所有供应商枚举 = LLM供应商枚举 | ASR供应商枚举;

export interface LLM供应商配置 {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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
  model?: string;
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

/**
 * LLM 配置视图（不暴露完整 API Key）
 */
export interface LLMConfigView {
  provider: LLM供应商枚举;
  providers: Record<LLM供应商枚举, {
    model: string;
    baseUrl: string;
    hasApiKey: boolean;
    apiKeyLength: number;
  }>;
}

/**
 * 当前生效的 LLM 配置（脱敏）
 */
export interface LLMActiveConfigView {
  provider: LLM供应商枚举;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
}

/**
 * 模型选项
 */
export interface 模型选项 {
  value: string;
  label: string;
}

/**
 * LLM 供应商配置
 */
export interface LLM供应商选项 {
  value: LLM供应商枚举;
  label: string;
  baseUrl: string;
  models: 模型选项[];
}

/**
 * 所有支持的 LLM 供应商配置
 */
export const LLM供应商列表: LLM供应商选项[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
  },
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
  },
  {
    value: 'aliyun',
    label: '千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { value: 'qwen-plus', label: 'Qwen Plus' },
      { value: 'qwen-turbo', label: 'Qwen Turbo' },
      { value: 'qwen-max', label: 'Qwen Max' },
      { value: 'qwen-long', label: 'Qwen Long' },
      { value: 'qwen-flash', label: 'Qwen Flash' },
    ],
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
    ],
  },
  {
    value: 'bigmodel',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { value: 'glm-4-flash', label: 'GLM-4 Flash' },
      { value: 'glm-4-plus', label: 'GLM-4 Plus' },
      { value: 'glm-4', label: 'GLM-4' },
    ],
  },
];

/**
 * 获取供应商配置
 */
export function 获取供应商配置(供应商: LLM供应商枚举): LLM供应商选项 | undefined {
  return LLM供应商列表.find((项) => 项.value === 供应商);
}

/**
 * 获取供应商的默认模型
 */
export function 获取默认模型(供应商: LLM供应商枚举): string {
  const 配置 = 获取供应商配置(供应商);
  return 配置?.models[0]?.value || '';
}

/**
 * 验证模型是否属于供应商
 */
export function 验证模型(供应商: LLM供应商枚举, 模型: string): boolean {
  const 配置 = 获取供应商配置(供应商);
  return 配置?.models.some((项) => 项.value === 模型) || false;
}

