/**
 * 编舞系统类型定义
 */

// ==================== 轨道类型枚举 ====================

// 图层类型
export enum TrackType {
  AUDIO = 'audio',
  ACTION = 'action'
}

// ==================== 动作块和关键帧 ====================

// 动作块
export interface ActionBlock {
  id: string
  name: string
  startTime: number // 秒
  duration: number // 秒
  color?: string
  data?: any // 动作数据
  actionType?: string // 动作类型（对应 Python API 中的方法名）
  actionParams?: Record<string, any> // 动作参数
  robotId?: string // 绑定的机器狗ID
}

// ==================== 轨道定义 ====================

// 轨道/图层
export interface Track {
  id: string
  name: string
  type: TrackType
  robotId?: string // 关联的机器人ID
  locked: boolean
  visible: boolean
  height: number
  blocks?: ActionBlock[] // 动作块（仅 action 类型）
  audioUrl?: string // 音频URL（仅 audio 类型）
}

// ==================== 时间轴配置 ====================

// 时间轴配置
export interface TimelineConfig {
  duration: number // 总时长（秒）
  pixelsPerSecond: number // 每秒像素数（缩放级别）
  currentTime: number // 当前播放时间
  snapToGrid: boolean // 是否吸附到网格
  gridSize: number // 网格大小（秒）
}

// ==================== 历史记录 ====================

// 历史操作类型
export enum HistoryActionType {
  ADD_TRACK = 'add_track',
  DELETE_TRACK = 'delete_track',
  UPDATE_TRACK = 'update_track',
  ADD_BLOCK = 'add_block',
  DELETE_BLOCK = 'delete_block',
  UPDATE_BLOCK = 'update_block',
  MOVE_BLOCK = 'move_block',
  UPDATE_AUDIO = 'update_audio'
}

// 历史记录项
export interface HistoryRecord {
  id: string
  type: HistoryActionType
  description: string // 操作描述
  timestamp: number
  trackId?: string
  trackName?: string
  data: {
    before?: any // 操作前的数据
    after?: any // 操作后的数据
  }
}

// 历史记录管理器状态
export interface HistoryState {
  records: HistoryRecord[]
  currentIndex: number // 当前位置（-1表示没有历史）
  maxSize: number // 最大历史记录数
}

// ==================== 项目相关 ====================

// 编舞项目
export interface ChoreoProject {
  uuid: string
  name: string
  description?: string
  folder_path: string
  thumbnail_path?: string
  last_opened?: string
  created_at: string
  updated_at: string
}

// 项目中的机器人配置
export interface ChoreoRobot {
  uuid: string
  robot_id: string // 关联到主机器人表的 uuid
  name: string
  track_index: number
  color?: string
  created_at: string
  updated_at: string
}

// ==================== 旧版兼容（时间轴片段格式）====================

// 时间轴轨道（简化版，用于API传输）
export interface TimelineTrack {
  id: string
  name: string
  type: 'action' | 'audio'
  robotId?: string
  muted?: boolean
  locked?: boolean
  visible?: boolean
  color?: string
  height?: number
  clips?: TimelineClip[]
  blocks?: ActionBlock[]
  audioUrl?: string
}

// 时间轴片段
export interface TimelineClip {
  id: string
  trackId: string
  startTime: number
  duration: number
  action?: ActionCommand
  audioFile?: string
}

// 动作指令
export interface ActionCommand {
  action: string
  parameters?: Record<string, any>
}

// 时间轴数据
export interface TimelineData {
  tracks: TimelineTrack[]
  config: TimelineConfig
  updated_at?: string
}

// 自定义动作
export interface CustomAction {
  uuid: string
  name: string
  description?: string
  tracks: TimelineTrack[]
  config: TimelineConfig
  created_at: string
  updated_at: string
}

// 执行状态
export interface ExecutionStatus {
  executionId: string
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error'
  currentTime: number
  progress: number
  message?: string
  startedAt: string
  error?: string
}

// ==================== API 请求类型 ====================

export interface CreateProjectDto {
  name: string
  description?: string
}

export interface UpdateProjectDto {
  name?: string
  description?: string
}

export interface AddRobotToProjectDto {
  robot_id: string
  name?: string
  track_index?: number
  color?: string
}

export interface SaveTimelineDto {
  tracks: TimelineTrack[]
  config: TimelineConfig
}

export interface ExecuteActionsDto {
  robotIds: string[]
  actions: ActionCommand[]
}

// ==================== 动作定义 ====================

// 动作参数定义
export interface ActionParamDef {
  name: string
  label: string
  type: 'number' | 'select' | 'text'
  default?: any
  min?: number
  max?: number
  step?: number
  precision?: number
  options?: { label: string; value: any }[]
  description?: string
}

// 动作定义
export interface ActionDef {
  method: string
  name: string
  description: string
  category: string
  params: ActionParamDef[]
}

// 机器人信息
export interface Robot {
  uuid: string
  name: string
  robot_ip: string
  status: 'online' | 'offline'
  model?: string
}
