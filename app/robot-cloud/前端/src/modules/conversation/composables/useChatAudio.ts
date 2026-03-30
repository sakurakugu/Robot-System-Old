import { buildAudioUrl, type ChatMessage } from '@/modules/conversation/chat'
import { ElMessage } from 'element-plus'
import { onUnmounted, ref, type Ref } from 'vue'

type TTSOptions = {
  voice: string
  speed: number
  pitch: number
  volume: number
}

type AudioResponsePayload = {
  buffer?: string
  format?: string
  duration?: number
}

type UseChatAudioOptions = {
  messages: Ref<ChatMessage[]>
  isConnected: Ref<boolean>
  sendTTS: (text: string, ttsOptions: TTSOptions) => void
  getTTSOptions: () => TTSOptions
}

export function useChatAudio(options: UseChatAudioOptions) {
  const { messages, isConnected, sendTTS, getTTSOptions } = options
  const pendingTTS = ref<string[]>([])
  const playRequestId = ref<string | null>(null)
  const blobAudioUrls = new Set<string>()

  const playAudio = (url: string) => {
    const audio = new Audio(url)
    void audio.play().catch(() => undefined)
  }

  const rememberBlobUrl = (url: string) => {
    if (url.startsWith('blob:')) {
      blobAudioUrls.add(url)
    }
  }

  const requestTTS = (messageId: string, text: string, autoPlay = false) => {
    pendingTTS.value.push(messageId)
    if (autoPlay) {
      playRequestId.value = messageId
    }
    sendTTS(text, getTTSOptions())
  }

  const assignAudioToMessage = (url: string, duration: number) => {
    const nextId = pendingTTS.value.shift() || null
    if (nextId) {
      const message = messages.value.find((item) => item.id === nextId)
      if (message && !message.audioUrl) {
        message.audioUrl = url
        message.audioDuration = duration
        return message.id
      }
    }

    for (let i = messages.value.length - 1; i >= 0; i -= 1) {
      const message = messages.value[i]
      if (!message.audioUrl) {
        message.audioUrl = url
        message.audioDuration = duration
        return message.id
      }
    }

    return null
  }

  const handleAudioResponse = (payload: AudioResponsePayload) => {
    const url = buildAudioUrl(payload.buffer || '', payload.format || 'opus')
    rememberBlobUrl(url)
    const assignedId = assignAudioToMessage(url, payload.duration || 0)

    if (assignedId && playRequestId.value === assignedId) {
      playRequestId.value = null
      playAudio(url)
    }
  }

  const handlePlayClick = (message: ChatMessage) => {
    if (message.audioUrl) {
      playAudio(message.audioUrl)
      return
    }

    if (!isConnected.value) {
      ElMessage.warning('未连接，无法生成语音')
      return
    }

    requestTTS(message.id, message.text, true)
  }

  onUnmounted(() => {
    for (const url of blobAudioUrls) {
      URL.revokeObjectURL(url)
    }
    blobAudioUrls.clear()
  })

  return {
    handleAudioResponse,
    handlePlayClick,
    requestTTS,
  }
}
