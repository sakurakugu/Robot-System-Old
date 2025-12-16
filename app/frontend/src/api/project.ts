import api from './index'

export interface Project {
  uuid: string
  user_uuid: string
  name: string
  description?: string
  folder_path: string
  thumbnail_path?: string
  last_opened?: string
  created_at: string
  updated_at: string
}

export interface CreateProjectDto {
  name: string
  description?: string
}

export interface UpdateProjectDto {
  name?: string
  description?: string
}

export const projectApi = {
  // 获取所有项目
  getProjects(): Promise<{ success: boolean; data: Project[] }> {
    return api.get('/projects')
  },

  // 获取单个项目
  getProject(uuid: string): Promise<{ success: boolean; data: Project }> {
    return api.get(`/projects/${uuid}`)
  },

  // 创建项目
  createProject(data: CreateProjectDto): Promise<{ success: boolean; data: Project }> {
    return api.post('/projects', data)
  },

  // 更新项目
  updateProject(uuid: string, data: UpdateProjectDto): Promise<{ success: boolean; data: Project }> {
    return api.put(`/projects/${uuid}`, data)
  },

  // 删除项目
  deleteProject(uuid: string): Promise<{ success: boolean; message: string }> {
    return api.delete(`/projects/${uuid}`)
  },

  // 打开项目
  openProject(uuid: string): Promise<{ success: boolean; data: Project }> {
    return api.post(`/projects/${uuid}/open`)
  },

  // 获取项目的机器人列表
  getRobots(projectUuid: string): Promise<{ success: boolean; data: any[] }> {
    return api.get(`/projects/${projectUuid}/robots`)
  },

  // 添加机器人到项目
  addRobot(projectUuid: string, data: any): Promise<{ success: boolean; data: any }> {
    return api.post(`/projects/${projectUuid}/robots`, data)
  },

  // 保存项目时间轴数据
  saveTimeline(uuid: string, tracks: any[], config: any): Promise<{ success: boolean; message: string }> {
    return api.post(`/projects/${uuid}/timeline`, { tracks, config })
  },

  // 加载项目时间轴数据
  loadTimeline(uuid: string): Promise<{ success: boolean; data: { tracks: any[]; config: any } }> {
    return api.get(`/projects/${uuid}/timeline`)
  },

  // 上传音频文件
  uploadAudio(uuid: string, file: File): Promise<{ success: boolean; data: { url: string; filename: string } }> {
    const formData = new FormData()
    formData.append('audio', file)
    return api.post(`/projects/${uuid}/upload-audio`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}
