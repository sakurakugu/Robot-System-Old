<template>
  <div class="timeline-editor">
    <!-- 右侧主编辑区 -->
    <div class="timeline-main">
      <!-- 工具栏 -->
      <div class="timeline-toolbar">
        <div class="toolbar-left">
          <el-button-group>
            <el-button size="small" @click="addTrack(TrackType.ACTION)">
              <el-icon><Plus /></el-icon> 动作轨道
            </el-button>
            <el-button size="small" @click="addTrack(TrackType.AUDIO)">
              <el-icon><Plus /></el-icon> 音频轨道
            </el-button>
          </el-button-group>
        </div>
        <div class="toolbar-center">
          <el-button size="small" :type="isPlaying ? 'primary' : 'default'" @click="togglePlay">
            <el-icon v-if="!isPlaying"><VideoPlayIcon /></el-icon>
            <el-icon v-else><VideoPauseIcon /></el-icon>
            {{ isPlaying ? '暂停' : '播放' }}
          </el-button>
          <span class="time-display">
            <span class="time-editable" @click="editCurrentTime">{{ formatTime(config.currentTime) }}</span>
            <span> / </span>
            <span class="time-editable" @click="editDuration">{{ formatTime(config.duration) }}</span>
          </span>
        </div>
        <div class="toolbar-right">
          <el-button-group>
            <el-button size="small" @click="zoomIn">
              <el-icon><ZoomIn /></el-icon>
            </el-button>
            <el-button size="small" @click="zoomOut">
              <el-icon><ZoomOut /></el-icon>
            </el-button>
          </el-button-group>
          <el-checkbox v-model="config.snapToGrid" size="small">吸附网格</el-checkbox>
          <span class="separator">|</span>
          <span class="zoom-level">缩放: {{ Math.round(config.pixelsPerSecond) }}px/s</span>
        </div>
      </div>

      <!-- 时间轴主体 -->
      <div class="timeline-content">
        <!-- 时间标尺 -->
        <div class="timeline-ruler">
          <div class="ruler-track-label">时间</div>
          <div class="ruler-wrapper" ref="rulerWrapper">
            <div class="ruler-content" :style="{ width: timelineWidth + 'px' }">
              <div
                v-for="tick in timeTicks"
                :key="tick.time"
                class="ruler-tick"
                :class="{ major: tick.isMajor }"
                :style="{ left: timeToPixel(tick.time) + 'px' }"
              >
                <div class="tick-line"></div>
                <div class="tick-label" v-if="tick.isMajor">{{ formatTime(tick.time) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 轨道列表容器 -->
        <div class="tracks-wrapper" ref="tracksWrapper">
          <!-- 轨道列表 -->
          <div class="timeline-tracks">
            <div v-for="track in tracks" :key="track.id" class="track-row" :style="{ height: track.height + 'px' }">
              <!-- 轨道标签 -->
              <div class="track-label">
                <div class="track-controls">
                  <el-button size="small" circle @click="toggleTrackVisibility(track.id)" :type="track.visible ? 'primary' : 'default'">
                    <el-icon><View v-if="track.visible" /><Hide v-else /></el-icon>
                  </el-button>
                  <el-button size="small" circle @click="toggleTrackLock(track.id)" :type="track.locked ? 'warning' : 'default'">
                    <el-icon><Lock v-if="track.locked" /><Unlock v-else /></el-icon>
                  </el-button>
                  <!-- 动作轨道的添加/删除按钮 -->
                  <template v-if="track.type === TrackType.ACTION">
                    <el-button size="small" circle @click="addActionBlock(track.id)" :disabled="track.locked">
                      <el-icon><Plus /></el-icon>
                    </el-button>
                    <el-button size="small" circle @click="deleteSelectedBlock(track.id)" :disabled="track.locked || !getSelectedBlock(track.id)">
                      <el-icon><Minus /></el-icon>
                    </el-button>
                  </template>
                  <el-button size="small" circle @click="deleteTrack(track.id)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <div class="track-name" @dblclick="editTrackName(track.id)">{{ track.name }}</div>
                <div class="track-badges">
                  <div class="track-type-badge" :class="track.type">
                    {{ track.type === TrackType.AUDIO ? '音频' : '动作' }}
                  </div>
                  <!-- 动作轨道的机器狗绑定状态 -->
                  <div v-if="track.type === TrackType.ACTION" class="robot-binding" @click.stop="selectRobotForTrack(track.id)">
                    <el-icon v-if="!track.robotId" style="color: #ffc107;"><Warning /></el-icon>
                    <el-icon v-else style="color: #4caf50;"><Check /></el-icon>
                    <span class="binding-text">{{ getRobotBindingText(track.robotId) }}</span>
                  </div>
                </div>
              </div>

              <!-- 轨道内容 -->
              <div class="track-content" :style="{ width: timelineWidth + 'px' }">
                <!-- 网格线 -->
                <div class="grid-lines">
                  <div v-for="tick in gridTicks" :key="tick" class="grid-line" :style="{ left: timeToPixel(tick) + 'px' }"></div>
                </div>

                <!-- 动作轨道 -->
                <ActionTrack
                  v-if="track.type === TrackType.ACTION"
                  :track="track"
                  :config="config"
                  :robots="props.robots"
                  @update:blocks="updateTrackBlocks(track.id, $event)"
                  @add-block="addActionBlock(track.id)"
                  @select-block="selectBlock(track.id, $event)"
                  @edit-block="editActionBlock(track.id, $event)"
                />

                <!-- 音频轨道 -->
                <AudioTrack
                  v-if="track.type === TrackType.AUDIO"
                  :track="track"
                  :config="config"
                  :isTimelinePlaying="isPlaying"
                  :currentTime="config.currentTime"
                  :projectUuid="props.projectUuid"
                  @update:audio="updateTrackAudio(track.id, $event)"
                />
              </div>
            </div>

            <!-- 空状态 -->
            <div v-if="tracks.length === 0" class="empty-state">
              <el-icon style="font-size: 48px"><Film /></el-icon>
              <p>暂无轨道，点击上方按钮添加轨道</p>
            </div>
          </div>
        </div>

        <!-- 播放头层（贯穿整个时间轴） -->
        <div class="playhead-layer" ref="playheadLayer">
          <div
            class="playhead"
            :style="{ left: (timeToPixel(config.currentTime) - scrollLeft + 200) + 'px' }"
            @mousedown="startDragPlayhead"
          ></div>
        </div>
      </div>

      <!-- 动作选择器对话框 -->
      <ActionSelectorDialog
        v-model:visible="actionSelectorVisible"
        :currentAction="editingActionData"
        :maxDuration="maxDurationLimit"
        @confirm="handleActionSelected"
      />

      <!-- 机器狗选择对话框 -->
      <el-dialog
        v-model="robotSelectorVisible"
        title="选择机器狗"
        width="680px"
        :close-on-click-modal="false"
        class="robot-selector-dialog"
      >
        <div class="robot-selector-header">为此轨道选择一个机器狗：</div>
        <div class="robot-selector-container">
          <!-- 取消绑定卡片 -->
          <div class="robot-select-card" :class="{ active: !selectedRobotId }" @click="selectedRobotId = ''">
            <div class="card-icon">
              <el-icon><CircleClose /></el-icon>
            </div>
            <div class="card-name">取消绑定</div>
            <div class="card-desc">解除当前关联</div>
            <div class="selection-mark" v-if="!selectedRobotId">
              <el-icon><Check /></el-icon>
            </div>
          </div>

          <!-- 机器狗列表 -->
          <div
            v-for="robot in props.robots"
            :key="robot.uuid"
            class="robot-select-card"
            :class="{ active: selectedRobotId === robot.uuid }"
            @click="selectedRobotId = robot.uuid"
          >
            <div class="card-status-dot" :class="robot.status" :title="robot.status === 'online' ? '在线' : '离线'"></div>
            <div class="card-icon robot-icon">🐕</div>
            <div class="card-info">
              <div class="card-name">{{ robot.name }}</div>
              <div class="card-ip">{{ robot.robot_ip }}</div>
            </div>
            <div class="selection-mark" v-if="selectedRobotId === robot.uuid">
              <el-icon><Check /></el-icon>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button @click="robotSelectorVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmRobotSelection">确定</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
    Check,
    CircleClose,
    Delete,
    Hide,
    Lock,
    Minus,
    Plus,
    Unlock,
    VideoPause as VideoPauseIcon,
    VideoPlay as VideoPlayIcon,
    View,
    Warning,
    ZoomIn,
    ZoomOut,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Film } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
    HistoryActionType,
    TrackType,
    type ActionBlock,
    type HistoryRecord,
    type Robot,
    type TimelineConfig,
    type Track,
} from '../../types'
import ActionSelectorDialog from './ActionSelectorDialog.vue'
import ActionTrack from './ActionTrack.vue'
import AudioTrack from './AudioTrack.vue'

