// 系统设置模块 - 类型定义

export interface LLMConfig {
  provider: 'openai' | 'bigmodel' | 'anthropic' | 'deepseek' | 'aliyun';
  openai: {
    model: string
    baseUrl: string
    hasApiKey: boolean
    apiKeyLength: number
  }
  bigmodel: {
    model: string
    baseUrl: string
    hasApiKey: boolean
    apiKeyLength: number
  }
  anthropic: {
    model: string
    baseUrl: string
    hasApiKey: boolean
    apiKeyLength: number
  }
  deepseek: {
    model: string
    baseUrl: string
    hasApiKey: boolean
    apiKeyLength: number
  }
  aliyun: {
    model: string
    baseUrl: string
    hasApiKey: boolean
    apiKeyLength: number
  }
}

export interface UpdateLLMConfigDTO {
  provider?: string
  apiKey?: string
  model?: string
  baseUrl?: string
}

export interface AIConfig {
  xunfeiAsr: {
    hasAppId: boolean
    appIdLength: number
    hasApiKey: boolean
    apiKeyLength: number
    hasApiSecret: boolean
    apiSecretLength: number
  }
}

export interface UpdateAIConfigDTO {
  xunfeiAsr?: {
    appId?: string
    apiKey?: string
    apiSecret?: string
  }
}

export interface LLMProvider {
  id: string
  name: string
  models: LLMModel[]
}

export interface LLMModel {
  id: string
  name: string
  description?: string
}

export interface UIConfig {
  serverUrl: string
  /** Web 前端专用 WebSocket 配置（可选，未设置时自动派生） */
  webWsBusinessUrl?: string
  webWsAudioUploadUrl?: string
  webWsAudioDownloadUrl?: string
  maxHistory: number
  controlLayout?: Record<string, { x: number; y: number }> | null
}

export interface UpdateUIConfigDTO {
  serverUrl?: string
  /** Web 前端专用 WebSocket 配置（可选） */
  webWsBusinessUrl?: string
  webWsAudioUploadUrl?: string
  webWsAudioDownloadUrl?: string
  maxHistory?: number
  controlLayout?: Record<string, { x: number; y: number }>
}

export interface SystemStatus {
  onlineRobots: number
  totalRobots: number
  timestamp: string
}

export interface NetworkInfo {
  ip: string
  all: string[]
}

export type ReleaseChannel = 'stable' | 'beta'

export interface AppVersionInfo {
  id: number
  versionName: string
  versionCode: number
  channel: ReleaseChannel
  fileName: string
  fileSize: number
  fileHash: string
  changelog: string | null
  isActive: boolean
  uploadedAt: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}
