<template>
  <div class="chatview">
    <aside class="sidebar">
      <div class="robot-info">
        <h3>机器狗信息</h3>
        <div class="info-item">
          <label>ID:</label>
          <span class="robot-id">{{ robotId }}</span>
        </div>
        <div class="info-item">
          <label>状态:</label>
          <span :class="robotStatus">{{ robotStatus }}</span>
        </div>
      </div>

      <div class="controls">
        <button @click="connect" :disabled="isConnected" class="btn-primary">
          {{ isConnected ? '已连接' : '连接服务器' }}
        </button>
        <button @click="disconnect" :disabled="!isConnected" class="btn-danger">
          断开连接
        </button>
        <button @click="clearHistory" class="btn-secondary">
          清空历史
        </button>
      </div>

      <div class="stats">
        <h3>统计信息</h3>
        <div class="stat-item">
          <label>消息数:</label>
          <span>{{ messageCount }}</span>
        </div>
        <div class="stat-item">
          <label>平均延迟:</label>
          <span>{{ avgLatency }}ms</span>
        </div>
      </div>
    </aside>

    <section class="content">
      <div class="chat-area" ref="chatArea">
        <div v-if="messages.length === 0" class="empty-state">
          <p>还没有对话记录，发送一条消息开始吧！</p>
        </div>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message"
          :class="msg.type"
        >
          <div class="message-header">
            <span class="message-sender">{{ msg.type === 'user' ? '用户' : 'AI' }}</span>
            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="message-content">{{ msg.text }}</div>
          <div v-if="msg.actions && msg.actions.length > 0" class="message-actions">
            <span class="action-label">动作:</span>
            <span
              v-for="action in msg.actions"
              :key="action"
              class="action-badge"
            >
              {{ action }}
            </span>
          </div>
          <div v-if="msg.latency" class="message-meta">
            <span>延迟: {{ msg.latency }}ms</span>
          </div>
        </div>
      </div>

      <div class="input-area">
        <textarea
          v-model="inputText"
          placeholder="输入消息... (按 Ctrl+Enter 发送)"
          @keydown.ctrl.enter="sendMessage"
          rows="3"
        ></textarea>
        <button
          @click="sendMessage"
          :disabled="!isConnected || !inputText.trim()"
          class="btn-send"
        >
          发送
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useWebSocket } from '../composables/useWebSocket'

interface Message {
  id: string
  type: 'user' | 'ai'
  text: string
  timestamp: number
  actions?: string[]
  latency?: number
}

const {
  isConnected,
  robotId,
  connect: wsConnect,
  disconnect: wsDisconnect,
  sendText,
  onMessage,
} = useWebSocket()

const messages = ref<Message[]>([])
const inputText = ref('')
const chatArea = ref<HTMLElement>()
const robotStatus = ref('offline')
const messageCount = ref(0)
const avgLatency = ref(0)

let requestTimestamps = new Map<number, number>()

const connect = async () => {
  await wsConnect()
  robotStatus.value = 'online'
}

const disconnect = () => {
  wsDisconnect()
  robotStatus.value = 'offline'
}

const sendMessage = () => {
  if (!inputText.value.trim() || !isConnected.value) return

  const text = inputText.value.trim()
  const timestamp = Date.now()

  messages.value.push({
    id: `user-${timestamp}`,
    type: 'user',
    text,
    timestamp,
  })

  requestTimestamps.set(timestamp, Date.now())
  sendText(text)
  inputText.value = ''
  scrollToBottom()
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

    messages.value.push({
      id: `ai-${timestamp}`,
      type: 'ai',
      text: data.data.text,
      timestamp,
      actions: data.data.actions,
      latency,
    })

    scrollToBottom()
  }
})

onMounted(() => {})
onUnmounted(() => {
  disconnect()
})
</script>

<style scoped>
.chatview {
  height: 100%;
  display: flex;
  overflow: hidden;
}
.sidebar {
  width: 280px;
  background-color: #2a2a2a;
  border-right: 1px solid #444;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
}
.robot-info h3,
.stats h3 {
  font-size: 1rem;
  margin-bottom: 1rem;
  color: #646cff;
}
.info-item,
.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.info-item label,
.stat-item label {
  color: #999;
}
.robot-id {
  font-family: monospace;
  font-size: 0.75rem;
  color: #64b5f6;
  word-break: break-all;
}
.controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.btn-primary,
.btn-secondary,
.btn-danger {
  width: 100%;
  padding: 0.7rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}
.btn-primary {
  background-color: #646cff;
  color: white;
}
.btn-primary:hover:not(:disabled) {
  background-color: #535bf2;
}
.btn-secondary {
  background-color: #555;
  color: white;
}
.btn-secondary:hover {
  background-color: #666;
}
.btn-danger {
  background-color: #f44336;
  color: white;
}
.btn-danger:hover:not(:disabled) {
  background-color: #d32f2f;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 1.1rem;
}
.message {
  max-width: 70%;
  padding: 1rem;
  border-radius: 12px;
  animation: fadeIn 0.3s ease-in-out;
}
.message.user {
  align-self: flex-end;
  background-color: #646cff;
  color: white;
}
.message.ai {
  align-self: flex-start;
  background-color: #2a2a2a;
  border: 1px solid #444;
}
.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}
.message-sender {
  font-weight: 600;
}
.message-time {
  opacity: 0.7;
}
.message-content {
  line-height: 1.5;
  word-wrap: break-word;
}
.message-actions {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.action-label {
  font-size: 0.85rem;
  opacity: 0.7;
}
.action-badge {
  background-color: rgba(100, 108, 255, 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-family: monospace;
}
.message-meta {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.6;
}
.input-area {
  border-top: 1px solid #444;
  padding: 1rem 1.5rem;
  display: flex;
  gap: 1rem;
  background-color: #2a2a2a;
}
.input-area textarea {
  flex: 1;
  resize: none;
  font-family: inherit;
}
.btn-send {
  padding: 0.7rem 2rem;
  background-color: #646cff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}
.btn-send:hover:not(:disabled) {
  background-color: #535bf2;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-color-scheme: light) {
  .sidebar,
  .input-area {
    background-color: #ffffff;
    border-color: #e0e0e0;
  }
  .message.ai {
    background-color: #ffffff;
    border-color: #e0e0e0;
  }
}
</style>
