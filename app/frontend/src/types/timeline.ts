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