// Props
const props = defineProps<{
  duration?: number
  projectUuid?: string
  selectedRobot?: string | null
  robots?: Robot[]
}>()

// Emits
const emit = defineEmits<{
  'update:currentTime': [time: number]
  'update:tracks': [tracks: Track[]]
  'play-audio': [trackId: string, startTime: number]
  'pause-audio': [trackId: string]
  'stop-audio': [trackId: string]
}>()

// 时间轴配置
const config = ref<TimelineConfig>({
  duration: props.duration || 60,
  pixelsPerSecond: 100,
  currentTime: 0,
  snapToGrid: true,
  gridSize: 0.5,
})

// 轨道列表
const tracks = ref<Track[]>([])

// 选中的动作块
const selectedBlocks = ref<Record<string, string>>({})

// 动作选择器
const actionSelectorVisible = ref(false)
const editingTrackId = ref<string | null>(null)
const editingBlockId = ref<string | null>(null)
const editingActionData = ref<{ actionType: string; actionParams: Record<string, any> } | undefined>(undefined)
const maxDurationLimit = ref<number | undefined>(undefined)

// 机器狗选择器
const robotSelectorVisible = ref(false)
const selectedRobotId = ref<string>('')
const editingTrackIdForRobot = ref<string | null>(null)

// 播放控制
const isPlaying = ref(false)
let playbackTimer: number | null = null
let playbackStartTime = 0
let playbackStartOffset = 0

