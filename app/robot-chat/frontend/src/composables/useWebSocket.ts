import { ref } from 'vue'
import { v7 as uuidv7 } from 'uuid'

interface MessageHandler {
  (data: any): void
}

export function useWebSocket() {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const robotId = ref('')
  const messageHandlers: MessageHandler[] = []

  const generateUUID = (): string => uuidv7()

  const fetchUiConfig = async (): Promise<{ serverUrl?: string; wsPath?: string } | null> => {
    try {
      const res = await fetch('/api/config/ui').then(r => r.json())
      if (res?.success && res.data) {
        const serverUrl: string = res.data.serverUrl || ''
        const wsPath: string = res.data.wsPath || '/api/conversation/connect'
        localStorage.setItem('rc_server_url', serverUrl)
        localStorage.setItem('rc_ws_path', wsPath)
        return { serverUrl, wsPath }
      }
    } catch {}
    return null
  }

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // 生成或使用已有的robotId
        if (!robotId.value) {
          robotId.value = generateUUID()
        }

        let savedServer = localStorage.getItem('rc_server_url') || ''
        let savedPath = localStorage.getItem('rc_ws_path') || '/api/conversation/connect'
        if (!savedServer || !localStorage.getItem('rc_ws_path')) {
          fetchUiConfig().then((cfg) => {
            if (cfg) {
              savedServer = cfg.serverUrl || savedServer
              savedPath = cfg.wsPath || savedPath
            }
            // 继续发起连接
            try {
              let wsUrl = ''
              if (savedServer) {
                try {
                  const u = new URL(savedServer)
                  const wsScheme = u.protocol === 'https:' ? 'wss:' : 'ws:'
                  wsUrl = `${wsScheme}//${u.host}${savedPath}?robotId=${robotId.value}&role=ui`
                } catch {
                  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
                  wsUrl = `${protocol}//${window.location.hostname}:3002${savedPath}?robotId=${robotId.value}&role=ui`
                }
              } else {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
                wsUrl = `${protocol}//${window.location.hostname}:3002${savedPath}?robotId=${robotId.value}&role=ui`
              }
              ws.value = new WebSocket(wsUrl)
              ws.value.onopen = () => {
                console.log('WebSocket连接已建立')
                isConnected.value = true
                resolve()
              }
              ws.value.onmessage = (event) => {
                try {
                  const data = JSON.parse(event.data)
                  console.log('收到消息:', data)
                  messageHandlers.forEach((handler) => handler(data))
                } catch (error) {
                  console.error('解析消息失败:', error)
                }
              }
              ws.value.onerror = (error) => {
                console.error('WebSocket错误:', error)
                reject(error)
              }
              ws.value.onclose = () => {
                console.log('WebSocket连接已关闭')
                isConnected.value = false
              }
            } catch (error) {
              reject(error)
            }
          })
          return
        }
        let wsUrl = ''
        if (savedServer) {
          try {
            const u = new URL(savedServer)
            const wsScheme = u.protocol === 'https:' ? 'wss:' : 'ws:'
            wsUrl = `${wsScheme}//${u.host}${savedPath}?robotId=${robotId.value}&role=ui`
          } catch {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            wsUrl = `${protocol}//${window.location.hostname}:3002${savedPath}?robotId=${robotId.value}&role=ui`
          }
        } else {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          wsUrl = `${protocol}//${window.location.hostname}:3002${savedPath}?robotId=${robotId.value}&role=ui`
        }
        
        ws.value = new WebSocket(wsUrl)

        ws.value.onopen = () => {
          console.log('WebSocket连接已建立')
          isConnected.value = true
          resolve()
        }

        ws.value.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('收到消息:', data)
            
            // 调用所有注册的消息处理器
            messageHandlers.forEach((handler) => handler(data))
          } catch (error) {
            console.error('解析消息失败:', error)
          }
        }

        ws.value.onerror = (error) => {
          console.error('WebSocket错误:', error)
          reject(error)
        }

        ws.value.onclose = () => {
          console.log('WebSocket连接已关闭')
          isConnected.value = false
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  const disconnect = () => {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    isConnected.value = false
  }

  const sendText = (text: string) => {
    if (!ws.value || !isConnected.value) {
      console.error('WebSocket未连接')
      return
    }

    const message = {
      type: 'text_input',
      robotId: robotId.value,
      timestamp: Date.now(),
      data: {
        text,
      },
    }

    ws.value.send(JSON.stringify(message))
  }

  const onMessage = (handler: MessageHandler) => {
    messageHandlers.push(handler)
  }

  return {
    isConnected,
    robotId,
    connect,
    disconnect,
    sendText,
    onMessage,
  }
}
