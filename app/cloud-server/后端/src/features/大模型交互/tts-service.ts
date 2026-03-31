import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import path from 'path';
import { logger } from '../../infra/logger';
import { uuidv7 } from '../../infra/utils/helpers';
import { AudioResponse, TTSOptions } from '../../types';

type PendingRequest = {
  resolve: (audio: AudioResponse) => void;
  reject: (error: Error) => void;
  chunks: Uint8Array[];
  format: 'mp3';
  onChunk?: (chunk: { seq: number; base64: string; format: 'mp3' }) => void;
  streamChunks: Uint8Array[];
  streamChunkBytes: number;
  streamSeq: number;
};

const 流式最小推送字节 = 24 * 1024;

class 语音合成服务 {
  private proc?: ChildProcessWithoutNullStreams;
  private stdoutBuffer = '';
  private pending = new Map<string, PendingRequest>();
  private pythonCommand: string = process.platform === 'win32' ? 'python' : 'python3';

  constructor() {
    this.ensureProcess();
  }

  async synthesize(text: string, options?: TTSOptions): Promise<AudioResponse> {
    return this.synthesizeStream(text, options);
  }

  async synthesizeStream(
    text: string,
    options?: TTSOptions,
    onChunk?: (chunk: { seq: number; base64: string; format: 'mp3' }) => void
  ): Promise<AudioResponse> {
    this.ensureProcess();
    const id = uuidv7();
    return new Promise<AudioResponse>((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        chunks: [],
        format: 'mp3',
        onChunk,
        streamChunks: [],
        streamChunkBytes: 0,
        streamSeq: 0,
      });
      const payload = {
        id,
        text,
        voice: options?.voice || 'zh-CN-XiaoxiaoNeural',
        speed: options?.speed ?? 0,
        pitch: options?.pitch ?? 0,
        volume: options?.volume ?? 0,
      };
      const proc = this.proc;
      if (!proc || !proc.stdin.writable) {
        this.pending.delete(id);
        reject(new Error('TTS进程未就绪'));
        return;
      }
      proc.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  private ensureProcess(): void {
    if (this.proc && !this.proc.killed) {
      return;
    }
    const scriptPath = path.join(__dirname, '../../core/scripts/edge_tts_runner.py');
    const proc = spawn(this.pythonCommand, ['-u', scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    this.proc = proc;

    proc.stdout.on('data', (d) => this.handleStdout(d));
    proc.stderr.on('data', () => {});
    proc.on('error', (err) => this.handleExit(err));
    proc.on('close', (code) => {
      if (code !== 0) {
        this.handleExit(new Error(`edge-tts 意外退出，代码 ${code}`));
      } else {
        this.handleExit(new Error('edge-tts 已退出'));
      }
    });
  }

  private handleStdout(data: Buffer): void {
    try {
      this.stdoutBuffer += data.toString('utf8');
    } catch (error) {
      logger.error('[TTS] UTF-8 解码错误:', error);
      return;
    }
    let index = this.stdoutBuffer.indexOf('\n');
    while (index !== -1) {
      const line = this.stdoutBuffer.slice(0, index).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(index + 1);
      if (line) {
        this.handleLine(line);
      }
      index = this.stdoutBuffer.indexOf('\n');
    }
  }

  private handleLine(line: string): void {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const id = String(msg?.id || '');
    if (!id) {
      return;
    }
    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }
    if (msg.type === 'chunk') {
      const base64 = String(msg.data || '');
      if (base64) {
        const decoded = Buffer.from(base64, 'base64');
        const chunkBytes = Uint8Array.from(decoded);
        pending.chunks.push(chunkBytes);
        if (pending.onChunk) {
          pending.streamChunks.push(chunkBytes);
          pending.streamChunkBytes += chunkBytes.length;
          if (pending.streamChunkBytes >= 流式最小推送字节) {
            const mergedChunk = Buffer.concat(pending.streamChunks as Uint8Array[]);
            pending.streamChunks = [];
            pending.streamChunkBytes = 0;
            pending.streamSeq += 1;
            pending.onChunk({
              seq: pending.streamSeq,
              base64: mergedChunk.toString('base64'),
              format: pending.format,
            });
          }
        }
      }
      return;
    }
    if (msg.type === 'end') {
      this.pending.delete(id);
      if (pending.onChunk && pending.streamChunks.length > 0) {
        const mergedChunk = Buffer.concat(pending.streamChunks as Uint8Array[]);
        pending.streamChunks = [];
        pending.streamChunkBytes = 0;
        pending.streamSeq += 1;
        pending.onChunk({
          seq: pending.streamSeq,
          base64: mergedChunk.toString('base64'),
          format: pending.format,
        });
      }
      const buffer = Buffer.concat(pending.chunks as Uint8Array[]);
      pending.resolve({
        format: pending.format,
        buffer: buffer.toString('base64'),
        duration: Number(msg.duration || 0),
      });
      return;
    }
    if (msg.type === 'error') {
      this.pending.delete(id);
      pending.reject(new Error(String(msg.message || 'TTS失败')));
    }
  }

  private handleExit(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
    this.proc = undefined;
  }
}

export default 语音合成服务;

export { 语音合成服务 as TTSService };