// 滚动位置
const scrollLeft = ref(0)

// 历史记录
const historyRecords = ref<HistoryRecord[]>([])
const historyCurrentIndex = ref(-1)
const maxHistorySize = 50

// 引用
const rulerWrapper = ref<HTMLElement>()
const tracksWrapper = ref<HTMLElement>()
const playheadLayer = ref<HTMLElement>()

// 计数器
let trackIdCounter = 0
let blockIdCounter = 0
let historyIdCounter = 0

// 计算时间轴宽度
const timelineWidth = computed(() => config.value.duration * config.value.pixelsPerSecond)

// 生成时间刻度
const timeTicks = computed(() => {
  const ticks: Array<{ time: number; isMajor: boolean }> = []
  const minorInterval = config.value.pixelsPerSecond > 50 ? 1 : 5
  const majorInterval = config.value.pixelsPerSecond > 50 ? 5 : 10
  for (let i = 0; i <= config.value.duration; i++) {
    if (i % minorInterval === 0) {
      ticks.push({ time: i, isMajor: i % majorInterval === 0 })
    }
  }
  return ticks
})

// 生成网格线
const gridTicks = computed(() => {
  const ticks: number[] = []
  const interval = config.value.gridSize
  for (let i = 0; i <= config.value.duration; i += interval) {
    ticks.push(i)
  }
  return ticks
})

// 时间转像素
const timeToPixel = (time: number) => time * config.value.pixelsPerSecond

// 像素转时间
const pixelToTime = (pixel: number) => {
  let time = pixel / config.value.pixelsPerSecond
  if (config.value.snapToGrid) {
    time = Math.round(time / config.value.gridSize) * config.value.gridSize
  }
  return Math.max(0, Math.min(config.value.duration, time))
}

// 格式化时间显示
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 编辑当前时间
const editCurrentTime = async () => {
  const currentMins = Math.floor(config.value.currentTime / 60)
  const currentSecs = Math.floor(config.value.currentTime % 60)
  let minutes = currentMins
  let seconds = currentSecs

  ElMessageBox({
    title: '编辑当前时间',
    message: `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="display: flex; flex-direction: column; gap: 5px;">
          <label style="font-size: 12px; color: #999;">分钟</label>
          <input type="number" min="0" max="99" value="${currentMins}" id="time-minutes" style="width: 80px; padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px;" />
        </div>
        <span style="font-size: 20px; margin-top: 20px;">:</span>
        <div style="display: flex; flex-direction: column; gap: 5px;">
          <label style="font-size: 12px; color: #999;">秒</label>
          <input type="number" min="0" max="59" value="${currentSecs}" id="time-seconds" style="width: 80px; padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px;" />
        </div>
      </div>
    `,
    dangerouslyUseHTMLString: true,
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    beforeClose: (action, _instance, done) => {
      if (action === 'confirm') {
        const minsInput = document.getElementById('time-minutes') as HTMLInputElement
        const secsInput = document.getElementById('time-seconds') as HTMLInputElement
        minutes = parseInt(minsInput?.value || '0') || 0
        seconds = parseInt(secsInput?.value || '0') || 0
        const newTime = minutes * 60 + Math.min(seconds, 59)
        if (newTime <= config.value.duration) {
          config.value.currentTime = newTime
          emit('update:currentTime', config.value.currentTime)
        }
      }
      done()
    },
  }).catch(() => {})
}

// 编辑总时长
const editDuration = async () => {
  const currentMins = Math.floor(config.value.duration / 60)
  const currentSecs = Math.floor(config.value.duration % 60)

  ElMessageBox({
    title: '编辑总时长',
    message: `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="display: flex; flex-direction: column; gap: 5px;">
          <label style="font-size: 12px; color: #999;">分钟</label>
          <input type="number" min="0" max="99" value="${currentMins}" id="duration-minutes" style="width: 80px; padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px;" />
        </div>
        <span style="font-size: 20px; margin-top: 20px;">:</span>
        <div style="display: flex; flex-direction: column; gap: 5px;">
          <label style="font-size: 12px; color: #999;">秒</label>
          <input type="number" min="0" max="59" value="${currentSecs}" id="duration-seconds" style="width: 80px; padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px;" />
        </div>
      </div>
    `,
    dangerouslyUseHTMLString: true,
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    beforeClose: (action, _instance, done) => {
      if (action === 'confirm') {
        const minsInput = document.getElementById('duration-minutes') as HTMLInputElement
        const secsInput = document.getElementById('duration-seconds') as HTMLInputElement
        const minutes = parseInt(minsInput?.value || '0') || 0
        const seconds = parseInt(secsInput?.value || '0') || 0
        const newDuration = minutes * 60 + Math.min(seconds, 59)
        if (newDuration >= 10) {
          config.value.duration = newDuration
        }
      }
      done()
    },
  }).catch(() => {})
}

