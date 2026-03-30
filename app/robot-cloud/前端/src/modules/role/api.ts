import type { BoundRobot, LlmProviderOption, Role, RoleFormData } from './types'

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(input, {
    ...init,
    headers,
  })

  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || `HTTP ${response.status}`)
  }

  return (payload.data ?? payload) as T
}

export function getLlmProviders() {
  return requestJson<LlmProviderOption[]>('/api/v1/config/llm/providers')
}

export function getRoles() {
  return requestJson<Role[]>('/api/v1/roles')
}

export function getRoleRobots(roleUuid: string) {
  return requestJson<BoundRobot[]>(`/api/v1/roles/${roleUuid}/robots`)
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
  return requestJson<Role>('/api/v1/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateRole(uuid: string, data: RoleFormData) {
  return requestJson<Role>(`/api/v1/roles/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteRole(uuid: string) {
  return requestJson<{ success: boolean }>(`/api/v1/roles/${uuid}`, {
    method: 'DELETE',
  })
}

export function unbindRobotRole(robotUuid: string) {
  return requestJson<{ success: boolean }>(`/api/v1/robots/${robotUuid}`, {
    method: 'PUT',
    body: JSON.stringify({ role_id: null }),
  })
}
