<template>
  <div class="project-editor">
    <el-container>
      <!-- 顶部工具栏 -->
      <el-header class="toolbar">
        <div class="toolbar-left">
          <el-button @click="goBack" circle>
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <h2>{{ projectName }}</h2>
        </div>
        <div class="toolbar-center">
          <!-- 时间显示已移到TimelineEditor中 -->
        </div>
        <div class="toolbar-right">
          <el-button>导出</el-button>
          <el-button type="primary" @click="saveProject">保存</el-button>
        </div>
      </el-header>

      <el-container>
        <!-- 左侧机器人列表 -->
        <el-aside width="250px" class="robot-list-panel">
          <div class="panel-header">
            <h3>机器人列表</h3>
            <div class="header-actions">
              <el-button size="small" @click="goToRobotManager">
                <el-icon><Setting /></el-icon>
              </el-button>
              <el-button size="small" @click="showAddRobotDialog = true">
                <el-icon><Plus /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="robot-list">
            <div
              v-for="robot in robots"
              :key="robot.uuid"
              class="robot-item"
              :class="{ active: selectedRobot === robot.uuid }"
              @click="selectRobot(robot.uuid)"
            >
              <div class="robot-status" :class="robot.status"></div>
              <span class="robot-name">{{ robot.name }}</span>
            </div>
            <el-empty v-if="robots.length === 0" description="暂无机器人" />
          </div>
        </el-aside>

        <!-- 中间时间轴编辑区 -->
        <el-main class="timeline-editor">
          <div class="timeline-container">
            <TimelineEditor
              ref="timelineEditorRef"
              :duration="totalDuration"
              :projectUuid="projectUuid"
              @update:currentTime="updateCurrentTime"
              @update:tracks="updateTracks"
            />
          </div>

          <!-- 底部日志 -->
          <div class="logs-panel">
            <div class="panel-header">
              <h3>日志</h3>
              <el-button size="small" @click="clearLogs">清除</el-button>
            </div>
            <div class="logs-content">
              <div v-for="(log, index) in logs" :key="index" class="log-item">
                {{ log }}
              </div>
              <p v-if="logs.length === 0" class="empty-logs">暂无日志</p>
            </div>
          </div>
        </el-main>

        <!-- 右侧预览面板 -->
        <el-aside width="300px" class="preview-panel">
          <div class="panel-header">
            <h3>实时预览</h3>
          </div>
          <div class="preview-content">
            <div class="preview-placeholder">
              <el-icon style="font-size: 64px"><Monitor /></el-icon>
              <p>机器人状态预览</p>
            </div>
          </div>
        </el-aside>
      </el-container>
    </el-container>

    <!-- 添加机器人对话框 -->
    <el-dialog v-model="showAddRobotDialog" title="添加机器人" width="500px">
      <el-form :model="newRobot" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="newRobot.name" placeholder="例如: 131" />
        </el-form-item>
        <el-form-item label="机器人IP" required>
          <el-input v-model="newRobot.robot_ip" placeholder="例如: 192.168.0.2" />
        </el-form-item>
        <el-form-item label="本地IP" required>
          <el-input v-model="newRobot.local_ip" placeholder="例如: 192.168.0.214" />
        </el-form-item>
        <el-form-item label="本地端口" required>
          <el-input v-model.number="newRobot.local_port" placeholder="例如: 10131" />
        </el-form-item>
        <el-form-item label="分组">
          <el-input v-model="newRobot.group_name" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddRobotDialog = false">取消</el-button>
        <el-button type="primary" @click="addRobot">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { projectApi } from '@/api/project'
import TimelineEditor from '@/components/timeline/TimelineEditor.vue'
import type { Track } from '@/types/timeline'

const route = useRoute()
const router = useRouter()
const projectUuid = route.params.uuid as string

const projectName = ref('加载中...')
const currentTimeSeconds = ref(0)
const totalDuration = ref(60) // 总时长（秒）
const timelineTracks = ref<Track[]>([])
const timelineEditorRef = ref<InstanceType<typeof TimelineEditor>>()
const robots = ref<any[]>([])
const selectedRobot = ref<string | null>(null)
const logs = ref<string[]>([])
const showAddRobotDialog = ref(false)
const newRobot = ref({
  name: '',
  robot_ip: '',
  local_ip: '',
  local_port: 10000,
  group_name: ''
})

// 更新时间轴当前时间
const updateCurrentTime = (time: number) => {
  currentTimeSeconds.value = time
}

// 更新时间轴轨道
const updateTracks = (tracks: Track[]) => {
  timelineTracks.value = tracks
}

let ws: WebSocket | null = null

const goBack = () => {
  router.push('/')
}