// 历史记录管理
const createHistoryRecord = (
  type: HistoryActionType,
  description: string,
  data: { before?: any; after?: any },
  trackId?: string,
  trackName?: string
): HistoryRecord => {
  historyIdCounter++
  return {
    id: `history-${historyIdCounter}`,
    type,
    description,
    timestamp: Date.now(),
    trackId,
    trackName,
    data,
  }
}

const addHistoryRecord = (record: HistoryRecord) => {
  if (historyCurrentIndex.value < historyRecords.value.length - 1) {
    historyRecords.value = historyRecords.value.slice(0, historyCurrentIndex.value + 1)
  }
  historyRecords.value.push(record)
  if (historyRecords.value.length > maxHistorySize) {
    historyRecords.value.shift()
  } else {
    historyCurrentIndex.value++
  }
}

const handleUndo = () => {
  if (historyCurrentIndex.value < 0) return
  const record = historyRecords.value[historyCurrentIndex.value]
  applyHistoryReverse(record)
  historyCurrentIndex.value--
}

const handleRedo = () => {
  if (historyCurrentIndex.value >= historyRecords.value.length - 1) return
  historyCurrentIndex.value++
  const record = historyRecords.value[historyCurrentIndex.value]
  applyHistoryForward(record)
}

const applyHistoryReverse = (record: HistoryRecord) => {
  switch (record.type) {
    case HistoryActionType.ADD_TRACK:
      if (record.trackId) {
        tracks.value = tracks.value.filter((t) => t.id !== record.trackId)
      }
      break
    case HistoryActionType.DELETE_TRACK:
      if (record.data.before) {
        tracks.value.push(JSON.parse(JSON.stringify(record.data.before)))
      }
      break
    case HistoryActionType.UPDATE_TRACK:
      if (record.trackId && record.data.before) {
        const track = tracks.value.find((t) => t.id === record.trackId)
        if (track) Object.assign(track, JSON.parse(JSON.stringify(record.data.before)))
      }
      break
    case HistoryActionType.ADD_BLOCK:
    case HistoryActionType.DELETE_BLOCK:
    case HistoryActionType.UPDATE_BLOCK:
    case HistoryActionType.MOVE_BLOCK:
      if (record.trackId && record.data.before) {
        const track = tracks.value.find((t) => t.id === record.trackId)
        if (track && track.type === TrackType.ACTION) {
          track.blocks = JSON.parse(JSON.stringify(record.data.before))
        }
      }
      break
    case HistoryActionType.UPDATE_AUDIO:
      if (record.trackId && record.data.before !== undefined) {
        const track = tracks.value.find((t) => t.id === record.trackId)
        if (track && track.type === TrackType.AUDIO) {
          track.audioUrl = record.data.before
        }
      }
      break
  }
  emit('update:tracks', tracks.value)
}

const applyHistoryForward = (record: HistoryRecord) => {
  switch (record.type) {
    case HistoryActionType.ADD_TRACK:
      if (record.data.after) {
        tracks.value.push(JSON.parse(JSON.stringify(record.data.after)))
      }
      break
    case HistoryActionType.DELETE_TRACK:
      if (record.trackId) {
        tracks.value = tracks.value.filter((t) => t.id !== record.trackId)
      }
      break
    case HistoryActionType.UPDATE_TRACK:
      if (record.trackId && record.data.after) {
        const track = tracks.value.find((t) => t.id === record.trackId)
        if (track) Object.assign(track, JSON.parse(JSON.stringify(record.data.after)))
      }
      break
    case HistoryActionType.ADD_BLOCK:
    case HistoryActionType.DELETE_BLOCK:
    case HistoryActionType.UPDATE_BLOCK:
    case HistoryActionType.MOVE_BLOCK:
      if (record.trackId && record.data.after) {
        const track = tracks.value.find((t) => t.id === record.trackId)
        if (track && track.type === TrackType.ACTION) {
          track.blocks = JSON.parse(JSON.stringify(record.data.after))
        }
      }
      break
    case HistoryActionType.UPDATE_AUDIO:
      if (record.trackId && record.data.after !== undefined) {
        const track = tracks.value.find((t) => t.id === record.trackId)
        if (track && track.type === TrackType.AUDIO) {
          track.audioUrl = record.data.after
        }
      }
      break
  }
  emit('update:tracks', tracks.value)
}

