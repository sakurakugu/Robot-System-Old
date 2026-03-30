<template>
  <div class="chatview">
    <section class="content">
      <div
        v-if="visionStatus"
        class="vision-status-banner"
      >
        <el-alert
          :title="visionStatus.message"
          :type="visionStatus.alertType"
          :closable="false"
          show-icon
        />
      </div>
      <div
        ref="chatArea"
        class="chat-area"
      >
        <el-empty
          v-if="messages.length === 0"
          description="还没有对话记录，发送一条消息开始吧！"
          :image-size="120"
        >
          <template #image>
            <el-icon
              :size="80"
              color="#909399"
            >
              <ChatDotSquare />
            </el-icon>
          </template>
        </el-empty>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-wrapper"
          :class="[{ 'align-right': msg.type === 'user' && msg.target === 'ai' }, msg.type]"
        >
          <el-avatar
            :size="36"
            class="message-avatar"
          >
            <el-icon v-if="msg.type === 'user'">
              <User />
            </el-icon>
            <el-icon v-else>
              <Bot />
            </el-icon>
          </el-avatar>
          <div class="message-bubble">
            <div class="message-header">
              <span class="message-sender">{{ msg.type === 'user' ? '用户' : 'AI助手' }}</span>
              <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <div class="message-content">
              {{ msg.text }}
            </div>
            <div
              v-if="msg.imageUrl"
              class="message-image-wrap"
            >
              <img
                :src="msg.imageUrl"
                class="message-image"
                alt="视觉识别图片"
              >
              <div
                v-if="msg.targetPosition"
                class="target-box"
                :style="buildTargetBoxStyle(msg.targetPosition)"
              />
            </div>
            <div
              v-if="msg.actions && msg.actions.length > 0"
              class="message-actions"
            >
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
            <div
              v-if="msg.latency"
              class="message-meta"
            >
              <el-icon><Clock /></el-icon>
              <span>{{ msg.latency }}ms</span>
            </div>
          </div>
          <div
            v-if="msg.sentToRobot !== undefined"
            class="robot-status"
          >
            <div class="robot-tools">
              <el-tooltip
                content="播放语音"
                placement="top"
              >
                <el-button
                  :disabled="!isConnected"
                  size="small"
                  circle
                  @click="handlePlayClick(msg)"
                >
                  <el-icon><Microphone /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
            <el-tag
              v-if="msg.sendingToRobot"
              size="small"
              type="info"
              effect="plain"
            >
              <el-icon class="is-loading">
                <Loading />
              </el-icon>
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
              <el-icon
                size="18"
                color="#E6A23C"
                style="cursor: help;"
              >
                <WarningFilled />
              </el-icon>
            </el-tooltip>
          </div>
        </div>
      </div>

      <div class="input-area">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入消息... (按 Ctrl+Enter 发送给大模型, Shift+Enter 发送给机器狗）"
          resize="none"
          @keydown.ctrl.enter="() => sendMessage('ai')"
          @keydown.shift.enter.prevent="() => sendMessage('robot')"
        />
        <div class="button-group">
          <VoiceRecordButton size="default" />
          <el-button
            type="success"
            :disabled="!isConnected || !inputText.trim()"
            :icon="Bot"
            @click="() => sendMessage('robot')"
          >
            发送给机器狗
          </el-button>
          <el-button
            type="primary"
            :disabled="!isConnected || !inputText.trim()"
            :icon="Promotion"
            @click="() => sendMessage('ai')"
          >
            发送给大模型
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import VoiceRecordButton from '@/components/VoiceRecordButton.vue'
import { getConversationHistory, sendCommand } from '@/modules/conversation/api'
import {
  buildTargetBoxStyle,
  buildVisionImageUrl,
  formatMessageTime as formatTime,
  normalizeConversationHistory,
  parseActionFormat,
  type ChatMessage,
  type VisionStatus,
} from '@/modules/conversation/chat'
import { useChatAudio } from '@/modules/conversation/composables/useChatAudio'
import { useWebSocket } from '@/composables/useWebSocket'
import {
  ChatDotSquare,
  Clock,
  Lightning,
  Loading,
  Microphone,
  Promotion,
  Select,
  User,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const {
  isConnected,
  robotId,
  connect: wsConnect,
  disconnect: wsDisconnect,
  sendTextWithTTS,
  sendTTS,
  sendMessage: wsSendMessage,
  onMessage,
} = useWebSocket()

const route = useRoute()
const props = defineProps<{ robotUuid?: string }>()
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const chatArea = ref<HTMLElement>()
const messageCount = ref(0)
const avgLatency = ref(0)
const visionStatus = ref<VisionStatus | null>(null)

let requestTimestamps = new Map<number, number>()

const ttsVoice = ref('zh-CN-XiaoxiaoNeural')
const ttsSpeed = ref(0)
const ttsPitch = ref(0)
const ttsVolume = ref(0)
// 可用的TTS声音列表（保留供未来使用）
// const voices = [
//   { label: '晓晓(女)', value: 'zh-CN-XiaoxiaoNeural' },
//   { label: '晓伊(女)', value: 'zh-CN-XiaoyiNeural' },
//   { label: '云健(男)', value: 'zh-CN-YunjianNeural' },
//   { label: '云皓(男)', value: 'zh-CN-YunhaoNeural' },
//   { label: '云熙(男)', value: 'zh-CN-YunxiNeural' },
//   { label: '云扬(男)', value: 'zh-CN-YunyangNeural' },
// ]

const getTTSOptions = () => ({
  voice: ttsVoice.value,
  speed: ttsSpeed.value,
  pitch: ttsPitch.value,
  volume: ttsVolume.value,
})

const { handleAudioResponse, handlePlayClick, requestTTS } = useChatAudio({
  messages,
  isConnected,
  sendTTS,
  getTTSOptions,
})

const disconnect = () => {
  wsDisconnect()
}

const resolveRobotUuid = () => {
  return props.robotUuid || (route.params.uuid as string | undefined)
}

const connectToRobot = async (uuid?: string) => {
  if (!uuid) return
  if (isConnected.value && robotId.value === uuid) return
  if (isConnected.value) {
    disconnect()
  }
  robotId.value = uuid
  try {
    await wsConnect()
  } catch {
    try {
      localStorage.removeItem('rc_server_url')
      await wsConnect()
    } catch {
      ElMessage.error('连接失败，请检查后端服务或网络')
    }
  }
}

const sendMessage = (target: 'ai' | 'robot') => {
  if (!inputText.value.trim() || !isConnected.value) return

  const text = inputText.value.trim()
  const timestamp = Date.now()

  const userMessage: ChatMessage = {
    id: `user-${timestamp}`,
    type: 'user',
    target,
    text,
    timestamp,
  }

  // 检查是否是动作格式 {{action=xxx}}
  const actionMatch = parseActionFormat(text)

  if (actionMatch) {
    // 直接发送动作（不生成音频）
    userMessage.sentToRobot = false
    userMessage.sendingToRobot = true
    userMessage.actions = [actionMatch.action]
    messages.value.push(userMessage)

    if (isConnected.value) {
      // 发送动作消息到后端（不发送TTS）
      wsSendMessage({
        type: 'action_input',
        robotId: robotId.value,
        timestamp,
        data: {
          action: actionMatch.action,
          parameters: actionMatch.parameters,
        },
      })

      userMessage.sendingToRobot = false
      userMessage.sentToRobot = true
      ElMessage.success(`已发送动作: ${actionMatch.action}`)
    }

    inputText.value = ''
    scrollToBottom()
    return // 动作格式不继续处理
  } else if (target === 'robot') {
    // 直接发送到机器狗
    userMessage.sentToRobot = false
    userMessage.sendingToRobot = true
    messages.value.push(userMessage)
    if (isConnected.value) {
      requestTTS(userMessage.id, text)
    }

    sendToRobot(text).then(success => {
      userMessage.sendingToRobot = false
      userMessage.sentToRobot = success
    })
  } else {
    // 发送给大模型
    userMessage.sentToRobot = false
    userMessage.sendingToRobot = false
    messages.value.push(userMessage)
    requestTimestamps.set(timestamp, Date.now())
    sendTextWithTTS(text, getTTSOptions())
  }

  inputText.value = ''
  scrollToBottom()
}

const sendToRobot = async (text: string): Promise<boolean> => {
  try {
    if (!robotId.value) {
      return false
    }
    await sendCommand(robotId.value, { text })
    return true
  } catch (error) {
    console.error('发送到机器狗失败:', error)
    return false
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight
  }
}

const removeMessageHandler = onMessage((data) => {
  if (data.type === 'vision_status') {
    const status = data.data?.status as VisionStatus['status']
    const alertTypeMap: Record<VisionStatus['status'], VisionStatus['alertType']> = {
      capturing: 'info',
      analyzing: 'warning',
      done: 'success',
      error: 'error',
    }
    const message = data.data?.message || '视觉识别处理中...'
    visionStatus.value = {
      status,
      message,
      alertType: alertTypeMap[status] || 'info',
    }
    return
  }
  if (data.type === 'asr_transcript') {
    const timestamp = Date.now()
    const asrMessage: ChatMessage = {
      id: `asr-${timestamp}`,
      type: 'user',
      target: 'ai',
      text: data.data?.text || '',
      timestamp,
    }
    messages.value.push(asrMessage)
    scrollToBottom()
    return
  }
  if (data.type === 'text_response') {
    const timestamp = Date.now()
    let latency: number | undefined
    const visionImageBase64 = data.data?.visionImage?.base64
    const visionImageFormat = data.data?.visionImage?.format || 'jpeg'
    const imageUrl = buildVisionImageUrl(visionImageBase64, visionImageFormat)

    const lastRequestTime = Array.from(requestTimestamps.values()).pop()
    if (lastRequestTime) {
      latency = timestamp - lastRequestTime
      const totalLatency = avgLatency.value * messageCount.value + latency
      messageCount.value++
      avgLatency.value = Math.round(totalLatency / messageCount.value)
    }

    const aiMessage: ChatMessage = {
      id: `ai-${timestamp}`,
      type: 'ai',
      text: data.data.text,
      timestamp,
      actions: data.data.actions,
      imageUrl,
      visionImageBase64,
      visionImageFormat,
      targetPosition: data.data?.targetPosition,
      latency,
      sentToRobot: false,
      sendingToRobot: true,
    }

    messages.value.push(aiMessage)
    scrollToBottom()

    aiMessage.sendingToRobot = false
    if (data.data?.vision) {
      visionStatus.value = null
    }

    if (!data.data?.noTTS && !data.data?.ttsDone) {
      const m = messages.value.find(mm => mm.id === aiMessage.id)
      if (m && !m.audioUrl) {
        requestTTS(m.id, m.text)
      }
    }
  } else if (data.type === 'audio_response') {
    try {
      handleAudioResponse(data.data || {})
    } catch (error) {
      console.error('处理音频响应失败:', error)
    }
  } else if (data.type === 'error') {
    if (data.data?.code === 'ASR_ERROR' || String(data.data?.message || '').includes('Opus解码失败')) {
      return
    }
    const timestamp = Date.now()
    const aiMessage: ChatMessage = {
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
})

const loadHistoryMessages = async (uuid?: string) => {
  if (!uuid) {
    messages.value = []
    return
  }

  try {
    const response = await getConversationHistory(uuid, 50, 0)
    messages.value = normalizeConversationHistory(response.data.conversations)
    await scrollToBottom()
  } catch (error) {
    console.error('加载历史对话失败:', error)
  }
}

onMounted(() => {
  const uuid = resolveRobotUuid()
  if (uuid) {
    loadHistoryMessages(uuid)
    connectToRobot(uuid)
  }
})
onUnmounted(() => {
  removeMessageHandler()
  disconnect()
})

watch(
  () => props.robotUuid,
  (val) => {
    if (val) {
      loadHistoryMessages(val)
      connectToRobot(val)
    }
  }
)

watch(
  () => route.params.uuid,
  (val) => {
    const uuid = val as string | undefined
    if (uuid && !props.robotUuid) {
      loadHistoryMessages(uuid)
      connectToRobot(uuid)
    }
  }
)
</script>

<style scoped>
.chatview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
}

.content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
}

.vision-status-banner {
  padding: 12px 24px 0;
}

.chat-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--el-fill-color-lighter);
}