const goToRobotManager = () => {
  router.push(`/project/${projectUuid}/robots`)
}

const selectRobot = (uuid: string) => {
  selectedRobot.value = uuid
}

const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString('zh-CN')
  logs.value.unshift(`[${timestamp}] ${message}`)
  if (logs.value.length > 100) {
    logs.value.pop()
  }
}

const clearLogs = () => {
  logs.value = []
}

const loadProject = async () => {
  try {
    const res = await projectApi.getProject(projectUuid)
    if (res.success) {
      projectName.value = res.data.name
    }
  } catch (error) {
    ElMessage.error('加载项目失败')
    console.error(error)
  }
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
      addLog('时间轴数据已加载')
    }
  } catch (error) {
    console.error('加载时间轴数据失败:', error)
    addLog('加载时间轴数据失败')
  }
}

const saveProject = async () => {
  try {
    if (!timelineEditorRef.value) {
      ElMessage.warning('时间轴未初始化')
      return
    }

    const tracks = timelineEditorRef.value.tracks
    const config = timelineEditorRef.value.config

    const res = await projectApi.saveTimeline(projectUuid, tracks, config)
    if (res.success) {
      ElMessage.success('项目已保存')
      addLog('项目已保存')
    } else {
      ElMessage.error('保存失败')
      addLog('保存失败')
    }
  } catch (error) {
    ElMessage.error('保存项目失败')
    console.error(error)
    addLog('保存项目失败')
  }
}

const loadRobots = async () => {
  try {
    const res = await projectApi.getRobots(projectUuid)
    if (res.success) {
      robots.value = res.data
    }
  } catch (error) {
    console.error('加载机器人列表失败:', error)
  }
}

const addRobot = async () => {
  if (!newRobot.value.name || !newRobot.value.robot_ip || !newRobot.value.local_ip) {
    ElMessage.warning('请填写必填项')
    return
  }

  try {
    const res = await projectApi.addRobot(projectUuid, newRobot.value)
    if (res.success) {
      ElMessage.success('机器人添加成功')
      showAddRobotDialog.value = false
      newRobot.value = {
        name: '',
        robot_ip: '',
        local_ip: '',
        local_port: 10000,
        group_name: ''
      }
      await loadRobots()
    }
  } catch (error) {
    ElMessage.error('添加机器人失败')
    console.error(error)
  }
}

const connectWebSocket = () => {
  const wsUrl = `ws://${window.location.hostname}:3000`
  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    addLog('WebSocket 已连接')
    ws?.send(JSON.stringify({
      type: 'join_project',
      projectUuid
    }))
  }

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      if (message.type === 'robot_log') {
        addLog(message.data.log)
      }
    } catch (error) {
      console.error('WebSocket 消息错误:', error)
    }
  }

  ws.onerror = (error) => {
    addLog('WebSocket 错误')
    console.error('WebSocket 错误:', error)
  }

  ws.onclose = () => {
    addLog('WebSocket 已断开')
  }
}

onMounted(() => {
  loadProject()
  loadRobots()
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
  height: 100vh;
  background: #1e1e1e;
  color: #d4d4d4;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.project-editor :deep(.el-container) {
  height: 100%;
  overflow: hidden;
}

.toolbar {
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.toolbar-left, .toolbar-center, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.toolbar h2 {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}

.time-display {
  font-size: 14px;
  color: #cccccc;
  font-family: monospace;
}

.robot-list-panel,
.preview-panel {
  background: #252526;
  border-right: 1px solid #3c3c3c;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 15px;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 5px;
}

.robot-list {
  padding: 10px;
  flex: 1;
  overflow-y: auto;
}

.robot-item {
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background 0.2s;
}

.robot-item:hover {
  background: #2a2d2e;
}

.robot-item.active {
  background: #094771;
}

.robot-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #666;
}

.robot-status.online {
  background: #4ec9b0;
}

.robot-status.offline {
  background: #666;
}

.robot-status.error {
  background: #f48771;
}

.robot-name {
  font-size: 14px;
}

.timeline-editor {
  background: #1e1e1e;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.timeline-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.logs-panel {
  height: 200px;
  background: #252526;
  border-top: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.logs-content {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-item {
  padding: 2px 0;
  color: #cccccc;
}

.empty-logs {
  color: #666;
  text-align: center;
  margin-top: 20px;
}

.preview-content {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.preview-placeholder {
  background: #1e1e1e;
  border: 2px dashed #3c3c3c;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  color: #666;
}

:deep(.el-aside) {
  overflow: hidden;
}

:deep(.el-button) {
  background: #0e639c;
  border-color: #0e639c;
  color: #fff;
}

:deep(.el-button:hover) {
  background: #1177bb;
  border-color: #1177bb;
}
</style>