const handleKeyDown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable], select')) return

  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    handleUndo()
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    handleRedo()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    tracks.value.forEach((track) => {
      if (track.type === TrackType.ACTION && selectedBlocks.value[track.id]) {
        deleteSelectedBlock(track.id)
      }
    })
  }
}

// 缩放
const zoomIn = () => {
  config.value.pixelsPerSecond = Math.min(config.value.pixelsPerSecond * 1.5, 500)
}

const zoomOut = () => {
  config.value.pixelsPerSecond = Math.max(config.value.pixelsPerSecond / 1.5, 20)
}

// 拖拽播放头
let isDraggingPlayhead = false
const startDragPlayhead = (e: MouseEvent) => {
  isDraggingPlayhead = true
  updatePlayheadPosition(e)
  document.addEventListener('mousemove', updatePlayheadPosition)
  document.addEventListener('mouseup', stopDragPlayhead)
}

const updatePlayheadPosition = (e: MouseEvent) => {
  if (!isDraggingPlayhead || !playheadLayer.value) return
  const rect = playheadLayer.value.getBoundingClientRect()
  const x = e.clientX - rect.left - 200 + scrollLeft.value
  config.value.currentTime = pixelToTime(x)
  emit('update:currentTime', config.value.currentTime)
}

const stopDragPlayhead = () => {
  isDraggingPlayhead = false
  document.removeEventListener('mousemove', updatePlayheadPosition)
  document.removeEventListener('mouseup', stopDragPlayhead)
}

// 自动滚动以跟随播放头
const autoScrollToPlayhead = () => {
  if (!tracksWrapper.value) return
  const playheadPosition = timeToPixel(config.value.currentTime)
  const currentScrollLeft = tracksWrapper.value.scrollLeft
  const viewportWidth = tracksWrapper.value.clientWidth
  const margin = 200

  const playheadViewportPosition = playheadPosition - currentScrollLeft
  if (playheadViewportPosition > viewportWidth - margin) {
    tracksWrapper.value.scrollLeft = playheadPosition - viewportWidth + margin
  } else if (playheadViewportPosition < margin) {
    tracksWrapper.value.scrollLeft = Math.max(0, playheadPosition - margin)
  }
}

// 添加轨道
const addTrack = (type: TrackType) => {
  trackIdCounter++
  const track: Track = {
    id: `track-${trackIdCounter}`,
    name: `${type === TrackType.AUDIO ? '音频' : '动作'}轨道 ${trackIdCounter}`,
    type,
    robotId: type === TrackType.ACTION && props.selectedRobot ? props.selectedRobot : undefined,
    locked: false,
    visible: true,
    height: type === TrackType.AUDIO ? 100 : 85,
    blocks: type === TrackType.ACTION ? [] : undefined,
    audioUrl: type === TrackType.AUDIO ? undefined : undefined,
  }
  tracks.value.push(track)
  emit('update:tracks', tracks.value)

  const record = createHistoryRecord(
    HistoryActionType.ADD_TRACK,
    `添加${track.name}`,
    { after: track },
    track.id,
    track.name
  )
  addHistoryRecord(record)
}

// 删除轨道
const deleteTrack = (trackId: string) => {
  const track = tracks.value.find((t) => t.id === trackId)
  if (!track) return

  const trackCopy = JSON.parse(JSON.stringify(track))
  tracks.value = tracks.value.filter((t) => t.id !== trackId)
  emit('update:tracks', tracks.value)

  const record = createHistoryRecord(
    HistoryActionType.DELETE_TRACK,
    `删除${track.name}`,
    { before: trackCopy },
    trackId,
    track.name
  )
  addHistoryRecord(record)
}

// 切换轨道可见性
const toggleTrackVisibility = (trackId: string) => {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) track.visible = !track.visible
}

// 切换轨道锁定
const toggleTrackLock = (trackId: string) => {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track) track.locked = !track.locked
}

// 编辑轨道名称
const editTrackName = (trackId: string) => {
  const track = tracks.value.find((t) => t.id === trackId)
  if (!track) return

  ElMessageBox.prompt('请输入新的轨道名称', '编辑轨道名称', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: track.name,
  })
    .then(({ value }) => {
      if (value) {
        track.name = value
        emit('update:tracks', tracks.value)
      }
    })
    .catch(() => {})
}

// 获取机器狗绑定文本
const getRobotBindingText = (robotId: string | undefined) => {
  if (!robotId) return '未绑定'
  if (!props.robots) return '未知机器狗'
  const robot = props.robots.find((r) => r.uuid === robotId)
  return robot ? robot.name : '未知机器狗'
}

// 为轨道选择机器狗
const selectRobotForTrack = async (trackId: string) => {
  const track = tracks.value.find((t) => t.id === trackId)
  if (!track || track.type !== TrackType.ACTION) return

  if (!props.robots || props.robots.length === 0) {
    ElMessage.warning('没有可用的机器狗，请先添加机器狗')
    return
  }

  selectedRobotId.value = track.robotId || ''
  editingTrackIdForRobot.value = trackId
  robotSelectorVisible.value = true
}

