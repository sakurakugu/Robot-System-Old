<template>
  <div class="keyframe-track" @click="onTrackClick">
    <!-- 关键帧曲线 -->
    <svg class="keyframe-curve" :width="curveWidth" :height="trackHeight">
      <!-- 连接线 -->
      <path
        v-if="sortedKeyframes.length > 1"
        :d="curvePath"
        fill="none"
        stroke="#ce9178"
        stroke-width="2"
      />
    </svg>

    <!-- 关键帧点 -->
    <div
      v-for="keyframe in keyframes"
      :key="keyframe.id"
      class="keyframe"
      :style="getKeyframeStyle(keyframe)"
      @mousedown.stop="startDragKeyframe($event, keyframe)"
      @dblclick.stop="editKeyframe(keyframe)"
    >
      <div class="keyframe-handle"></div>
      <div class="keyframe-tooltip">
        {{ keyframe.time.toFixed(2) }}s: {{ (keyframe.value * 100).toFixed(0) }}%
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="keyframes.length === 0" class="empty-track">
      点击添加关键帧
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Keyframe, TimelineConfig } from '@/types/timeline'

const props = defineProps<{
  track: any
  config: TimelineConfig
}>()

const emit = defineEmits<{
  'update:keyframes': [keyframes: Keyframe[]]
  'add-keyframe': [time: number]
}>()

const keyframes = computed(() => props.track.keyframes || [])
const trackHeight = 60
const curveWidth = computed(() => props.config.duration * props.config.pixelsPerSecond)

// 排序后的关键帧
const sortedKeyframes = computed(() => {
  return [...keyframes.value].sort((a, b) => a.time - b.time)
})

// 获取关键帧样式
const getKeyframeStyle = (keyframe: Keyframe) => {
  const left = keyframe.time * props.config.pixelsPerSecond
  const top = trackHeight * (1 - keyframe.value)
  return {
    left: `${left}px`,
    top: `${top}px`
  }
}

// 生成曲线路径
const curvePath = computed(() => {
  if (sortedKeyframes.value.length < 2) return ''

  let path = ''
  sortedKeyframes.value.forEach((kf, index) => {
    const x = kf.time * props.config.pixelsPerSecond
    const y = trackHeight * (1 - kf.value)

    if (index === 0) {
      path += `M ${x} ${y}`
    } else {
      // 使用贝塞尔曲线实现缓动效果
      const prevKf = sortedKeyframes.value[index - 1]
      const prevX = prevKf.time * props.config.pixelsPerSecond
      const prevY = trackHeight * (1 - prevKf.value)
      
      const cp1x = prevX + (x - prevX) * 0.4
      const cp1y = prevY
      const cp2x = prevX + (x - prevX) * 0.6
      const cp2y = y

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y}`
    }
  })

  return path
})

// 拖拽关键帧
let draggedKeyframe: Keyframe | null = null
let dragStartX = 0
let dragStartY = 0
let dragStartTime = 0
let dragStartValue = 0

const startDragKeyframe = (e: MouseEvent, keyframe: Keyframe) => {
  if (props.track.locked) return

  draggedKeyframe = keyframe
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartTime = keyframe.time
  dragStartValue = keyframe.value

  document.addEventListener('mousemove', onDragKeyframe)
  document.addEventListener('mouseup', stopDragKeyframe)
  e.preventDefault()
}

const onDragKeyframe = (e: MouseEvent) => {
  if (!draggedKeyframe) return

  const deltaX = e.clientX - dragStartX
  const deltaY = e.clientY - dragStartY

  let newTime = dragStartTime + deltaX / props.config.pixelsPerSecond
  let newValue = dragStartValue - deltaY / trackHeight

  // 吸附到网格
  if (props.config.snapToGrid) {
    newTime = Math.round(newTime / props.config.gridSize) * props.config.gridSize
  }

  // 限制范围
  newTime = Math.max(0, Math.min(props.config.duration, newTime))
  newValue = Math.max(0, Math.min(1, newValue))

  // 更新关键帧
  const updatedKeyframes = keyframes.value.map((kf: Keyframe) =>
    kf.id === draggedKeyframe!.id
      ? { ...kf, time: newTime, value: newValue }
      : kf
  )
  emit('update:keyframes', updatedKeyframes)
}

const stopDragKeyframe = () => {
  draggedKeyframe = null
  document.removeEventListener('mousemove', onDragKeyframe)
  document.removeEventListener('mouseup', stopDragKeyframe)
}

// 编辑关键帧
const editKeyframe = (keyframe: Keyframe) => {
  // TODO: 打开编辑对话框
  console.log('Edit keyframe:', keyframe)
}

// 点击轨道添加关键帧
const onTrackClick = (e: MouseEvent) => {
  if (props.track.locked) return

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = e.clientX - rect.left
  let time = x / props.config.pixelsPerSecond

  // 吸附到网格
  if (props.config.snapToGrid) {
    time = Math.round(time / props.config.gridSize) * props.config.gridSize
  }

  time = Math.max(0, Math.min(props.config.duration, time))
  emit('add-keyframe', time)
}
</script>

<style scoped>
.keyframe-track {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.keyframe-curve {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.keyframe {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 10;
}

.keyframe-handle {
  width: 12px;
  height: 12px;
  background: #ce9178;
  border: 2px solid var(--el-bg-color-page);
  border-radius: 50%;
  cursor: move;
  transition: all 0.2s;
}

.keyframe:hover .keyframe-handle {
  width: 16px;
  height: 16px;
  background: #e9b893;
}

.keyframe-tooltip {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  border: 1px solid var(--el-border-color);
}

.keyframe:hover .keyframe-tooltip {
  opacity: 1;
}

.empty-track {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  border: 1px dashed #3c3c3c;
  border-radius: 4px;
  margin: 4px;
}
</style>
