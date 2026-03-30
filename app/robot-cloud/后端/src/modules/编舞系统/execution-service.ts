import { logger } from '../../core/logger';
import type WebSocketService from '../websocket/service';
import { ChoreoScheduler } from './scheduler';
import type {
  ChoreoWSMessage,
  ExecutionPlan,
  ExecutionStatus,
} from './types';

type 编舞调度器 = Pick<
  ChoreoScheduler,
  'start' | 'pause' | 'resume' | 'stop' | 'getCurrentTime' | 'getProgress'
>;

/**
 * 编舞执行服务
 * 负责调度器创建、执行状态维护和广播生命周期管理
 */
export class 编舞执行服务 {
  private readonly executions: Map<string, ExecutionStatus> = new Map();
  private readonly schedulers: Map<string, 编舞调度器> = new Map();
  private wsService?: WebSocketService;

  constructor(
    private readonly 创建调度器: (wsService: WebSocketService) => 编舞调度器 =
      (wsService) => new ChoreoScheduler(wsService),
  ) {}

  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
  }

  startExecution(plan: ExecutionPlan): ExecutionStatus {
    if (!this.wsService) {
      throw new Error('WebSocket 服务未初始化');
    }

    if (plan.actions.length === 0) {
      throw new Error('时间轴中没有可执行的动作（请确保动作块已绑定机器人且已选择动作类型）');
    }

    if (plan.robotIds.length === 0) {
      throw new Error('没有绑定机器人的轨道，无法执行');
    }

    const scheduler = this.创建调度器(this.wsService);
    const executionId = plan.scheduleId;
    const status: ExecutionStatus = {
      executionId,
      scheduleId: plan.scheduleId,
      status: 'running',
      currentTime: 0,
      progress: 0,
      startedAt: new Date().toISOString(),
    };

    this.executions.set(executionId, status);
    this.schedulers.set(executionId, scheduler);

    scheduler.start(plan, (message) => {
      this.处理广播消息(executionId, status, message);
    });

    logger.info('编舞执行已启动', {
      executionId,
      projectUuid: plan.projectUuid,
      actionCount: plan.actions.length,
      robotCount: plan.robotIds.length,
    });

    return status;
  }

  pauseExecution(executionId: string): boolean {
    const scheduler = this.schedulers.get(executionId);
    const status = this.executions.get(executionId);
    if (!scheduler || !status) {
      return false;
    }

    const result = scheduler.pause();
    if (result) {
      status.status = 'paused';
      status.currentTime = scheduler.getCurrentTime();
    }
    return result;
  }

  resumeExecution(executionId: string): boolean {
    const scheduler = this.schedulers.get(executionId);
    const status = this.executions.get(executionId);
    if (!scheduler || !status) {
      return false;
    }

    const result = scheduler.resume();
    if (result) {
      status.status = 'running';
    }
    return result;
  }

  stopExecution(executionId: string): boolean {
    const scheduler = this.schedulers.get(executionId);
    const status = this.executions.get(executionId);
    if (!status || (status.status !== 'running' && status.status !== 'paused')) {
      return false;
    }

    if (scheduler) {
      scheduler.stop('manual');
      this.schedulers.delete(executionId);
    }

    status.status = 'stopped';
    return true;
  }

  getExecutionStatus(executionId: string): ExecutionStatus | undefined {
    const status = this.executions.get(executionId);
    const scheduler = this.schedulers.get(executionId);
    if (status && scheduler) {
      status.currentTime = scheduler.getCurrentTime();
      status.progress = scheduler.getProgress();
    }
    return status;
  }

  getRunningExecutions(): ExecutionStatus[] {
    return Array.from(this.executions.values()).filter(
      (status) => status.status === 'running' || status.status === 'paused',
    );
  }

  private 处理广播消息(
    executionId: string,
    status: ExecutionStatus,
    message: ChoreoWSMessage,
  ): void {
    this.wsService!.broadcast(
      message as unknown as import('../../types').ServerMessage,
      'business',
    );

    if (message.type === 'choreo_progress') {
      status.currentTime = message.data.currentTime;
      status.progress = message.data.progress;
      return;
    }

    if (message.type === 'choreo_complete') {
      status.status = 'completed';
      status.progress = 100;
      status.currentTime = message.data.totalDuration;
      this.schedulers.delete(executionId);
      return;
    }

    if (message.type === 'choreo_stop') {
      status.status = 'stopped';
      status.message = message.data.message;
      this.schedulers.delete(executionId);
    }
  }
}

export default 编舞执行服务;