// 确认机器狗选择
const confirmRobotSelection = () => {
  if (editingTrackIdForRobot.value) {
    const track = tracks.value.find((t) => t.id === editingTrackIdForRobot.value)
    if (track) {
      const oldRobotId = track.robotId
      track.robotId = selectedRobotId.value || undefined
      emit('update:tracks', tracks.value)

      const record = createHistoryRecord(
        HistoryActionType.UPDATE_TRACK,
        `${track.name} ${track.robotId ? '绑定到' : '解除绑定'} ${getRobotBindingText(track.robotId)}`,
        { before: { robotId: oldRobotId }, after: { robotId: track.robotId } },
        track.id,
        track.name
      )
      addHistoryRecord(record)
    }
  }
  robotSelectorVisible.value = false
  editingTrackIdForRobot.value = null
}

// 更新动作块
const updateTrackBlocks = (trackId: string, blocks: ActionBlock[]) => {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track && track.type === TrackType.ACTION) {
    const oldBlocks = JSON.parse(JSON.stringify(track.blocks))
    track.blocks = blocks
    emit('update:tracks', tracks.value)

    const record = createHistoryRecord(
      HistoryActionType.MOVE_BLOCK,
      `移动${track.name}中的动作块`,
      { before: oldBlocks, after: blocks },
      trackId,
      track.name
    )
    addHistoryRecord(record)
  }
}

// 添加动作块
const addActionBlock = (trackId: string) => {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track && track.type === TrackType.ACTION) {
    blockIdCounter++

    let maxEndTime = 0
    ;(track.blocks || []).forEach((b) => {
      const endTime = b.startTime + b.duration
      if (endTime > maxEndTime) maxEndTime = endTime
    })

    const newBlock: ActionBlock = {
      id: `block-${blockIdCounter}`,
      name: `动作 ${blockIdCounter}`,
      startTime: maxEndTime,
      duration: 2,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
    }

    const oldBlocks = JSON.parse(JSON.stringify(track.blocks || []))
    track.blocks = [...(track.blocks || []), newBlock]
    emit('update:tracks', tracks.value)

    const record = createHistoryRecord(
      HistoryActionType.ADD_BLOCK,
      `在${track.name}中添加动作块`,
      { before: oldBlocks, after: track.blocks },
      trackId,
      track.name
    )
    addHistoryRecord(record)
  }
}

// 选中动作块
const selectBlock = (trackId: string, blockId: string) => {
  selectedBlocks.value[trackId] = blockId
}

// 获取选中的块
const getSelectedBlock = (trackId: string) => selectedBlocks.value[trackId]

// 删除选中的动作块
const deleteSelectedBlock = (trackId: string) => {
  const track = tracks.value.find((t) => t.id === trackId)
  const selectedBlockId = selectedBlocks.value[trackId]

  if (track && track.type === TrackType.ACTION && selectedBlockId) {
    const oldBlocks = JSON.parse(JSON.stringify(track.blocks || []))
    track.blocks = (track.blocks || []).filter((b) => b.id !== selectedBlockId)
    delete selectedBlocks.value[trackId]
    emit('update:tracks', tracks.value)

    const record = createHistoryRecord(
      HistoryActionType.DELETE_BLOCK,
      `从${track.name}中删除动作块`,
      { before: oldBlocks, after: track.blocks },
      trackId,
      track.name
    )
    addHistoryRecord(record)
  }
}

// 编辑动作块
const editActionBlock = (trackId: string, block: ActionBlock) => {
  editingTrackId.value = trackId
  editingBlockId.value = block.id

  const track = tracks.value.find((t) => t.id === trackId)
  if (track && track.type === TrackType.ACTION) {
    const nextBlock = (track.blocks || [])
      .filter((b) => b.id !== block.id && b.startTime > block.startTime)
      .sort((a, b) => a.startTime - b.startTime)[0]

    if (nextBlock) {
      maxDurationLimit.value = nextBlock.startTime - block.startTime
    } else {
      maxDurationLimit.value = config.value.duration - block.startTime
    }
  }

  if (block.actionType) {
    editingActionData.value = {
      actionType: block.actionType,
      actionParams: { ...(block.actionParams || {}) },
    }
    if (editingActionData.value.actionParams.duration !== undefined) {
      editingActionData.value.actionParams.duration = block.duration
    }
  } else {
    editingActionData.value = undefined
  }
  actionSelectorVisible.value = true
}

