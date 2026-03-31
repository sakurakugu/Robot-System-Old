import { v7 as uuidv7 } from 'uuid';
import { logger } from '../../infra/logger';
import type {
  ExecutionPlan,
  ScheduledAction,
  TimelineData,
} from './types';

type 时间轴ID生成器 = () => string;

/**
 * 编舞时间轴编译器
 * 负责将时间轴数据转换为可执行计划
 */
export class 编舞时间轴编译器 {
  constructor(
    private readonly 生成计划ID: 时间轴ID生成器 = uuidv7,
  ) {}

  compile(projectUuid: string, timelineData: TimelineData): ExecutionPlan {
    const { tracks, config } = timelineData;
    const scheduleId = this.生成计划ID();
    const actions: ScheduledAction[] = [];
    const robotIdSet = new Set<string>();

    for (const track of tracks) {
      if (track.type !== 'action') {
        continue;
      }

      const blocks = track.blocks ?? [];
      for (const block of blocks) {
        const robotId = block.robotId || track.robotId;
        if (!robotId) {
          continue;
        }

        const actionName = block.actionType;
        if (!actionName) {
          continue;
        }

        robotIdSet.add(robotId);
        actions.push({
          robotId,
          action: actionName,
          parameters: block.actionParams,
          executeAt: Math.round(block.startTime * 1000),
          duration: Math.round(block.duration * 1000),
        });
      }
    }

    actions.sort((a, b) => a.executeAt - b.executeAt);

    for (let i = 0; i < actions.length - 1; i++) {
      const current = actions[i];
      const next = actions[i + 1];
      if (current.robotId === next.robotId && current.executeAt === next.executeAt) {
        logger.warn('检测到同一机器人同一时刻的冲突动作', {
          robotId: current.robotId,
          time: current.executeAt,
          action1: current.action,
          action2: next.action,
        });
      }
    }

    const totalDuration = Math.round(config.duration * 1000);

    logger.info('时间轴编译完成', {
      scheduleId,
      actionCount: actions.length,
      robotCount: robotIdSet.size,
      totalDuration,
    });

    return {
      scheduleId,
      projectUuid,
      totalDuration,
      actions,
      robotIds: Array.from(robotIdSet),
    };
  }
}

export default 编舞时间轴编译器;
