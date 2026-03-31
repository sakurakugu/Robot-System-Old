// 机器人模块 - 类型定义

export type RobotStatus = 'online' | 'offline' | 'connecting' | 'error'

export interface RobotMetadata {
  robot_ip?: string | null
  local_ip?: string | null
  local_port?: number | null
  group_name?: string | null
  battery?: number | null
}

export interface Robot {
  uuid: string
  name?: string | null
  model?: string | null
  version?: string | null
  motion_control_version?: string | null
  server_version?: string | null
  ip?: string | null
  robot_ip?: string | null
  local_ip?: string | null
  local_port?: number | null
  group_name?: string | null
  tags?: string[] | string | null
  sn?: string | null
  role_id?: string | null
  status: RobotStatus
  last_connected?: string | null
  last_connected_at?: string | null
  registered_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  metadata?: RobotMetadata | Record<string, unknown> | string | null
  battery?: number | null
  connected?: boolean | null
  is_connected?: boolean | null

  // AI配置
  ai_temperature?: number
  ai_model?: string | null
  ai_system_prompt?: string
  ai_voice?: string
  ai_intent?: string
  ai_role_name?: string
  
  // 状态信息
  lastStatus?: string
  lastStatusTime?: string
}

export interface CreateRobotDTO {
  name?: string
  ip?: string
  robot_ip?: string
  group_name?: string
  model?: string
  status?: string
  sn?: string
  tags?: string[] | string
}

export interface UpdateRobotDTO {
  name?: string
  model?: string
  ip?: string
  robot_ip?: string
  status?: string
  role_id?: string | null
  group_name?: string
  sn?: string
  tags?: string[] | string
  ai_temperature?: number
  ai_model?: string
  ai_system_prompt?: string
  ai_voice?: string
  ai_intent?: string
  ai_role_name?: string
}

export interface RobotListResponse {
  success: boolean
  data: {
    robots: Robot[]
    onlineCount?: number
  }
}

export interface RobotResponse {
  success: boolean
  data: Robot
}

export interface RobotGroupsResponse {
  success: boolean
  data: {
    groups: string[]
  }
}

export interface ConnectionTestResult {
  success: boolean
  connected: boolean
  message: string
}

export interface LocalIpResponse {
  success: boolean
  data: {
    ip: string
  }
}

export interface RobotVolumeResponse {
  success: boolean
  data: {
    volume: number
    muted: boolean
  }
}

export interface LogUploadRecord {
  id: string
  time: string
  logType: 'robot' | 'app' | 'all'
  size: number
  range: {
    from: string | null
    to: string | null
  }
}

export interface ApiResponse {
  success: boolean
  message?: string
  data?: any
}
