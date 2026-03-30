export interface Role {
  uuid: string
  name: string
  description?: string
  llm_provider?: string
  llm_model?: string
  asr_provider?: string
  asr_model?: string
  temperature?: number
  system_prompt?: string
  voice?: string
  intent_strategy?: string
  max_history?: number
  is_default?: number
  robot_count?: number
}

export interface ProviderModelOption {
  value: string
  label: string
}

export interface LlmProviderOption {
  value: string
  label: string
  models?: ProviderModelOption[]
}

export interface RoleFormData {
  uuid: string
  name: string
  description: string
  llm_provider: string
  llm_model: string
  asr_provider: string
  asr_model: string
  temperature: number
  system_prompt: string
  voice: string
  intent_strategy: string
  max_history: number
}

export interface BoundRobot {
  uuid: string
  name: string
  model?: string | null
  ip?: string | null
}
