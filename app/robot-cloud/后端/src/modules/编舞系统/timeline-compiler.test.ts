import { logger } from '../../core/logger';
import { 编舞时间轴编译器 } from './timeline-compiler';
import type { TimelineData } from './types';

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mocked-schedule-id'),
}));

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function 创建时间轴数据(): TimelineData {
  return {
    tracks: [
      {
        id: 'audio-1',
        name: '音频轨',
        type: 'audio',
      },
      {
        id: 'track-1',
        name: '动作轨一',
        type: 'action',
        robotId: 'robot-track',
        blocks: [
          {
            id: 'block-1',
            name: '前进',
            startTime: 2,
            duration: 1.5,
            actionType: 'forward',
            actionParams: { speed: 1 },
          },
          {
            id: 'block-2',
            name: '转身',
            startTime: 1,
            duration: 0.5,
            actionType: 'turn',
            robotId: 'robot-block',
          },
        ],
      },
      {
        id: 'track-2',
        name: '动作轨二',
        type: 'action',
        robotId: 'robot-track',
        blocks: [
          {
            id: 'block-3',
            name: '无动作',
            startTime: 0,
            duration: 1,
          },
        ],
      },
    ],
    config: {
      duration: 12,
      pixelsPerSecond: 100,
      currentTime: 0,
      snapToGrid: true,
      gridSize: 0.5,
    },
  };
}

describe('编舞时间轴编译器', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应生成按时间排序的执行计划并支持块级机器人覆盖', () => {
    const 编译器 = new 编舞时间轴编译器(() => 'schedule-1');

    const 计划 = 编译器.compile('project-1', 创建时间轴数据());

    expect(计划).toEqual({
      scheduleId: 'schedule-1',
      projectUuid: 'project-1',
      totalDuration: 12000,
      robotIds: ['robot-track', 'robot-block'],
      actions: [
        {
          robotId: 'robot-block',
          action: 'turn',
          parameters: undefined,
          executeAt: 1000,
          duration: 500,
        },
        {
          robotId: 'robot-track',
          action: 'forward',
          parameters: { speed: 1 },
          executeAt: 2000,
          duration: 1500,
        },
      ],
    });
    expect(logger.info).toHaveBeenCalledWith('时间轴编译完成', expect.objectContaining({
      scheduleId: 'schedule-1',
      actionCount: 2,
      robotCount: 2,
      totalDuration: 12000,
    }));
  });

  it('同一机器人同一时刻冲突时应记录警告', () => {
    const 编译器 = new 编舞时间轴编译器(() => 'schedule-2');
    const 时间轴数据: TimelineData = {
      tracks: [
        {
          id: 'track-1',
          name: '动作轨',
          type: 'action',
          robotId: 'robot-1',
          blocks: [
            {
              id: 'block-1',
              name: '前进',
              startTime: 1,
              duration: 1,
              actionType: 'forward',
            },
            {
              id: 'block-2',
              name: '后退',
              startTime: 1,
              duration: 1,
              actionType: 'backward',
            },
          ],
        },
      ],
      config: {
        duration: 5,
        pixelsPerSecond: 100,
        currentTime: 0,
        snapToGrid: true,
        gridSize: 0.5,
      },
    };

    编译器.compile('project-2', 时间轴数据);

    expect(logger.warn).toHaveBeenCalledWith('检测到同一机器人同一时刻的冲突动作', {
      robotId: 'robot-1',
      time: 1000,
      action1: 'forward',
      action2: 'backward',
    });
  });
});
