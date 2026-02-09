import crypto from 'crypto';
import WebSocket from 'ws';
import 配置 from '../../config';

export interface StreamingASROptions {
  model?: string;
  sampleRate?: number;
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
  private audioQueue: Buffer[] = [];
  private isProcessingQueue = false;
  private options: Required<StreamingASROptions>;

  private resolveCallback: ((text: string) => void) | null = null;
  private rejectCallback: ((error: Error) => void) | null = null;

  constructor(options?: StreamingASROptions) {
    this.taskId = crypto.randomUUID();
    this.options = {
      model: options?.model || 配置.asr.aliyun?.model || 'fun-asr-realtime',
      sampleRate: options?.sampleRate || 16000,
      format: options?.format || 'pcm',
    };
  }

  /**
   * 启动 ASR 服务连接
   */
  async start(): Promise<void> {
    const aliyun = 配置.asr.aliyun;
    if (!aliyun?.apiKey) {
      throw new Error('阿里云 ASR API密钥未配置');
    }

    const wsUrl = aliyun.baseUrl || 'wss://dashscope.aliyuncs.com/api-ws/v1/inference';

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${aliyun.apiKey}`,
        },
      });

      this.ws.on('open', () => {
        console.log('[流式ASR] WebSocket 连接成功');
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
          console.log('[流式ASR] 已发送开始消息');
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
        console.error('[流式ASR] WebSocket 错误:', err);
        this.cleanup();
        if (this.rejectCallback) {
          this.rejectCallback(new Error(`阿里云ASR连接错误: ${err.message}`));
        }
        reject(new Error(`阿里云ASR连接错误: ${err.message}`));
      });

      this.ws.on('close', (code, reason) => {
        console.log('[流式ASR] WebSocket 关闭:', { code, reason: reason.toString() });
        if (!this.closed) {
          this.closed = true;
          if (!this.taskStarted) {
            const error = new Error('阿里云ASR任务未启动就关闭了连接');
            if (this.rejectCallback) {
              this.rejectCallback(error);
            }
            reject(error);
          } else if (this.resolveCallback) {
            // 正常关闭，返回已收集的结果
            this.resolveCallback(this.finalText.trim());
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
      console.warn('[流式ASR] 已关闭，忽略音频数据');
      return;
    }

    // 将音频块加入队列
    this.audioQueue.push(pcmChunk);
    console.log('[流式ASR] 音频块入队，队列长度:', this.audioQueue.length, 'chunk大小:', pcmChunk.length);

    // 如果任务已启动且没有正在处理队列，则开始处理
    if (this.taskStarted && !this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * 结束音频输入，等待识别完成
   */
  async finish(): Promise<string> {
    console.log('[流式ASR] 开始结束流程');

    return new Promise((resolve, reject) => {
      this.resolveCallback = resolve;
      this.rejectCallback = reject;

      // 等待队列处理完成
      const waitForQueue = () => {
        if (this.audioQueue.length > 0 || this.isProcessingQueue) {
          console.log('[流式ASR] 等待队列处理完成，剩余:', this.audioQueue.length);
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
          console.log('[流式ASR] 任务已启动，开始处理队列');
          this.taskStarted = true;
          // 任务启动后，开始处理队列中的音频数据
          this.processQueue();
          break;

        case 'result-generated':
          // 提取识别结果
          if (msg.payload?.output?.sentence?.text) {
            const text = msg.payload.output.sentence.text;
            console.log('[流式ASR] 识别结果:', text);
            // 如果是句子结束，更新最终文本
            if (msg.payload.output.sentence.sentence_end) {
              this.finalText = text;
              console.log('[流式ASR] 句子结束，更新最终文本:', this.finalText);
            }
          }
          break;

        case 'task-finished':
          console.log('[流式ASR] 任务完成，最终文本:', this.finalText);
          this.cleanup();
          if (this.resolveCallback) {
            this.resolveCallback(this.finalText.trim());
          }
          break;

        case 'task-failed':
          const errorMsg = msg.header?.error_message || '未知错误';
          const errorCode = msg.header?.error_code || 'UNKNOWN';
          console.error('[流式ASR] 任务失败:', errorCode, errorMsg);
          this.cleanup();
          if (this.rejectCallback) {
            this.rejectCallback(new Error(`阿里云ASR失败 [${errorCode}]: ${errorMsg}`));
          }
          break;

        default:
          console.log('[流式ASR] 未知事件:', msg.header?.event);
      }
    } catch (err) {
      console.error('[流式ASR] 消息处理错误:', err);
      this.cleanup();
      if (this.rejectCallback) {
        this.rejectCallback(err as Error);
      }
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
        console.log('[流式ASR] 发送音频块，大小:', chunk.length, '剩余队列:', this.audioQueue.length);

        // 控制发送速率（每 100ms 约 3200 字节，因此延迟约 20ms）
        await new Promise(resolve => setTimeout(resolve, 20));
      } catch (err) {
        console.error('[流式ASR] 发送音频块失败:', err);
        this.cleanup();
        if (this.rejectCallback) {
          this.rejectCallback(err as Error);
        }
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
      console.warn('[流式ASR] 无法发送结束消息，连接已关闭');
      if (this.resolveCallback) {
        this.resolveCallback(this.finalText.trim());
      }
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
      console.log('[流式ASR] 发送结束消息');
      this.ws.send(JSON.stringify(endMessage));
    } catch (err) {
      console.error('[流式ASR] 发送结束消息失败:', err);
      this.cleanup();
      if (this.rejectCallback) {
        this.rejectCallback(err as Error);
      }
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    } catch (err) {
      console.error('[流式ASR] 清理资源失败:', err);
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
