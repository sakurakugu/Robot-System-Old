import OpusScript from 'opusscript';
import { AliyunStreamingASR } from '../../features/大模型交互/aliyun-streaming-asr';
import type 语音识别服务 from '../../features/大模型交互/asr-service';
import type { ASROptions } from '../../features/大模型交互/types';
import type { RobotRecord } from '../../features/机器人管理/types';
import type { RoleRecord } from '../../features/角色管理/types';
import type { AudioChunk, AudioEnd, AudioStart } from '../../shared/types';
import 配置 from '../config';
import { logger } from '../logger';

type 音频格式 = 'opus' | 'pcm';
type 音频开始数据 = Partial<AudioStart>;
type 音频块数据 = Partial<AudioChunk>;
type 音频结束数据 = Partial<AudioEnd>;
type 音频识别选项 = Omit<ASROptions, 'provider'> & {
  provider?: string;
};
type 可转Uint8数组值 =
  | Uint8Array
  | ArrayBuffer
  | ArrayBufferView
  | ArrayLike<number>;
type Opus解码器实例 = {
  decode(chunk: Buffer, frameSize: number): 可转Uint8数组值 | null | undefined;
  delete(): void;
};
type OpusScript构造器 = {
  new(sampleRate: number, channels: number, application: number): Opus解码器实例;
  Application: {
    VOIP: number;
  };
};
const OpusScript实现 = OpusScript as unknown as OpusScript构造器;

type 音频转写元数据 = {
  asrTime: number;
  durationMs: number;
  sessionId: string;
};

type AudioSession = {
  robotId: string;
  sessionId: string;
  format: 音频格式;
  sampleRate: number;
  channels: number;
  frameDurationMs: number;
  chunks: Buffer[];
  startedAt: number;
  lastChunkAt: number;
  streamingASR?: AliyunStreamingASR;
  opusDecoder?: Opus解码器实例;
  asrOptions?: 音频识别选项;
  pcmBuffer?: Buffer[];
  pcmBufferSize?: number;
};

export interface 音频会话管理器依赖 {
  获取机器人记录(robotId: string): Promise<RobotRecord | undefined>;
  获取角色记录(roleId: string): Promise<RoleRecord | undefined>;
  asrService: 语音识别服务;
  发送错误(robotId: string, code: string, message: string): void;
  处理音频转写结果(
    robotId: string,
    text: string,
    meta: 音频转写元数据,
  ): Promise<void>;
}

/**
 * 管理音频上传会话、流式 ASR 和批量 ASR 降级逻辑
 */
export class 音频会话管理器 {
  private audioSessions: Map<string, AudioSession> = new Map();

  constructor(private readonly 依赖: 音频会话管理器依赖) {}

  获取会话(sessionId: string): AudioSession | undefined {
    return this.audioSessions.get(sessionId);
  }

  async handleAudioStart(robotId: string, audioData: 音频开始数据): Promise<void> {
    const sessionId = String(audioData?.sessionId || '');
    if (!sessionId) {
      logger.warn('音频开始缺少sessionId', { robotId });
      return;
    }

    const format: 音频格式 = audioData?.format === 'pcm' ? 'pcm' : 'opus';
    const sampleRate = Number(audioData?.sampleRate || 16000);
    const channels = Number(audioData?.channels || 1);
    const frameDurationMs = Number(audioData?.frameDurationMs || 20);
    const { asrOptions, useStreamingASR } = await this.解析识别选项(robotId);

    const session: AudioSession = {
      robotId,
      sessionId,
      format,
      sampleRate,
      channels,
      frameDurationMs,
      chunks: [],
      startedAt: Date.now(),
      lastChunkAt: Date.now(),
      asrOptions,
    };

    if (useStreamingASR) {
      this.初始化流式识别(session);
    }

    this.audioSessions.set(sessionId, session);
    logger.debug('音频会话开始', {
      robotId,
      sessionId,
      format,
      sampleRate,
      channels,
      frameDurationMs,
      useStreamingASR,
    });
  }

