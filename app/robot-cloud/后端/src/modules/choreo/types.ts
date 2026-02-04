/**
 * 编舞系统类型定义
 */

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
  clips: TimelineClip[];
}

// 时间轴片段
export interface TimelineClip {
  id: string;
  trackId: string;
  startTime: number;          // 开始时间（秒）
  duration: number;           // 持续时间（秒）
  action?: ActionCommand;     // 动作指令
  audioFile?: string;         // 音频文件路径
}

// 动作指令
export interface ActionCommand {
  action: string;
  parameters?: Record<string, any>;
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
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  currentTime: number;
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

export interface ExecuteActionsDto {
  robotIds: string[];
  actions: ActionCommand[];
}

// 项目机器人配置（用于 Python 脚本生成）
export interface ProjectRobotConfig {
  uuid: string;
  name: string;
  robot_ip: string;
  local_ip: string;
  local_port: number;
  group_name?: string;
  status?: 'online' | 'offline';
}

// 封装结果
export interface BuildResult {
  pythonFile: string;
  buildPath: string;
}

// 运行结果
export interface RunResult {
  executionId: string;
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
