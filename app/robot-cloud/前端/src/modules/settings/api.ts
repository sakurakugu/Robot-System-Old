// 系统设置模块 - API

import { http } from '@/api/request'
import type {
  AIConfig,
  ApiResponse,
  AppVersionInfo,
  LLMConfig,
  LLMProvider,
  NetworkInfo,
  ReleaseChannel,
  SystemStatus,
  UIConfig,
  UpdateAIConfigDTO,
  UpdateLLMConfigDTO,
  UpdateUIConfigDTO,
} from './types'

/**
 * 获取 LLM 配置
 */
export function getLLMConfig() {
  return http.get<ApiResponse<LLMConfig>>('/api/v1/config/llm')
}

/**
 * 获取 LLM 提供商列表
 */
export function getLLMProviders() {
  return http.get<ApiResponse<LLMProvider[]>>('/api/v1/config/llm/providers')
}

/**
 * 更新 LLM 配置
 */
export function updateLLMConfig(data: UpdateLLMConfigDTO) {
  return http.put<ApiResponse>('/api/v1/config/llm', data)
}

/**
 * 获取 AI 配置
 */
export function getAIConfig() {
  return http.get<ApiResponse<AIConfig>>('/api/v1/config/ai')
}

/**
 * 更新 AI 配置
 */
export function updateAIConfig(data: UpdateAIConfigDTO) {
  return http.put<ApiResponse>('/api/v1/config/ai', data)
}

/**
 * 获取 UI 配置
 */
export function getUIConfig() {
  return http.get<ApiResponse<UIConfig>>('/api/v1/config/ui')
}

/**
 * 更新 UI 配置
 */
export function updateUIConfig(data: UpdateUIConfigDTO) {
  return http.put<ApiResponse>('/api/v1/config/ui', data)
}

/**
 * 获取系统状态
 */
export function getSystemStatus() {
  return http.get<ApiResponse<SystemStatus>>('/api/v1/status')
}

/**
 * 健康检查
 */
export function healthCheck() {
  return http.get<ApiResponse>('/api/v1/health')
}

/**
 * 获取本机 IP
 */
export function getLocalIP() {
  return http.get<ApiResponse<NetworkInfo>>('/api/v1/network/local-ip')
}

/**
 * 上传 APP 安装包
 */
export function uploadAppPackage(payload: {
  apk: File
  version: string
  versionCode: number
  fileHash: string
  channel: ReleaseChannel
  changelog?: string
}) {
  const formData = new FormData()
  formData.append('apk', payload.apk)
  formData.append('version', payload.version)
  formData.append('versionCode', String(payload.versionCode))
  formData.append('fileHash', payload.fileHash)
  formData.append('channel', payload.channel)
  if (payload.changelog) {
    formData.append('changelog', payload.changelog)
  }

  return http.post<ApiResponse<AppVersionInfo>>('/api/v1/updates/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

/**
 * 获取 APP 版本列表
 */
export function getAppVersions(channel?: ReleaseChannel) {
  return http.get<ApiResponse<AppVersionInfo[]>>('/api/v1/updates/versions', {
    params: channel ? { channel } : undefined,
  })
}

/**
 * 回滚到指定版本
 */
export function rollbackAppVersion(id: number) {
  return http.post<ApiResponse<AppVersionInfo>>(`/api/v1/updates/rollback/${id}`)
}

/**
 * 删除版本
 */
export function deleteAppVersion(id: number) {
  return http.delete<ApiResponse>(`/api/v1/updates/versions/${id}`)
}
