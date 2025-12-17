<template>
  <div class="audio-track">
    <!-- 音频波形容器 -->
    <div v-if="track.audioUrl" class="waveform-container" ref="waveformContainer">
      <div class="audio-controls">
        <span class="audio-name">{{ getAudioName(track.audioUrl) }}</span>
        <el-button size="small" @click="removeAudio">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
      <div ref="waveformEl" class="waveform"></div>
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
      <el-icon style="font-size: 32px"><Upload /></el-icon>
      <p>点击或拖拽上传音频文件</p>
      <p class="upload-hint">支持 MP3, WAV, OGG 格式</p>
      <input
        ref="fileInput"
        type="file"
        accept="audio/*"
        style="display: none"
        @change="handleFileUpload"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { TimelineConfig } from '@/types/timeline'
import { projectApi } from '@/api/project'
import WaveSurfer from 'wavesurfer.js'

const props = defineProps<{
  track: any
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
const isPlaying = ref(false)
const isDragOver = ref(false)

let wavesurfer: WaveSurfer | null = null

// 初始化波形
const initWaveform = () => {
  console.log('已调用初始化波形:', { 
    hasWaveformEl: !!waveformEl.value, 
    audioUrl: props.track.audioUrl 
  })
  
  if (!waveformEl.value || !props.track.audioUrl) {
    console.log('无法初始化波形：缺少元素或URL')
    return
  }

  // 销毁旧实例
  if (wavesurfer) {
    console.log('销毁旧的 wavesurfer 实例')
    wavesurfer.destroy()
  }

  console.log('创建新的 WaveSurfer 实例')
  // 创建新实例
  wavesurfer = WaveSurfer.create({
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
    fillParent: false
  })

  // 加载音频
  console.log('加载音频:', props.track.audioUrl)
  wavesurfer.load(props.track.audioUrl)

  // 监听播放完成
  wavesurfer.on('finish', () => {
    isPlaying.value = false
  })

  // 监听播放状态
  wavesurfer.on('play', () => {
    isPlaying.value = true
  })

  wavesurfer.on('pause', () => {
    isPlaying.value = false
  })
  
  wavesurfer.on('ready', () => {
    console.log('WaveSurfer 已准备好')
  })
  
  wavesurfer.on('error', (error) => {
    console.error('WaveSurfer 错误:', error)
  })
}

// 监听音频URL变化
watch(() => props.track.audioUrl, (newUrl, oldUrl) => {
  console.log('音频 URL 出现变化:', { oldUrl, newUrl, hasUrl: !!newUrl })
  if (newUrl) {
    // 等待DOM更新后初始化
    setTimeout(() => {
      console.log('初始化波形，URL:', newUrl)
      initWaveform()
    }, 100)
  }
}, { immediate: true })

// 监听时间轴播放状态
watch(() => props.isTimelinePlaying, (playing) => {
  if (!wavesurfer) return
  
  if (playing) {
    // 从当前时间点播放
    const currentTime = props.currentTime || 0
    if (currentTime < wavesurfer.getDuration()) {
      wavesurfer.seekTo(currentTime / wavesurfer.getDuration())
      wavesurfer.play()
    }
  } else {
    wavesurfer.pause()
  }
})

// 监听当前时间变化（用于seek）
watch(() => props.currentTime, (time) => {
  if (!wavesurfer || !time || props.isTimelinePlaying) return
  
  // 仅在暂停时更新位置
  const duration = wavesurfer.getDuration()
  if (duration > 0 && time <= duration) {
    wavesurfer.seekTo(time / duration)
  }
})

// 监听缩放变化
watch(() => props.config.pixelsPerSecond, () => {
  if (wavesurfer && props.track.audioUrl) {
    initWaveform()
  }
})

// 移除音频
const removeAudio = () => {
  if (wavesurfer) {
    wavesurfer.destroy()
    wavesurfer = null
  }
  emit('update:audio', '')
}

// 获取音频文件名
const getAudioName = (url: string) => {
  return url.split('/').pop() || '未知音频'
}

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click()
}

// 处理文件上传
const handleFileUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  console.log('文件上传处理已调用, 文件:', file)
  
  if (!file) return

  // 验证文件类型
  if (!file.type.startsWith('audio/')) {
    alert('请选择音频文件')
    return
  }

  // 如果没有projectUuid，则使用临时blob URL
  if (!props.projectUuid) {
    console.warn('未提供 projectUuid，使用临时 blob URL')
    const audioUrl = URL.createObjectURL(file)
    console.log('已创建音频 URL:', audioUrl)
    emit('update:audio', audioUrl)
    return
  }

  try {
    // 上传文件到服务器
    console.log('正在上传音频文件到服务器...')
    const res = await projectApi.uploadAudio(props.projectUuid, file)
    
    if (res.success && res.data.url) {
      console.log('上传成功，URL:', res.data.url)
      // 使用服务器返回的URL
      const serverUrl = `http://${window.location.hostname}:3000${res.data.url}`
      emit('update:audio', serverUrl)
    } else {
      console.error('上传失败:', res)
      alert('音频上传失败')
    }
  } catch (error) {
    console.error('上传错误:', error)
    alert('音频上传失败: ' + error)
  }
  
  // 清空input，允许重新选择同一文件
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
  console.log('拖拽事件处理被调用, 文件:', files)
  
  if (!files || files.length === 0) return

  const file = files[0]
  console.log('拖拽的文件:', file)
  
  // 验证文件类型
  if (!file.type.startsWith('audio/')) {
    alert('请选择音频文件')
    return
  }

  // 如果没有projectUuid，则使用临时blob URL
  if (!props.projectUuid) {
    console.warn('未提供 projectUuid，使用临时 blob URL')
    const audioUrl = URL.createObjectURL(file)
    console.log('已创建音频 URL（拖拽）:', audioUrl)
    emit('update:audio', audioUrl)
    return
  }

  try {
    // 上传文件到服务器
    console.log('正在上传拖拽的音频文件到服务器...')
    const res = await projectApi.uploadAudio(props.projectUuid, file)
    
    if (res.success && res.data.url) {
      console.log('上传成功，URL:', res.data.url)
      // 使用服务器返回的URL
      const serverUrl = `http://${window.location.hostname}:3000${res.data.url}`
      emit('update:audio', serverUrl)
    } else {
      console.error('上传失败:', res)
      alert('音频上传失败')
    }
  } catch (error) {
    console.error('上传错误:', error)
    alert('音频上传失败: ' + error)
  }
}

onMounted(() => {
  console.log('音轨已挂载, 轨道:', props.track)
  console.log('轨道类型:', props.track.type)
  console.log('轨道ID:', props.track.id)
  console.log('轨道名称:', props.track.name)
})

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
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
}

.audio-name {
  flex: 1;
  font-size: 12px;
  color: #d4d4d4;
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
  color: #666;
  cursor: pointer;
  border: 2px dashed #3c3c3c;
  border-radius: 4px;
  margin: 4px;
  transition: all 0.2s;
}

.upload-area:hover,
.upload-area.drag-over {
  background: rgba(78, 201, 176, 0.1);
  border-color: #4ec9b0;
  color: #4ec9b0;
}

.upload-area p {
  margin: 0;
  font-size: 12px;
}

.upload-hint {
  font-size: 10px !important;
  color: #555 !important;
}
</style>
