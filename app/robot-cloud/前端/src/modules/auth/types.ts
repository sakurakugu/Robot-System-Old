export type AccountRole = 'user' | 'admin' | 'super_admin'

export interface AuthUser {
  id: string
  username: string
  role: AccountRole
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface LoginSession {
  id: string
  clientType: 'web' | 'mobile' | 'unknown'
  deviceName: string
  ipAddress: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

export interface AuthPayload {
  token: string
  user: AuthUser
  session: LoginSession
}

export interface ApiResp<T> {
  success: boolean
  data: T
  error?: string
  message?: string
}
