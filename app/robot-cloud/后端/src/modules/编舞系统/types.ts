/**
 * 编舞系统类型定义
 */

// ==================== 调度与执行 ====================

// 编排后的单条动作（编译时间轴后生成）
export interface ScheduledAction {
  robotId: string;              // 目标机器人 ID
  action: string;               // 动作名称
  parameters?: Record<string, any>;
  executeAt: number;            // 相对执行时间（毫秒）
  duration: number;             // 动作持续时间（毫秒）
}

// 编译后的执行计划
export interface ExecutionPlan {
  scheduleId: string;
  projectUuid: string;
  totalDuration: number;        // 总时长（毫秒）
  actions: ScheduledAction[];   // 按 executeAt 排序
  robotIds: string[];           // 涉及的机器人 ID 列表
}

// 编舞 WebSocket 消息（服务端 → UI）
export type ChoreoWSMessage =
  | ChoreoStartMessage
  | ChoreoProgressMessage
  | ChoreoActionMessage
  | ChoreoStopMessage
  | ChoreoCompleteMessage
  | ChoreoErrorMessage;

export interface ChoreoStartMessage {
  type: 'choreo_start';
  timestamp: number;
  data: {
    scheduleId: string;
    totalDuration: number;
    robotIds: string[];
  };
}

export interface ChoreoProgressMessage {
  type: 'choreo_progress';
  timestamp: number;
  data: {
    scheduleId: string;
    currentTime: number;        // 当前播放时间（毫秒）
    progress: number;           // 0-100
  };
}

export interface ChoreoActionMessage {
  type: 'choreo_action';
  timestamp: number;
  data: {
    scheduleId: string;
    robotId: string;
    action: string;
    parameters?: Record<string, any>;
  };
}

export interface ChoreoStopMessage {
  type: 'choreo_stop';
  timestamp: number;
  data: {
    scheduleId: string;
    reason: 'manual' | 'error';
    message?: string;
  };
}

export interface ChoreoCompleteMessage {
  type: 'choreo_complete';
  timestamp: number;
  data: {
    scheduleId: string;
    totalDuration: number;
  };
}

export interface ChoreoErrorMessage {
  type: 'choreo_error';
  timestamp: number;
  data: {
    scheduleId: string;
    message: string;
  };
}

// ==================== 项目与数据 ====================

// 编舞项目
export interface ChoreoProject {
  uuid: string;
  name: string;
  description?: string;
  folder_path: string;
  thumbnail_path?: string;
  last_opened?: string;
  created_at: string;
  updated_at: string;
}

// 项目中的机器人配置
export interface ChoreoRobot {
  uuid: string;
  robot_id: string;           // 关联到主机器人表的 uuid
  name: string;
  track_index: number;        // 在时间轴中的轨道索引
  color?: string;             // 轨道颜色
  created_at: string;
  updated_at: string;
}

// 时间轴轨道
export interface TimelineTrack {
  id: string;
  name: string;
  type: 'action' | 'audio';
  robotId?: string;           // 关联的机器人 ID
  muted?: boolean;
  locked?: boolean;
  color?: string;
  blocks?: ActionBlock[];     // 动作块（仅 action 类型）
  audioUrl?: string;          // 音频文件 URL（仅 audio 类型）
}

// 动作块
export interface ActionBlock {
  id: string;
  name: string;
  startTime: number;          // 开始时间（秒）
  duration: number;           // 持续时间（秒）
  actionType?: string;        // 动作类型（Python API 方法名）
  actionParams?: Record<string, any>;  // 动作参数
  robotId?: string;           // 块级机器人绑定（覆盖轨道级）
  color?: string;
}

// 时间轴配置
export interface TimelineConfig {
  duration: number;           // 总时长（秒）
  pixelsPerSecond: number;    // 每秒像素数（用于前端显示）
  currentTime: number;        // 当前播放位置
  snapToGrid: boolean;        // 是否吸附网格
  gridSize: number;           // 网格大小（秒）
}

// 时间轴数据
export interface TimelineData {
  tracks: TimelineTrack[];
  config: TimelineConfig;
  updated_at?: string;
}

// 自定义动作
export interface CustomAction {
  uuid: string;
  name: string;
  description?: string;
  tracks: TimelineTrack[];
  config: TimelineConfig;
  created_at: string;
  updated_at: string;
}

// 执行选项
export interface ExecutionOptions {
  robotIds: string[];         // 要执行的机器人 ID 列表
  startTime?: number;         // 开始时间偏移
  endTime?: number;           // 结束时间
  loop?: boolean;             // 是否循环
}

// 执行状态
export interface ExecutionStatus {
  executionId: string;
  scheduleId: string;
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  currentTime: number;        // 当前播放时间（毫秒）
  progress: number;           // 0-100
  message?: string;
  startedAt: string;
  error?: string;
}

// API 请求/响应类型
export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
}

export interface AddRobotToProjectDto {
  robot_id: string;           // 主机器人表中的 UUID
  name?: string;
  track_index?: number;
  color?: string;
}

export interface SaveTimelineDto {
  tracks: TimelineTrack[];
  config: TimelineConfig;
}

// 执行编舞请求（前端 → 后端，只需指定项目，后端自行编译时间轴）
export interface ExecuteChoreoDto {
  loop?: boolean;             // 是否循环执行
}

// 项目机器人配置
export interface ProjectRobotConfig {
  uuid: string;
  name: string;
  robot_ip: string;
  local_ip: string;
  local_port: number;
  group_name?: string;
  status?: 'online' | 'offline';
}

// 连接测试结果
export interface ConnectionTestResult {
  success: boolean;
  connected: boolean;
  message: string;
  mode?: 'ap' | 'wifi';
}

// 更新项目机器人 DTO
export interface UpdateProjectRobotDto {
  name?: string;
  robot_ip?: string;
  local_ip?: string;
  local_port?: number;
  group_name?: string;
  status?: 'online' | 'offline';
}

// 添加项目机器人 DTO（扩展版本，支持直接添加机器人配置）
export interface AddProjectRobotDirectDto {
  name: string;
  robot_ip: string;
  local_ip: string;
  local_port: number;
  group_name?: string;
}
