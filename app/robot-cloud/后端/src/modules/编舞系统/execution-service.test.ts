import { 编舞执行服务 } from './execution-service';
import type {
  ChoreoWSMessage,
  ExecutionPlan,
} from './types';

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

type WebSocket服务Mock = {
  broadcast: jest.Mock;
};

type 调度器Mock = {
  start: jest.Mock;
  pause: jest.Mock;
  resume: jest.Mock;
  stop: jest.Mock;
  getCurrentTime: jest.Mock;
  getProgress: jest.Mock;
};

function 创建WebSocket服务Mock(): WebSocket服务Mock {
  return {
    broadcast: jest.fn(),
  };
}

function 创建调度器Mock(): 调度器Mock {
  return {
    start: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
    getCurrentTime: jest.fn(() => 0),
    getProgress: jest.fn(() => 0),
  };
}

function 创建执行计划(): ExecutionPlan {
  return {
    scheduleId: 'schedule-1',
    projectUuid: 'project-1',
    totalDuration: 5000,
    robotIds: ['robot-1'],
    actions: [
      {
        robotId: 'robot-1',
        action: 'forward',
        executeAt: 1000,
        duration: 500,
      },
    ],
  };
}

describe('编舞执行服务', () => {
  it('启动执行应创建状态并响应广播更新', () => {
    const ws服务 = 创建WebSocket服务Mock();
    const 调度器 = 创建调度器Mock();
    let 广播回调: ((message: ChoreoWSMessage) => void) | undefined;
    调度器.start.mockImplementation((_plan, onBroadcast) => {
      广播回调 = onBroadcast;
    });

    const 服务 = new 编舞执行服务(() => 调度器 as any);
    服务.setWebSocketService(ws服务 as any);

    const 计划 = 创建执行计划();
    const 状态 = 服务.startExecution(计划);

    expect(状态.executionId).toBe('schedule-1');
    expect(状态.status).toBe('running');
    expect(调度器.start).toHaveBeenCalledWith(计划, expect.any(Function));

    广播回调!({
      type: 'choreo_progress',
      timestamp: Date.now(),
      data: {
        scheduleId: 'schedule-1',
        currentTime: 1200,
        progress: 24,
      },
    });
    调度器.getCurrentTime.mockReturnValue(1200);
    调度器.getProgress.mockReturnValue(24);

    const 最新状态 = 服务.getExecutionStatus('schedule-1');
    expect(最新状态?.currentTime).toBe(1200);
    expect(最新状态?.progress).toBe(24);
    expect(ws服务.broadcast).toHaveBeenCalled();

    广播回调!({
      type: 'choreo_complete',
      timestamp: Date.now(),
      data: {
        scheduleId: 'schedule-1',
        totalDuration: 5000,
      },
    });

    expect(服务.getExecutionStatus('schedule-1')?.status).toBe('completed');
  });

  it('暂停恢复停止应委托调度器并维护执行状态', () => {
    const ws服务 = 创建WebSocket服务Mock();
    const 调度器 = 创建调度器Mock();
    调度器.pause.mockReturnValue(true);
    调度器.resume.mockReturnValue(true);
    调度器.getCurrentTime.mockReturnValue(1600);
    调度器.getProgress.mockReturnValue(32);

    const 服务 = new 编舞执行服务(() => 调度器 as any);
    服务.setWebSocketService(ws服务 as any);
    服务.startExecution(创建执行计划());

    expect(服务.pauseExecution('schedule-1')).toBe(true);
    expect(服务.getExecutionStatus('schedule-1')?.status).toBe('paused');
    expect(服务.getExecutionStatus('schedule-1')?.currentTime).toBe(1600);

    expect(服务.resumeExecution('schedule-1')).toBe(true);
    expect(服务.getExecutionStatus('schedule-1')?.status).toBe('running');

    expect(服务.stopExecution('schedule-1')).toBe(true);
    expect(调度器.stop).toHaveBeenCalledWith('manual');
    expect(服务.getExecutionStatus('schedule-1')?.status).toBe('stopped');
    expect(服务.getRunningExecutions()).toEqual([]);
  });

  it('未注入 WebSocket 服务时不应启动执行', () => {
    const 服务 = new 编舞执行服务();

    expect(() => 服务.startExecution(创建执行计划())).toThrow('WebSocket 服务未初始化');
  });
});
