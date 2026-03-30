// 机器人模块 - 状态管理

import { ElMessage } from 'element-plus'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as robotApi from './api'
import type { CreateRobotDTO, Robot, RobotMetadata, RobotStatus, UpdateRobotDTO } from './types'

type RawRobot = Partial<Robot> & {
  uuid: string
  status?: string | null
}

function parseRobotMetadata(metadata: RawRobot['metadata']): RobotMetadata {
  if (!metadata) {
    return {}
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') {
        return parsed as RobotMetadata
      }
      return {}
    } catch {
      return {}
    }
  }

  return metadata as RobotMetadata
}

function normalizeRobotTags(tags: RawRobot['tags']): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
  }

  if (typeof tags === 'string' && tags.trim().length > 0) {
    try {
      const parsed = JSON.parse(tags) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      }
    } catch {
      return []
    }
  }

  return []
}

function normalizeRobotStatus(status?: string | null): RobotStatus {
  if (status === 'online' || status === 'connecting' || status === 'error') {
    return status
  }

  if (status === 'connected') {
    return 'online'
  }

  return 'offline'
}

function normalizeRobot(rawRobot: RawRobot): Robot {
  const metadata = parseRobotMetadata(rawRobot.metadata)

  return {
    ...rawRobot,
    name: rawRobot.name || '',
    model: rawRobot.model || '',
    version: rawRobot.version || '',
    motion_control_version: rawRobot.motion_control_version || '',
    server_version: rawRobot.server_version || '',
    status: normalizeRobotStatus(rawRobot.status),
    last_connected: rawRobot.last_connected_at || rawRobot.last_connected || null,
    ip: rawRobot.ip ?? null,
    robot_ip: rawRobot.robot_ip ?? metadata.robot_ip ?? null,
    local_ip: rawRobot.local_ip ?? metadata.local_ip ?? null,
    local_port:
      typeof rawRobot.local_port === 'number'
        ? rawRobot.local_port
        : (typeof metadata.local_port === 'number' ? metadata.local_port : 10000),
    group_name: rawRobot.group_name ?? metadata.group_name ?? null,
    tags: normalizeRobotTags(rawRobot.tags),
    battery:
      typeof rawRobot.battery === 'number'
        ? rawRobot.battery
        : (typeof metadata.battery === 'number' ? metadata.battery : null),
    metadata,
  }
}

function replaceRobotInList(robots: Robot[], nextRobot: Robot) {
  const index = robots.findIndex(robot => robot.uuid === nextRobot.uuid)
  if (index === -1) {
    robots.unshift(nextRobot)
    return
  }
  robots[index] = nextRobot
}

export const useRobotStore = defineStore('robot', () => {
  // 状态
  const robots = ref<Robot[]>([])
  const currentRobot = ref<Robot | null>(null)
  const loading = ref(false)
  const groups = ref<string[]>([])

  // 计算属性
  const onlineRobots = computed(() =>
    robots.value.filter(r => r.status === 'online')
  )

  const offlineRobots = computed(() =>
    robots.value.filter(r => r.status === 'offline')
  )

  const onlineCount = computed(() => onlineRobots.value.length)

  const totalCount = computed(() => robots.value.length)

  const robotsByGroup = computed(() => {
    const grouped: Record<string, Robot[]> = {}
    robots.value.forEach(robot => {
      const group = robot.group_name || '未分组'
      if (!grouped[group]) {
        grouped[group] = []
      }
      grouped[group].push(robot)
    })
    return grouped
  })

  // 方法
  async function fetchRobots() {
    loading.value = true
    try {
      const res = await robotApi.getRobotList()
      const normalizedRobots = res.data.robots.map(normalizeRobot)
      robots.value = normalizedRobots
      return {
        ...res.data,
        robots: normalizedRobots,
      }
    } catch (error) {
      console.error('获取机器人列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function fetchGroups() {
    try {
      const res = await robotApi.getRobotGroups()
      groups.value = res.data.groups
      return res.data.groups
    } catch (error) {
      console.error('获取分组失败:', error)
      throw error
    }
  }

  async function fetchRobotDetail(uuid: string) {
    loading.value = true
    try {
      const res = await robotApi.getRobotDetail(uuid)
      const normalizedRobot = normalizeRobot(res.data)
      currentRobot.value = normalizedRobot
      replaceRobotInList(robots.value, normalizedRobot)
      return normalizedRobot
    } catch (error) {
      console.error('获取机器人详情失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function createRobot(data: CreateRobotDTO) {
    loading.value = true
    try {
      const res = await robotApi.createRobot(data)
      const normalizedRobot = normalizeRobot(res.data)
      replaceRobotInList(robots.value, normalizedRobot)
      ElMessage.success('创建成功')
      return normalizedRobot
    } catch (error) {
      console.error('创建机器人失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function updateRobot(uuid: string, data: UpdateRobotDTO) {
    loading.value = true
    try {
      const res = await robotApi.updateRobot(uuid, data)
      const normalizedRobot = normalizeRobot(res.data)
      replaceRobotInList(robots.value, normalizedRobot)

      // 更新当前机器人
      if (currentRobot.value?.uuid === uuid) {
        currentRobot.value = normalizedRobot
      }

      ElMessage.success('更新成功')
      return normalizedRobot
    } catch (error) {
      console.error('更新机器人失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function deleteRobot(uuid: string) {
    loading.value = true
    try {
      await robotApi.deleteRobot(uuid)

      // 从列表中移除
      const index = robots.value.findIndex(r => r.uuid === uuid)
      if (index !== -1) {
        robots.value.splice(index, 1)
      }

      // 清除当前机器人
      if (currentRobot.value?.uuid === uuid) {
        currentRobot.value = null
      }

      ElMessage.success('删除成功')
    } catch (error) {
      console.error('删除机器人失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function testConnection(uuid: string) {
    try {
      const res = await robotApi.testRobotConnection(uuid)
      if (res.connected) {
        ElMessage.success(res.message || '连接成功')
      } else {
        ElMessage.warning(res.message || '连接失败')
      }
      return res
    } catch (error) {
      console.error('测试连接失败:', error)
      throw error
    }
  }

  async function connectRobot(uuid: string) {
    loading.value = true
    try {
      const res = await robotApi.connectRobot(uuid)
      const normalizedRobot = normalizeRobot(res.data)
      replaceRobotInList(robots.value, normalizedRobot)

      ElMessage.success('连接成功')
      return normalizedRobot
    } catch (error) {
      console.error('连接机器人失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function updateFirmware(uuid: string) {
    loading.value = true
    try {
      const res = await robotApi.updateRobotFirmware(uuid)
      ElMessage.success('固件推送成功')
      return res
    } catch (error) {
      console.error('推送固件失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  function setCurrentRobot(robot: Robot | null) {
    currentRobot.value = robot
  }

  function getRobotById(uuid: string) {
    return robots.value.find(r => r.uuid === uuid)
  }

  function clearCurrentRobot() {
    currentRobot.value = null
  }

  return {
    // 状态
    robots,
    currentRobot,
    loading,
    groups,

    // 计算属性
    onlineRobots,
    offlineRobots,
    onlineCount,
    totalCount,
    robotsByGroup,

    // 方法
    fetchRobots,
    fetchGroups,
    fetchRobotDetail,
    createRobot,
    updateRobot,
    deleteRobot,
    testConnection,
    connectRobot,
    updateFirmware,
    setCurrentRobot,
    getRobotById,
    clearCurrentRobot,
  }
})
