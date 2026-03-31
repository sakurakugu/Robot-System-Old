<template>
  <el-tooltip
    :content="isRecording ? '松开结束录音' : '按住说话'"
    placement="top"
  >
    <el-button
      :class="['voice-record-btn', { recording: isRecording }]"
      :circle="circle"
      :size="size"
      @pointerdown.prevent="onPointerDown"
      @pointerup.prevent="onPointerUp"
      @pointerleave="onPointerUp"
      @contextmenu.prevent
    >
      <el-icon><Microphone /></el-icon>
    </el-button>
  </el-tooltip>
</template>

<script setup lang="ts">
import { useAudioRecorder } from '@/features/conversation/composables/useAudioRecorder';
import { useWebSocket } from '@/share/websocket/useWebSocket';
import { Microphone } from '@element-plus/icons-vue';

withDefaults(defineProps<{
  /** 按钮大小 */
  size?: 'small' | 'default' | 'large'
  /** 是否圆形按钮 */
  circle?: boolean
}>(), {
  size: 'default',
  circle: true,
})

const { robotId, isAudioUploadConnected, sendMessage } = useWebSocket()

const { isRecording, startRecording, stopRecording } = useAudioRecorder(
  () => robotId.value,
  sendMessage,
  () => isAudioUploadConnected.value,
)

const onPointerDown = () => {
  startRecording()
}

const onPointerUp = () => {
  if (isRecording.value) {
    stopRecording()
  }
}
</script>

<style scoped>
.voice-record-btn {
  transition: all 0.2s ease;
  user-select: none;
  touch-action: none;
}

.voice-record-btn.recording {
  background-color: #f56c6c !important;
  border-color: #f56c6c !important;
  color: #fff !important;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
</style>
