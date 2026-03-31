<template>
  <div class="audio-track">
    <!-- 音频波形容器 -->
    <div
      v-if="track.audioUrl"
      ref="waveformContainer"
      class="waveform-container"
    >
      <div class="audio-controls">
        <span class="audio-name">{{ getAudioName(track.audioUrl) }}</span>
        <el-button
          size="small"
          @click="removeAudio"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
      <div
        ref="waveformEl"
        class="waveform"
      />
    </div>

    <!-- 上传音频 -->
    <div
      v-else
      class="upload-area"
      :class="{ 'drag-over': isDragOver }"
      @click="triggerFileInput"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <el-icon style="font-size: 32px">
        <Upload />
      </el-icon>
      <p>点击或拖拽上传音频文件</p>
      <p class="upload-hint">
        支持 MP3, WAV, OGG 格式
      </p>
      <input
        ref="fileInput"
        type="file"
        accept="audio/*"
        style="display: none"
        @change="handleFileUpload"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { Delete, Upload } from '@element-plus/icons-vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { choreoApi } from '../../api'
import type { TimelineConfig, Track } from '../../types'

// WaveSurfer 将在 onMounted 中动态加载
let WaveSurferModule: any = null

const props = defineProps<{
  track: Track
  config: TimelineConfig
  isTimelinePlaying?: boolean
  currentTime?: number
  projectUuid?: string
}>()

const emit = defineEmits<{
  'update:audio': [audioUrl: string]
}>()

const waveformEl = ref<HTMLElement>()
const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)

let wavesurfer: any = null

// 初始化波形
const initWaveform = async () => {
  if (!waveformEl.value || !props.track.audioUrl) return

  // 动态加载 WaveSurfer
  if (!WaveSurferModule) {
    try {
      // @ts-ignore - wavesurfer.js 是可选依赖
      WaveSurferModule = (await import('wavesurfer.js')).default
    } catch {
      console.warn('wavesurfer.js 未安装，音频波形功能将不可用')
      return
    }
  }

  if (wavesurfer) {
    wavesurfer.destroy()
  }

  wavesurfer = WaveSurferModule.create({
    container: waveformEl.value,
    waveColor: '#4ec9b0',
    progressColor: '#2a9d8f',
    cursorWidth: 0,
    barWidth: 2,
    barRadius: 2,
    height: 60,
    normalize: true,
    backend: 'WebAudio',
    minPxPerSec: props.config.pixelsPerSecond,
    fillParent: false,
  })

  wavesurfer.load(props.track.audioUrl)

  wavesurfer.on('finish', () => {})
  wavesurfer.on('play', () => {})
  wavesurfer.on('pause', () => {})
  wavesurfer.on('ready', () => {})
  wavesurfer.on('error', (error: any) => {
    console.error('WaveSurfer 错误:', error)
  })
}

// 监听音频URL变化
watch(
  () => props.track.audioUrl,
  (newUrl) => {
    if (newUrl) {
      setTimeout(() => {
        initWaveform()
      }, 100)
    }
  },
  { immediate: true }
)

// 监听时间轴播放状态
watch(
  () => props.isTimelinePlaying,
  (playing) => {
    if (!wavesurfer) return

    if (playing) {
      const currentTime = props.currentTime || 0
      if (currentTime < wavesurfer.getDuration()) {
        wavesurfer.seekTo(currentTime / wavesurfer.getDuration())
        wavesurfer.play()
      }
    } else {
      wavesurfer.pause()
    }
  }
)

// 监听当前时间变化
watch(
  () => props.currentTime,
  (time) => {
    if (!wavesurfer || !time || props.isTimelinePlaying) return

    const duration = wavesurfer.getDuration()
    if (duration > 0 && time <= duration) {
      wavesurfer.seekTo(time / duration)
    }
  }
)

// 监听缩放变化
watch(
  () => props.config.pixelsPerSecond,
  () => {
    if (wavesurfer && props.track.audioUrl) {
      initWaveform()
    }
  }
)

// 移除音频
const removeAudio = () => {
  if (wavesurfer) {
    wavesurfer.destroy()
    wavesurfer = null
  }
  emit('update:audio', '')
}

// 获取音频文件名
const getAudioName = (url: string) => url.split('/').pop() || '未知音频'

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click()
}

// 处理文件上传
const handleFileUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!file.type.startsWith('audio/')) {
    alert('请选择音频文件')
    return
  }

  if (!props.projectUuid) {
    const audioUrl = URL.createObjectURL(file)
    emit('update:audio', audioUrl)
    return
  }

  try {
    const res = await choreoApi.uploadAudio(props.projectUuid, file)

    if (res.success && res.data.url) {
      const serverUrl = `${window.location.protocol}//${window.location.hostname}:3001${res.data.url}`
      emit('update:audio', serverUrl)
    } else {
      alert('音频上传失败')
    }
  } catch (error) {
    console.error('上传错误:', error)
    alert('音频上传失败: ' + error)
  }

  target.value = ''
}

// 拖拽事件处理
const handleDragOver = () => {
  isDragOver.value = true
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleDrop = async (e: DragEvent) => {
  isDragOver.value = false
  const files = e.dataTransfer?.files

  if (!files || files.length === 0) return

  const file = files[0]

  if (!file.type.startsWith('audio/')) {
    alert('请选择音频文件')
    return
  }

  if (!props.projectUuid) {
    const audioUrl = URL.createObjectURL(file)
    emit('update:audio', audioUrl)
    return
  }

  try {
    const res = await choreoApi.uploadAudio(props.projectUuid, file)

    if (res.success && res.data.url) {
      const serverUrl = `${window.location.protocol}//${window.location.hostname}:3001${res.data.url}`
      emit('update:audio', serverUrl)
    } else {
      alert('音频上传失败')
    }
  } catch (error) {
    console.error('上传错误:', error)
    alert('音频上传失败: ' + error)
  }
}

onMounted(() => {})

onUnmounted(() => {
  if (wavesurfer) {
    wavesurfer.destroy()
  }
})
</script>

<style scoped>
.audio-track {
  position: relative;
  width: 100%;
  height: 100%;
}

.waveform-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.audio-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
}

.audio-name {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waveform {
  flex: 1;
  overflow: hidden;
  min-height: 60px;
}

.upload-area {
  width: calc(100% - 8px);
  height: calc(100% - 8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  border: 2px dashed var(--el-border-color);
  border-radius: 4px;
  margin: 4px;
  transition: all 0.2s;
}

.upload-area:hover,
.upload-area.drag-over {
  background: color-mix(in oklab, var(--el-color-primary) 10%, transparent);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.upload-area p {
  margin: 0;
  font-size: 12px;
}

.upload-hint {
  font-size: 10px !important;
  color: var(--el-text-color-secondary) !important;
}
</style>
