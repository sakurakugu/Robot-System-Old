/**
 * 编舞系统 API
 */

import { http } from '@/api/request';
import type {
    AddRobotToProjectDto,
    ChoreoProject,
    ChoreoRobot,
    CreateProjectDto,
    CustomAction,
    ExecuteChoreoDto,
    ExecutionStatus,
    SaveTimelineDto,
    TimelineData,
    UpdateProjectDto,
} from './types';

const BASE_URL = '/api/v1/choreo'

export const choreoApi = {
  // ==================== 项目管理 ====================

  /** 获取所有项目 */
  getProjects(): Promise<{ success: boolean; data: ChoreoProject[] }> {
    return http.get(`${BASE_URL}/projects`)
  },

  /** 获取单个项目 */
  getProject(uuid: string): Promise<{ success: boolean; data: ChoreoProject }> {
    return http.get(`${BASE_URL}/projects/${uuid}`)
  },

  /** 创建项目 */
  createProject(data: CreateProjectDto): Promise<{ success: boolean; data: ChoreoProject }> {
    return http.post(`${BASE_URL}/projects`, data)
  },

  /** 更新项目 */
  updateProject(uuid: string, data: UpdateProjectDto): Promise<{ success: boolean; data: ChoreoProject }> {
    return http.put(`${BASE_URL}/projects/${uuid}`, data)
  },

  /** 删除项目 */
  deleteProject(uuid: string): Promise<{ success: boolean; message: string }> {
    return http.delete(`${BASE_URL}/projects/${uuid}`)
  },

  /** 导出项目 */
  async exportProject(uuid: string): Promise<Blob> {
    const response = await fetch(`${BASE_URL}/projects/${uuid}/export`, {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error('导出失败')
    }
    return response.blob()
  },

  /** 导入项目 */
  importProject(file: File): Promise<{ success: boolean; data: ChoreoProject }> {
    const formData = new FormData()
    formData.append('file', file)
    return http.post(`${BASE_URL}/projects/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /** 打开项目 */
  openProject(uuid: string): Promise<{ success: boolean; data: ChoreoProject }> {
    return http.post(`${BASE_URL}/projects/${uuid}/open`)
  },

  // ==================== 项目机器人管理 ====================

  /** 获取项目机器人列表 */
  getProjectRobots(projectUuid: string): Promise<{ success: boolean; data: ChoreoRobot[] }> {
    return http.get(`${BASE_URL}/projects/${projectUuid}/robots`)
  },

  /** 添加机器人到项目 */
  addRobotToProject(projectUuid: string, data: AddRobotToProjectDto): Promise<{ success: boolean; data: ChoreoRobot }> {
    return http.post(`${BASE_URL}/projects/${projectUuid}/robots`, data)
  },

  /** 从项目移除机器人 */
  removeRobotFromProject(projectUuid: string, robotUuid: string): Promise<{ success: boolean; message: string }> {
    return http.delete(`${BASE_URL}/projects/${projectUuid}/robots/${robotUuid}`)
  },

  // ==================== 时间轴管理 ====================

  /** 获取时间轴数据 */
  getTimeline(projectUuid: string): Promise<{ success: boolean; data: TimelineData }> {
    return http.get(`${BASE_URL}/projects/${projectUuid}/timeline`)
  },

  /** 保存时间轴数据 */
  saveTimeline(projectUuid: string, data: SaveTimelineDto): Promise<{ success: boolean; message: string }> {
    return http.post(`${BASE_URL}/projects/${projectUuid}/timeline`, data)
  },

  // ==================== 自定义动作管理 ====================

  /** 获取自定义动作列表 */
  getCustomActions(projectUuid: string): Promise<{ success: boolean; data: CustomAction[] }> {
    return http.get(`${BASE_URL}/projects/${projectUuid}/custom-actions`)
  },

  /** 保存自定义动作 */
  saveCustomAction(projectUuid: string, data: Omit<CustomAction, 'uuid' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; data: CustomAction }> {
    return http.post(`${BASE_URL}/projects/${projectUuid}/custom-actions`, data)
  },

  // ==================== 音频管理 ====================

  /** 获取音频文件 URL */
  getAudioUrl(projectUuid: string, filename: string): string {
    return `${BASE_URL}/projects/${projectUuid}/audio/${filename}`
  },

  /** 上传音频文件 */
  uploadAudio(projectUuid: string, file: File): Promise<{ success: boolean; data: { filename: string; originalname: string; size: number; url: string } }> {
    const formData = new FormData()
    formData.append('audio', file)
    return http.post(`${BASE_URL}/projects/${projectUuid}/audio`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /** 列出音频文件 */
  listAudioFiles(projectUuid: string): Promise<{ success: boolean; data: string[] }> {
    return http.get(`${BASE_URL}/projects/${projectUuid}/audio`)
  },

  /** 删除音频文件 */
  deleteAudioFile(projectUuid: string, filename: string): Promise<{ success: boolean; message: string }> {
    return http.delete(`${BASE_URL}/projects/${projectUuid}/audio/${filename}`)
  },

  // ==================== 编舞执行 ====================

  /** 执行编舞（后端自动编译时间轴） */
  executeChoreo(projectUuid: string, data?: ExecuteChoreoDto): Promise<{ success: boolean; data: ExecutionStatus; message: string }> {
    return http.post(`${BASE_URL}/projects/${projectUuid}/execute`, data || {})
  },

  /** 暂停执行 */
  pauseExecution(executionId: string): Promise<{ success: boolean; message: string }> {
    return http.post(`${BASE_URL}/executions/${executionId}/pause`)
  },

  /** 恢复执行 */
  resumeExecution(executionId: string): Promise<{ success: boolean; message: string }> {
    return http.post(`${BASE_URL}/executions/${executionId}/resume`)
  },

  /** 停止执行 */
  stopExecution(executionId: string): Promise<{ success: boolean; message: string }> {
    return http.post(`${BASE_URL}/executions/${executionId}/stop`)
  },

  /** 获取执行状态 */
  getExecutionStatus(executionId: string): Promise<{ success: boolean; data: ExecutionStatus }> {
    return http.get(`${BASE_URL}/executions/${executionId}`)
  },

  /** 获取正在运行的执行列表 */
  getRunningExecutions(): Promise<{ success: boolean; data: ExecutionStatus[] }> {
    return http.get(`${BASE_URL}/executions`)
  },

  // ==================== 文件管理 ====================

  /** 获取项目文件列表 */
  getProjectFiles(projectUuid: string): Promise<{ success: boolean; data: FileItem[] }> {
    return http.get(`${BASE_URL}/projects/${projectUuid}/files`)
  },

  /** 读取文件内容 */
  getFileContent(projectUuid: string, filePath: string): Promise<{ success: boolean; data: string }> {
    return http.get(`${BASE_URL}/projects/${projectUuid}/files/content`, { params: { path: filePath } })
  },

  /** 保存文件内容 */
  saveFileContent(projectUuid: string, filePath: string, content: string): Promise<{ success: boolean; message: string }> {
    return http.post(`${BASE_URL}/projects/${projectUuid}/files/content`, { path: filePath, content })
  },

  /** 删除文件 */
  deleteFile(projectUuid: string, filePath: string): Promise<{ success: boolean; message: string }> {
    return http.delete(`${BASE_URL}/projects/${projectUuid}/files`, { params: { path: filePath } })
  },
}

// 文件项类型
export interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  modifiedTime?: string
  children?: FileItem[]
}
