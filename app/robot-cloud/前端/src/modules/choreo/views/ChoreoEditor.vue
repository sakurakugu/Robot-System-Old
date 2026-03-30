<template>
  <div class="choreo-editor-container">
    <!-- 顶部工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button
          text
          @click="goBack"
        >
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <el-divider direction="vertical" />
        <span class="project-name">{{ project?.name || '加载中...' }}</span>

        <!-- 菜单栏 -->
        <el-dropdown
          trigger="click"
          @command="handleEditCommand"
        >
          <span class="menu-item">
            编辑 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="save">
                保存
              </el-dropdown-item>
              <el-dropdown-item command="save-as-action">
                保存为自定义动作
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown
          trigger="click"
          @command="handleHelpCommand"
        >
          <span class="menu-item">
            帮助 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="help">
                打开帮助
              </el-dropdown-item>
              <el-dropdown-item command="about">
                关于
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="toolbar-center">
        <!-- 播放控制已移至 TimelineEditor 内部 -->
      </div>
      <div class="toolbar-right">
        <el-button-group class="panel-toggles">
          <el-button
            :type="showLeftPanel ? 'primary' : ''"
            size="small"
            title="左侧面板"
            @click="showLeftPanel = !showLeftPanel"
          >
            <el-icon><Fold /></el-icon>
          </el-button>
          <el-button
            :type="showRightPanel ? 'primary' : ''"
            size="small"
            title="右侧预览"
            @click="showRightPanel = !showRightPanel"
          >
            <el-icon><Expand /></el-icon>
          </el-button>
        </el-button-group>
        <el-button
          size="small"
          :loading="saving"
          @click="saveTimeline"
        >
          <el-icon><DocumentChecked /></el-icon>
          保存
        </el-button>
        <template v-if="executing">
          <el-button
            v-if="executionStatus?.status === 'running'"
            size="small"
            type="warning"
            @click="pauseExecution"
          >
            暂停
          </el-button>
          <el-button
            v-if="executionStatus?.status === 'paused'"
            size="small"
            type="success"
            @click="resumeExecution"
          >
            恢复
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click="stopExecution"
          >
            停止
          </el-button>
          <span class="execution-progress">
            {{ executionStatus?.progress ?? 0 }}%
          </span>
        </template>
        <el-button
          v-else
          size="small"
          type="primary"
          :disabled="!canExecute"
          @click="executeTimeline"
        >
          <el-icon><Zap /></el-icon>
          执行
        </el-button>
      </div>
    </div>

    <div class="editor-main">
      <!-- 左侧活动栏 -->
      <div class="activity-bar">
        <div class="activity-icons">
          <div
            class="activity-icon"
            :class="{ active: activeView === 'robots' }"
            title="机器人列表"
            @click="toggleView('robots')"
          >
            <el-icon><Setting /></el-icon>
          </div>
          <div
            class="activity-icon"
            :class="{ active: activeView === 'actions' }"
            title="动作列表"
            @click="toggleView('actions')"
          >
            <el-icon><VideoPlay /></el-icon>
          </div>
          <div
            class="activity-icon"
            :class="{ active: activeView === 'history' }"
            title="历史记录"
            @click="toggleView('history')"
          >
            <el-icon><Clock /></el-icon>
          </div>
        </div>
        <div class="activity-bottom">
          <div
            class="activity-icon"
            title="设置"
            @click="goToSettings"
          >
            <el-icon><Setting /></el-icon>
          </div>
        </div>
      </div>

      <!-- 左侧面板 -->
      <div
        v-show="showLeftPanel"
        class="side-panel left-panel"
        :style="{ width: leftPanelWidth + 'px' }"
      >
        <div class="panel-header">
          <span>{{ getPanelTitle }}</span>
          <div
            v-if="activeView === 'robots'"
            class="header-actions"
          >
            <el-button
              size="small"
              text
              @click="showAddRobotDialog = true"
            >
              <el-icon><Plus /></el-icon>
            </el-button>
          </div>
        </div>

        <!-- 机器人列表 -->
        <div
          v-show="activeView === 'robots'"
          class="robot-list"
        >
          <div
            v-for="robot in projectRobots"
            :key="robot.uuid"
            class="robot-item"
            :class="{ selected: selectedRobotId === robot.robot_id }"
            @click="selectRobot(robot.robot_id)"
          >
            <div
              class="robot-status"
              :class="getRobotStatus(robot.robot_id)"
            />
            <span class="robot-name">{{ robot.name }}</span>
            <el-button
              size="small"
              text
              @click.stop="removeRobotFromProject(robot.uuid)"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
          <el-empty
            v-if="projectRobots.length === 0"
            description="暂无机器人"
            :image-size="60"
          >
            <el-button
              size="small"
              type="primary"
              @click="showAddRobotDialog = true"
            >
              添加机器人
            </el-button>
          </el-empty>
        </div>

        <!-- 动作列表 -->
        <div
          v-show="activeView === 'actions'"
          class="actions-panel"
        >
          <ActionList />
        </div>

        <!-- 历史记录 -->
        <div
          v-show="activeView === 'history'"
          class="history-panel"
        >
          <HistoryPanel
            :history-records="historyRecords"
            :current-index="historyCurrentIndex"
            @undo="handleUndo"
            @redo="handleRedo"
            @jump-to="handleJumpTo"
            @clear="handleClearHistory"
          />
        </div>
      </div>


      <!-- 左侧面板拖拽条 -->
      <div
        v-show="showLeftPanel"
        class="vertical-resizer"
        @mousedown="startResizeLeft"
      />

      <!-- 中间时间轴编辑器 -->
      <div class="center-content">
        <div
          v-loading="loading"
          class="timeline-area"
        >
          <TimelineEditor
            ref="timelineEditorRef"
            :duration="config.duration"
            :project-uuid="projectUuid"
            :selected-robot="selectedRobotId"
            :robots="robotsForTimeline"
            @update:current-time="updateCurrentTime"
            @update:tracks="updateTracks"
            @history-change="onHistoryChange"
          />
        </div>

        <!-- 底部面板拖拽条 -->
        <div
          v-show="showBottomPanel"
          class="horizontal-resizer"
          @mousedown="startResizeBottom"
        />

        <!-- 底部日志面板 -->
        <div
          v-show="showBottomPanel"
          class="bottom-panel"
          :style="{ height: bottomPanelHeight + 'px' }"
        >
          <div class="panel-header">
            <span>日志输出</span>
            <div class="header-actions">
              <el-button
                size="small"
                text
                title="清空日志"
                @click="clearLogs"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
              <el-button
                size="small"
                text
                title="关闭面板"
                @click="showBottomPanel = false"
              >
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>
          <div
            ref="logsContainerRef"
            class="logs-content"
          >
            <div
              v-for="(log, index) in logs"
              :key="index"
              class="log-item"
              :class="log.type"
            >
              <span class="log-time">{{ log.time }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
            <div
              v-if="logs.length === 0"
              class="no-logs"
            >
              暂无日志
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧面板拖拽条 -->
      <div
        v-show="showRightPanel"
        class="vertical-resizer"
        @mousedown="startResizeRight"
      />

      <!-- 右侧预览面板 -->
      <div
        v-show="showRightPanel"
        class="side-panel right-panel"
        :style="{ width: rightPanelWidth + 'px' }"
      >
        <div class="panel-header">
          实时预览
        </div>
        <div class="preview-content">
          <RobotPreview
            :current-time="config.currentTime"
            :is-playing="isPlaying"
            :tracks="tracks"
          />
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <div class="status-left">
        <span class="status-item">
          <el-icon><Connection /></el-icon>
          机器人: {{ projectRobots.length }}
        </span>
        <span class="status-item">
          <el-icon><VideoPlay /></el-icon>
          轨道: {{ tracks.length }}
        </span>
      </div>
      <div class="status-right">
        <span
          class="status-item"
          style="cursor: pointer;"
          @click="showBottomPanel = !showBottomPanel"
        >
          <el-icon><Document /></el-icon>
          日志 ({{ logs.length }})
        </span>
        <span class="status-item">当前时间: {{ config.currentTime.toFixed(2) }}s</span>
        <span class="status-item">时长: {{ config.duration }}s</span>
      </div>
    </div>

    <!-- 添加机器人对话框 -->
    <el-dialog
      v-model="showAddRobotDialog"
      title="添加机器人"
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="选择机器人">
          <el-select
            v-model="addRobotForm.robot_id"
            placeholder="请选择机器人"
            style="width: 100%"
          >
            <el-option
              v-for="robot in availableRobots"
              :key="robot.uuid"
              :label="robot.name || robot.uuid"
              :value="robot.uuid"
            >
              <span>{{ robot.name || '未命名' }}</span>
              <span style="color: #999; margin-left: 8px">{{ robot.ip }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input
            v-model="addRobotForm.name"
            placeholder="可选，留空使用默认名称"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddRobotDialog = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :disabled="!addRobotForm.robot_id"
          @click="addRobotToProjectHandler"
        >
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 保存为自定义动作对话框 -->
    <el-dialog
      v-model="showSaveAsActionDialog"
      title="保存为自定义动作"
      width="450px"
    >
      <el-form label-width="80px">
        <el-form-item label="动作名称">
          <el-input
            v-model="customActionName"
            placeholder="请输入自定义动作名称"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSaveAsActionDialog = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :disabled="!customActionName.trim()"
          @click="saveAsCustomAction"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useWebSocket } from '@/composables/useWebSocket'
import { getRobotList } from '@/modules/robot/api'
import { ArrowDown, ArrowLeft, Clock, Close, Connection, Delete, Document, DocumentChecked, Expand, Fold, Plus, Setting, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Zap } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { choreoApi } from '../api'
import RobotPreview from '../components/RobotPreview.vue'
import { HistoryPanel, TimelineEditor } from '../components/timeline'
import type {
  ChoreoProject,
  ChoreoRobot,
  ChoreoWSMessage,
  ExecutionStatus,
  HistoryRecord,
  Robot,
  TimelineConfig,
} from '../types'
import ActionList from './ActionList.vue'

const route = useRoute()
const router = useRouter()
const projectUuid = route.params.uuid as string

// 状态
const loading = ref(true)
const saving = ref(false)
const project = ref<ChoreoProject | null>(null)
const projectRobots = ref<ChoreoRobot[]>([])
const allRobots = ref<any[]>([])
 
const tracks = ref<any[]>([])
const selectedRobotId = ref<string | null>(null)
const showAddRobotDialog = ref(false)
const showSaveAsActionDialog = ref(false)
const customActionName = ref('')
const timelineEditorRef = ref<InstanceType<typeof TimelineEditor>>()
const isPlaying = ref(false)

// 面板状态
const showLeftPanel = ref(true)
const showRightPanel = ref(false)
const showBottomPanel = ref(true)
const leftPanelWidth = ref(280)
const rightPanelWidth = ref(360)
const bottomPanelHeight = ref(200)
const activeView = ref<'robots' | 'actions' | 'history'>('robots')

// 日志相关
interface LogItem {
  time: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}
const logs = ref<LogItem[]>([])
const logsContainerRef = ref<HTMLElement | null>(null)

// 拖拽相关
const isResizing = ref(false)
const resizeType = ref<'left' | 'right' | 'bottom' | null>(null)

// 历史记录
const historyRecords = ref<HistoryRecord[]>([])
const historyCurrentIndex = ref(-1)

const config = reactive<TimelineConfig>({
  duration: 60,
  pixelsPerSecond: 100,
  currentTime: 0,
  snapToGrid: true,
  gridSize: 0.5,
})

const addRobotForm = reactive({
  robot_id: '',
  name: '',
})

// 计算属性
const availableRobots = computed(() => {
  const usedIds = new Set(projectRobots.value.map((r) => r.robot_id))
  return allRobots.value.filter((r) => !usedIds.has(r.uuid))
})

const robotsForTimeline = computed<Robot[]>(() => {
  return projectRobots.value.map((pr) => {
    const fullRobot = allRobots.value.find((r) => r.uuid === pr.robot_id)
    return {
      uuid: pr.robot_id,
      name: pr.name,
      robot_ip: fullRobot?.ip || '',
      status: fullRobot?.status || 'offline',
    }
  })
})

const canExecute = computed(() => {
  if (projectRobots.value.length === 0) return false
  // 必须有至少一个动作轨道：已绑定机器人、已有 block、且 block 已选择动作
  return tracks.value.some(
    (t) =>
      t.type === 'action' &&
      t.robotId &&
      t.blocks?.some((b: { actionType?: string }) => !!b.actionType)
  )
})

const getPanelTitle = computed(() => {
  switch (activeView.value) {
    case 'robots':
      return '机器人列表'
    case 'actions':
      return '动作列表'
    case 'history':
      return '历史记录'
    default:
      return ''
  }
})

// 切换左侧视图
const toggleView = (view: 'robots' | 'actions' | 'history') => {
  if (activeView.value === view) {
    showLeftPanel.value = !showLeftPanel.value
  } else {
    activeView.value = view
    showLeftPanel.value = true
  }
}

// 更新当前时间
const updateCurrentTime = (time: number) => {
  config.currentTime = time
}

// 更新轨道
 
const updateTracks = (newTracks: any[]) => {
  tracks.value = newTracks
}

// 历史记录变化
const onHistoryChange = (records: HistoryRecord[], index: number) => {
  historyRecords.value = records
  historyCurrentIndex.value = index
}

// 历史记录操作 (TODO: 需要 TimelineEditor 实现相关方法)
const handleUndo = () => {
  // 历史记录撤销功能待实现
  console.log('Undo action')
}

const handleRedo = () => {
  // 历史记录重做功能待实现
  console.log('Redo action')
}

const handleJumpTo = (index: number) => {
  // 跳转到历史记录功能待实现
  console.log('Jump to history index:', index)
}

const handleClearHistory = () => {
  // 清空历史记录
  historyRecords.value = []
  historyCurrentIndex.value = -1
}

// 返回
const goBack = () => {
  router.push('/choreo')
}

// 跳转设置
const goToSettings = () => {
  router.push(`/choreo/${projectUuid}/settings`)
}

// 编辑命令
const handleEditCommand = (command: string) => {
  if (command === 'save') {
    saveTimeline()
  } else if (command === 'save-as-action') {
    showSaveAsActionDialog.value = true
  }
}

// 帮助命令
const handleHelpCommand = (command: string) => {
  if (command === 'help') {
    router.push(`/choreo/${projectUuid}/help`)
  } else if (command === 'about') {
    router.push(`/choreo/${projectUuid}/about`)
  }
}

// 保存为自定义动作
const saveAsCustomAction = async () => {
  if (!customActionName.value.trim()) return
  if (!timelineEditorRef.value) return

  try {
    const data = timelineEditorRef.value.getTimelineData()
    await choreoApi.saveCustomAction(projectUuid, {
      name: customActionName.value,
      description: '',
      tracks: data.tracks,
      config: data.config,
    })
    ElMessage.success('自定义动作已保存')
    showSaveAsActionDialog.value = false
    customActionName.value = ''
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  }
}

// 选择机器人
const selectRobot = (robotId: string) => {
  selectedRobotId.value = selectedRobotId.value === robotId ? null : robotId
}

// 获取机器人状态
const getRobotStatus = (robotId: string) => {
  const robot = allRobots.value.find((r) => r.uuid === robotId)
  return robot?.status || 'offline'
}

// 添加机器人到项目
const addRobotToProjectHandler = async () => {
  if (!addRobotForm.robot_id) return

  try {
    const res = await choreoApi.addRobotToProject(projectUuid, {
      robot_id: addRobotForm.robot_id,
      name: addRobotForm.name || undefined,
    })
    if (res.success) {
      projectRobots.value.push(res.data)
      showAddRobotDialog.value = false
      addRobotForm.robot_id = ''
      addRobotForm.name = ''
      ElMessage.success('机器人已添加')
    }
  } catch (error) {
    console.error('添加机器人失败:', error)
  }
}

// 从项目移除机器人
const removeRobotFromProject = async (robotUuid: string) => {
  try {
    await choreoApi.removeRobotFromProject(projectUuid, robotUuid)
    const index = projectRobots.value.findIndex((r) => r.uuid === robotUuid)
    if (index !== -1) {
      projectRobots.value.splice(index, 1)
    }
    ElMessage.success('机器人已移除')
  } catch (error) {
    console.error('移除机器人失败:', error)
  }
}

// 保存时间轴
const saveTimeline = async () => {
  if (!timelineEditorRef.value) return

  saving.value = true
  try {
    const data = timelineEditorRef.value.getTimelineData()
    await choreoApi.saveTimeline(projectUuid, {
      tracks: data.tracks,
      config: data.config,
    })
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// ==================== 编舞执行 ====================

const executionStatus = ref<ExecutionStatus | null>(null)
const executing = computed(() => executionStatus.value?.status === 'running' || executionStatus.value?.status === 'paused')

// 执行时间轴
const executeTimeline = async () => {
  if (!canExecute.value) return

  // 预检查：确保时间轴已保存
  if (timelineEditorRef.value) {
    await saveTimeline()
  }

  try {
    const res = await choreoApi.executeChoreo(projectUuid)
    if (res.success) {
      executionStatus.value = res.data
      addLog('编舞开始执行', 'success')
      ElMessage.success('开始执行')
    }
  } catch (error: any) {
    console.error('执行失败:', error)
    ElMessage.error(error.response?.data?.error || '执行失败')
  }
}

// 暂停执行
const pauseExecution = async () => {
  if (!executionStatus.value) return
  try {
    await choreoApi.pauseExecution(executionStatus.value.executionId)
    addLog('编舞已暂停', 'warning')
  } catch (error) {
    console.error('暂停失败:', error)
  }
}

// 恢复执行
const resumeExecution = async () => {
  if (!executionStatus.value) return
  try {
    await choreoApi.resumeExecution(executionStatus.value.executionId)
    addLog('编舞已恢复', 'info')
  } catch (error) {
    console.error('恢复失败:', error)
  }
}

// 停止执行
const stopExecution = async () => {
  if (!executionStatus.value) return
  try {
    await choreoApi.stopExecution(executionStatus.value.executionId)
    executionStatus.value = null
    addLog('编舞已停止', 'warning')
  } catch (error) {
    console.error('停止失败:', error)
  }
}

// 处理 WebSocket 编舞消息
const handleChoreoMessage = (message: ChoreoWSMessage) => {
  switch (message.type) {
    case 'choreo_start':
      addLog(`编舞开始，总时长 ${(message.data.totalDuration / 1000).toFixed(1)}s，机器人 ${message.data.robotIds.length} 台`, 'success')
      break
    case 'choreo_progress':
      if (executionStatus.value) {
        executionStatus.value.currentTime = message.data.currentTime
        executionStatus.value.progress = message.data.progress
        // 驱动时间轴竖线（currentTime 单位：秒）
        timelineEditorRef.value?.setCurrentTime(message.data.currentTime / 1000)
      }
      break
    case 'choreo_action':
      addLog(`[${message.data.robotId}] 执行动作: ${message.data.action}`, 'info')
      break
    case 'choreo_stop':
      executionStatus.value = null
      addLog(`编舞已停止: ${message.data.message || message.data.reason}`, 'warning')
      break
    case 'choreo_complete':
      executionStatus.value = null
      addLog(`编舞执行完成，总时长 ${(message.data.totalDuration / 1000).toFixed(1)}s`, 'success')
      ElMessage.success('编舞执行完成')
      break
    case 'choreo_error':
      executionStatus.value = null
      addLog(`编舞执行错误: ${message.data.message}`, 'error')
      ElMessage.error(`执行错误: ${message.data.message}`)
      break
  }
}

// WebSocket 消息监听
const { onMessage, connect: wsConnect, disconnect: wsDisconnect } = useWebSocket()

const setupWSListener = () => {
  onMessage((message: any) => {
    if (typeof message.type === 'string' && message.type.startsWith('choreo_')) {
      handleChoreoMessage(message as ChoreoWSMessage)
    }
  })
  wsConnect().catch((e) => console.warn('编舞 WS 连接失败:', e))
}

const cleanupWSListener = () => {
  wsDisconnect()
}

// 拖拽处理函数
const startResizeLeft = (e: MouseEvent) => {
  e.preventDefault()
  isResizing.value = true
  resizeType.value = 'left'
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

const startResizeRight = (e: MouseEvent) => {
  e.preventDefault()
  isResizing.value = true
  resizeType.value = 'right'
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

const startResizeBottom = (e: MouseEvent) => {
  e.preventDefault()
  isResizing.value = true
  resizeType.value = 'bottom'
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return

  if (resizeType.value === 'left') {
    const newWidth = e.clientX - 48 // 减去活动栏宽度
    leftPanelWidth.value = Math.max(200, Math.min(500, newWidth))
  } else if (resizeType.value === 'right') {
    const newWidth = window.innerWidth - e.clientX
    rightPanelWidth.value = Math.max(200, Math.min(600, newWidth))
  } else if (resizeType.value === 'bottom') {
    const container = document.querySelector('.center-content')
    if (container) {
      const rect = container.getBoundingClientRect()
      const newHeight = rect.bottom - e.clientY
      bottomPanelHeight.value = Math.max(100, Math.min(400, newHeight))
    }
  }
}

const stopResize = () => {
  isResizing.value = false
  resizeType.value = null
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// 日志函数
const addLog = (message: string, type: LogItem['type'] = 'info') => {
  const now = new Date()
  const time = now.toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.push({ time, message, type })

  // 自动滚动到底部
  setTimeout(() => {
    if (logsContainerRef.value) {
      logsContainerRef.value.scrollTop = logsContainerRef.value.scrollHeight
    }
  }, 0)
}

const clearLogs = () => {
  logs.value = []
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    // 加载项目信息
    const projectRes = await choreoApi.getProject(projectUuid)
    if (projectRes.success) {
      project.value = projectRes.data
    }

    // 加载项目机器人
    const robotsRes = await choreoApi.getProjectRobots(projectUuid)
    if (robotsRes.success) {
      projectRobots.value = robotsRes.data
    }

    // 加载时间轴
    const timelineRes = await choreoApi.getTimeline(projectUuid)
    if (timelineRes.success && timelineRes.data) {
      tracks.value = timelineRes.data.tracks || []
      Object.assign(config, timelineRes.data.config)

      // 等待组件挂载后加载数据
      setTimeout(() => {
        if (timelineEditorRef.value) {
          timelineEditorRef.value.loadTimelineData({
            tracks: timelineRes.data.tracks || [],
            config: timelineRes.data.config,
          })
        }
      }, 100)
    }

    // 加载所有机器人
    const allRobotsRes = await getRobotList()
    if (allRobotsRes.success) {
      allRobots.value = allRobotsRes.data.robots || []
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  setupWSListener()
  addLog('编舞编辑器已加载', 'info')
})

onUnmounted(() => {
  cleanupWSListener()
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.choreo-editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
}

.editor-toolbar {
  height: 48px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.project-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.menu-item {
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 2px;
  color: var(--el-text-color-regular);
  border-radius: 4px;
}

.menu-item:hover {
  background: var(--el-fill-color-light);
}

.panel-toggles {
  margin-right: 8px;
}

.editor-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 活动栏 */
.activity-bar {
  width: 48px;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px 0;
}

.activity-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.activity-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.activity-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  transition: all 0.2s;
}

.activity-icon:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.activity-icon.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

/* 侧面板 */
.side-panel {
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-panel {
  border-right: none;
  border-left: 1px solid var(--el-border-color-lighter);
}

.panel-header {
  padding: 12px 16px;
  font-weight: 500;
  font-size: 13px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.panel-content {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

/* 机器人列表 */
.robot-list {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.robot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 4px;
}

.robot-item:hover {
  background: var(--el-fill-color-light);
}

.robot-item.selected {
  background: var(--el-color-primary-light-9);
}

.robot-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #909399;
}

.robot-status.online {
  background: #67c23a;
}

.robot-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 动作列表面板 */
.actions-panel {
  flex: 1;
  overflow: hidden;
}

/* 历史记录面板 */
.history-panel {
  flex: 1;
  overflow: hidden;
}

/* 时间轴区域 */
.timeline-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 预览内容 */
.preview-content {
  flex: 1;
  overflow: hidden;
}

/* 中间内容区域 */
.center-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 拖拽条样式 */
.vertical-resizer {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  position: relative;
}

.vertical-resizer::after {
  content: '';
  position: absolute;
  left: 1px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--el-border-color);
  opacity: 0.4;
}

.vertical-resizer:hover::after {
  opacity: 0.8;
}

.horizontal-resizer {
  height: 4px;
  cursor: row-resize;
  background: transparent;
  position: relative;
  flex-shrink: 0;
}

.horizontal-resizer::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 1px;
  height: 2px;
  background: var(--el-border-color);
  opacity: 0.4;
}

.horizontal-resizer:hover::after {
  opacity: 0.8;
}

/* 底部面板 */
.bottom-panel {
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 15px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  background: var(--el-bg-color-page);
}

.log-item {
  padding: 2px 0;
  display: flex;
  gap: 12px;
}

.log-time {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.log-message {
  color: var(--el-text-color-primary);
}

.log-item.success .log-message {
  color: var(--el-color-success);
}

.log-item.warning .log-message {
  color: var(--el-color-warning);
}

.log-item.error .log-message {
  color: var(--el-color-danger);
}

.no-logs {
  color: var(--el-text-color-secondary);
  text-align: center;
  padding: 20px;
}

/* 状态栏 */
.status-bar {
  height: 22px;
  background: #007acc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  flex-shrink: 0;
  font-size: 12px;
  color: #ffffff;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-item .el-icon {
  font-size: 14px;
}

.execution-progress {
  font-size: 12px;
  color: var(--el-color-primary);
  font-weight: bold;
  margin-left: 4px;
}
</style>
