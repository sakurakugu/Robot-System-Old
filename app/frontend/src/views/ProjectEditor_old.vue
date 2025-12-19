<template>
  <div class="project-editor">
    <div class="timeline-container">
      <TimelineEditor
        ref="timelineEditorRef"
        :duration="totalDuration"
        :projectUuid="projectUuid"
        :selectedRobot="props.selectedRobot"
        :robots="props.robots"
        @update:currentTime="updateCurrentTime"
        @update:tracks="updateTracks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
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
    console.log('开始加载时间轴数据:', projectUuid)
    const res = await projectApi.loadTimeline(projectUuid)
    console.log('收到时间轴数据:', res)
    
    if (res.success && res.data) {
      // 等待组件挂载后再加载数据
      if (timelineEditorRef.value && timelineEditorRef.value.loadTimelineData) {
        console.log('加载数据到编辑器:', {
          tracksCount: res.data.tracks?.length || 0,
          config: res.data.config
        })
        timelineEditorRef.value.loadTimelineData({
          tracks: res.data.tracks,
          config: res.data.config
        })
        timelineTracks.value = res.data.tracks || []
      } else {
        console.warn('TimelineEditor 未挂载或 loadTimelineData 方法不存在')
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

// 保存时间轴数据
const saveTimeline = async () => {
  if (!timelineEditorRef.value) {
    throw new Error('时间轴编辑器未初始化')
  }
  
  const data = timelineEditorRef.value.getTimelineData()
  
  console.log('准备保存时间轴数据:', {
    projectUuid,
    tracksCount: data.tracks.length,
    config: data.config
  })
  
  const res = await projectApi.saveTimeline(projectUuid, data.tracks, data.config)
  console.log('保存结果:', res)
  return res
}

onMounted(async () => {
  // 延迟加载，确保 TimelineEditor 组件已完全挂载
  await nextTick()
  loadTimeline()
  connectWebSocket()
  
  // 监听保存事件
  const handleSave = async (event: Event) => {
    const customEvent = event as CustomEvent
    if (customEvent.detail?.projectUuid === projectUuid) {
      try {
        console.log('开始保存时间轴数据...')
        const res = await saveTimeline()
        console.log('时间轴保存结果:', res)
      } catch (error) {
        console.error('保存时间轴失败:', error)
      }
    }
  }
  
  window.addEventListener('save-project', handleSave)
  
  // 监听“保存为自定义动作”
  const handleSaveAsAction = async (event: Event) => {
    const customEvent = event as CustomEvent
    if (customEvent.detail?.projectUuid === projectUuid) {
      const name: string = customEvent.detail?.name
      if (!name) return
      try {
        if (!timelineEditorRef.value) throw new Error('时间轴编辑器未初始化')
        const data = timelineEditorRef.value.getTimelineData()
        await projectApi.saveCustomAction(projectUuid, { name, description: '', tracks: data.tracks, config: data.config })
      } catch (error) {
        console.error('保存为自定义动作失败:', error)
      }
    }
  }
  
  window.addEventListener('save-as-action', handleSaveAsAction)
  
  // 在卸载时移除监听器（需要在 onUnmounted 中添加）
  const originalOnUnmounted = () => {
    if (ws) {
      ws.close()
    }
    window.removeEventListener('save-project', handleSave)
    window.removeEventListener('save-as-action', handleSaveAsAction)
  }
  
  onUnmounted(originalOnUnmounted)
})

// 暴露保存方法给父组件
defineExpose({
  saveTimeline,
  validate: () => timelineEditorRef.value?.validate() || { valid: true }
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
