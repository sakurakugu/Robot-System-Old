import { http } from '@/api/request'
import type { ApiResp, AuthPayload, AuthUser, LoginSession } from './types'

export function registerAccount(payload: { username: string; password: string }) {
  return http.post<ApiResp<AuthPayload>>('/api/v1/auth/register', payload, {
    headers: {
      'x-client-type': 'web',
      'x-device-name': navigator.userAgent,
    },
  })
}

export function loginAccount(payload: { username: string; password: string }) {
  return http.post<ApiResp<AuthPayload>>('/api/v1/auth/login', payload, {
    headers: {
      'x-client-type': 'web',
      'x-device-name': navigator.userAgent,
    },
  })
}

export function getProfile() {
  return http.get<ApiResp<AuthUser>>('/api/v1/auth/me')
}

export function logoutAccount() {
  return http.post<ApiResp<{ success: boolean }>>('/api/v1/auth/logout')
}

export function getMySessions() {
  return http.get<ApiResp<LoginSession[]>>('/api/v1/auth/sessions')
}

export function revokeSession(id: string) {
  return http.delete<ApiResp<{ success: boolean }>>(`/api/v1/auth/sessions/${id}`)
}

export function getUsers() {
  return http.get<ApiResp<AuthUser[]>>('/api/v1/auth/users')
}

export function updateUserRole(id: string, role: 'user' | 'admin' | 'super_admin') {
  return http.put<ApiResp<AuthUser>>(`/api/v1/auth/users/${id}/role`, { role })
}
