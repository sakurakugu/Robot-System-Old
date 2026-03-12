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
const FRAME_DURATION_MS = 100 // 每 100ms 发送一帧

type SendAudioMessage = (message: any) => void

/** PCM Float32 → Int16 数组 → base64 */
function float32ToBase64PCM(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  const bytes = new Uint8Array(int16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** 下采样：从原始采样率降到目标采样率 */
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer
  const ratio = fromRate / toRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const idx = Math.round(i * ratio)
    result[i] = buffer[Math.min(idx, buffer.length - 1)]
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
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
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
      audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
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
        const base64 = float32ToBase64PCM(resampled)
        sendMessage({
          type: 'audio_chunk',
          robotId: robotId(),
          timestamp: Date.now(),
          // TODO: 后续替换 format 为 opus
          data: { format: 'pcm', sampleRate: SAMPLE_RATE, channels: 1, sessionId, seq: seq++, frameDurationMs: FRAME_DURATION_MS, buffer: base64 },
        })
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
    isRecording.value = false
  }

  return { isRecording, startRecording, stopRecording }
}
