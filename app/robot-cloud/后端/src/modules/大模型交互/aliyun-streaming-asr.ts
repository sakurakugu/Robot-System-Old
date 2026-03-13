import crypto from 'crypto';
import WebSocket from 'ws';
import 配置 from '../../config';
import { apiKeyManager } from '../../core/config/apikey-manager';
import { logger } from '../../core/logger';

export interface StreamingASROptions {
  model?: string;
  sampleRate?: number;
  channels?: number;
  format?: 'pcm' | 'opus';
}

/**
 * 阿里云流式 ASR 服务
 * 支持边收边发，实时处理音频流
 */
export class AliyunStreamingASR {
  private ws: WebSocket | null = null;
  private taskId: string;
  private closed = false;
  private taskStarted = false;
  private finalText = '';
  private latestText = '';
  private audioQueue: Buffer[] = [];
  private isProcessingQueue = false;
  private options: Required<StreamingASROptions>;

  private resolveCallback: ((text: string) => void) | null = null;
  private rejectCallback: ((error: Error) => void) | null = null;
  private startTimeout?: NodeJS.Timeout;
  private finishTimeout?: NodeJS.Timeout;

  /**
   * 兼容不同返回结构提取文本
   */
  private extractTextFromMessage(msg: any): { text: string; sentenceEnd: boolean } {
    const output = msg?.payload?.output;
    const sentence = output?.sentence;

    if (sentence && typeof sentence.text === 'string' && sentence.text.trim()) {
      return { text: sentence.text.trim(), sentenceEnd: Boolean(sentence.sentence_end) };
    }

    if (typeof output?.text === 'string' && output.text.trim()) {
      return { text: output.text.trim(), sentenceEnd: Boolean(output?.sentence_end) };
    }

    if (Array.isArray(output?.sentences) && output.sentences.length > 0) {
      const last = output.sentences[output.sentences.length - 1];
      const text = typeof last?.text === 'string' ? last.text.trim() : '';
      if (text) {
        return { text, sentenceEnd: Boolean(last?.sentence_end) };
      }
    }

    if (typeof msg?.payload?.result === 'string' && msg.payload.result.trim()) {
      return { text: msg.payload.result.trim(), sentenceEnd: true };
    }

    return { text: '', sentenceEnd: false };
  }

  private mergeFinalText(text: string): void {
    if (!text) return;
    if (!this.finalText) {
      this.finalText = text;
      return;
    }
    if (this.finalText.includes(text)) return;
    this.finalText = `${this.finalText}${text}`;
  }

  constructor(options?: StreamingASROptions) {
    this.taskId = crypto.randomUUID();
    this.options = {
      model: options?.model || 配置.asr.aliyun?.model || 'fun-asr-realtime',
      sampleRate: options?.sampleRate || 16000,
      channels: options?.channels || 1,
      format: options?.format || 'pcm',
    };
  }

