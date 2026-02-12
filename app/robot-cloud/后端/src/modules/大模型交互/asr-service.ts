import axios from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';
import WebSocket from 'ws';
import 配置 from '../../config';
import { logger } from '../../core/logger';

export interface ASROptions {
  language?: string;
  prompt?: string;
  provider?: 'xunfei' | 'openai' | 'aliyun';
  model?: string;
}

class 语音识别服务 {
  async 转录Wav(wavBuffer: Buffer, options?: ASROptions): Promise<string> {
    const provider = options?.provider || 配置.asr.provider;
    switch (provider) {
      case 'xunfei':
        return this.转录讯飞(wavBuffer, options);
      case 'openai':
        return this.转录OpenAI(wavBuffer, options);
      case 'aliyun':
        return this.转录阿里云(wavBuffer, options);
      default:
        throw new Error(`不支持的ASR提供商: ${provider}`);
    }
  }

  private async 转录讯飞(wavBuffer: Buffer, options?: ASROptions): Promise<string> {
    const xunfei = 配置.asr.xunfei;
    if (!xunfei?.appId || !xunfei.apiKey || !xunfei.apiSecret) {
      throw new Error('讯飞ASR密钥未配置');
    }

    const host = 'iat-api.xfyun.cn';
    const path = '/v2/iat';
    const url = this.buildXunfeiUrl(host, path, xunfei.apiKey, xunfei.apiSecret);

    const pcmBuffer = this.extractPcmFromWav(wavBuffer);
    const sampleRate = this.detectSampleRate(wavBuffer) || 16000;
    const frameSize = 1280;
    const intervalMs = 40;

    const language = options?.language || 'zh_cn';

    return new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(url);
      const timeoutMs = 4_5000;
      let closed = false;
      let finalText = '';
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`讯飞ASR超时（${timeoutMs}ms）`));
      }, timeoutMs);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timeout);
        try {
          ws.close();
        } catch { }
      };

      ws.on('open', async () => {
        try {
          let status = 0;
          for (let offset = 0; offset < pcmBuffer.length; offset += frameSize) {
            const chunk = pcmBuffer.slice(offset, offset + frameSize);
            const payload: any = {
              data: {
                status,
                format: `audio/L16;rate=${sampleRate}`,
                encoding: 'raw',
                audio: chunk.toString('base64'),
              },
            };
            if (status === 0) {
              payload.common = { app_id: xunfei.appId };
              payload.business = {
                language,
                domain: 'iat',
                accent: 'mandarin',
                vad_eos: 2000,
                ptt: 1,
              };
              status = 1;
            }

            ws.send(JSON.stringify(payload));
            await new Promise(r => setTimeout(r, intervalMs));
          }

          const endPayload = { data: { status: 2 } };
          ws.send(JSON.stringify(endPayload));
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.code !== 0) {
            cleanup();
            reject(new Error(msg.message || `讯飞ASR错误: ${msg.code}`));
            return;
          }

          const wsResults = msg?.data?.result?.ws || [];
          if (Array.isArray(wsResults)) {
            const textPart = wsResults
              .map((w: any) => w?.cw?.[0]?.w || '')
              .join('');
            // “我吃了一串串串”这种如果用去重会有问题
            finalText += textPart;
          }

          if (msg?.data?.status === 2) {
            cleanup();
            resolve(finalText.trim());
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      ws.on('error', (err) => {
        cleanup();
        reject(err);
      });

      ws.on('close', () => {
        if (!closed) {
          closed = true;
          clearTimeout(timeout);
          resolve(finalText.trim());
        }
      });
    });
  }

  private buildXunfeiUrl(host: string, path: string, apiKey: string, apiSecret: string): string {
    const date = new Date().toUTCString();
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    const signatureSha = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureOrigin)
      .digest('base64');

    const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    const params = new URLSearchParams({
      authorization,
      date,
      host,
    });
    return `wss://${host}${path}?${params.toString()}`;
  }

  private extractPcmFromWav(wavBuffer: Buffer): Buffer {
    if (wavBuffer.length < 44) return wavBuffer;
    if (wavBuffer.toString('ascii', 0, 4) !== 'RIFF') return wavBuffer;
    if (wavBuffer.toString('ascii', 8, 12) !== 'WAVE') return wavBuffer;

    let offset = 12;
    while (offset + 8 <= wavBuffer.length) {
      const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
      const chunkSize = wavBuffer.readUInt32LE(offset + 4);
      if (chunkId === 'data') {
        return wavBuffer.slice(offset + 8, offset + 8 + chunkSize);
      }
      offset += 8 + chunkSize;
    }
    return wavBuffer;
  }

  private detectSampleRate(wavBuffer: Buffer): number | null {
    if (wavBuffer.length < 28) return null;
    if (wavBuffer.toString('ascii', 0, 4) !== 'RIFF') return null;
    return wavBuffer.readUInt32LE(24);
  }

  private async 转录OpenAI(wavBuffer: Buffer, options?: ASROptions): Promise<string> {
    const openai = 配置.asr.openai;
    if (!openai?.apiKey) {
      throw new Error('OpenAI ASR API密钥未配置');
    }

    const url = `${openai.baseUrl || 'https://api.openai.com/v1'}/audio/transcriptions`;
    const form = new FormData();
    form.append('model', openai.model || 'whisper-1');
    form.append('file', wavBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav',
    });

    const language = options?.language || openai.language || '';
    if (language) {
      form.append('language', language);
    }
    const prompt = options?.prompt || openai.prompt || '';
    if (prompt) {
      form.append('prompt', prompt);
    }

    try {
      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${openai.apiKey}`,
        },
        maxBodyLength: Infinity,
        timeout: 60000,
      });
      const text = String(response.data?.text || '').trim();
      return text;
    } catch (error: any) {
      const data = error.response?.data;
      const message = data?.error?.message || data?.message || error.message;
      throw new Error(`ASR调用失败: ${message}`);
    }
  }

  private async 转录阿里云(wavBuffer: Buffer, options?: ASROptions): Promise<string> {
    const aliyun = 配置.asr.aliyun;
    if (!aliyun?.apiKey) {
      throw new Error('阿里云 ASR API密钥未配置');
    }

    const wsUrl = aliyun.baseUrl || 'wss://dashscope.aliyuncs.com/api-ws/v1/inference';
    const model = options?.model || aliyun.model || 'fun-asr-realtime';

    const pcmBuffer = this.extractPcmFromWav(wavBuffer);
    const sampleRate = this.detectSampleRate(wavBuffer) || 16000;

    // logger.log('[阿里云ASR] 开始识别', {
    //   wsUrl,
    //   model,
    //   wavBufferSize: wavBuffer.length,
    //   pcmBufferSize: pcmBuffer.length,
    //   sampleRate,
    // });

    return new Promise<string>((resolve, reject) => {
      const taskId = crypto.randomUUID();
      const timeoutMs = 9_0000;
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${aliyun.apiKey}`,
        },
      });

      let closed = false;
      let taskStarted = false;
      let finalText = '';
      const chunkSize = 3200; // 每次发送 3200 字节（约 100ms 的 16kHz 16bit PCM 音频）
      let currentOffset = 0;
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`阿里云ASR超时（${timeoutMs}ms）`));
      }, timeoutMs);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timeout);
        try {
          ws.close();
        } catch { }
      };

      // 分块发送音频数据（二进制格式）
      const sendAudioChunks = () => {
        const sendNextChunk = () => {
          if (currentOffset >= pcmBuffer.length) {
            // 所有音频发送完成，发送结束消息
            const endMessage = {
              header: {
                action: 'finish-task',
                task_id: taskId,
                streaming: 'duplex',
              },
              payload: {
                input: {},
              },
            };
            logger.info('[阿里云ASR] 音频发送完成，发送结束消息');
            ws.send(JSON.stringify(endMessage));
            return;
          }

          const chunk = pcmBuffer.slice(currentOffset, currentOffset + chunkSize);
          currentOffset += chunkSize;

          // 直接发送二进制音频数据，不是 JSON
          ws.send(chunk);

          if (currentOffset % (chunkSize * 10) === 0) {
            logger.info('[阿里云ASR] 音频发送进度', { progress: Math.round((currentOffset / pcmBuffer.length) * 100) + '%' });
          }

          // 控制发送速率，避免过快（每 100ms 发送一次）
          setTimeout(sendNextChunk, 100);
        };

        sendNextChunk();
      };

      ws.on('open', () => {
        logger.info('[阿里云ASR] WebSocket 连接成功');
        try {
          // 发送开始消息（必须包含 payload.input 和 task_group）
          const startMessage = {
            header: {
              action: 'run-task',
              task_id: taskId,
              streaming: 'duplex',
            },
            payload: {
              task_group: 'audio',
              task: 'asr',
              function: 'recognition',
              model: model,
              parameters: {
                format: 'pcm',
                sample_rate: sampleRate,
              },
              input: {},
            },
          };
          // logger.log('[阿里云ASR] 发送开始消息:', JSON.stringify(startMessage, null, 2));
          ws.send(JSON.stringify(startMessage));
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString());

          // 添加详细日志用于调试
          // logger.log('[阿里云ASR] 收到消息:', JSON.stringify(msg, null, 2));

          // 处理不同的事件类型
          switch (msg.header?.event) {
            case 'task-started':
              logger.info('[阿里云ASR] 任务已启动，开始发送音频');
              taskStarted = true;
              sendAudioChunks();
              break;

            case 'result-generated':
              // 提取识别结果
              if (msg.payload?.output?.sentence?.text) {
                const text = msg.payload.output.sentence.text;
                logger.info('[阿里云ASR] 识别结果', { text });
                // 如果是句子结束（sentence_end 为 true），更新 finalText
                if (msg.payload.output.sentence.sentence_end) {
                  finalText = text;
                  logger.info('[阿里云ASR] 句子结束，更新最终文本', { finalText });
                }
              }
              break;

            case 'task-finished':
              logger.info('[阿里云ASR] 任务完成，最终文本', { finalText });
              cleanup();
              resolve(finalText.trim());
              break;

            case 'task-failed':
              const errorMsg = msg.header?.error_message || '未知错误';
              const errorCode = msg.header?.error_code || 'UNKNOWN';
              logger.error('[阿里云ASR] 任务失败', { errorCode, errorMsg });
              cleanup();
              reject(new Error(`阿里云ASR失败 [${errorCode}]: ${errorMsg}`));
              break;

            default:
              logger.warn('[阿里云ASR] 未知事件', { event: msg.header?.event });
          }
        } catch (err) {
          logger.error('[阿里云ASR] 消息处理错误', err as Error);
          cleanup();
          reject(err);
        }
      });

      ws.on('error', (err) => {
        logger.error('[阿里云ASR] WebSocket 错误', err as Error);
        cleanup();
        reject(new Error(`阿里云ASR连接错误: ${err.message}`));
      });

      ws.on('close', (code, reason) => {
        logger.info('[阿里云ASR] WebSocket 关闭', { code, reason: reason.toString() });
        if (!closed) {
          closed = true;
          clearTimeout(timeout);
          if (!taskStarted) {
            reject(new Error('阿里云ASR任务未启动就关闭了连接'));
          } else {
            // 正常关闭，返回已收集的结果
            resolve(finalText.trim());
          }
        }
      });
    });
  }
}

export default 语音识别服务;