// 处理动作选择
const handleActionSelected = (action: { actionType: string; actionName: string; actionParams: Record<string, any> }) => {
  if (editingTrackId.value && editingBlockId.value) {
    const track = tracks.value.find((t) => t.id === editingTrackId.value)
    if (track && track.type === TrackType.ACTION) {
      const block = track.blocks?.find((b) => b.id === editingBlockId.value)
      if (block) {
        const oldBlocks = JSON.parse(JSON.stringify(track.blocks || []))

        block.name = action.actionName
        block.actionType = action.actionType
        block.actionParams = action.actionParams

        if (action.actionParams.duration !== undefined) {
          block.duration = action.actionParams.duration
        }

        emit('update:tracks', tracks.value)

        const record = createHistoryRecord(
          HistoryActionType.UPDATE_BLOCK,
          `更新${track.name}中的${action.actionName}`,
          { before: oldBlocks, after: track.blocks },
          editingTrackId.value,
          track.name
        )
        addHistoryRecord(record)
      }
    }
  }

  editingTrackId.value = null
  editingBlockId.value = null
  editingActionData.value = undefined
  maxDurationLimit.value = undefined
}

// 更新音频
const updateTrackAudio = (trackId: string, audioUrl: string) => {
  const track = tracks.value.find((t) => t.id === trackId)
  if (track && track.type === TrackType.AUDIO) {
    const oldAudioUrl = track.audioUrl
    track.audioUrl = audioUrl
    emit('update:tracks', tracks.value)

    const record = createHistoryRecord(
      HistoryActionType.UPDATE_AUDIO,
      `更新${track.name}的音频`,
      { before: oldAudioUrl, after: audioUrl },
      trackId,
      track.name
    )
    addHistoryRecord(record)
  }
}

// 播放控制
const togglePlay = () => {
  if (isPlaying.value) {
    pausePlayback()
  } else {
    startPlayback()
  }
}

const startPlayback = () => {
  isPlaying.value = true
  playbackStartTime = Date.now()
  playbackStartOffset = config.value.currentTime

  tracks.value.forEach((track) => {
    if (track.type === TrackType.AUDIO && track.audioUrl) {
      emit('play-audio', track.id, config.value.currentTime)
    }
  })

  const updatePlayback = () => {
    if (!isPlaying.value) return
    const elapsed = (Date.now() - playbackStartTime) / 1000
    config.value.currentTime = playbackStartOffset + elapsed

    if (config.value.currentTime >= config.value.duration) {
      stop()
      return
    }

    autoScrollToPlayhead()
    emit('update:currentTime', config.value.currentTime)
    playbackTimer = requestAnimationFrame(updatePlayback)
  }

  playbackTimer = requestAnimationFrame(updatePlayback)
}

const pausePlayback = () => {
  isPlaying.value = false
  if (playbackTimer !== null) {
    cancelAnimationFrame(playbackTimer)
    playbackTimer = null
  }

  tracks.value.forEach((track) => {
    if (track.type === TrackType.AUDIO && track.audioUrl) {
      emit('pause-audio', track.id)
    }
  })
}

const stop = () => {
  isPlaying.value = false
  if (playbackTimer !== null) {
    cancelAnimationFrame(playbackTimer)
    playbackTimer = null
  }

  tracks.value.forEach((track) => {
    if (track.type === TrackType.AUDIO && track.audioUrl) {
      emit('stop-audio', track.id)
    }
  })
}

// 校验时间轴数据
const validate = () => {
  const unboundTracks = tracks.value.filter((t) => t.type === TrackType.ACTION && !t.robotId)

  if (unboundTracks.length > 0) {
    return {
      valid: false,
      message: `有 ${unboundTracks.length} 个动作轨道未绑定机器狗，请先绑定`,
    }
  }

  return { valid: true }
}

// 加载时间轴数据
const loadTimelineData = (data: { tracks?: any[]; config?: Partial<TimelineConfig> }) => {
  if (data.tracks && Array.isArray(data.tracks)) {
    // 转换类型字符串为枚举
    const convertedTracks = data.tracks.map((track: any) => ({
      ...track,
      type: track.type === 'audio' ? TrackType.AUDIO
        : track.type === 'action' ? TrackType.ACTION
        : track.type, // 如果已经是枚举值则保留
      locked: track.locked ?? false,
      visible: track.visible ?? true,
      height: track.height ?? 80,
    }))
    const clonedTracks = JSON.parse(JSON.stringify(convertedTracks))
    tracks.value = clonedTracks

    let maxTrackId = 0
    let maxBlockId = 0
    clonedTracks.forEach((track: Track) => {
      const trackMatch = track.id.match(/track-(\d+)/)
      if (trackMatch) {
        const trackNum = parseInt(trackMatch[1])
        if (trackNum > maxTrackId) maxTrackId = trackNum
      }

      if (track.blocks) {
        track.blocks.forEach((block: ActionBlock) => {
          const blockMatch = block.id.match(/block-(\d+)/)
          if (blockMatch) {
            const blockNum = parseInt(blockMatch[1])
            if (blockNum > maxBlockId) maxBlockId = blockNum
          }
        })
      }
    })

    trackIdCounter = maxTrackId
    blockIdCounter = maxBlockId
    historyRecords.value = []
    historyCurrentIndex.value = -1
  }

  if (data.config) {
    Object.assign(config.value, data.config)
  }
}