  private settleSuccess(text: string): void {
    if (this.finishTimeout) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = undefined;
    }
    if (this.resolveCallback) {
      const resolve = this.resolveCallback;
      this.resolveCallback = null;
      this.rejectCallback = null;
      resolve(text);
    }
  }

  private settleError(error: Error): void {
    if (this.finishTimeout) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = undefined;
    }
    if (this.rejectCallback) {
      const reject = this.rejectCallback;
      this.resolveCallback = null;
      this.rejectCallback = null;
      reject(error);
    }
  }

  /**
   * 启动 ASR 服务连接
   */
  async start(): Promise<void> {
    const aliyun = 配置.asr.aliyun;
    if (!aliyun) {
      throw new Error('阿里云 ASR配置未启用');
    }
    const apiKey = apiKeyManager.get('aliyun');
    if (!apiKey) {
      throw new Error('阿里云 ASR API密钥未配置');
    }

    const wsUrl = aliyun.baseUrl || 'wss://dashscope.aliyuncs.com/api-ws/v1/inference';

    return new Promise((resolve, reject) => {
      const timeoutMs = 1_5000;
      this.startTimeout = setTimeout(() => {
        this.cleanup();
        reject(new Error(`阿里云ASR连接超时（${timeoutMs}ms）`));
      }, timeoutMs);

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      this.ws.on('open', () => {
        logger.info('[流式ASR] WebSocket 连接成功');
        try {
          // 发送开始消息
          const startMessage = {
            header: {
              action: 'run-task',
              task_id: this.taskId,
              streaming: 'duplex',
            },
            payload: {
              task_group: 'audio',
              task: 'asr',
              function: 'recognition',
              model: this.options.model,
              parameters: {
                format: this.options.format,
                sample_rate: this.options.sampleRate,
              },
              input: {},
            },
          };
          this.ws!.send(JSON.stringify(startMessage));
          logger.info('[流式ASR] 已发送开始消息');
          if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = undefined;
          }
          resolve();
        } catch (err) {
          this.cleanup();
          reject(err);
        }
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (err) => {
        logger.error('[流式ASR] WebSocket 错误', err as Error);
        this.cleanup();
        this.settleError(new Error(`阿里云ASR连接错误: ${err.message}`));
        reject(new Error(`阿里云ASR连接错误: ${err.message}`));
      });

      this.ws.on('close', (code, reason) => {
        logger.info('[流式ASR] WebSocket 关闭', { code, reason: reason.toString() });
        if (!this.closed) {
          this.closed = true;
          if (!this.taskStarted) {
            const error = new Error('阿里云ASR任务未启动就关闭了连接');
            this.settleError(error);
            reject(error);
          } else if (this.resolveCallback) {
            // 正常关闭，返回已收集的结果
            this.settleSuccess(this.finalText.trim());
          }
        }
      });
    });
  }

  /**
   * 推送音频数据（PCM 格式）
   * 会自动缓存到队列，等待连接建立后发送
   */
  pushAudio(pcmChunk: Buffer): void {
    if (this.closed) {
      logger.warn('[流式ASR] 已关闭，忽略音频数据');
      return;
    }

    // 将音频块加入队列
    this.audioQueue.push(pcmChunk);
    // logger.log('[流式ASR] 音频块入队，队列长度:', this.audioQueue.length, 'chunk大小:', pcmChunk.length);

    // 如果任务已启动且没有正在处理队列，则开始处理
    if (this.taskStarted && !this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * 结束音频输入，等待识别完成
   */
  async finish(): Promise<string> {
    logger.info('[流式ASR] 开始结束流程');

    return new Promise((resolve, reject) => {
      this.resolveCallback = resolve;
      this.rejectCallback = reject;
      const timeoutMs = 6_0000;
      this.finishTimeout = setTimeout(() => {
        this.cleanup();
        this.settleError(new Error(`阿里云ASR完成超时（${timeoutMs}ms）`));
      }, timeoutMs);

      // 等待队列处理完成
      const waitForQueue = () => {
        if (this.audioQueue.length > 0 || this.isProcessingQueue) {
          logger.info('[流式ASR] 等待队列处理完成', { remaining: this.audioQueue.length });
          setTimeout(waitForQueue, 100);
        } else {
          this.sendFinishMessage();
        }
      };

      waitForQueue();
    });
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: WebSocket.RawData): void {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.header?.event) {
        case 'task-started':
          logger.info('[流式ASR] 任务已启动，开始处理队列');
          this.taskStarted = true;
          // 任务启动后，开始处理队列中的音频数据
          this.processQueue();
          break;

        case 'result-generated':
          {
            const { text, sentenceEnd } = this.extractTextFromMessage(msg);
            if (text) {
              this.latestText = text;
              logger.info('[流式ASR] 识别结果', { text, sentenceEnd });
              if (sentenceEnd) {
                this.mergeFinalText(text);
                logger.info('[流式ASR] 句子结束，更新最终文本', { finalText: this.finalText });
              }
            }
          }
          break;

        case 'task-finished':
          if (!this.finalText && this.latestText) {
            this.finalText = this.latestText;
          }
          logger.info('[流式ASR] 任务完成，最终文本', { finalText: this.finalText });
          this.cleanup();
          this.settleSuccess(this.finalText.trim());
          break;

        case 'task-failed':
          const errorMsg = msg.header?.error_message || '未知错误';
          const errorCode = msg.header?.error_code || 'UNKNOWN';
          logger.error('[流式ASR] 任务失败', { errorCode, errorMsg });
          this.cleanup();
          this.settleError(new Error(`阿里云ASR失败 [${errorCode}]: ${errorMsg}`));
          break;

        default:
          logger.warn('[流式ASR] 未知事件', { event: msg.header?.event });
      }
    } catch (err) {
      logger.error('[流式ASR] 消息处理错误', err as Error);
      this.cleanup();
      this.settleError(err as Error);
    }
  }

  /**
   * 处理音频队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.taskStarted || this.closed) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.audioQueue.length > 0 && this.ws && !this.closed) {
      const chunk = this.audioQueue.shift()!;
      try {
        // 发送音频数据（二进制格式）
        this.ws.send(chunk);
        // logger.log('[流式ASR] 发送音频块，大小:', chunk.length, '剩余队列:', this.audioQueue.length);

        // 按真实音频时长限速，避免发送过快导致识别质量下降
        const bytesPerSecond = this.options.sampleRate * this.options.channels * 2;
        const durationMs = Math.max(10, Math.round((chunk.length / bytesPerSecond) * 1000));
        await new Promise(resolve => setTimeout(resolve, durationMs));
      } catch (err) {
        logger.error('[流式ASR] 发送音频块失败', err as Error);
        this.cleanup();
        this.settleError(err as Error);
        break;
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 发送结束消息
   */
  private sendFinishMessage(): void {
    if (!this.ws || this.closed) {
      logger.warn('[流式ASR] 无法发送结束消息，连接已关闭');
      this.settleSuccess(this.finalText.trim());
      return;
    }

    try {
      const endMessage = {
        header: {
          action: 'finish-task',
          task_id: this.taskId,
          streaming: 'duplex',
        },
        payload: {
          input: {},
        },
      };
      logger.info('[流式ASR] 发送结束消息');
      this.ws.send(JSON.stringify(endMessage));
    } catch (err) {
      logger.error('[流式ASR] 发送结束消息失败', err as Error);
      this.cleanup();
      this.settleError(err as Error);
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = undefined;
    }
    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    } catch (err) {
      logger.error('[流式ASR] 清理资源失败', err as Error);
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    closed: boolean;
    taskStarted: boolean;
    queueLength: number;
    finalText: string;
  } {
    return {
      closed: this.closed,
      taskStarted: this.taskStarted,
      queueLength: this.audioQueue.length,
      finalText: this.finalText,
    };
  }
}
