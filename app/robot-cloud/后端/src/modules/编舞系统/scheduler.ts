/**
 * 编舞调度执行器
 * 根据编译后的 ExecutionPlan，按时间精确派发动作指令到各机器人
 */

import { logger } from '../../core/logger';
import type { 编舞执行消息网关 } from './execution-message-gateway';
import type {
    ChoreoWSMessage,
    ExecutionPlan,
    ScheduledAction,
} from './types';

export type SchedulerState = 'idle' | 'running' | 'paused' | 'stopped' | 'completed';

export class ChoreoScheduler {
  private state: SchedulerState = 'idle';
  private plan: ExecutionPlan | null = null;

  // 时间追踪
  private startRealTime = 0;       // 开始执行的真实时间（Date.now）
  private pausedAt = 0;            // 暂停时的播放时间（毫秒）
  private totalPausedDuration = 0; // 累计暂停时长

  // 定时器
  private actionTimers: ReturnType<typeof setTimeout>[] = [];
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private completionTimer: ReturnType<typeof setTimeout> | null = null;

  // 进度回调
  private onBroadcast: ((message: ChoreoWSMessage) => void) | null = null;

  constructor(private readonly 消息网关: 编舞执行消息网关) {}

  /**
   * 获取当前状态
   */
  getState(): SchedulerState {
    return this.state;
  }

  /**
   * 获取当前播放时间（毫秒）
   */
  getCurrentTime(): number {
    if (this.state === 'paused') return this.pausedAt;
    if (this.state !== 'running' || !this.plan) return 0;
    return Date.now() - this.startRealTime - this.totalPausedDuration;
  }

  /**
   * 获取当前进度（0-100）
   */
  getProgress(): number {
    if (!this.plan || this.plan.totalDuration === 0) return 0;
    return Math.min(100, Math.round((this.getCurrentTime() / this.plan.totalDuration) * 100));
  }

  /**
   * 启动执行
   */
  start(plan: ExecutionPlan, onBroadcast: (message: ChoreoWSMessage) => void): void {
    if (this.state === 'running') {
      this.stop('manual');
    }

    this.plan = plan;
    this.state = 'running';
    this.onBroadcast = onBroadcast;
    this.startRealTime = Date.now();
    this.totalPausedDuration = 0;
    this.pausedAt = 0;

    logger.info('编舞调度开始', {
      scheduleId: plan.scheduleId,
      totalDuration: plan.totalDuration,
      actionCount: plan.actions.length,
      robotCount: plan.robotIds.length,
    });

    // 广播开始
    this.broadcast({
      type: 'choreo_start',
      timestamp: Date.now(),
      data: {
        scheduleId: plan.scheduleId,
        totalDuration: plan.totalDuration,
        robotIds: plan.robotIds,
      },
    });

    // 禁用涉及机器人的收音
    for (const robotId of plan.robotIds) {
      this.消息网关.发送到机器人(robotId, {
        type: 'audio_control',
        robotId,
        timestamp: Date.now(),
        data: { enabled: false, source: 'system' },
      });
    }

    // 安排所有动作
    this.scheduleActions(plan.actions, 0);

    // 启动进度广播（每 500ms）
    this.progressInterval = setInterval(() => {
      if (this.state !== 'running' || !this.plan) return;
      this.broadcast({
        type: 'choreo_progress',
        timestamp: Date.now(),
        data: {
          scheduleId: this.plan.scheduleId,
          currentTime: this.getCurrentTime(),
          progress: this.getProgress(),
        },
      });
    }, 500);

    // 安排完成事件
    this.completionTimer = setTimeout(() => {
      this.complete();
    }, plan.totalDuration);
  }

  /**
   * 暂停执行
   */
  pause(): boolean {
    if (this.state !== 'running') return false;

    this.pausedAt = this.getCurrentTime();
    this.state = 'paused';

    // 清除所有待执行的定时器
    this.clearTimers();

    logger.info('编舞调度暂停', { scheduleId: this.plan?.scheduleId, pausedAt: this.pausedAt });
    return true;
  }

