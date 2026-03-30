import { EventEmitter } from 'events';
import { WebSocket请求响应跟踪器 } from './request-response-tracker';

class 假连接 extends EventEmitter {
  override on(event: 'message' | 'close' | 'error', listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  override off(event: 'message' | 'close' | 'error', listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }
}

describe('WebSocket请求响应跟踪器', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('收到匹配响应后应返回结果并清理监听器', async () => {
    const tracker = new WebSocket请求响应跟踪器();
    const connection = new 假连接();

    const promise = tracker.等待响应(connection, {
      超时毫秒: 1000,
      超时消息: '请求超时',
      匹配器: (message) => {
        if (message.type === 'volume_response') {
          return message.data as Record<string, unknown>;
        }
        return undefined;
      },
    });

    connection.emit('message', Buffer.from('not-json'));
    connection.emit('message', Buffer.from(JSON.stringify({ type: 'other' })));
    connection.emit('message', Buffer.from(JSON.stringify({
      type: 'volume_response',
      data: { requestId: 'req-1', success: true },
    })));

    await expect(promise).resolves.toEqual({ requestId: 'req-1', success: true });
    expect(connection.listenerCount('message')).toBe(0);
    expect(connection.listenerCount('close')).toBe(0);
    expect(connection.listenerCount('error')).toBe(0);
  });

  it('超时后应拒绝并清理监听器', async () => {
    jest.useFakeTimers();

    const tracker = new WebSocket请求响应跟踪器();
    const connection = new 假连接();

    const promise = tracker.等待响应(connection, {
      超时毫秒: 500,
      超时消息: '等待超时',
      匹配器: () => undefined,
    });

    const assertion = expect(promise).rejects.toThrow('等待超时');
    await jest.advanceTimersByTimeAsync(500);

    await assertion;
    expect(connection.listenerCount('message')).toBe(0);
    expect(connection.listenerCount('close')).toBe(0);
    expect(connection.listenerCount('error')).toBe(0);
  });

  it('连接关闭后应立即拒绝并清理监听器', async () => {
    const tracker = new WebSocket请求响应跟踪器();
    const connection = new 假连接();

    const promise = tracker.等待响应(connection, {
      超时毫秒: 1000,
      超时消息: '等待超时',
      连接关闭消息: '机器人已断开',
      匹配器: () => undefined,
    });

    connection.emit('close');

    await expect(promise).rejects.toThrow('机器人已断开');
    expect(connection.listenerCount('message')).toBe(0);
    expect(connection.listenerCount('close')).toBe(0);
    expect(connection.listenerCount('error')).toBe(0);
  });
});
