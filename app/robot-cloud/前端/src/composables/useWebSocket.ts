/**
 * useWebSocket
 *
 * Web UI 端连接后端服务器的 WebSocket composable。
 *
 * 连接路径（均携带 ?robotId={uuid}&role=ui）：
 *   业务通道  /api/v1/interaction/connect/business  —— AI 对话、TTS、动作指令、摇杆控制指令
 *   音频上传  /api/v1/interaction/connect/audio_upload
 *   音频下载  /api/v1/interaction/connect/audio_download
 *
 * 服务器地址解析优先级：
 *   1. 后端 /api/v1/config/ui 返回的 serverUrl（可在设置页面修改）
 *   2. localStorage 缓存
 *   3. 当前页面同源地址
 */

import { v7 as uuidv7 } from 'uuid'
import { ref } from 'vue'

// WebSocket 通道路径（与后端 server.ts 中的 basePath 一致）
const WS_PATHS = {
  business:      '/api/v1/web/business',
  audioUpload:   '/api/v1/web/audio_upload',
  audioDownload: '/api/v1/web/audio_download',
} as const

const CONNECT_TIMEOUT_MS = 8000
const LS_SERVER_KEY = 'rc_server_url'

type MessageHandler = (data: any) => void

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
  return `${toWsOrigin(server)}${path}?robotId=${robotId}&role=ui`
}

/** 从后端拉取 UI 配置（serverUrl 可在设置页面修改） */
async function fetchServerUrl(): Promise<string> {
  try {
    const res = await fetch('/api/v1/config/ui').then(r => r.json())
    if (res?.success && res.data?.serverUrl) {
      const url = String(res.data.serverUrl)
      localStorage.setItem(LS_SERVER_KEY, url)
      return url
    }
  } catch { /* 忽略，使用缓存或同源 */ }
  return localStorage.getItem(LS_SERVER_KEY) || ''
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
  const wsBusiness      = ref<WebSocket | null>(null)
  const wsAudioUpload   = ref<WebSocket | null>(null)
  const wsAudioDownload = ref<WebSocket | null>(null)

  const isConnected             = ref(false)
  const isAudioUploadConnected  = ref(false)
  const isAudioDownloadConnected = ref(false)

  const robotId = ref('')
  const messageHandlers: MessageHandler[] = []

  const dispatchMessage = (data: any) => messageHandlers.forEach(h => h(data))

  const onMessage = (handler: MessageHandler) => {
    messageHandlers.push(handler)
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

    const server = await fetchServerUrl()

    // 业务通道：必须成功（失败则 throw，调用方处理）
    const bizUrl = buildWsUrl(server, WS_PATHS.business, robotId.value)
    wsBusiness.value = await connectSocket(bizUrl, dispatchMessage)
    wsBusiness.value.onclose = () => { isConnected.value = false; wsBusiness.value = null }
    isConnected.value = true

    // 控制通道 / 音频通道：失败时静默忽略
    const tryConnect = async (
      path: string,
      wsRef: { value: WebSocket | null },
      connRef: { value: boolean },
    ) => {
      try {
        const url = buildWsUrl(server, path, robotId.value)
        const ws = await connectSocket(url, () => { /* 控制/音频通道不转发消息到 messageHandlers */ })
        wsRef.value = ws
        connRef.value = true
        ws.onclose = () => { connRef.value = false; wsRef.value = null }
      } catch { /* 静默 */ }
    }

    Promise.all([
      tryConnect(WS_PATHS.audioUpload,   wsAudioUpload,   isAudioUploadConnected),
      tryConnect(WS_PATHS.audioDownload, wsAudioDownload, isAudioDownloadConnected),
    ])
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
    if (type === 'audio_chunk') {
      if (!wsAudioUpload.value) { console.error('音频上传通道未连接'); return }
      wsAudioUpload.value.send(JSON.stringify(message))
      return
    }
    sendOnBusiness(message)
  }

  return {
    // 状态
    isConnected,
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
