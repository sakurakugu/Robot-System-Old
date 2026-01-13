<template>
  <div class="history-panel">
    <!-- 顶部操作按钮 -->
    <div class="history-header">
      <div class="history-actions">
        <el-tooltip content="撤回 (Ctrl+Z)" placement="top">
          <el-button 
            size="small" 
            :disabled="!canUndo" 
            @click="handleUndo"
            circle
          >
            <el-icon><Back /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="重做 (Ctrl+Shift+Z)" placement="top">
          <el-button 
            size="small" 
            :disabled="!canRedo" 
            @click="handleRedo"
            circle
          >
            <el-icon><Right /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="清空历史" placement="top">
          <el-button 
            size="small" 
            :disabled="historyRecords.length === 0"
            @click="handleClear"
            circle
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 历史记录列表 -->
    <div class="history-list">
      <div 
        v-for="(record, index) in displayRecords" 
        :key="record.id"
        class="history-item"
        :class="{
          'is-active': index === currentIndex,
          'is-future': index > currentIndex
        }"
        @click="handleJumpTo(index)"
      >
        <div class="history-item-icon">
          <el-icon>
            <component :is="getActionIcon(record.type)" />
          </el-icon>
        </div>
        <div class="history-item-content">
          <div class="history-item-description">{{ record.description }}</div>
          <div class="history-item-meta">
            <span class="history-item-track" v-if="record.trackName">
              {{ record.trackName }}
            </span>
            <span class="history-item-time">{{ formatTime(record.timestamp) }}</span>
          </div>
        </div>
        <div class="history-item-indicator" v-if="index === currentIndex">
          <el-icon><CircleCheckFilled /></el-icon>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="historyRecords.length === 0" class="history-empty">
        <el-icon><DocumentCopy /></el-icon>
        <p>暂无操作记录</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { HistoryRecord, HistoryActionType } from '@/types/timeline'
import { 
  Back, 
  Right, 
  Delete, 
  CircleCheckFilled,
  DocumentCopy,
  Plus,
  Minus,
  Edit,
  Rank,
  VideoPlay
} from '@element-plus/icons-vue'

// Props
const props = defineProps<{
  historyRecords: HistoryRecord[]
  currentIndex: number
}>()

// Emits
const emit = defineEmits<{
  'undo': []
  'redo': []
  'jump-to': [index: number]
  'clear': []
}>()

// 计算属性
const canUndo = computed(() => props.currentIndex >= 0)
const canRedo = computed(() => props.currentIndex < props.historyRecords.length - 1)

// 倒序显示（最新的在上面）
const displayRecords = computed(() => {
  return [...props.historyRecords].reverse()
})

// 事件处理
const handleUndo = () => {
  emit('undo')
}

const handleRedo = () => {
  emit('redo')
}

const handleJumpTo = (displayIndex: number) => {
  // displayIndex 是倒序的索引，需要转换为正序索引
  const actualIndex = props.historyRecords.length - 1 - displayIndex
  emit('jump-to', actualIndex)
}

const handleClear = () => {
  emit('clear')
}

// 获取操作类型对应的图标
const getActionIcon = (type: HistoryActionType) => {
  const iconMap: Record<HistoryActionType, any> = {
    [HistoryActionType.ADD_TRACK]: Plus,
    [HistoryActionType.DELETE_TRACK]: Minus,
    [HistoryActionType.UPDATE_TRACK]: Edit,
    [HistoryActionType.ADD_BLOCK]: Plus,
    [HistoryActionType.DELETE_BLOCK]: Minus,
    [HistoryActionType.UPDATE_BLOCK]: Edit,
    [HistoryActionType.MOVE_BLOCK]: Rank,
    [HistoryActionType.ADD_KEYFRAME]: Plus,
    [HistoryActionType.DELETE_KEYFRAME]: Minus,
    [HistoryActionType.UPDATE_KEYFRAME]: Edit,
    [HistoryActionType.UPDATE_AUDIO]: VideoPlay
  }
  return iconMap[type] || Edit
}

// 格式化时间
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp

  // 少于1分钟
  if (diff < 60000) {
    return '刚刚'
  }
  // 少于1小时
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  }
  // 同一天
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  // 其他情况
  return date.toLocaleString('zh-CN', { 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}
</script>

<style scoped lang="scss">
.history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color);
}

.history-header {
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.history-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.history-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-start;

  .el-button {
    width: 32px;
    height: 32px;
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
    color: var(--el-text-color-secondary);

    &:hover:not(:disabled) {
      background: var(--el-fill-color);
      border-color: var(--el-border-color);
      color: var(--el-text-color-primary);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--el-bg-color-page);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: 3px;

    &:hover {
      background: var(--el-border-color);
    }
  }
}

.history-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  margin-bottom: 4px;
  background: var(--el-bg-color);
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--el-fill-color);
    border-color: var(--el-color-primary);
  }

  &.is-active {
    background: var(--el-color-primary);
    border-color: var(--el-color-primary);

    .history-item-description {
      color: var(--el-text-color-primary);
      font-weight: 500;
    }
  }

  &.is-future {
    opacity: 0.4;

    .history-item-description {
      text-decoration: line-through;
    }
  }
}

.history-item-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);
  border-radius: 4px;
  color: var(--el-color-primary);
  font-size: 14px;
}

.history-item-content {
  flex: 1;
  min-width: 0;
}

.history-item-description {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 4px;
  line-height: 1.4;
  word-break: break-all;
}

.history-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.history-item-track {
  padding: 2px 6px;
  background: var(--el-fill-color);
  border-radius: 3px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-item-time {
  white-space: nowrap;
}

.history-item-indicator {
  flex-shrink: 0;
  color: var(--el-color-primary);
  font-size: 16px;
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--el-text-color-placeholder);

  .el-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  p {
    font-size: 13px;
    margin: 0;
  }
}
</style>
