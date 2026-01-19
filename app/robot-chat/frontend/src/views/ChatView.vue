<template>
  <div class="chatview">
    <el-aside width="320px" class="sidebar">
      <el-card shadow="never" class="selector-card">
        <template #header>
          <div class="card-header">
            <el-icon><Bot /></el-icon>
            <span>选择机器人</span>
          </div>
        </template>
        <el-select
          v-model="selectedUuid"
          placeholder="搜索并选择机器人"
          filterable
          style="width: 100%; margin-bottom: 12px"
        >
          <el-option
            v-for="r in robots"
            :key="r.uuid"
            :label="r.name || r.uuid"
            :value="r.uuid"
          >
            <div class="robot-option">
              <span>{{ r.name || '未命名' }}</span>
              <span class="robot-uuid">{{ r.uuid.substring(0, 8) }}</span>
            </div>
          </el-option>
        </el-select>
        <el-button
          type="primary"
          @click="handleConnectionClick"
          :disabled="!selectedUuid"
          :loading="isConnecting"
          style="width: 100%; position: relative;"
        >
          <span>{{ connectionButtonText }}</span>
          <el-icon v-if="isRobotConnected" style="position: absolute; right: 12px; color: #67C23A;">
            <SuccessFilled />
          </el-icon>
        </el-button>
      </el-card>

      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <el-icon><InfoFilled /></el-icon>
            <span>机器狗信息</span>
          </div>
        </template>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="ID">
            <el-text type="info" size="small" class="robot-id">{{ robotId }}</el-text>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="robotStatus === 'online' ? 'success' : 'info'" size="small">
              {{ robotStatus === 'online' ? '在线' : '离线' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="controls-card">
        <template #header>
          <div class="card-header">
            <el-icon><Connection /></el-icon>
            <span>连接控制</span>
          </div>
        </template>
        <el-space direction="vertical" style="width: 100%" :size="10">

          <el-button
            @click="clearHistory"
            :icon="Delete"
            style="width: 100%"
          >
            清空历史
          </el-button>
        </el-space>
      </el-card>

      <el-card shadow="never" class="stats-card">
        <template #header>
          <div class="card-header">
            <el-icon><DataAnalysis /></el-icon>
            <span>统计信息</span>
          </div>
        </template>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="消息数">
            <el-text type="primary">{{ messageCount }}</el-text>
          </el-descriptions-item>
          <el-descriptions-item label="平均延迟">
            <el-text type="warning">{{ avgLatency }}ms</el-text>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </el-aside>

    <section class="content">
      <div class="chat-area" ref="chatArea">
        <el-empty
          v-if="messages.length === 0"
          description="还没有对话记录，发送一条消息开始吧！"
          :image-size="120"
        >
          <template #image>
            <el-icon :size="80" color="#909399"><ChatDotSquare /></el-icon>
          </template>
        </el-empty>
        
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-wrapper"
          :class="[{ 'align-right': msg.type === 'user' && msg.target === 'ai' }, msg.type]"
        >
          <el-avatar :size="36" class="message-avatar">
            <el-icon v-if="msg.type === 'user'"><User /></el-icon>
            <el-icon v-else><Bot /></el-icon>
          </el-avatar>
          <div class="message-bubble">
            <div class="message-header">
              <span class="message-sender">{{ msg.type === 'user' ? '用户' : 'AI助手' }}</span>
              <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <div class="message-content">{{ msg.text }}</div>
            <div v-if="msg.actions && msg.actions.length > 0" class="message-actions">
              <el-icon><Lightning /></el-icon>
              <el-tag
                v-for="action in msg.actions"
                :key="action"
                size="small"
                type="success"
                effect="plain"
              >
                {{ action }}
              </el-tag>
            </div>
            <div v-if="msg.latency" class="message-meta">
              <el-icon><Clock /></el-icon>
              <span>{{ msg.latency }}ms</span>
            </div>
          </div>
          <div v-if="msg.sentToRobot !== undefined" class="robot-status">
            <el-tag
              v-if="msg.sendingToRobot"
              size="small"
              type="info"
              effect="plain"
            >
              <el-icon class="is-loading"><Loading /></el-icon>
              发送中...
            </el-tag>
            <el-tag
              v-else-if="msg.sentToRobot"
              size="small"
              type="success"
              effect="plain"
            >
              <el-icon><Select /></el-icon>
              已发送到机器狗
            </el-tag>
            <el-tooltip
              v-else
              content="未发送到机器狗"
              placement="top"
            >
              <el-icon size="18" color="#E6A23C" style="cursor: help;"><WarningFilled /></el-icon>
            </el-tooltip>
          </div>
        </div>
      </div>

      <div class="input-area">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入消息... (按 Ctrl+Enter 发送给大模型, Shift+Enter 发送给机器狗)"
          @keydown.ctrl.enter="() => sendMessage('ai')"
          @keydown.shift.enter.prevent="() => sendMessage('robot')"
          resize="none"
        />
        <div class="button-group">
          <el-button
            type="success"
            @click="() => sendMessage('robot')"
            :disabled="!isConnected || !inputText.trim()"
            :icon="Bot"
          >
            发送给机器狗
          </el-button>
          <el-button
            type="primary"
            @click="() => sendMessage('ai')"
            :disabled="!isConnected || !inputText.trim()"
            :icon="Promotion"
          >
            发送给大模型
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  ChatDotSquare,
  Clock,
  Connection,
  DataAnalysis,
  Delete,
  InfoFilled,
  Lightning,
  Loading,
  Promotion,
  Select,
  SuccessFilled,
  User,
  WarningFilled
} from '@element-plus/icons-vue'
import { Bot } from 'lucide-vue-next'
import { nextTick, onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useWebSocket } from '../composables/useWebSocket'
import { ElMessage } from 'element-plus'

type Message = {
  id: string
  type: 'user' | 'ai'
  target?: 'ai' | 'robot'
  text: string
  timestamp: number
  actions?: string[]
  latency?: number
  sentToRobot?: boolean
  sendingToRobot?: boolean
}

const {
  isConnected,
  robotId,
  connect: wsConnect,
  disconnect: wsDisconnect,
  sendText,
  onMessage,
} = useWebSocket()

const route = useRoute()
const messages = ref<Message[]>([])
const inputText = ref('')
const chatArea = ref<HTMLElement>()
const robotStatus = ref('offline')
const messageCount = ref(0)
const avgLatency = ref(0)

let requestTimestamps = new Map<number, number>()

type RobotItem = { uuid: string; name?: string; status?: string }
const robots = ref<RobotItem[]>([])
const selectedUuid = ref<string>('')
const isConnecting = ref(false)



const disconnect = () => {
  wsDisconnect()
}

const isRobotConnected = computed(() => {
  return isConnected.value && selectedUuid.value === robotId.value
})

const connectionButtonText = computed(() => {
  if (isConnected.value) {
    if (selectedUuid.value === robotId.value) {
      return '断开该连接'
    }
    return '断开并连接'
  }
  return '连接机器狗'
})

const handleConnectionClick = async () => {
  if (!selectedUuid.value) return

  isConnecting.value = true
  try {
    if (isConnected.value) {
      if (selectedUuid.value === robotId.value) {
        disconnect()
        robotStatus.value = 'offline'
        ElMessage.success('已断开连接')
        return
      }
      disconnect()
      robotStatus.value = 'offline'
    }

  // Connect to the selected robot
  robotId.value = selectedUuid.value
    await wsConnect()
    robotStatus.value = 'online'
    ElMessage.success('连接成功')
  } catch (e) {
    ElMessage.error('连接失败，请检查后端服务或网络')
  } finally {
    isConnecting.value = false
  }
}

const sendMessage = (target: 'ai' | 'robot') => {
  if (!inputText.value.trim() || !isConnected.value) return

  const text = inputText.value.trim()
  const timestamp = Date.now()

  const userMessage: Message = {
    id: `user-${timestamp}`,
    type: 'user',
    target,
    text,
    timestamp,
  }

  if (target === 'robot') {
    // 直接发送到机器狗
    userMessage.sentToRobot = false
    userMessage.sendingToRobot = true
    messages.value.push(userMessage)
    
    sendToRobot(text).then(success => {
      userMessage.sendingToRobot = false
      userMessage.sentToRobot = success
    })
  } else {
    // 发送给大模型
    messages.value.push(userMessage)
    requestTimestamps.set(timestamp, Date.now())
    sendText(text)
  }

  inputText.value = ''
  scrollToBottom()
}

const sendToRobot = async (text: string): Promise<boolean> => {
  try {
    // 这里需要调用实际的机器狗API
    // 假设有一个发送到机器狗的接口
    const response = await fetch(`/api/robot/${robotId.value}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
    return response.ok
  } catch (error) {
    console.error('发送到机器狗失败:', error)
    return false
  }
}

const clearHistory = () => {
  messages.value = []
  messageCount.value = 0
  avgLatency.value = 0
  requestTimestamps.clear()
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight
  }
}

onMessage((data) => {
  if (data.type === 'text_response') {
    const timestamp = Date.now()
    let latency: number | undefined

    const lastRequestTime = Array.from(requestTimestamps.values()).pop()
    if (lastRequestTime) {
      latency = timestamp - lastRequestTime
      const totalLatency = avgLatency.value * messageCount.value + latency
      messageCount.value++
      avgLatency.value = Math.round(totalLatency / messageCount.value)
    }

    const aiMessage: Message = {
      id: `ai-${timestamp}`,
      type: 'ai',
      text: data.data.text,
      timestamp,
      actions: data.data.actions,
      latency,
      sentToRobot: false,
      sendingToRobot: true,
    }

    messages.value.push(aiMessage)
    scrollToBottom()

    // 不自动转发到机器狗，避免重复
    aiMessage.sendingToRobot = false
  } else if (data.type === 'error') {
    const timestamp = Date.now()
    const aiMessage: Message = {
      id: `ai-${timestamp}`,
      type: 'ai',
      text: `发生错误：${data.data?.message || '未知错误'}`,
      timestamp,
      actions: [],
      sentToRobot: false,
      sendingToRobot: false,
    }
    messages.value.push(aiMessage)
    scrollToBottom()
  }
});

onMounted(() => {
  const uuid = route.params.uuid as string | undefined
  if (uuid) {
    robotId.value = uuid
    selectedUuid.value = uuid
  }
  fetch('/api/robots')
    .then(res => res.json())
    .then(json => {
      const list: any[] = json?.data?.robots || []
      robots.value = list.map((r) => ({ uuid: r.uuid, name: r.name || '', status: r.status || 'offline' }))
      const cur = robots.value.find(r => r.uuid === (selectedUuid.value || robotId.value))
      robotStatus.value = cur?.status || 'offline'
    })
    .catch(() => {})
})
onUnmounted(() => {
  disconnect()
})

watch(selectedUuid, (val) => {
  const cur = robots.value.find(r => r.uuid === val)
  robotStatus.value = cur?.status || 'offline'
})
</script>

<style scoped>
.chatview {
  height: 100%;
  display: flex;
  overflow: hidden;
  gap: 1px;
  background: var(--el-border-color-lighter);
}

.sidebar {
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  overflow-y: auto;
}
.sidebar :deep(.el-card),
.sidebar :deep(.el-card__body),
.sidebar :deep(.el-card__header),
.sidebar :deep(.el-descriptions),
.sidebar :deep(.el-space) {
  overflow: visible;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.robot-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.robot-uuid {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.robot-id {
  font-family: monospace;
  word-break: break-all;
}

.selector-card,
.info-card,
.controls-card,
.stats-card {
  margin-bottom: 0;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
}

.chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--el-fill-color-lighter);
}

.message-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  animation: slideIn 0.3s ease-out;
}

.message-wrapper .message-avatar {
  order: 1;
}
.message-wrapper .message-bubble {
  order: 2;
}

.message-wrapper.align-right .message-avatar {
  order: 1;
}
.message-wrapper.align-right .robot-status {
  order: 2;
}
.message-wrapper.align-right .message-bubble {
  order: 3;
}

.message-wrapper.align-right {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.message-wrapper.user .message-avatar {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.message-wrapper.user .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  opacity: 0.8;
}

.message-sender {
  font-weight: 600;
}

.message-content {
  line-height: 1.6;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.message-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.message-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  opacity: 0.6;
}

.input-area {
  border-top: 1px solid var(--el-border-color);
  padding: 20px;
  display: flex;
  gap: 12px;
  background: white;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 130px;
}

.button-group .el-button {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.input-area :deep(.el-textarea__inner) {
  font-family: inherit;
}

.robot-status {
  display: flex;
  align-items: center;
  gap: 4px;
  align-self: flex-end;
  order: 3;
  margin-bottom: 4px;
}

.robot-status .el-tag :deep(.el-tag__content) {
  display: flex;
  align-items: center;
  gap: 4px;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
