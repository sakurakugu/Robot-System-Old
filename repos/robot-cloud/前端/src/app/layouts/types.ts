// API 响应通用类型

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginationParams {
  limit?: number
  offset?: number
  page?: number
  pageSize?: number
}

export interface PaginationResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// 导出所有模块类型
export * from '@/features/conversation/types'
export * from '@/features/robot/types'
export * from '@/features/settings/types'
export * from '@/share/websocket/types'


