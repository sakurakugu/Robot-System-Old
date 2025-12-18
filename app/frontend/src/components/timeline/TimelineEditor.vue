<template>
  <div class="timeline-editor">
    <!-- 工具栏 -->
    <div class="timeline-toolbar">
      <div class="toolbar-left">
        <el-button-group>
          <el-button size="small" @click="addTrack(TrackType.ACTION)">
            <el-icon>
              <Plus />
            </el-icon> 动作轨道
          </el-button>
          <el-button size="small" @click="addTrack(TrackType.KEYFRAME)">
            <el-icon>
              <Plus />
            </el-icon> 关键帧轨道
          </el-button>
          <el-button size="small" @click="addTrack(TrackType.AUDIO)">
            <el-icon>
              <Plus />
            </el-icon> 音频轨道
          </el-button>
        </el-button-group>
      </div>
      <div class="toolbar-center">
        <el-button size="small" :type="isPlaying ? 'primary' : 'default'" @click="togglePlay">
          <el-icon v-if="!isPlaying">
            <VideoPlay />
          </el-icon>
          <el-icon v-else>
            <VideoPause />
          </el-icon>
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
            <el-icon>
              <ZoomIn />
            </el-icon>
          </el-button>
          <el-button size="small" @click="zoomOut">
            <el-icon>
              <ZoomOut />
            </el-icon>
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
            <div v-for="tick in timeTicks" :key="tick.time" class="ruler-tick" :class="{ major: tick.isMajor }"
              :style="{ left: timeToPixel(tick.time) + 'px' }">
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
                <el-button size="small" circle @click="toggleTrackVisibility(track.id)"
                  :type="track.visible ? 'primary' : 'default'">
                  <el-icon>
                    <View v-if="track.visible" />
                    <Hide v-else />
                  </el-icon>
                </el-button>
                <el-button size="small" circle @click="toggleTrackLock(track.id)"
                  :type="track.locked ? 'warning' : 'default'">
                  <el-icon>
                    <Lock v-if="track.locked" />
                    <Unlock v-else />
                  </el-icon>
                </el-button>
                <!-- 动作轨道的添加/删除按钮 -->
                <template v-if="track.type === TrackType.ACTION">
                  <el-button size="small" circle @click="addActionBlock(track.id)" :disabled="track.locked">
                    <el-icon>
                      <Plus />
                    </el-icon>
                  </el-button>
                  <el-button size="small" circle @click="deleteSelectedBlock(track.id)"
                    :disabled="track.locked || !getSelectedBlock(track.id)">
                    <el-icon>
                      <Minus />
                    </el-icon>
                  </el-button>
                </template>
                <el-button size="small" circle @click="deleteTrack(track.id)">
                  <el-icon>
                    <Delete />
                  </el-icon>
                </el-button>
              </div>
              <div class="track-name" @dblclick="editTrackName(track.id)">
                {{ track.name }}
              </div>
              <div class="track-badges">
                <div class="track-type-badge" :class="track.type">
                  {{ track.type === TrackType.AUDIO ? '音频' : track.type === TrackType.ACTION ? '动作' : '关键帧' }}
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
                <div v-for="tick in gridTicks" :key="tick" class="grid-line"
                  :style="{ left: timeToPixel(tick) + 'px' }"></div>
              </div>

              <!-- 动作轨道 -->
              <ActionTrack v-if="track.type === TrackType.ACTION" :track="track" :config="config"
                :robots="props.robots"
                @update:blocks="updateTrackBlocks(track.id, $event)" @add-block="addActionBlock(track.id)"
                @select-block="selectBlock(track.id, $event)" @edit-block="editActionBlock(track.id, $event)" />

              <!-- 关键帧轨道 -->
              <KeyframeTrack v-if="track.type === TrackType.KEYFRAME" :track="track" :config="config"
                @update:keyframes="updateTrackKeyframes(track.id, $event)"
                @add-keyframe="addKeyframe(track.id, $event)" />

              <!-- 音频轨道 -->
              <AudioTrack v-if="track.type === TrackType.AUDIO" :track="track" :config="config"
                :isTimelinePlaying="isPlaying" :currentTime="config.currentTime" :projectUuid="props.projectUuid"
                @update:audio="updateTrackAudio(track.id, $event)" />
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="tracks.length === 0" class="empty-state">
            <el-icon style="font-size: 48px">
              <Film />
            </el-icon>
            <p>暂无轨道，点击上方按钮添加轨道</p>
          </div>
        </div>
      </div>

      <!-- 播放头层（贯穿整个时间轴） -->
      <div class="playhead-layer" ref="playheadLayer">
        <div class="playhead" :style="{
          left: (timeToPixel(config.currentTime) - scrollLeft + 200) + 'px'
        }" @mousedown="startDragPlayhead"></div>
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
        <div 
          class="robot-select-card" 
          :class="{ active: !selectedRobotId }"
          @click="selectedRobotId = ''"
        >
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
          <div class="card-icon robot-icon">
            🐕
          </div>
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Track, TrackType, TimelineConfig, ActionBlock, Keyframe } from '@/types/timeline'
import ActionTrack from './ActionTrack.vue'
import KeyframeTrack from './KeyframeTrack.vue'
import AudioTrack from './AudioTrack.vue'
import ActionSelectorDialog from './ActionSelectorDialog.vue'
import { Warning, Check, CircleClose } from '@element-plus/icons-vue'

