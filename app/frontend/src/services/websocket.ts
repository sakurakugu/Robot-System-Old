class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectInterval = 3000
  private reconnectTimer: number | null = null
  private listeners: Map<string, Set<Function>> = new Map()

  constructor(url: string) {
    this.url = url
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('WebSocket 已连接')
        this.emit('connected', { clientId: '', timestamp: new Date().toISOString() })
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('收到消息:', message)
          this.emit(message.type, message.data || message)
        } catch (error) {
          console.error('消息解析失败:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket 已断开')
        this.emit('disconnected', {})
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error)
        this.emit('error', error)
      }
    } catch (error) {
      console.error('WebSocket 连接失败:', error)
      this.scheduleReconnect()
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(type: string, data?: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }))
    } else {
      console.warn('WebSocket 未连接，无法发送消息')
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: Function) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return

    this.reconnectTimer = window.setTimeout(() => {
      console.log('尝试重新连接...')
      this.connect()
    }, this.reconnectInterval)
  }

  joinProject(projectUuid: string) {
    this.send('join_project', { projectUuid })
  }

  leaveProject() {
    this.send('leave_project')
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// 创建单例
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
export const wsClient = new WebSocketClient(wsUrl)

// 自动连接
wsClient.connect()
