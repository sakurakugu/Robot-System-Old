import { isValidIP } from '@/share/utils/validator'
import { normalizeRobot } from './normalize'
import type { Robot, UpdateRobotDTO } from './types'

export type RobotSettingsField =
  | 'name'
  | 'role_id'
  | 'group_name'
  | 'tags'
  | 'ip'
  | 'ai_temperature'
  | 'ai_model'
  | 'ai_voice'
  | 'ai_intent'
  | 'ai_role_name'
  | 'ai_system_prompt'

export type RobotSettingsFormData = {
  name: string
  model: string
  role_id: string
  group_name: string
  sn: string
  uuid: string
  ip: string
  local_ip: string
  version: string
  motion_control_version: string
  server_version: string
  ai_temperature: number
  ai_model: string
  ai_voice: string
  ai_intent: string
  ai_role_name: string
  ai_system_prompt: string
}

type RobotSettingsState = {
  form: RobotSettingsFormData
  tags: string[]
  connected: boolean
  battery: number | undefined
}

export function createRobotSettingsFormData(): RobotSettingsFormData {
  return {
    name: '',
    model: '',
    role_id: '',
    group_name: '',
    sn: '',
    uuid: '',
    ip: '',
    local_ip: '',
    version: '',
    motion_control_version: '',
    server_version: '',
    ai_temperature: 0.7,
    ai_model: '',
    ai_voice: '',
    ai_intent: '',
    ai_role_name: '',
    ai_system_prompt: '',
  }
}

export function getRobotErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function resolveRobotConnected(robot: Robot): boolean {
  const rawStatus = robot.status as string | undefined
  return Boolean(
    robot.connected ??
      robot.is_connected ??
      (rawStatus === 'online' || rawStatus === 'connected'),
  )
}

export function buildRobotSettingsState(robot: Robot): RobotSettingsState {
  const normalizedRobot = normalizeRobot(robot)

  return {
    form: {
      ...createRobotSettingsFormData(),
      uuid: normalizedRobot.uuid || '',
      name: normalizedRobot.name || '',
      model: normalizedRobot.model || '',
      role_id: normalizedRobot.role_id || '',
      group_name: normalizedRobot.group_name || '',
      sn: normalizedRobot.sn || '',
      ip: normalizedRobot.ip ?? normalizedRobot.robot_ip ?? '',
      local_ip: normalizedRobot.local_ip ?? '',
      version: normalizedRobot.version || '',
      motion_control_version: normalizedRobot.motion_control_version || '',
      server_version: normalizedRobot.server_version || '',
      ai_temperature: typeof normalizedRobot.ai_temperature === 'number' ? normalizedRobot.ai_temperature : 0.7,
      ai_model: normalizedRobot.ai_model || '',
      ai_voice: normalizedRobot.ai_voice || '',
      ai_intent: normalizedRobot.ai_intent || '',
      ai_role_name: normalizedRobot.ai_role_name || '',
      ai_system_prompt: normalizedRobot.ai_system_prompt || '',
    },
    tags: Array.isArray(normalizedRobot.tags) ? normalizedRobot.tags : [],
    connected: resolveRobotConnected(normalizedRobot),
    battery: normalizedRobot.battery ?? undefined,
  }
}

export function buildRobotAutoSavePayload(
  field: RobotSettingsField,
  formData: RobotSettingsFormData,
  tags: string[],
): { payload: UpdateRobotDTO | null; errorMessage?: string } {
  switch (field) {
    case 'name':
      return { payload: { name: formData.name } }
    case 'role_id':
      return { payload: { role_id: formData.role_id || null } }
    case 'group_name':
      return { payload: { group_name: formData.group_name } }
    case 'tags':
      return { payload: { tags } }
    case 'ip':
      if (!formData.ip || !isValidIP(formData.ip)) {
        return { payload: null, errorMessage: 'IP格式不正确' }
      }
      return { payload: { ip: formData.ip, robot_ip: formData.ip } }
    case 'ai_temperature':
      return { payload: { ai_temperature: formData.ai_temperature } }
    case 'ai_model':
      return { payload: { ai_model: formData.ai_model } }
    case 'ai_voice':
      return { payload: { ai_voice: formData.ai_voice } }
    case 'ai_intent':
      return { payload: { ai_intent: formData.ai_intent } }
    case 'ai_role_name':
      return { payload: { ai_role_name: formData.ai_role_name } }
    case 'ai_system_prompt':
      return { payload: { ai_system_prompt: formData.ai_system_prompt } }
    default:
      return { payload: null }
  }
}
