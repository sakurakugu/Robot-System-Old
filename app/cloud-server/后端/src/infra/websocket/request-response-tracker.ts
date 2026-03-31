export interface 可监听消息连接 {
  on(event: 'message' | 'close' | 'error', listener: (...args: unknown[]) => void): void;
  off(event: 'message' | 'close' | 'error', listener: (...args: unknown[]) => void): void;
}

export interface 等待响应选项<T> {
  超时毫秒: number;
  超时消息: string;
  连接关闭消息?: string;
  匹配器: (message: Record<string, unknown>) => T | undefined;
}

function 转换为文本(data: unknown): string | null {
  if (typeof data === 'string') {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data.toString();
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString();
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString();
  }

  if (Array.isArray(data) && data.every((item) => Buffer.isBuffer(item))) {
    return data.map((item) => item.toString()).join('');
  }

  return null;
}

function 解析消息(data: unknown): Record<string, unknown> | null {
  const text = 转换为文本(data);
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 忽略无法解析的消息，继续等待后续响应
  }

  return null;
}

export class WebSocket请求响应跟踪器 {
  等待响应<T>(连接: 可监听消息连接, 选项: 等待响应选项<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let 已完成 = false;

      const 清理 = () => {
        clearTimeout(超时定时器);
        连接.off('message', 处理消息);
        连接.off('close', 处理关闭);
        连接.off('error', 处理错误);
      };

      const 结束 = (执行: () => void) => {
        if (已完成) {
          return;
        }
        已完成 = true;
        清理();
        执行();
      };

      const 处理消息 = (data: unknown) => {
        const message = 解析消息(data);
        if (!message) {
          return;
        }

        const 匹配结果 = 选项.匹配器(message);
        if (匹配结果 === undefined) {
          return;
        }

        结束(() => resolve(匹配结果));
      };

      const 处理关闭 = () => {
        结束(() => reject(new Error(选项.连接关闭消息 || '连接已关闭')));
      };

      const 处理错误 = (error: unknown) => {
        const err = error instanceof Error ? error : new Error('连接发生未知错误');
        结束(() => reject(err));
      };

      const 超时定时器 = setTimeout(() => {
        结束(() => reject(new Error(选项.超时消息)));
      }, 选项.超时毫秒);

      连接.on('message', 处理消息);
      连接.on('close', 处理关闭);
      连接.on('error', 处理错误);
    });
  }
}
