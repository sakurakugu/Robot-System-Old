import type { LLMProvider } from '../types';

/**
 * 模型选项
 */
export interface ModelOption {
  value: string;
  label: string;
}

/**
 * LLM 供应商配置
 */
export interface LLMProviderOption {
  value: LLMProvider;
  label: string;
  baseUrl: string;
  models: ModelOption[];
}

/**
 * 所有支持的 LLM 供应商配置
 */
export const LLM_PROVIDERS: LLMProviderOption[] = [
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
    value: 'tongyi',
    label: '通义千问',
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
export function getProviderConfig(provider: LLMProvider): LLMProviderOption | undefined {
  return LLM_PROVIDERS.find((p) => p.value === provider);
}

/**
 * 获取供应商的默认模型
 */
export function getDefaultModel(provider: LLMProvider): string {
  const config = getProviderConfig(provider);
  return config?.models[0]?.value || '';
}

/**
 * 验证模型是否属于供应商
 */
export function isValidModel(provider: LLMProvider, model: string): boolean {
  const config = getProviderConfig(provider);
  return config?.models.some((m) => m.value === model) || false;
}