// Props
const props = defineProps<{
  duration?: number
  projectUuid?: string
  selectedRobot?: string | null // 当前选中的机器狗ID
  robots?: any[] // 机器狗列表
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
  gridSize: 0.5
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

// 撤销/重做历史
const history = ref<Track[][]>([])
const historyIndex = ref(-1)
const maxHistorySize = 50

// 引用
const rulerWrapper = ref<HTMLElement>()
const tracksWrapper = ref<HTMLElement>()
const playheadLayer = ref<HTMLElement>()

// 计算时间轴宽度
const timelineWidth = computed(() => {
  return config.value.duration * config.value.pixelsPerSecond
})

// 生成时间刻度
const timeTicks = computed(() => {
  const ticks: Array<{ time: number; isMajor: boolean }> = []
  const minorInterval = config.value.pixelsPerSecond > 50 ? 1 : 5
  const majorInterval = config.value.pixelsPerSecond > 50 ? 5 : 10

  for (let i = 0; i <= config.value.duration; i++) {
    if (i % minorInterval === 0) {
      ticks.push({
        time: i,
        isMajor: i % majorInterval === 0
      })
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
const timeToPixel = (time: number) => {
  return time * config.value.pixelsPerSecond
}

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
  const { ElMessageBox } = await import('element-plus')
  const { h } = await import('vue')

  const currentMins = Math.floor(config.value.currentTime / 60)
  const currentSecs = Math.floor(config.value.currentTime % 60)

  let minutes = currentMins
  let seconds = currentSecs

  ElMessageBox({
    title: '编辑当前时间',
    message: h('div', { style: 'display: flex; align-items: center; gap: 10px;' }, [
      h('div', { style: 'display: flex; flex-direction: column; gap: 5px;' }, [
        h('label', { style: 'font-size: 12px; color: #999;' }, '分钟'),
        h('input', {
          type: 'number',
          min: 0,
          max: 99,
          value: currentMins,
          style: 'width: 80px; padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px;',
          onInput: (e: Event) => {
            minutes = parseInt((e.target as HTMLInputElement).value) || 0
          }
        })
      ]),
      h('span', { style: 'font-size: 20px; margin-top: 20px;' }, ':'),
      h('div', { style: 'display: flex; flex-direction: column; gap: 5px;' }, [
        h('label', { style: 'font-size: 12px; color: #999;' }, '秒'),
        h('input', {
          type: 'number',
          min: 0,
          max: 59,
          value: currentSecs,
          style: 'width: 80px; padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px;',
          onInput: (e: Event) => {
            seconds = parseInt((e.target as HTMLInputElement).value) || 0
          }
        })
      ])
    ]),
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    beforeClose: (action, instance, done) => {
      if (action === 'confirm') {
        const newTime = minutes * 60 + Math.min(seconds, 59)
        if (newTime <= config.value.duration) {
          config.value.currentTime = newTime
          emit('update:currentTime', config.value.currentTime)
          done()
        } else {
          instance.confirmButtonLoading = false
          done()
        }
      } else {
        done()
      }
    }
  }).catch(() => {
    // 用户取消
  })
}

// 编辑总时长
const editDuration = async () => {
  const { ElMessageBox } = await import('element-plus')
  const { h } = await import('vue')

  const currentMins = Math.floor(config.value.duration / 60)
  const currentSecs = Math.floor(config.value.duration % 60)

  let minutes = currentMins
  let seconds = currentSecs

  ElMessageBox({
    title: '编辑总时长',
    message: h('div', { style: 'display: flex; align-items: center; gap: 10px;' }, [
      h('div', { style: 'display: flex; flex-direction: column; gap: 5px;' }, [
        h('label', { style: 'font-size: 12px; color: #999;' }, '分钟'),
        h('input', {
          type: 'number',
          min: 0,
          max: 99,
          value: currentMins,
          style: 'width: 80px; padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px;',
          onInput: (e: Event) => {
            minutes = parseInt((e.target as HTMLInputElement).value) || 0
          }
        })
      ]),
      h('span', { style: 'font-size: 20px; margin-top: 20px;' }, ':'),
      h('div', { style: 'display: flex; flex-direction: column; gap: 5px;' }, [
        h('label', { style: 'font-size: 12px; color: #999;' }, '秒'),
        h('input', {
          type: 'number',
          min: 0,
          max: 59,
          value: currentSecs,
          style: 'width: 80px; padding: 5px 10px; border: 1px solid #dcdfe6; border-radius: 4px;',
          onInput: (e: Event) => {
            seconds = parseInt((e.target as HTMLInputElement).value) || 0
          }
        })
      ])
    ]),
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    beforeClose: (action, instance, done) => {
      if (action === 'confirm') {
        const newDuration = minutes * 60 + Math.min(seconds, 59)
        if (newDuration >= 10) {
          config.value.duration = newDuration
          done()
        } else {
          instance.confirmButtonLoading = false
          done()
        }
      } else {
        done()
      }
    }
  }).catch(() => {
    // 用户取消
  })
}

// 历史管理
const saveHistory = () => {
  // 移除当前索引之后的所有历史
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }

  // 深拷贝当前轨道状态
  const snapshot = JSON.parse(JSON.stringify(tracks.value))
  history.value.push(snapshot)

  // 限制历史记录大小
  if (history.value.length > maxHistorySize) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

const undo = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--
    tracks.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    emit('update:tracks', tracks.value)
  }
}

const redo = () => {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    tracks.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    emit('update:tracks', tracks.value)
  }
}

// 键盘事件处理
const handleKeyDown = (e: KeyboardEvent) => {
  // Ctrl+Z 撤销
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  }
  // Ctrl+Shift+Z 或 Ctrl+Y 重做
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    redo()
  }
  // Delete 删除选中的动作块
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    // 遍历所有轨道，删除选中的块
    tracks.value.forEach(track => {
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
  const x = e.clientX - rect.left - 200 + scrollLeft.value // 减去标签宽度，加上滚动偏移
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

  const playheadPosition = timeToPixel(config.value.currentTime) // 播放头在时间轴内容中的绝对位置
  const currentScrollLeft = tracksWrapper.value.scrollLeft // 当前滚动位置
  const viewportWidth = tracksWrapper.value.clientWidth // 可视区域宽度
  const margin = 200 // 距离边缘的安全边距，考虑右侧预览面板

  // 计算播放头相对于可视区域的位置
  const playheadViewportPosition = playheadPosition - currentScrollLeft

  // 如果播放头接近可视区域右边缘，自动向右滚动
  if (playheadViewportPosition > viewportWidth - margin) {
    tracksWrapper.value.scrollLeft = playheadPosition - viewportWidth + margin
  }
  // 如果播放头接近可视区域左边缘，自动向左滚动
  else if (playheadViewportPosition < margin) {
    tracksWrapper.value.scrollLeft = Math.max(0, playheadPosition - margin)
  }
}

// 添加轨道
let trackIdCounter = 0
const addTrack = (type: TrackType) => {
  trackIdCounter++
  console.log('Adding track with type:', type)
  console.log('TrackType.AUDIO:', TrackType.AUDIO)
  console.log('TrackType.ACTION:', TrackType.ACTION)

  const track: Track = {
    id: `track-${trackIdCounter}`,
    name: `${type === TrackType.AUDIO ? '音频' : type === TrackType.ACTION ? '动作' : '关键帧'}轨道 ${trackIdCounter}`,
    type,
    // 如果是动作轨道且有选中的机器狗，自动绑定
    robotId: type === TrackType.ACTION && props.selectedRobot ? props.selectedRobot : undefined,
    locked: false,
    visible: true,
    height: type === TrackType.AUDIO ? 100 : 85,
    blocks: type === TrackType.ACTION ? [] : undefined,
    keyframes: type === TrackType.KEYFRAME ? [] : undefined,
    audioUrl: type === TrackType.AUDIO ? undefined : undefined
  }

  console.log('Created track:', track)
  tracks.value.push(track)
  emit('update:tracks', tracks.value)
  saveHistory()
}

// 删除轨道
const deleteTrack = (trackId: string) => {
  tracks.value = tracks.value.filter((t: Track) => t.id !== trackId)
  emit('update:tracks', tracks.value)
  saveHistory()
}

// 切换轨道可见性
const toggleTrackVisibility = (trackId: string) => {
  const track = tracks.value.find((t: Track) => t.id === trackId)
  if (track) {
    track.visible = !track.visible
  }
}

// 切换轨道锁定
const toggleTrackLock = (trackId: string) => {
  const track = tracks.value.find((t: Track) => t.id === trackId)
  if (track) {
    track.locked = !track.locked
  }
}

// 编辑轨道名称
const editTrackName = (trackId: string) => {
  // TODO: 实现轨道名称编辑
  console.log('Edit track name:', trackId)
}

// 获取机器狗绑定文本
const getRobotBindingText = (robotId: string | undefined) => {
  if (!robotId) return '未绑定'
  if (!props.robots) return '未知机器狗'
  const robot = props.robots.find((r: any) => r.uuid === robotId)
  return robot ? robot.name : '未知机器狗'
}

// 为轨道选择机器狗
const selectRobotForTrack = async (trackId: string) => {
  const track = tracks.value.find((t: Track) => t.id === trackId)
  if (!track || track.type !== TrackType.ACTION) return
  
  if (!props.robots || props.robots.length === 0) {
    const { ElMessage } = await import('element-plus')
    ElMessage.warning('没有可用的机器狗，请先添加机器狗')
    return
  }
  
  // 设置当前选中的机器狗
  selectedRobotId.value = track.robotId || ''
  editingTrackIdForRobot.value = trackId
  robotSelectorVisible.value = true
}

// 确认机器狗选择
const confirmRobotSelection = () => {
  if (editingTrackIdForRobot.value) {
    const track = tracks.value.find((t: Track) => t.id === editingTrackIdForRobot.value)
    if (track) {
      track.robotId = selectedRobotId.value || undefined
      emit('update:tracks', tracks.value)
      saveHistory()
    }
  }
  robotSelectorVisible.value = false
  editingTrackIdForRobot.value = null
}

// 更新动作块
const updateTrackBlocks = (trackId: string, blocks: ActionBlock[]) => {
  const track = tracks.value.find((t: Track) => t.id === trackId)
  if (track && track.type === TrackType.ACTION) {
    track.blocks = blocks
    emit('update:tracks', tracks.value)
    saveHistory()
  }
}

// 添加动作块
let blockIdCounter = 0
const addActionBlock = (trackId: string) => {
  const track = tracks.value.find((t: Track) => t.id === trackId)
  if (track && track.type === TrackType.ACTION) {
    blockIdCounter++
    
    // 找到最后一个动作块的结束时间，将新块放在末尾
    let maxEndTime = 0
    ;(track.blocks || []).forEach((b: ActionBlock) => {
      const endTime = b.startTime + b.duration
      if (endTime > maxEndTime) {
        maxEndTime = endTime
      }
    })
    
    const newBlock: ActionBlock = {
      id: `block-${blockIdCounter}`,
      name: `动作 ${blockIdCounter}`,
      startTime: maxEndTime, // 放在末尾而不是当前时间
      duration: 2,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    }
    track.blocks = [...(track.blocks || []), newBlock]
    emit('update:tracks', tracks.value)
    saveHistory()
  }
}

// 选中动作块
const selectBlock = (trackId: string, blockId: string) => {
  selectedBlocks.value[trackId] = blockId
}

// 获取选中的块
const getSelectedBlock = (trackId: string) => {
  return selectedBlocks.value[trackId]
}

// 删除选中的动作块
const deleteSelectedBlock = (trackId: string) => {
  const track = tracks.value.find((t: Track) => t.id === trackId)
  const selectedBlockId = selectedBlocks.value[trackId]

  if (track && track.type === TrackType.ACTION && selectedBlockId) {
    track.blocks = (track.blocks || []).filter((b: ActionBlock) => b.id !== selectedBlockId)
    delete selectedBlocks.value[trackId]
    emit('update:tracks', tracks.value)
    saveHistory()
  }
}

// 编辑动作块
const editActionBlock = (trackId: string, block: ActionBlock) => {
  editingTrackId.value = trackId
  editingBlockId.value = block.id
  
  // 计算当前块的最大可用时间（找到下一个块的起始时间）
  const track = tracks.value.find((t: Track) => t.id === trackId)
  if (track && track.type === TrackType.ACTION) {
    const nextBlock = (track.blocks || [])
      .filter((b: ActionBlock) => b.id !== block.id && b.startTime > block.startTime)
      .sort((a: ActionBlock, b: ActionBlock) => a.startTime - b.startTime)[0]
    
    if (nextBlock) {
      // 最大时间 = 下一个块的起始时间 - 当前块的起始时间
      maxDurationLimit.value = nextBlock.startTime - block.startTime
    } else {
      // 如果没有下一个块，使用时间轴总时长作为限制
      maxDurationLimit.value = config.value.duration - block.startTime
    }
  }
  
  // 如果块已经有动作数据，传递给对话框
  if (block.actionType) {
    editingActionData.value = {
      actionType: block.actionType,
      actionParams: { ...(block.actionParams || {}) }
    }
    // 将当前块的实际 duration 同步到参数中
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
    const track = tracks.value.find((t: Track) => t.id === editingTrackId.value)
    if (track && track.type === TrackType.ACTION) {
      const block = track.blocks?.find((b: ActionBlock) => b.id === editingBlockId.value)
      if (block) {
        // 更新动作块的名称和动作数据
        block.name = action.actionName
        block.actionType = action.actionType
        block.actionParams = action.actionParams
        
        // 根据动作参数中的 duration 更新块的持续时间
        // 注意：duration 已经在对话框中受到最大值限制，这里直接使用即可
        if (action.actionParams.duration !== undefined) {
          block.duration = action.actionParams.duration
        }
        
        emit('update:tracks', tracks.value)
        saveHistory()
      }
    }
  }
  
  // 重置编辑状态
  editingTrackId.value = null
  editingBlockId.value = null
  editingActionData.value = undefined
  maxDurationLimit.value = undefined
}

// 更新关键帧
const updateTrackKeyframes = (trackId: string, keyframes: Keyframe[]) => {
  const track = tracks.value.find((t: Track) => t.id === trackId)
  if (track && track.type === TrackType.KEYFRAME) {
    track.keyframes = keyframes
    emit('update:tracks', tracks.value)
    saveHistory()
  }
}

// 添加关键帧
let keyframeIdCounter = 0
const addKeyframe = (trackId: string, time: number) => {
  const track = tracks.value.find((t: Track) => t.id === trackId)
  if (track && track.type === TrackType.KEYFRAME) {
    keyframeIdCounter++
    const newKeyframe: Keyframe = {
      id: `keyframe-${keyframeIdCounter}`,
      time,
      value: 0.5,
      easing: 'linear'
    }
    track.keyframes = [...(track.keyframes || []), newKeyframe]
    emit('update:tracks', tracks.value)
    saveHistory()
  }
}

// 更新音频
const updateTrackAudio = (trackId: string, audioUrl: string) => {
  console.log('updateTrackAudio called:', { trackId, audioUrl })
  const track = tracks.value.find((t: Track) => t.id === trackId)
  console.log('Found track:', track)

  if (track && track.type === TrackType.AUDIO) {
    track.audioUrl = audioUrl
    console.log('Updated track.audioUrl:', track.audioUrl)
    emit('update:tracks', tracks.value)
    saveHistory()
  } else {
    console.log('Track not found or not audio type')
  }
}

// 同步滚动
onMounted(() => {
  // 同步横向滚动
  if (tracksWrapper.value) {
    tracksWrapper.value.addEventListener('scroll', (e: Event) => {
      const currentScrollLeft = (e.target as HTMLElement).scrollLeft
      scrollLeft.value = currentScrollLeft

      // 同步标尺滚动
      if (rulerWrapper.value) {
        rulerWrapper.value.scrollLeft = currentScrollLeft
      }
    })
  }

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)

  // 初始化历史记录
  saveHistory()
})

