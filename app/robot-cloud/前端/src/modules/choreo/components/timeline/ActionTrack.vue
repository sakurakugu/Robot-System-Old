<template>
  <div
    class="action-track"
    @click="handleTrackClick"
  >
    <!-- 动作块列表 -->
    <div
      v-for="block in blocks"
      :key="block.id"
      class="action-block"
      :class="{ selected: isSelected(block) }"
      :style="getBlockStyle(block)"
      @mousedown="startDragBlock($event, block)"
      @dblclick.stop="editBlock(block)"
      @click.stop="selectBlock(block)"
      @contextmenu.prevent="editBlock(block)"
    >
      <div class="block-content">
        <span class="block-name">{{ block.name }}</span>
        <span class="block-duration">{{ block.duration.toFixed(1) }}s</span>
      </div>
      <!-- 左侧调整手柄 -->
      <div
        class="resize-handle left"
        @mousedown.stop="startResize($event, block, 'left')"
      />
      <!-- 右侧调整手柄 -->
      <div
        class="resize-handle right"
        @mousedown.stop="startResize($event, block, 'right')"
      />
    </div>

    <!-- 空状态提示 -->
    <div
      v-if="blocks.length === 0"
      class="empty-hint"
    >
      点击轨道空白处添加动作块
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ActionBlock, Robot, TimelineConfig, Track } from '../../types';

const props = defineProps<{
  track: Track
  config: TimelineConfig
  robots?: Robot[]
}>()

const emit = defineEmits<{
  'update:blocks': [blocks: ActionBlock[]]
  'add-block': []
  'select-block': [blockId: string]
  'edit-block': [block: ActionBlock]
}>()

const blocks = computed(() => {
  if (isDragging.value || isResizing.value) {
    return localBlocks.value
  }
  return props.track.blocks || []
})

// 本地动作块状态（用于拖拽和调整大小时）
const localBlocks = ref<ActionBlock[]>([])
const isDragging = ref(false)
const isResizing = ref(false)

// 选中的块
const selectedBlockId = ref<string | null>(null)

// 判断是否选中
const isSelected = (block: ActionBlock) => selectedBlockId.value === block.id

// 选中块
const selectBlock = (block: ActionBlock) => {
  selectedBlockId.value = block.id
  emit('select-block', block.id)
}

// 获取动作块样式
const getBlockStyle = (block: ActionBlock) => {
  const left = block.startTime * props.config.pixelsPerSecond
  const width = block.duration * props.config.pixelsPerSecond
  return {
    left: `${left}px`,
    width: `${width}px`,
    backgroundColor: block.color || '#569cd6',
  }
}

// 拖拽动作块
let draggedBlock: ActionBlock | null = null
let dragStartX = 0
let dragStartTime = 0
let longPressTimer: number | null = null

const startDragBlock = (e: MouseEvent, block: ActionBlock) => {
  if (props.track.locked) return

  draggedBlock = block
  dragStartX = e.clientX
  dragStartTime = block.startTime
  isDragging.value = false

  // 初始化本地块状态
  localBlocks.value = JSON.parse(JSON.stringify(props.track.blocks || []))

  // 设置长按定时器（800ms）
  longPressTimer = window.setTimeout(() => {
    if (!isDragging.value) {
      editBlock(block)
      longPressTimer = null
    }
  }, 800)

  document.addEventListener('mousemove', onDragBlock)
  document.addEventListener('mouseup', stopDragBlock)
  e.preventDefault()
}

const onDragBlock = (e: MouseEvent) => {
  if (!draggedBlock) return

  // 如果鼠标移动超过阈值，取消长按定时器并开始拖拽
  const moveThreshold = 5
  const deltaX = Math.abs(e.clientX - dragStartX)

  if (deltaX > moveThreshold && !isDragging.value) {
    isDragging.value = true
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  if (!isDragging.value) return

  const deltaTime = (e.clientX - dragStartX) / props.config.pixelsPerSecond

  let newStartTime = dragStartTime + deltaTime

  // 吸附到网格
  if (props.config.snapToGrid) {
    newStartTime = Math.round(newStartTime / props.config.gridSize) * props.config.gridSize
  }

  // 限制在时间轴范围内
  newStartTime = Math.max(0, Math.min(props.config.duration - draggedBlock.duration, newStartTime))

  // 检查是否与其他块重叠
  const hasOverlap = localBlocks.value.some((b) => {
    if (b.id === draggedBlock!.id) return false
    const blockEnd = newStartTime + draggedBlock!.duration
    const bEnd = b.startTime + b.duration
    return !(blockEnd <= b.startTime || newStartTime >= bEnd)
  })

  if (!hasOverlap) {
    localBlocks.value = localBlocks.value.map((b) =>
      b.id === draggedBlock!.id ? { ...b, startTime: newStartTime } : b
    )
  }
}

const stopDragBlock = () => {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }

  if (isDragging.value) {
    emit('update:blocks', localBlocks.value)
  }

  draggedBlock = null
  isDragging.value = false
  document.removeEventListener('mousemove', onDragBlock)
  document.removeEventListener('mouseup', stopDragBlock)
}

