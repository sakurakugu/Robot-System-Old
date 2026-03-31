import { http } from '@/share/api/http'
import type { BoundRobot, LlmProviderOption, Role, RoleFormData } from './types'

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

async function requestJson<T>(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  body?: unknown,
): Promise<T> {
  let payload: ApiEnvelope<T>

  switch (method) {
    case 'get':
      payload = await http.get<ApiEnvelope<T>>(url)
      break
    case 'post':
      payload = await http.post<ApiEnvelope<T>>(url, body)
      break
    case 'put':
      payload = await http.put<ApiEnvelope<T>>(url, body)
      break
    case 'delete':
      payload = await http.delete<ApiEnvelope<T>>(url)
      break
  }

  return (payload.data ?? payload) as T
}

export function getLlmProviders() {
  return requestJson<LlmProviderOption[]>('get', '/api/v1/config/llm/providers')
}

export function getRoles() {
  return requestJson<Role[]>('get', '/api/v1/roles')
}

export function getRoleRobots(roleUuid: string) {
  return requestJson<BoundRobot[]>('get', `/api/v1/roles/${roleUuid}/robots`)
}

export async function getRolesWithRobotCount() {
  const roles = await getRoles()
  const robotResults = await Promise.allSettled(
    roles.map(role => getRoleRobots(role.uuid)),
  )

  return roles.map((role, index) => ({
    ...role,
    robot_count: robotResults[index].status === 'fulfilled'
      ? robotResults[index].value.length
      : 0,
  }))
}

export function createRole(data: RoleFormData) {
  return requestJson<Role>('post', '/api/v1/roles', data)
}

export function updateRole(uuid: string, data: RoleFormData) {
  return requestJson<Role>('put', `/api/v1/roles/${uuid}`, data)
}

export function deleteRole(uuid: string) {
  return requestJson<{ success: boolean }>('delete', `/api/v1/roles/${uuid}`)
}

export function unbindRobotRole(robotUuid: string) {
  return requestJson<{ success: boolean }>('put', `/api/v1/robots/${robotUuid}`, { role_id: null })
}
