import type { Conversation } from './types'

export type ChatTargetPosition = {
  label: string
  cx: number
  cy: number
  w: number
  h: number
}

export type ChatMessage = {
  id: string
  type: 'user' | 'ai'
  target?: 'ai' | 'robot'
  text: string
  timestamp: number
  actions?: string[]
  imageUrl?: string
  visionImageBase64?: string
  visionImageFormat?: string
  targetPosition?: ChatTargetPosition
  latency?: number
  sentToRobot?: boolean
  sendingToRobot?: boolean
  audioUrl?: string
  audioDuration?: number
}

export type VisionStatus = {
  status: 'capturing' | 'analyzing' | 'error' | 'done'
  message: string
  alertType: 'info' | 'success' | 'warning' | 'error'
}

export type ParsedAction = {
  action: string
  parameters: Record<string, string | number>
}

type HistoryMetadata = {
  from?: string
  visionImage?: {
    base64?: string
    format?: string
  }
  targetPosition?: ChatTargetPosition
}

type HistoryAction = {
  name?: string
}

export function parseActionFormat(text: string): ParsedAction | null {
  const actionRegex = /^\{\{action=([a-zA-Z_][a-zA-Z0-9_]*)((?:,[a-zA-Z_][a-zA-Z0-9_]*=[^,}]+)*)\}\}$/
  const match = text.match(actionRegex)

  if (!match) {
    return null
  }

  const action = match[1]
  const paramsStr = match[2]
  const parameters: Record<string, string | number> = {}

  if (paramsStr) {
    const paramPairs = paramsStr.slice(1).split(',')
    for (const pair of paramPairs) {
      const [key, value] = pair.split('=')
      if (key && value !== undefined) {
        parameters[key.trim()] = Number.isNaN(Number(value)) ? value : Number(value)
      }
    }
  }

  return { action, parameters }
}

export function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function buildVisionImageUrl(base64?: string, format = 'jpeg') {
  return base64 ? `data:image/${format};base64,${base64}` : undefined
}

export function buildAudioUrl(base64: string, format = 'opus') {
  const normalizedFormat = format.toLowerCase()
  const mime = normalizedFormat === 'mp3' ? 'audio/mpeg' : 'audio/webm;codecs=opus'

  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }))
  } catch {
    const prefix = normalizedFormat === 'mp3' ? 'data:audio/mpeg;base64,' : 'data:audio/webm;codecs=opus;base64,'
    return `${prefix}${base64}`
  }
}

export function buildTargetBoxStyle(target: ChatTargetPosition) {
  const clampUnit = (value: number) => Math.max(0, Math.min(1, value))
  const cx = clampUnit(target.cx)
  const cy = clampUnit(target.cy)
  const w = clampUnit(target.w)
  const h = clampUnit(target.h)

  return {
    left: `${cx * 100}%`,
    top: `${cy * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    transform: 'translate(-50%, -50%)',
  }
}

export function normalizeConversationHistory(conversations: Conversation[]): ChatMessage[] {
  return conversations
    .slice()
    .reverse()
    .flatMap((item) => {
      const timestamp = new Date(item.timestamp).getTime()
      const metadata = parseJson<HistoryMetadata>(item.metadata)
      const actions = parseJson<Array<HistoryAction> | string[]>(item.actions)
      const normalizedActions = normalizeActionNames(actions)
      const visionImageBase64 = metadata?.visionImage?.base64
      const visionImageFormat = metadata?.visionImage?.format || 'jpeg'
      const imageUrl = buildVisionImageUrl(visionImageBase64, visionImageFormat)
      const latency = typeof item.processing_time === 'number' ? item.processing_time : undefined
      const fromController = String(metadata?.from || '') === 'controller'

      return [
        {
          id: `history-user-${item.uuid}`,
          type: 'user' as const,
          target: fromController ? 'robot' as const : 'ai' as const,
          text: item.user_input,
          timestamp,
          sentToRobot: fromController,
          sendingToRobot: false,
        },
        {
          id: `history-ai-${item.uuid}`,
          type: 'ai' as const,
          text: item.ai_response,
          timestamp,
          actions: normalizedActions,
          imageUrl,
          visionImageBase64,
          visionImageFormat,
          targetPosition: metadata?.targetPosition,
          latency,
          sentToRobot: false,
          sendingToRobot: false,
        },
      ]
    })
}

function parseJson<T>(value?: string | null): T | undefined {
  if (!value) {
    return undefined
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

function normalizeActionNames(actions?: Array<HistoryAction> | string[]) {
  if (!Array.isArray(actions)) {
    return []
  }

  return actions
    .map((action) => {
      if (typeof action === 'string') {
        return action
      }

      return typeof action?.name === 'string' ? action.name : ''
    })
    .filter(Boolean)
}
