import { 创建编舞执行消息网关 } from './execution-message-gateway';

describe('编舞执行消息网关', () => {
  it('发送机器人消息时应固定走 business 通道', () => {
    const 宿主 = {
      sendToRobot: jest.fn(),
      broadcast: jest.fn(),
    };
    const 网关 = 创建编舞执行消息网关(宿主);

    网关.发送到机器人('robot-1', {
      type: 'action_command',
      robotId: 'robot-1',
      timestamp: 1,
      data: { action: 'sit' },
    });

    expect(宿主.sendToRobot).toHaveBeenCalledWith(
      'robot-1',
      expect.objectContaining({
        type: 'action_command',
      }),
      'business',
    );
  });

  it('广播执行消息时应固定走 business 通道', () => {
    const 宿主 = {
      sendToRobot: jest.fn(),
      broadcast: jest.fn(),
    };
    const 网关 = 创建编舞执行消息网关(宿主);

    网关.广播执行消息({
      type: 'choreo_progress',
      timestamp: 1,
      data: {
        scheduleId: 'schedule-1',
        currentTime: 1000,
        progress: 20,
      },
    });

    expect(宿主.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'choreo_progress',
      }),
      'business',
    );
  });
});
