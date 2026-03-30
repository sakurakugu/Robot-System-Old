import { ElMessage } from 'element-plus'
import { computed, reactive, ref, type ComputedRef } from 'vue'
import type { Router } from 'vue-router'
import { getRoles } from '../../role/api'
import type { Role } from '../../role/types'
import {
  deleteRobot as removeRobot,
  getLocalNetworkIp,
  getRobotDetail,
  updateRobot as updateRobotDetail,
} from '../api'
import {
  buildRobotAutoSavePayload,
  buildRobotSettingsState,
  createRobotSettingsFormData,
  getRobotErrorMessage,
} from '../settings'
import type { RobotSettingsField, RobotSettingsFormData } from '../settings'

export function useRobotSettingsState(options: {
  uuid: ComputedRef<string | undefined>
  router: Router
  loadVolume: () => Promise<void>
  status: {
    temperature: number
    battery: number | undefined
    connected: boolean
  }
}) {
  const loading = ref(false)
  const formData = reactive<RobotSettingsFormData>(createRobotSettingsFormData())
  const roles = ref<Role[]>([])
  const tags = ref<string[]>([])

  const firmwareUpdateAvailable = ref(false)
  const hasUpdate = computed(() => firmwareUpdateAvailable.value)

  const loadRoles = async () => {
    try {
      roles.value = await getRoles()
    } catch {
      // 角色列表加载失败不影响当前页面编辑
    }
  }

  const loadData = async () => {
    const currentUuid = options.uuid.value
    const rolesPromise = loadRoles()
    if (!currentUuid) {
      await rolesPromise
      return
    }

    loading.value = true
    try {
      const [robotResponse, localIpResponse] = await Promise.all([
        getRobotDetail(currentUuid),
        getLocalNetworkIp().catch(() => null),
      ])

      const robotState = buildRobotSettingsState(robotResponse.data)
      Object.assign(formData, robotState.form)
      tags.value = robotState.tags
      options.status.connected = robotState.connected
      options.status.battery = robotState.battery

      if (localIpResponse?.data?.ip) {
        formData.local_ip = localIpResponse.data.ip
      }

      if (options.status.connected) {
        await options.loadVolume()
      }
    } catch (error) {
      ElMessage.error(getRobotErrorMessage(error, '加载数据失败'))
    } finally {
      loading.value = false
    }

    await rolesPromise
  }

  const autoSave = async (field: RobotSettingsField) => {
    const currentUuid = options.uuid.value
    if (!currentUuid) {
      ElMessage.warning('请先选择机器人')
      return
    }

    const { payload, errorMessage } = buildRobotAutoSavePayload(field, formData, tags.value)
    if (errorMessage) {
      ElMessage.warning(errorMessage)
    }
    if (!payload) {
      return
    }

    try {
      await updateRobotDetail(currentUuid, payload)
      ElMessage.success({ message: '保存成功', duration: 1000 })
    } catch (error) {
      ElMessage.error(getRobotErrorMessage(error, '保存失败'))
    }
  }

  const updateFormField = <K extends keyof RobotSettingsFormData>(
    field: K,
    value: RobotSettingsFormData[K],
  ) => {
    formData[field] = value
  }

  const handleRemoveTag = (tag: string) => {
    const index = tags.value.indexOf(tag)
    if (index === -1) {
      return
    }
    tags.value.splice(index, 1)
    autoSave('tags')
  }

  const handleAddTag = (tag: string) => {
    tags.value.push(tag)
    autoSave('tags')
  }

  const handleConnectionTested = async (connected: boolean) => {
    options.status.connected = connected
    if (connected) {
      await options.loadVolume()
    }
  }

  const handleUpgrade = async (type: 'firmware') => {
    ElMessage.info(`暂不支持${type === 'firmware' ? '固件' : '系统'}升级功能`)
  }

  const handleUnbind = async () => {
    const currentUuid = options.uuid.value
    if (!currentUuid) {
      ElMessage.warning('请先选择机器人')
      return
    }

    loading.value = true
    try {
      await removeRobot(currentUuid)
      ElMessage.success('解除绑定成功')
      options.router.push('/robots')
    } catch (error) {
      ElMessage.error(`解除绑定失败: ${getRobotErrorMessage(error, '网络错误')}`)
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    formData,
    roles,
    tags,
    status: options.status,
    firmwareUpdateAvailable,
    hasUpdate,
    loadData,
    autoSave,
    updateFormField,
    handleRemoveTag,
    handleAddTag,
    handleConnectionTested,
    handleUpgrade,
    handleUnbind,
  }
}
