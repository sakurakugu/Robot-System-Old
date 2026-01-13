import { ref } from 'vue'

interface MessageHandler {
  (data: any): void
}

export function useWebSocket() {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const robotId = ref('')
  const messageHandlers: MessageHandler[] = []

  const generateUUID = (): string => {
    // 简单的UUID v4生成
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // 生成或使用已有的robotId
        if (!robotId.value) {
          robotId.value = generateUUID()
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.hostname}:3000/api/conversation/connect?robotId=${robotId.value}`
        
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