// 播放控制函数
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

  // 开始播放所有音频轨道
  tracks.value.forEach((track) => {
    if (track.type === TrackType.AUDIO && track.audioUrl) {
      // 通过事件通知音频轨道开始播放
      emit('play-audio', track.id, config.value.currentTime)
    }
  })

  // 启动播放循环
  const updatePlayback = () => {
    if (!isPlaying.value) return

    const elapsed = (Date.now() - playbackStartTime) / 1000
    config.value.currentTime = playbackStartOffset + elapsed

    // 如果播放到末尾，停止
    if (config.value.currentTime >= config.value.duration) {
      stop()
      return
    }

    // 自动滚动以跟随播放头
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

  // 暂停所有音频轨道
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

  // 停止所有音频轨道
  tracks.value.forEach((track) => {
    if (track.type === TrackType.AUDIO && track.audioUrl) {
      emit('stop-audio', track.id)
    }
  })
}

onUnmounted(() => {
  if (playbackTimer !== null) {
    cancelAnimationFrame(playbackTimer)
  }
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', updatePlayheadPosition)
  document.removeEventListener('mouseup', stopDragPlayhead)
})

// 校验时间轴数据
const validate = () => {
  const unboundTracks = tracks.value.filter(
    t => t.type === TrackType.ACTION && !t.robotId
  )
  
  if (unboundTracks.length > 0) {
    return {
      valid: false,
      message: `有 ${unboundTracks.length} 个动作轨道未绑定机器狗，请先绑定`
    }
  }
  
  return { valid: true }
}