.chat-area::-webkit-scrollbar {
  width: 6px;
}

.chat-area::-webkit-scrollbar-track {
  background: transparent;
}

.chat-area::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.chat-area::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
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
.message-wrapper.align-right .message-bubble {
  order: 2;
}
.message-wrapper.align-right .robot-status {
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
  color: var(--el-text-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.message-wrapper.user .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.message-wrapper.ai .message-bubble {
  background: white;
  color: var(--el-text-color-primary);
}

.message-wrapper.ai .message-header {
  color: var(--el-text-color-secondary);
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

.message-image-wrap {
  margin-top: 10px;
  position: relative;
  display: inline-block;
  overflow: hidden;
  border-radius: 10px;
}

.message-image {
  display: block;
  max-width: 320px;
  max-height: 240px;
  width: 100%;
  object-fit: contain;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color);
}

.target-box {
  position: absolute;
  border: 2px solid #ff3b30;
  box-sizing: border-box;
  pointer-events: none;
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
.message-tools {
  margin-top: 8px;
  display: flex;
  gap: 6px;
}

.input-area {
  border-top: 1px solid var(--el-border-color);
  padding: 20px;
  display: flex;
  gap: 12px;
  background: white;
  flex-shrink: 0;
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
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  align-self: flex-end;
  order: 3;
  margin-bottom: 4px;
}

.robot-status .el-tag :deep(.el-tag__content) {
  display: flex;
  align-items: center;
  gap: 4px;
}

.robot-tools {
  display: flex;
  align-items: center;
  gap: 6px;
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
