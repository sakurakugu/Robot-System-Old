/**
 * useAudioRecorder
 *
 * 浏览器端实时录音 composable。
 * 使用 Web Audio API (AudioContext + AudioWorklet / ScriptProcessorNode)
 * 采集 PCM 16kHz 单声道音频，流式发送到后端 ASR。
 *
 * TODO: 后续将 PCM 替换为 Opus 编码以减少带宽
 */

import { ElMessage } from 'element-plus'
import { ref } from 'vue'

const SAMPLE_RATE = 16000
const FRAME_DURATION_MS = 20
// 与手机端保持一致：每次上送约 3200 字节 PCM 数据
const TARGET_CHUNK_BYTES = 3200

type SendAudioMessage = (message: any) => void

/** PCM Float32 -> Int16 little-endian 字节流 */
function float32ToPCMBytes(float32: Float32Array): Uint8Array {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return new Uint8Array(int16.buffer)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** 下采样：从原始采样率降到目标采样率 */
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer
  if (fromRate < toRate) {
    // 仅支持降采样，避免上采样引入伪信号
    return buffer
  }
  const ratio = fromRate / toRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0

  // 使用区间平均法，保留语音主频信息，降低混叠失真
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
    let accum = 0
    let count = 0
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i]
      count++
    }
    result[offsetResult] = count > 0 ? (accum / count) : 0
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }
  return result
}

/** 生成简易唯一 ID */
function generateSessionId(): string {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAudioRecorder(
  robotId: () => string,
  sendMessage: SendAudioMessage,
  isAudioUploadConnected: () => boolean,
) {
  const isRecording = ref(false)
  let audioContext: AudioContext | null = null
  let mediaStream: MediaStream | null = null
  let scriptProcessor: ScriptProcessorNode | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let sessionId = ''
  let seq = 0
  let pcmQueue: Uint8Array[] = []
  let pcmQueueSize = 0

  const startRecording = async () => {
    if (isRecording.value) return

    if (!isAudioUploadConnected()) {
      ElMessage.warning('音频上传通道未连接，请检查连接状态')
      return
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          // 浏览器内置增强会显著影响 ASR，统一关闭
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        ElMessage.error('麦克风权限被拒绝，请在浏览器设置中允许')
      } else if (e.name === 'NotFoundError') {
        ElMessage.error('未检测到麦克风设备')
      } else {
        ElMessage.error(`麦克风访问失败: ${e.message}`)
      }
      return
    }

    try {
      // 使用硬件采样率采集，再统一降采样到 16k
      audioContext = new AudioContext()
      sourceNode = audioContext.createMediaStreamSource(mediaStream)

      // 使用 ScriptProcessorNode 采集 PCM 数据（bufferSize = 采样率 * 帧时长）
      const bufferSize = Math.round(SAMPLE_RATE * (FRAME_DURATION_MS / 1000))
      // ScriptProcessorNode 的 bufferSize 必须是 256, 512, 1024, 2048, 4096, 8192, 16384 之一
      const validBufferSize = [256, 512, 1024, 2048, 4096, 8192, 16384].reduce((prev, curr) =>
        Math.abs(curr - bufferSize) < Math.abs(prev - bufferSize) ? curr : prev,
      )
      scriptProcessor = audioContext.createScriptProcessor(validBufferSize, 1, 1)

      sessionId = generateSessionId()
      seq = 0
      isRecording.value = true

      // 发送音频开始消息
      sendMessage({
        type: 'audio_start',
        robotId: robotId(),
        timestamp: Date.now(),
        // TODO: 后续替换 format 为 opus
        data: { format: 'pcm', sampleRate: SAMPLE_RATE, channels: 1, frameDurationMs: FRAME_DURATION_MS, sessionId },
      })

      scriptProcessor.onaudioprocess = (event) => {
        if (!isRecording.value) return
        const inputData = event.inputBuffer.getChannelData(0)
        // 下采样到目标采样率（AudioContext 可能使用硬件原始采样率）
        const resampled = downsample(inputData, audioContext!.sampleRate, SAMPLE_RATE)
        const bytes = float32ToPCMBytes(resampled)
        pcmQueue.push(bytes)
        pcmQueueSize += bytes.length

        while (pcmQueueSize >= TARGET_CHUNK_BYTES) {
          const merged = new Uint8Array(pcmQueueSize)
          let offset = 0
          for (const chunk of pcmQueue) {
            merged.set(chunk, offset)
            offset += chunk.length
          }

          const frame = merged.slice(0, TARGET_CHUNK_BYTES)
          const remaining = merged.slice(TARGET_CHUNK_BYTES)
          pcmQueue = remaining.length > 0 ? [remaining] : []
          pcmQueueSize = remaining.length

          sendMessage({
            type: 'audio_chunk',
            robotId: robotId(),
            timestamp: Date.now(),
            // TODO: 后续替换 format 为 opus
            data: { format: 'pcm', sampleRate: SAMPLE_RATE, channels: 1, sessionId, seq: seq++, frameDurationMs: FRAME_DURATION_MS, buffer: bytesToBase64(frame) },
          })
        }
      }

      sourceNode.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)
    } catch (e: any) {
      cleanup()
      ElMessage.error(`录音初始化失败: ${e.message}`)
    }
  }

  const stopRecording = () => {
    if (!isRecording.value) return
    isRecording.value = false

    // 先发尾包，再发结束消息，避免后端先结束会话导致尾包丢失
    if (pcmQueueSize > 0) {
      const merged = new Uint8Array(pcmQueueSize)
      let offset = 0
      for (const chunk of pcmQueue) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      sendMessage({
        type: 'audio_chunk',
        robotId: robotId(),
        timestamp: Date.now(),
        data: { format: 'pcm', sampleRate: SAMPLE_RATE, channels: 1, sessionId, seq: seq++, frameDurationMs: FRAME_DURATION_MS, buffer: bytesToBase64(merged) },
      })
    }

    // 发送音频结束消息
    if (sessionId) {
      sendMessage({
        type: 'audio_end',
        robotId: robotId(),
        timestamp: Date.now(),
        data: { sessionId, reason: 'manual' },
      })
      sessionId = ''
    }

    seq = 0
    pcmQueue = []
    pcmQueueSize = 0
    cleanup()
  }

  const cleanup = () => {
    if (scriptProcessor) {
      scriptProcessor.disconnect()
      scriptProcessor.onaudioprocess = null
      scriptProcessor = null
    }
    if (sourceNode) {
      sourceNode.disconnect()
      sourceNode = null
    }
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop())
      mediaStream = null
    }
    pcmQueue = []
    pcmQueueSize = 0
    isRecording.value = false
  }

  return { isRecording, startRecording, stopRecording }
}
