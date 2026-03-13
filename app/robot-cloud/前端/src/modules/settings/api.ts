// 系统设置模块 - API

import { http } from '@/api/request'
import type {
    AIConfig,
    ApiResponse,
    AppVersionInfo,
    FeedbackItem,
    FeedbackListQuery,
    FeedbackListResult,
    FeedbackStatus,
    LLMConfig,
    LLMProvider,
    NetworkInfo,
    ReleaseChannel,
    RobotPackageInfo,
    SubmitFeedbackDTO,
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

export function submitFeedback(data: SubmitFeedbackDTO) {
  return http.post<ApiResponse<{ id: string }>>('/api/v1/feedback', data)
}

export function getFeedbackList(query?: FeedbackListQuery) {
  return http.get<ApiResponse<FeedbackListResult>>('/api/v1/feedback', {
    params: query,
  })
}

export function getFeedbackDetail(id: string) {
  return http.get<ApiResponse<FeedbackItem>>(`/api/v1/feedback/${id}`)
}

export function updateFeedbackStatus(id: string, status: FeedbackStatus) {
  return http.patch<ApiResponse<FeedbackItem>>(`/api/v1/feedback/${id}/status`, { status })
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
    timeout: 0, // 文件上传不限超时
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

/**
 * 上传机器人包（可分别或合并上传 agent / server / common）
 */
export function uploadRobotPackages(payload: {
  agent?: { file: File; hash: string }
  server?: { file: File; hash: string }
  common?: { file: File; hash: string }
  version: string
  versionCode: number
  channel: ReleaseChannel
  changelog?: string
}) {
  const formData = new FormData()
  formData.append('version', payload.version)
  formData.append('versionCode', String(payload.versionCode))
  formData.append('channel', payload.channel)
  if (payload.changelog) {
    formData.append('changelog', payload.changelog)
  }
  if (payload.agent) {
    formData.append('agent', payload.agent.file)
    formData.append('agentHash', payload.agent.hash)
  }
  if (payload.server) {
    formData.append('server', payload.server.file)
    formData.append('serverHash', payload.server.hash)
  }
  if (payload.common) {
    formData.append('common', payload.common.file)
    formData.append('commonHash', payload.common.hash)
  }
  return http.post<ApiResponse<RobotPackageInfo>>('/api/v1/robot-packages/upload', formData, {
    timeout: 0, // 文件上传不限超时
  })
}

/**
 * 获取机器人包版本列表
 */
export function getRobotPackageVersions(channel?: ReleaseChannel) {
  return http.get<ApiResponse<RobotPackageInfo[]>>('/api/v1/robot-packages/versions', {
    params: channel ? { channel } : undefined,
  })
}

/**
 * 回滚机器人包到指定版本
 */
export function rollbackRobotPackage(id: number) {
  return http.post<ApiResponse<RobotPackageInfo>>(`/api/v1/robot-packages/rollback/${id}`)
}

/**
 * 删除机器人包版本
 */
export function deleteRobotPackage(id: number) {
  return http.delete<ApiResponse>(`/api/v1/robot-packages/versions/${id}`)
}