  async handleAudioChunk(robotId: string, audioData: 音频块数据): Promise<void> {
    const sessionId = String(audioData?.sessionId || '');
    const buffer = audioData?.buffer;
    if (!buffer) {
      logger.debug('音频块数据为空', { robotId, sessionId });
      return;
    }

    let session = sessionId ? this.audioSessions.get(sessionId) : undefined;
    if (!session) {
      const fallbackSessionId = sessionId || `${robotId}-${Date.now()}`;
      session = {
        robotId,
        sessionId: fallbackSessionId,
        format: audioData?.format === 'pcm' ? 'pcm' : 'opus',
        sampleRate: Number(audioData?.sampleRate || 16000),
        channels: Number(audioData?.channels || 1),
        frameDurationMs: Number(audioData?.frameDurationMs || 20),
        chunks: [],
        startedAt: Date.now(),
        lastChunkAt: Date.now(),
      };
      this.audioSessions.set(fallbackSessionId, session);
    }

    try {
      const chunk = Buffer.from(buffer, 'base64');
      if (chunk.length === 0) {
        logger.debug('音频块长度为0', { robotId, sessionId });
        return;
      }

      logger.debug('接收音频块', {
        robotId,
        sessionId,
        chunkLength: chunk.length,
        base64Length: buffer.length,
        totalChunks: session.chunks.length + 1,
        hasStreamingASR: !!session.streamingASR,
      });

      session.chunks.push(chunk);
      session.lastChunkAt = Date.now();

      if (!session.streamingASR) {
        return;
      }

      try {
        this.推送实时音频到流式识别(session, chunk);
      } catch (error) {
        logger.warn('实时处理音频块失败', {
          robotId,
          sessionId,
          format: session.format,
          chunkLength: chunk.length,
          error: String(error),
        });
      }
    } catch (error) {
      logger.warn('音频块解码失败', {
        robotId,
        sessionId,
        error: String(error),
        bufferType: typeof buffer,
      });
    }
  }

  async handleAudioEnd(robotId: string, audioData: 音频结束数据): Promise<void> {
    const sessionId = String(audioData?.sessionId || '');
    if (!sessionId) {
      logger.warn('音频结束缺少sessionId', { robotId });
      return;
    }

    const session = this.audioSessions.get(sessionId);
    if (!session) {
      logger.warn('音频会话不存在', { robotId, sessionId });
      return;
    }

    this.audioSessions.delete(sessionId);

    if (!session.chunks || session.chunks.length === 0) {
      logger.warn('音频会话无有效数据', { robotId, sessionId });
      return;
    }

    const validChunks = session.chunks.filter((chunk): chunk is Buffer => !!chunk && chunk.length > 0);
    if (validChunks.length === 0) {
      logger.warn('音频会话所有数据块都为空', {
        robotId,
        sessionId,
        totalChunks: session.chunks.length,
      });
      return;
    }

    const durationMs = session.frameDurationMs * session.chunks.length;
    const asrStart = Date.now();

    try {
      let text = '';

      if (session.streamingASR) {
        try {
          if (session.pcmBuffer && session.pcmBuffer.length > 0) {
            const mergedBuffer = this.合并Buffer片段(session.pcmBuffer);
            session.streamingASR.pushAudio(mergedBuffer);
            logger.debug('发送剩余 PCM 数据', {
              robotId,
              sessionId,
              pcmSize: mergedBuffer.length,
            });
            session.pcmBuffer = [];
            session.pcmBufferSize = 0;
          }

          text = await session.streamingASR.finish();
          logger.info('流式 ASR 识别完成', {
            robotId,
            sessionId,
            text,
            chunks: session.chunks.length,
            durationMs,
          });
        } catch (error) {
          logger.error('流式 ASR 识别失败，降级到批量处理', error as Error, { robotId, sessionId });
          text = '';
        }
      }

      if (!text.trim()) {
        logger.info('使用批量 ASR 处理', { robotId, sessionId });
        const wavBuffer = session.format === 'pcm'
          ? this.buildWavBuffer(
            this.合并Buffer片段(validChunks),
            this.规范采样率(session.sampleRate),
            this.规范声道数(session.channels),
          )
          : this.decodeOpusChunksToWav(session);

        text = (await this.依赖.asrService.转录Wav(
          wavBuffer,
          this.转换ASR服务选项(session.asrOptions),
        )) || '';
      }

      const asrTime = Date.now() - asrStart;
      if (!text.trim()) {
        logger.info('ASR结果为空', { robotId, sessionId });
        return;
      }

      await this.依赖.处理音频转写结果(robotId, text.trim(), {
        asrTime,
        durationMs,
        sessionId,
      });
    } catch (error) {
      const message = this.提取错误消息(error, '语音识别失败');
      if (String(message).includes('Opus解码失败')) {
        logger.warn('Opus解码失败', {
          robotId,
          sessionId,
          chunks: session.chunks.length,
          sampleRate: session.sampleRate,
          channels: session.channels,
          frameDurationMs: session.frameDurationMs,
        });
        return;
      }

      logger.error('音频处理失败', this.转成错误对象(error), { robotId, sessionId });
      this.依赖.发送错误(robotId, 'ASR_ERROR', message);
    } finally {
      this.释放会话资源(session);
    }
  }