  /**
   * 恢复执行
   */
  resume(): boolean {
    if (this.state !== 'paused' || !this.plan) return false;

    const now = Date.now();
    // 累加暂停时长
    this.totalPausedDuration += now - (this.startRealTime + this.totalPausedDuration + this.pausedAt);
    // 修正：重新计算 startRealTime 使得 getCurrentTime() 从 pausedAt 继续
    this.startRealTime = now - this.pausedAt - this.totalPausedDuration;
    this.state = 'running';

    // 重新安排尚未执行的动作（executeAt > pausedAt 的动作）
    const remaining = this.plan.actions.filter(a => a.executeAt > this.pausedAt);
    this.scheduleActions(remaining, this.pausedAt);

    // 重启进度广播
    this.progressInterval = setInterval(() => {
      if (this.state !== 'running' || !this.plan) return;
      this.broadcast({
        type: 'choreo_progress',
        timestamp: Date.now(),
        data: {
          scheduleId: this.plan.scheduleId,
          currentTime: this.getCurrentTime(),
          progress: this.getProgress(),
        },
      });
    }, 500);

    // 重新安排完成事件
    const remainingTime = this.plan.totalDuration - this.pausedAt;
    this.completionTimer = setTimeout(() => {
      this.complete();
    }, remainingTime);

    logger.info('编舞调度恢复', { scheduleId: this.plan.scheduleId, resumeFrom: this.pausedAt });
    return true;
  }

  /**
   * 停止执行
   */
  stop(reason: 'manual' | 'error', message?: string): void {
    if (this.state === 'idle' || this.state === 'stopped' || this.state === 'completed') return;

    this.state = 'stopped';
    this.clearTimers();

    if (this.plan) {
      this.broadcast({
        type: 'choreo_stop',
        timestamp: Date.now(),
        data: {
          scheduleId: this.plan.scheduleId,
          reason,
          message,
        },
      });
    }

    logger.info('编舞调度停止', { scheduleId: this.plan?.scheduleId, reason, message });
    this.cleanup();
  }

  /**
   * 销毁调度器（释放资源）
   */
  destroy(): void {
    this.clearTimers();
    this.cleanup();
  }

  // ==================== 内部方法 ====================

  /**
   * 安排动作执行
   */
  private scheduleActions(actions: ScheduledAction[], baseTime: number): void {
    for (const action of actions) {
      const delay = action.executeAt - baseTime;
      if (delay < 0) continue; // 跳过已过期的动作

      const timer = setTimeout(() => {
        if (this.state !== 'running') return;
        this.executeAction(action);
      }, delay);

      this.actionTimers.push(timer);
    }
  }

  /**
   * 执行单个动作
   */
  private executeAction(action: ScheduledAction): void {
    const { robotId, action: actionName, parameters } = action;

    // 通过 WebSocket 发送动作指令到机器人
    this.消息网关.发送到机器人(robotId, {
      type: 'action_command',
      robotId,
      timestamp: Date.now(),
      data: {
        action: actionName,
        parameters: parameters || {},
      },
    });

    // 广播当前执行的动作（给 UI 显示）
    if (this.plan) {
      this.broadcast({
        type: 'choreo_action',
        timestamp: Date.now(),
        data: {
          scheduleId: this.plan.scheduleId,
          robotId,
          action: actionName,
          parameters,
        },
      });
    }
  }

  /**
   * 执行完成
   */
  private complete(): void {
    if (this.state !== 'running') return;

    this.state = 'completed';
    this.clearTimers();

    if (this.plan) {
      this.broadcast({
        type: 'choreo_complete',
        timestamp: Date.now(),
        data: {
          scheduleId: this.plan.scheduleId,
          totalDuration: this.plan.totalDuration,
        },
      });

      logger.info('编舞调度完成', { scheduleId: this.plan.scheduleId });
    }

    this.cleanup();
  }

  /**
   * 清除所有定时器
   */
  private clearTimers(): void {
    for (const timer of this.actionTimers) {
      clearTimeout(timer);
    }
    this.actionTimers = [];

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    if (this.completionTimer) {
      clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }
  }

  /**
   * 广播消息
   */
  private broadcast(message: ChoreoWSMessage): void {
    this.onBroadcast?.(message);
  }

  /**
   * 清理状态
   */
  private cleanup(): void {
    this.plan = null;
    this.onBroadcast = null;
  }
}
