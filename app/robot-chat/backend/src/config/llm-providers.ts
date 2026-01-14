// 导出大模型供应商值类型
export type LLMProviderValue = 'openai' | 'anthropic' | 'deepseek' | 'bigmodel'

// 导出大模型模型接口
export interface LLMModel {
  value: string
  label: string
}

// 导出大模型供应商配置接口
export interface LLMProviderConfig {
  value: LLMProviderValue
  label: string
  baseUrl?: string
  models: LLMModel[]
}

// 导出大模型供应商配置数组
export const LLM_PROVIDERS: LLMProviderConfig[] = [
  {
    value: 'openai',
    label: 'OpenAI（开放AI）',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { value: 'gpt-4o', label: 'OpenAI GPT-4o' },
      { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o-mini' },
      { value: 'gpt-4.1', label: 'OpenAI GPT-4.1' }
    ]
  },
  {
    value: 'bigmodel',
    label: '智谱 BigModel',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: [
      { value: 'glm-4.5-flash', label: 'BigModel GLM-4.5-Flash' }
    ]
  },
  {
    value: 'anthropic',
    label: 'Anthropic（Claude）',
    baseUrl: 'https://api.anthropic.com',
    models: [
      { value: 'claude-3-5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
      { value: 'claude-3-opus', label: 'Anthropic Claude 3 Opus' }
    ]
  },
  {
    value: 'deepseek',
    label: 'DeepSeek（深度求索）',
    baseUrl: 'https://api.deepseek.com',
    models: [
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
      { value: 'deepseek-chat', label: 'DeepSeek Chat' }
    ]
  }
]
