<template>
  <div class="project-editor">
    <div class="timeline-container">
      <TimelineEditor
        ref="timelineEditorRef"
        :duration="totalDuration"
        :projectUuid="projectUuid"
        @update:currentTime="updateCurrentTime"
        @update:tracks="updateTracks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { projectApi } from '@/api/project'
import TimelineEditor from '@/components/timeline/TimelineEditor.vue'
import type { Track } from '@/types/timeline'

// 接收从 MainLayout 传递的 props
const props = defineProps<{
  robots?: any[]
  selectedRobot?: string | null
}>()

const route = useRoute()
const projectUuid = route.params.uuid as string

const currentTimeSeconds = ref(0)
const totalDuration = ref(60) // 总时长（秒）
const timelineTracks = ref<Track[]>([])
const timelineEditorRef = ref<InstanceType<typeof TimelineEditor>>()

let ws: WebSocket | null = null

// 更新时间轴当前时间
const updateCurrentTime = (time: number) => {
  currentTimeSeconds.value = time
}

// 更新时间轴轨道
const updateTracks = (tracks: Track[]) => {
  timelineTracks.value = tracks
}

const loadTimeline = async () => {
  try {
    const res = await projectApi.loadTimeline(projectUuid)
    if (res.success && res.data) {
      // 恢复轨道数据
      if (timelineEditorRef.value && res.data.tracks) {
        timelineEditorRef.value.tracks = res.data.tracks
        timelineTracks.value = res.data.tracks
      }
      // 恢复配置
      if (timelineEditorRef.value && res.data.config) {
        Object.assign(timelineEditorRef.value.config, res.data.config)
      }
    }
  } catch (error) {
    console.error('加载时间轴数据失败:', error)
  }
}

const connectWebSocket = () => {
  const wsUrl = `ws://${window.location.hostname}:3000`
  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    ws?.send(JSON.stringify({
      type: 'join_project',
      projectUuid
    }))
  }

  ws.onmessage = (event) => {
    try {
      JSON.parse(event.data)
      // 处理消息
    } catch (error) {
      console.error('WebSocket 消息错误:', error)
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket 错误:', error)
  }

  ws.onclose = () => {
    // WebSocket 已断开
  }
}

onMounted(() => {
  loadTimeline()
  connectWebSocket()
})

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
})
</script>

<style scoped>
.project-editor {
  width: 100%;
  height: 100%;
  background: #1e1e1e;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timeline-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