  private async 解析识别选项(
    robotId: string,
  ): Promise<{ asrOptions: 音频识别选项; useStreamingASR: boolean }> {
    const robot = await this.依赖.获取机器人记录(robotId);
    const asrOptions: 音频识别选项 = {};
    let useStreamingASR = false;

    if (robot?.role_uuid) {
      const role = await this.依赖.获取角色记录(robot.role_uuid);
      if (role?.asr_provider) {
        asrOptions.provider = role.asr_provider;
        if (role.asr_model) {
          asrOptions.model = role.asr_model;
        }
        useStreamingASR = role.asr_provider === 'aliyun';
      }
    } else if (配置.asr.provider === 'aliyun') {
      asrOptions.provider = 'aliyun';
      useStreamingASR = true;
    }

    return { asrOptions, useStreamingASR };
  }

  private 初始化流式识别(session: AudioSession): void {
    try {
      logger.info('启动流式 ASR 服务', {
        robotId: session.robotId,
        sessionId: session.sessionId,
        asrOptions: session.asrOptions,
      });

      const streamingASR = new AliyunStreamingASR({
        model: session.asrOptions?.model as string | undefined,
        sampleRate: session.sampleRate,
        channels: session.channels,
        format: 'pcm',
      });

      streamingASR.start().catch((error) => {
        logger.error('流式 ASR 启动失败', error as Error, {
          robotId: session.robotId,
          sessionId: session.sessionId,
        });
        this.依赖.发送错误(
          session.robotId,
          'ASR_START_ERROR',
          this.提取错误消息(error, '流式 ASR 启动失败'),
        );
      });

      session.streamingASR = streamingASR;
      session.pcmBuffer = [];
      session.pcmBufferSize = 0;

      if (session.format !== 'opus') {
        return;
      }

      const sampleRate = this.规范采样率(session.sampleRate);
      const channels = this.规范声道数(session.channels);
      try {
        session.opusDecoder = new OpusScript实现(
          sampleRate,
          channels,
          OpusScript实现.Application.VOIP,
        );
        logger.debug('Opus 解码器初始化成功', {
          robotId: session.robotId,
          sessionId: session.sessionId,
          sampleRate,
          channels,
        });
      } catch (error) {
        logger.error('Opus 解码器初始化失败', error instanceof Error ? error : new Error(String(error)), {
          robotId: session.robotId,
          sessionId: session.sessionId,
          sampleRate,
          channels,
        });
      }
    } catch (error) {
      logger.error('流式 ASR 初始化失败', error instanceof Error ? error : new Error(String(error)), {
        robotId: session.robotId,
        sessionId: session.sessionId,
      });
    }
  }

  private 推送实时音频到流式识别(session: AudioSession, chunk: Buffer): void {
    const sampleRate = this.规范采样率(session.sampleRate);
    if (session.format === 'pcm') {
      session.streamingASR!.pushAudio(chunk);
      return;
    }

    if (!session.opusDecoder) {
      return;
    }

    const frameDurationMs = this.规范帧时长(session.frameDurationMs);
    const frameSize = Math.floor((sampleRate * frameDurationMs) / 1000);
    const pcmData = session.opusDecoder.decode(chunk, frameSize);
    if (pcmData) {
      const 解码后数据 = this.转成Uint8数组(pcmData);
      if (解码后数据.byteLength === 0) {
        return;
      }

      const pcmBuffer = Buffer.from(解码后数据.buffer, 解码后数据.byteOffset, 解码后数据.byteLength);
      session.pcmBuffer = session.pcmBuffer || [];
      session.pcmBuffer.push(pcmBuffer);
      session.pcmBufferSize = (session.pcmBufferSize || 0) + pcmBuffer.length;
    }

    if ((session.pcmBufferSize || 0) === 0 || !session.pcmBuffer || session.pcmBuffer.length === 0) {
      return;
    }

    const mergedBuffer = this.合并Buffer片段(session.pcmBuffer);
    session.streamingASR!.pushAudio(mergedBuffer);
    session.pcmBuffer = [];
    session.pcmBufferSize = 0;

    logger.debug('实时推送 PCM 到流式 ASR', {
      robotId: session.robotId,
      sessionId: session.sessionId,
      format: session.format,
      pcmSize: mergedBuffer.length,
      asrStatus: session.streamingASR!.getStatus(),
    });
  }

