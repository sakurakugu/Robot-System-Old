/**
 * useWebSocket
 *
 * Web UI 端连接后端服务器的 WebSocket composable。
 *
 * 连接路径（均携带 ?robotId={uuid}&role=ui）：
 *   业务通道  /api/v1/web/business  —— AI 对话、TTS、动作指令、摇杆控制指令
 *   音频上传  /api/v1/web/audio/upload
 *   音频下载  /api/v1/web/audio/download
 *
 * 服务器地址解析优先级：
 *   1. 后端 /api/v1/config/ui 返回的 serverUrl（可在设置页面修改）
 *   2. localStorage 缓存
 *   3. 当前页面同源地址
 *
 * WebSocket 路径自动派生，不再支持手改
 */

import { getUIConfig } from '@/modules/settings/api'
import { v7 as uuidv7 } from 'uuid'
import { ref } from 'vue'

const CONNECT_TIMEOUT_MS = 8000
const LS_SERVER_KEY = 'rc_server_url'

type MessageHandler = (data: any) => void

interface UIConfig {
  serverUrl: string
}

// 模块级共享状态，确保不同组件拿到同一套连接与状态
const wsBusiness = ref<WebSocket | null>(null)
const wsAudioUpload = ref<WebSocket | null>(null)
const wsAudioDownload = ref<WebSocket | null>(null)

const isConnected = ref(false)
const isAudioUploadConnected = ref(false)
const isAudioDownloadConnected = ref(false)

const robotId = ref('')
const messageHandlers: MessageHandler[] = []

/** 将 http/https/ws/wss 或纯 host 地址统一转为 ws:// 或 wss:// 前缀 */
function toWsOrigin(server: string): string {
  if (!server.trim()) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}`
  }
  if (/^wss?:\/\//i.test(server)) return server.replace(/\/$/, '')
  if (/^https?:\/\//i.test(server)) {
    const u = new URL(server)
    return `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${server.replace(/\/$/, '')}`
}

function buildWsUrl(server: string, path: string, robotId: string): string {
  const token = encodeURIComponent(localStorage.getItem('auth_token') || '')
  return `${toWsOrigin(server)}${path}?robotId=${robotId}&role=ui&token=${token}`
}

/** 从后端拉取 UI 配置（serverUrl 可在设置页面修改） */
async function fetchUIConfig(): Promise<UIConfig> {
  try {
    const res = await getUIConfig()
    if (res?.data) {
      const data = res.data
      if (data.serverUrl) {
        localStorage.setItem(LS_SERVER_KEY, data.serverUrl)
      }
      return data
    }
  } catch { /* 忽略，使用缓存或同源 */ }
  const serverUrl = localStorage.getItem(LS_SERVER_KEY) || ''
  return { serverUrl }
}

/**
 * 建立单个 WebSocket 连接，连接超时会 reject；
 * 成功后不处理重连（业务层决定是否重连）。
 */
function connectSocket(
  url: string,
  onMsg: (data: any) => void,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let settled = false
    const ws = new WebSocket(url)

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        ws.close()
        reject(new Error(`连接超时: ${url}`))
      }
    }, CONNECT_TIMEOUT_MS)

    ws.onopen = () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(ws)
      }
    }
    ws.onmessage = (event) => {
      try { onMsg(JSON.parse(event.data)) } catch { /* 忽略 */ }
    }
    ws.onerror = () => { /* 等待 onclose */ }
    ws.onclose = () => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(new Error(`连接关闭: ${url}`))
      }
    }
  })
}

export function useWebSocket() {
  const dispatchMessage = (data: any) => messageHandlers.forEach(h => h(data))

  const onMessage = (handler: MessageHandler) => {
    if (!messageHandlers.includes(handler)) {
      messageHandlers.push(handler)
    }
  }

  const closeSocket = (wsRef: { value: WebSocket | null }, connRef: { value: boolean }) => {
    if (wsRef.value) { wsRef.value.onclose = null; wsRef.value.close(); wsRef.value = null }
    connRef.value = false
  }

  const disconnect = () => {
    closeSocket(wsBusiness,      isConnected)
    closeSocket(wsAudioUpload,   isAudioUploadConnected)
    closeSocket(wsAudioDownload, isAudioDownloadConnected)
  }

  const connect = async (): Promise<void> => {
    if (!robotId.value) robotId.value = uuidv7()

    const config = await fetchUIConfig()
    const server = config.serverUrl

    // 业务通道：使用后端返回的 wsBusinessUrl（已自动派生）
    // 注意：已移除 webWsBusinessUrl 手改支持
    const businessPath = '/api/v1/web/business'
    const bizUrl = buildWsUrl(server, businessPath, robotId.value)
    wsBusiness.value = await connectSocket(bizUrl, dispatchMessage)
    wsBusiness.value.onclose = () => { isConnected.value = false; wsBusiness.value = null }
    isConnected.value = true

    // 音频通道
    const upPath = '/api/v1/web/audio/upload'
    const upUrl = buildWsUrl(server, upPath, robotId.value)
    connectSocket(upUrl, () => {}) // 上传不需要收消息
      .then(ws => {
        wsAudioUpload.value = ws
        isAudioUploadConnected.value = true
        ws.onclose = () => {
          isAudioUploadConnected.value = false
          wsAudioUpload.value = null
        }
      })
      .catch(() => console.error('音频上传通道连接失败'))

    const downPath = '/api/v1/web/audio/download'
    const downUrl = buildWsUrl(server, downPath, robotId.value)
    connectSocket(downUrl, dispatchMessage)
      .then(ws => {
        wsAudioDownload.value = ws
        isAudioDownloadConnected.value = true
        ws.onclose = () => {
          isAudioDownloadConnected.value = false
          wsAudioDownload.value = null
        }
      })
      .catch(() => console.error('音频下载通道连接失败'))
  }

  // ── 发送方法 ──────────────────────────────────────────────

  const sendOnBusiness = (message: any) => {
    if (!wsBusiness.value || !isConnected.value) { console.error('业务通道未连接'); return }
    wsBusiness.value.send(JSON.stringify(message))
  }

  const sendText = (text: string) =>
    sendOnBusiness({ type: 'text_input', robotId: robotId.value, timestamp: Date.now(), data: { text } })

  const sendTextWithTTS = (text: string, ttsOptions: any) =>
    sendOnBusiness({ type: 'text_input', robotId: robotId.value, timestamp: Date.now(), data: { text, ttsOptions } })

  const sendTTS = (text: string, ttsOptions: any) =>
    sendOnBusiness({ type: 'tts_input', robotId: robotId.value, timestamp: Date.now(), data: { text, ttsOptions } })

  const sendMessage = (message: any) => {
    const type = message?.type
    if (type === 'audio_chunk' || type === 'audio_start' || type === 'audio_end') {
      if (!wsAudioUpload.value || !isAudioUploadConnected.value) { console.error('音频上传通道未连接'); return }
      wsAudioUpload.value.send(JSON.stringify(message))
      return
    }
    sendOnBusiness(message)
  }

  return {
    // 状态
    isConnected,
    isAudioUploadConnected,
    isAudioDownloadConnected,
    robotId,
    // 方法
    connect,
    disconnect,
    sendText,
    sendTextWithTTS,
    sendTTS,
    sendMessage,
    onMessage,
  }
}
