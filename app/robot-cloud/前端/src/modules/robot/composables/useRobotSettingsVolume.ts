import { ElMessage } from 'element-plus'
import { onBeforeUnmount, reactive, type ComputedRef } from 'vue'
import { getRobotVolume, setRobotMute, setRobotVolume } from '../api'
import { getRobotErrorMessage } from '../settings'

type RobotStatusState = {
  connected: boolean
}

export function useRobotSettingsVolume(options: {
  uuid: ComputedRef<string | undefined>
  status: RobotStatusState
}) {
  const volumeData = reactive({
    volume: 50,
    muted: false,
    loading: false,
  })

  let volumeDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const loadVolume = async () => {
    const currentUuid = options.uuid.value
    if (!currentUuid || !options.status.connected) {
      return
    }

    volumeData.loading = true
    try {
      const response = await getRobotVolume(currentUuid)
      if (response.data) {
        volumeData.volume = response.data.volume || 50
        volumeData.muted = response.data.muted || false
      }
    } catch (error) {
      console.error('加载音量失败:', error)
    } finally {
      volumeData.loading = false
    }
  }

  const updateVolume = (value: number) => {
    volumeData.volume = value
  }

  const handleVolumeChange = (value?: number) => {
    if (volumeDebounceTimer) {
      clearTimeout(volumeDebounceTimer)
    }

    const nextVolume = typeof value === 'number' ? value : volumeData.volume
    volumeDebounceTimer = setTimeout(async () => {
      const currentUuid = options.uuid.value
      if (!currentUuid) {
        return
      }

      volumeData.loading = true
      try {
        await setRobotVolume(currentUuid, nextVolume)
        ElMessage.success({ message: `音量已设置为 ${nextVolume}`, duration: 1000 })
      } catch (error) {
        ElMessage.error(`设置音量失败: ${getRobotErrorMessage(error, '网络错误')}`)
      } finally {
        volumeData.loading = false
      }
    }, 500)
  }

  const handleMuteToggle = async () => {
    const currentUuid = options.uuid.value
    if (!currentUuid) {
      return
    }

    const newMuteState = !volumeData.muted
    volumeData.loading = true

    try {
      await setRobotMute(currentUuid, newMuteState)
      volumeData.muted = newMuteState
      ElMessage.success(newMuteState ? '已静音' : '已取消静音')
    } catch (error) {
      ElMessage.error(`设置静音失败: ${getRobotErrorMessage(error, '网络错误')}`)
    } finally {
      volumeData.loading = false
    }
  }

  onBeforeUnmount(() => {
    if (volumeDebounceTimer) {
      clearTimeout(volumeDebounceTimer)
      volumeDebounceTimer = null
    }
  })

  return {
    volumeData,
    loadVolume,
    updateVolume,
    handleVolumeChange,
    handleMuteToggle,
  }
}
