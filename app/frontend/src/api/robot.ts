import api from './index'

export interface Robot {
  uuid: string
  name: string
  robot_ip: string
  local_ip: string
  local_port: number
  group_name?: string
  status: 'online' | 'offline' | 'connecting'
  created_at: string
  updated_at: string
}

export interface RobotCreateData {
  name: string
  robot_ip: string
  local_ip: string
  local_port: number
  group_name?: string
}

export interface RobotUpdateData extends RobotCreateData {
  status?: string
}

export interface ActionCommand {
  action: string
  params?: any[]
  duration?: number
}

export interface ExecuteActionsData {
  robotUuids: string[]
  actions: ActionCommand[]
}

// 获取项目的所有机器人
export function getRobots(projectUuid: string) {
  return api.get(`/projects/${projectUuid}/robots`)
}

// 添加机器人
export function addRobot(projectUuid: string, data: RobotCreateData) {
  return api.post(`/projects/${projectUuid}/robots`, data)
}

// 更新机器人
export function updateRobot(projectUuid: string, robotUuid: string, data: RobotUpdateData) {
  return api.put(`/projects/${projectUuid}/robots/${robotUuid}`, data)
}

// 删除机器人
export function deleteRobot(projectUuid: string, robotUuid: string) {
  return api.delete(`/projects/${projectUuid}/robots/${robotUuid}`)
}

// 测试机器人连接
export function testRobotConnection(projectUuid: string, robotUuid: string) {
  return api.post(`/projects/${projectUuid}/robots/${robotUuid}/test-connection`)
}

export function connectRobot(projectUuid: string, robotUuid: string) {
  return api.post(`/projects/${projectUuid}/robots/${robotUuid}/connect`)
}

export function restartMotion(projectUuid: string, robotUuid: string) {
  return api.post(`/projects/${projectUuid}/robots/${robotUuid}/restart-motion`)
}

// 执行动作序列
export function executeActions(projectUuid: string, data: ExecuteActionsData) {
  return api.post(`/projects/${projectUuid}/execute-actions`, data)
}

// 停止执行
export function stopExecution(projectUuid: string, executionId: string) {
  return api.post(`/projects/${projectUuid}/stop-execution/${executionId}`)
}

// 获取执行任务列表
export function getExecutions(projectUuid: string) {
  return api.get(`/projects/${projectUuid}/executions`)
}