// 获取时间轴数据
const getTimelineData = () => {
  return {
    tracks: tracks.value,
    config: config.value,
  }
}

// 同步滚动
onMounted(() => {
  if (tracksWrapper.value) {
    tracksWrapper.value.addEventListener('scroll', (e: Event) => {
      const currentScrollLeft = (e.target as HTMLElement).scrollLeft
      scrollLeft.value = currentScrollLeft
      if (rulerWrapper.value) {
        rulerWrapper.value.scrollLeft = currentScrollLeft
      }
    })
  }
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (playbackTimer !== null) {
    cancelAnimationFrame(playbackTimer)
  }
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', updatePlayheadPosition)
  document.removeEventListener('mouseup', stopDragPlayhead)
})

// 暴露方法
defineExpose({
  addTrack,
  deleteTrack,
  validate,
  loadTimelineData,
  getTimelineData,
})
</script>

<style scoped>
.timeline-editor {
  width: 100%;
  height: 100%;
  display: flex;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-regular);
}

.timeline-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.timeline-toolbar {
  height: 45px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  gap: 15px;
  flex-shrink: 0;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.separator {
  color: var(--el-text-color-secondary);
  margin: 0 5px;
}

.zoom-level {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.time-display {
  font-size: 13px;
  color: var(--el-text-color-regular);
  font-family: monospace;
  padding: 0 10px;
  display: flex;
  align-items: center;
}

.time-editable {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.time-editable:hover {
  background-color: var(--el-fill-color-light);
}

.timeline-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.timeline-ruler {
  height: 40px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  flex-shrink: 0;
}

.ruler-track-label {
  width: 200px;
  border-right: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.ruler-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.ruler-content {
  position: relative;
  height: 100%;
}

.ruler-tick {
  position: absolute;
  top: 0;
  bottom: 0;
}

.tick-line {
  width: 1px;
  height: 8px;
  background: var(--el-text-color-placeholder);
  margin-top: 32px;
}

.ruler-tick.major .tick-line {
  height: 14px;
  background: var(--el-text-color-secondary);
  margin-top: 26px;
}

.tick-label {
  position: absolute;
  top: 5px;
  left: 5px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  user-select: none;
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ff4444;
  cursor: ew-resize;
  z-index: 100;
  height: 100vh;
}

.playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: -6px;
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 10px solid #ff4444;
}

.tracks-wrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  position: relative;
}

.playhead-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
}

.playhead-layer .playhead {
  pointer-events: auto;
}

.timeline-tracks {
  min-width: 100%;
  overflow: visible;
}

.track-row {
  display: flex;
  border-bottom: 1px solid var(--el-border-color);
}

.track-label {
  width: 200px;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
  justify-content: flex-start;
  overflow: hidden;
}

.track-controls {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.track-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
  margin-top: 3px;
  flex-shrink: 0;
}

.track-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  flex-shrink: 0;
}

.track-type-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
  display: inline-block;
  flex-shrink: 0;
}

.track-type-badge.audio {
  background: #4ec9b0;
  color: #000;
}

.track-type-badge.action {
  background: #569cd6;
  color: #000;
}

/* keyframe css removed */

.robot-binding {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);
}

.robot-binding:hover {
  background: var(--el-fill-color);
  border-color: var(--el-border-color);
}

.binding-text {
  font-size: 10px;
  white-space: nowrap;
  line-height: 1;
}

.track-content {
  position: relative;
  flex: 1;
  background: var(--el-bg-color-page);
}

.grid-lines {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--el-border-color);
}

.empty-state {
  padding: 60px;
  text-align: center;
  color: var(--el-text-color-placeholder);
}

.empty-state p {
  margin-top: 15px;
  font-size: 14px;
}

.robot-selector-header {
  margin-bottom: 15px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.robot-selector-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 15px;
  max-height: 400px;
  overflow-y: auto;
  padding: 5px;
}

.robot-select-card {
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.robot-select-card:hover {
  border-color: var(--el-border-color);
  background: var(--el-fill-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.robot-select-card.active {
  border-color: var(--el-color-primary);
  background: color-mix(in oklab, var(--el-color-primary) 20%, transparent);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.card-icon {
  font-size: 28px;
  color: var(--el-text-color-secondary);
  margin-bottom: 5px;
}

.robot-select-card.active .card-icon {
  color: var(--el-text-color-primary);
}

.robot-icon {
  font-size: 32px;
}

.card-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  position: absolute;
  top: 10px;
  right: 10px;
}

.card-status-dot.online {
  background: #4ec9b0;
  box-shadow: 0 0 4px #4ec9b0;
}

.card-status-dot.offline {
  background: #f48771;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.card-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.card-ip {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.card-desc {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.selection-mark {
  position: absolute;
  top: 5px;
  left: 5px;
  color: var(--el-color-primary);
  font-size: 16px;
  background: var(--el-bg-color-page);
  border-radius: 50%;
  padding: 2px;
}
</style>