  private decodeOpusChunksToWav(session: AudioSession): Buffer {
    const sampleRate = this.规范采样率(session.sampleRate);
    const channels = this.规范声道数(session.channels);
    const frameDurationMs = this.规范帧时长(session.frameDurationMs);
    const frameSize = Math.floor((sampleRate * frameDurationMs) / 1000);

    let decoder: Opus解码器实例 | undefined;
    try {
      decoder = new OpusScript实现(
        sampleRate,
        channels,
        OpusScript实现.Application.VOIP,
      );
    } catch (error) {
      logger.error('Opus解码器初始化失败', error instanceof Error ? error : new Error(String(error)), {
        sampleRate,
        channels,
        sessionId: session.sessionId,
      });
      throw new Error('Opus解码失败');
    }

    try {
      const pcmBuffers: Uint8Array[] = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < session.chunks.length; i++) {
        const chunk = session.chunks[i];
        if (!chunk || chunk.length === 0) {
          logger.debug('跳过空音频块', { sessionId: session.sessionId, index: i });
          continue;
        }

        try {
          logger.debug('尝试解码音频块', {
            sessionId: session.sessionId,
            index: i,
            chunkLength: chunk.length,
            expectedFrameSize: frameSize,
            hexPreview: chunk.slice(0, Math.min(16, chunk.length)).toString('hex'),
          });

          const decoded = decoder.decode(chunk, frameSize);
          if (decoded) {
            const 解码后数据 = this.转成Uint8数组(decoded);
            if (解码后数据.byteLength === 0) {
              continue;
            }

            pcmBuffers.push(解码后数据);
            successCount++;
            logger.debug('音频块解码成功', {
              sessionId: session.sessionId,
              index: i,
              decodedLength: 解码后数据.byteLength,
            });
          }
        } catch (error) {
          failCount++;
          logger.warn('音频块解码失败', {
            sessionId: session.sessionId,
            index: i,
            chunkLength: chunk.length,
            expectedFrameSize: frameSize,
            error: String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          });
        }
      }

      if (pcmBuffers.length === 0) {
        logger.warn('Opus解码失败：所有音频块解码失败', {
          sessionId: session.sessionId,
          totalChunks: session.chunks.length,
          failCount,
          sampleRate,
          channels,
          frameDurationMs,
          frameSize,
        });
        throw new Error('Opus解码失败');
      }

      if (failCount > 0) {
        logger.debug('部分音频块解码失败', {
          sessionId: session.sessionId,
          successCount,
          failCount,
          totalChunks: session.chunks.length,
        });
      }

      return this.buildWavBuffer(Buffer.concat(pcmBuffers), sampleRate, channels);
    } finally {
      if (decoder) {
        try {
          decoder.delete();
        } catch (error) {
          logger.error('Opus解码器释放失败', error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }

  private buildWavBuffer(pcmData: Buffer, sampleRate: number, channels: number): Buffer {
    const bitsPerSample = 16;
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    for (let i = 0; i < pcmData.length; i++) {
      buffer[44 + i] = pcmData[i];
    }

    return buffer;
  }

  private 合并Buffer片段(buffers: readonly Buffer[]): Buffer {
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const merged = Buffer.alloc(totalLength);
    let offset = 0;

    for (const buffer of buffers) {
      for (let i = 0; i < buffer.length; i++) {
        merged[offset + i] = buffer[i];
      }
      offset += buffer.length;
    }

    return merged;
  }

  private 释放会话资源(session: AudioSession): void {
    if (!session.opusDecoder) {
      return;
    }

    try {
      session.opusDecoder.delete?.();
    } catch {
      // 忽略清理错误
    }
  }

  private 规范采样率(sampleRate: number): number {
    return sampleRate === 16000 || sampleRate === 48000 ? sampleRate : 16000;
  }

  private 规范声道数(channels: number): number {
    return channels === 2 ? 2 : 1;
  }

  private 规范帧时长(frameDurationMs: number): number {
    const allowed = new Set([2.5, 5, 10, 20, 40, 60]);
    return allowed.has(frameDurationMs) ? frameDurationMs : 20;
  }

  private 转换ASR服务选项(options?: 音频识别选项): ASROptions {
    if (!options) {
      return {};
    }

    return options as unknown as ASROptions;
  }

  private 转成Uint8数组(value: 可转Uint8数组值): Uint8Array {
    if (value instanceof Uint8Array) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }

    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength,
      );
    }

    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }

    return new Uint8Array(value);
  }

  private 转成错误对象(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private 提取错误消息(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }
}
