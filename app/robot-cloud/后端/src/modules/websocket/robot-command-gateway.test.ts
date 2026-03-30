import { EventEmitter } from 'events';
import type { RobotConnection } from '../../types';
import { 机器人命令网关 } from './robot-command-gateway';

jest.mock('../../core/utils/helpers', () => ({
  uuidv7: jest.fn(() => 'generated-request-id'),
}));

class 假WebSocket extends EventEmitter {}

function 创建业务连接(websocket: 假WebSocket): RobotConnection {
  return {
    robotId: 'robot-1',
    websocket,
    connectedAt: new Date('2026-03-30T00:00:00.000Z'),
    lastActiveAt: new Date('2026-03-30T00:00:00.000Z'),
    channel: 'business',
    metadata: {},
  };
}

describe('机器人命令网关', () => {
  it('应发送带 requestId 的业务命令并等待匹配响应', async () => {
    const websocket = new 假WebSocket();
    const 获取业务连接 = jest.fn(() => 创建业务连接(websocket));
    const 发送消息 = jest.fn(() => true);
    const 网关 = new 机器人命令网关({
      获取业务连接,
      发送消息,
      生成请求ID: () => 'req-1',
      获取当前时间: () => 1234567890,
    });

    const 响应Promise = 网关.请求获取机器人配置('robot-1');

    expect(发送消息).toHaveBeenCalledWith('robot-1', {
      type: 'config_get',
      robotId: 'robot-1',
      timestamp: 1234567890,
      data: {
        requestId: 'req-1',
      },
    });

    websocket.emit('message', JSON.stringify({
      type: 'config_response',
      data: {
        requestId: 'other-id',
        success: true,
        data: { ignored: true },
      },
    }));

    websocket.emit('message', JSON.stringify({
      type: 'config_response',
      data: {
        requestId: 'req-1',
        success: true,
        data: { sdkMode: true },
      },
    }));

    await expect(响应Promise).resolves.toEqual({
      requestId: 'req-1',
      success: true,
      data: { sdkMode: true },
    });
    expect(获取业务连接).toHaveBeenCalledWith('robot-1');
  });

  it('发送失败时应抛出对应错误', async () => {
    const websocket = new 假WebSocket();
    const 网关 = new 机器人命令网关({
      获取业务连接: () => 创建业务连接(websocket),
      发送消息: () => false,
      生成请求ID: () => 'req-2',
    });

    await expect(
      网关.请求设置SDK模式('robot-1', true),
    ).rejects.toThrow('发送设置SDK模式命令失败');
  });
});