// 调整动作块大小
let resizeBlock: ActionBlock | null = null
let resizeDirection: 'left' | 'right' = 'right'
let resizeStartX = 0
let resizeStartTime = 0
let resizeStartDuration = 0

const startResize = (e: MouseEvent, block: ActionBlock, direction: 'left' | 'right') => {
  if (props.track.locked) return

  resizeBlock = block
  resizeDirection = direction
  resizeStartX = e.clientX
  resizeStartTime = block.startTime
  resizeStartDuration = block.duration
  isResizing.value = true

  localBlocks.value = JSON.parse(JSON.stringify(props.track.blocks || []))

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const onResize = (e: MouseEvent) => {
  if (!resizeBlock) return

  const deltaX = e.clientX - resizeStartX
  const deltaTime = deltaX / props.config.pixelsPerSecond

  let newStartTime = resizeStartTime
  let newDuration = resizeStartDuration

  if (resizeDirection === 'left') {
    newStartTime = resizeStartTime + deltaTime
    newDuration = resizeStartDuration - deltaTime
  } else {
    newDuration = resizeStartDuration + deltaTime
  }

  // 吸附到网格
  if (props.config.snapToGrid) {
    if (resizeDirection === 'left') {
      newStartTime = Math.round(newStartTime / props.config.gridSize) * props.config.gridSize
      newDuration = resizeStartTime + resizeStartDuration - newStartTime
    } else {
      newDuration = Math.round(newDuration / props.config.gridSize) * props.config.gridSize
    }
  }

  // 最小持续时间
  const minDuration = 0.1
  if (newDuration < minDuration) {
    if (resizeDirection === 'left') {
      newStartTime = resizeStartTime + resizeStartDuration - minDuration
    }
    newDuration = minDuration
  }

  // 限制在时间轴范围内
  if (resizeDirection === 'left') {
    newStartTime = Math.max(0, newStartTime)
    newDuration = resizeStartTime + resizeStartDuration - newStartTime
  } else {
    newDuration = Math.min(props.config.duration - newStartTime, newDuration)
  }

  // 检查是否与其他块重叠
  const hasOverlap = localBlocks.value.some((b) => {
    if (b.id === resizeBlock!.id) return false
    const blockEnd = newStartTime + newDuration
    const bEnd = b.startTime + b.duration
    return !(blockEnd <= b.startTime || newStartTime >= bEnd)
  })

  if (!hasOverlap) {
    localBlocks.value = localBlocks.value.map((b) =>
      b.id === resizeBlock!.id ? { ...b, startTime: newStartTime, duration: newDuration } : b
    )
  }
}

const stopResize = () => {
  if (isResizing.value) {
    emit('update:blocks', localBlocks.value)
  }

  resizeBlock = null
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

// 编辑动作块
const editBlock = (block: ActionBlock) => {
  emit('edit-block', block)
}

// 添加动作块
const addBlock = () => {
  emit('add-block')
}

// 处理轨道点击事件
const handleTrackClick = (e: MouseEvent) => {
  if (props.track.locked) return

  const target = e.target as HTMLElement
  if (
    (target.classList.contains('action-track') || target.classList.contains('empty-hint')) &&
    blocks.value.length === 0
  ) {
    addBlock()
  }

  selectedBlockId.value = null
}
</script>

<style scoped>
.action-track {
  position: relative;
  width: 100%;
  height: 100%;
}

.action-block {
  position: absolute;
  top: 8px;
  height: calc(100% - 16px);
  border-radius: 4px;
  cursor: move;
  user-select: none;
  display: flex;
  align-items: center;
  padding: 0 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 0, 0, 0.2);
  transition: box-shadow 0.2s;
}

.action-block:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.action-block.selected {
  box-shadow: 0 0 0 2px #ff4444;
  z-index: 15;
}

.block-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1;
  pointer-events: none;
}

.block-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-duration {
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  background: var(--el-fill-color-light);
  opacity: 0;
  transition: opacity 0.2s;
}

.action-block:hover .resize-handle {
  opacity: 1;
}

.resize-handle.left {
  left: 0;
  border-left: 2px solid var(--el-border-color);
}

.resize-handle.right {
  right: 0;
  border-right: 2px solid var(--el-border-color);
}

.empty-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  pointer-events: none;
  user-select: none;
}
</style>