// 暴露方法
defineExpose({
  addTrack,
  deleteTrack,
  validate,
  config,
  tracks
})
</script>

<style scoped>
.timeline-editor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #d4d4d4;
}

.timeline-toolbar {
  height: 45px;
  background: #2d2d30;
  border-bottom: 1px solid #3c3c3c;
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
  color: #555;
  margin: 0 5px;
}

.zoom-level {
  font-size: 12px;
  color: #888;
}

.time-duration {
  font-size: 12px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 5px;
}

.time-display {
  font-size: 13px;
  color: #cccccc;
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
  background-color: rgba(255, 255, 255, 0.1);
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
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
  flex-shrink: 0;
}

.ruler-track-label {
  width: 200px;
  border-right: 1px solid #3c3c3c;
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
  background: #555;
  margin-top: 32px;
}

.ruler-tick.major .tick-line {
  height: 14px;
  background: #888;
  margin-top: 26px;
}

.tick-label {
  position: absolute;
  top: 5px;
  left: 5px;
  font-size: 11px;
  color: #888;
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
  border-bottom: 1px solid #3c3c3c;
}

.track-label {
  width: 200px;
  background: #252526;
  border-right: 1px solid #3c3c3c;
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
  background: #333;
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

.track-type-badge.keyframe {
  background: #ce9178;
  color: #000;
}

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
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.robot-binding:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.binding-text {
  font-size: 10px;
  white-space: nowrap;
  line-height: 1;
}

.track-content {
  position: relative;
  flex: 1;
  background: #1e1e1e;
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
  background: #2a2a2a;
}

.empty-state {
  padding: 60px;
  text-align: center;
  color: #666;
}

.empty-state p {
  margin-top: 15px;
  font-size: 14px;
}

.robot-selector-header {
  margin-bottom: 15px;
  color: #ccc;
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
  border: 1px solid #3c3c3c;
  background: #252526;
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
  border-color: #555;
  background: #2d2d30;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.robot-select-card.active {
  border-color: #0e639c;
  background: rgba(14, 99, 156, 0.2);
  box-shadow: 0 0 0 1px #0e639c inset;
}

.card-icon {
  font-size: 28px;
  color: #888;
  margin-bottom: 5px;
}

.robot-select-card.active .card-icon {
  color: #fff;
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
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.card-ip {
  font-size: 11px;
  color: #888;
  font-family: monospace;
}

.card-desc {
  font-size: 12px;
  color: #666;
}

.selection-mark {
  position: absolute;
  top: 5px;
  left: 5px;
  color: #0e639c;
  font-size: 16px;
  background: rgba(30, 30, 30, 0.8);
  border-radius: 50%;
  padding: 2px;
}
</style>
