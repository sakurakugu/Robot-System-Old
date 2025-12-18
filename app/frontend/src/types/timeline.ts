// 时间轴相关的类型定义

// 图层类型
export enum TrackType {
  AUDIO = 'audio',
  ACTION = 'action',
  KEYFRAME = 'keyframe'
}

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

// 关键帧
export interface Keyframe {
  id: string
  time: number // 秒
  value: number
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}

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
  keyframes?: Keyframe[] // 关键帧（仅 keyframe 类型）
  audioUrl?: string // 音频URL（仅 audio 类型）
}

// 时间轴配置
export interface TimelineConfig {
  duration: number // 总时长（秒）
  pixelsPerSecond: number // 每秒像素数（缩放级别）
  currentTime: number // 当前播放时间
  snapToGrid: boolean // 是否吸附到网格
  gridSize: number // 网格大小（秒）
}

// 历史操作类型
export enum HistoryActionType {
  ADD_TRACK = 'add_track',
  DELETE_TRACK = 'delete_track',
  UPDATE_TRACK = 'update_track',
  ADD_BLOCK = 'add_block',
  DELETE_BLOCK = 'delete_block',
  UPDATE_BLOCK = 'update_block',
  MOVE_BLOCK = 'move_block',
  ADD_KEYFRAME = 'add_keyframe',
  DELETE_KEYFRAME = 'delete_keyframe',
  UPDATE_KEYFRAME = 'update_keyframe',
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
