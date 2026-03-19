import { RateLimiter } from '../../core/utils/helpers';
import { Action, SafetyCheckResult, SafetyRule } from './types';

export class 动作控制器 {
  // 动作白名单
  private readonly ALLOWED_ACTIONS = new Set([
    'stand_up',
    'sit_down',
    'shake_hand',
    'wave',
    'nod',
    'dance',
    'walk_forward',
    'walk_backward',
    'jump',
    'move',
    'approach_target',
  ]);

  // 安全规则
  private readonly SAFETY_RULES: SafetyRule[] = [
    { action: 'walk_forward', maxValue: 3 },
    { action: 'walk_backward', maxValue: 3 },
    { action: 'turn_left', maxValue: 720 },
    { action: 'turn_right', maxValue: 720 },
    { action: 'move', maxValue: 5 }, // duration最大5秒
    { action: 'approach_target', maxValue: 8 },
  ];

  // 频率限制器 (每分钟最多10次动作)
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter(10, 60000); // 10次/分钟
  }

  /**
   * 检查动作是否安全
   */
  检查动作安全(robotId: string, action: Action): SafetyCheckResult {
    // 检查频率限制
    if (!this.rateLimiter.check(robotId)) {
      return {
        safe: false,
        reason: '动作执行频率过高，请稍后再试',
      };
    }

    // 检查是否在白名单中
    if (!this.ALLOWED_ACTIONS.has(action.name)) {
      return {
        safe: false,
        reason: `动作 "${action.name}" 不在允许列表中`,
      };
    }

    // 检查参数范围
    const rule = this.SAFETY_RULES.find(r => r.action === action.name);
    if (rule) {
      // 特殊处理move动作的参数验证
      if (action.name === 'move') {
        const sanitizedAction = { ...action };
        let modified = false;

        // 方式1：距离/步数/角度控制
        if (action.parameters.distance !== undefined) {
          const distance = Number(action.parameters.distance);
          if (Math.abs(distance) > 5) {
            sanitizedAction.parameters = { ...action.parameters, distance: Math.sign(distance) * 5 };
            modified = true;
          }
        }

        if (action.parameters.steps !== undefined) {
          const steps = Number(action.parameters.steps);
          if (Math.abs(steps) > 10) {
            sanitizedAction.parameters = { ...action.parameters, steps: Math.sign(steps) * 10 };
            modified = true;
          }
        }

        if (action.parameters.angle !== undefined) {
          const angle = Number(action.parameters.angle);
          if (Math.abs(angle) > 360) {
            sanitizedAction.parameters = { ...action.parameters, angle: Math.sign(angle) * 360 };
            modified = true;
          }
        }

        // 验证 direction 参数
        if (action.parameters.direction !== undefined) {
          const validDirections = ['forward', 'backward', 'left', 'right'];
          if (!validDirections.includes(action.parameters.direction)) {
            return {
              safe: false,
              reason: `无效的移动方向，必须是: ${validDirections.join(', ')}`,
            };
          }
        }

        // 方式2：速度控制
        if (action.parameters.vx !== undefined) {
          const vx = Number(action.parameters.vx);
          if (Math.abs(vx) > 0.3) {
            sanitizedAction.parameters = { ...action.parameters, vx: Math.sign(vx) * 0.3 };
            modified = true;
          }
        }
        if (action.parameters.vy !== undefined) {
          const vy = Number(action.parameters.vy);
          if (Math.abs(vy) > 0.2) {
            sanitizedAction.parameters = { ...action.parameters, vy: Math.sign(vy) * 0.2 };
            modified = true;
          }
        }
        if (action.parameters.yaw_rate !== undefined) {
          const yaw = Number(action.parameters.yaw_rate);
          if (Math.abs(yaw) > 0.5) {
            sanitizedAction.parameters = { ...action.parameters, yaw_rate: Math.sign(yaw) * 0.5 };
            modified = true;
          }
        }

        // 验证持续时间
        if (action.parameters.duration !== undefined) {
          const duration = Number(action.parameters.duration);
          if (duration > rule.maxValue!) {
            sanitizedAction.parameters = { ...sanitizedAction.parameters, duration: rule.maxValue };
            modified = true;
          } else if (duration < 0) {
            return {
              safe: false,
              reason: '持续时间不能为负数',
            };
          }
        }

        if (modified) {
          return {
            safe: true,
            reason: '参数已自动调整到安全范围',
            sanitizedAction,
          };
        }
      } else if (action.name === 'approach_target') {
        const sanitizedAction = { ...action, parameters: { ...action.parameters } };
        let modified = false;
        const clamp01 = (value: any, key: string) => {
          const n = Number(value);
          if (!Number.isFinite(n)) {
            sanitizedAction.parameters[key] = 0.5;
            modified = true;
            return;
          }
          if (n < 0) {
            sanitizedAction.parameters[key] = 0;
            modified = true;
            return;
          }
          if (n > 1) {
            sanitizedAction.parameters[key] = 1;
            modified = true;
            return;
          }
          sanitizedAction.parameters[key] = n;
        };
        clamp01(action.parameters.cx, 'cx');
        clamp01(action.parameters.cy, 'cy');
        clamp01(action.parameters.w, 'w');
        clamp01(action.parameters.h, 'h');

        const stopArea = Number(action.parameters.stop_area ?? 0.22);
        if (!Number.isFinite(stopArea) || stopArea <= 0) {
          sanitizedAction.parameters.stop_area = 0.22;
          modified = true;
        } else if (stopArea > 0.8) {
          sanitizedAction.parameters.stop_area = 0.8;
          modified = true;
        } else {
          sanitizedAction.parameters.stop_area = stopArea;
        }

        const maxSeconds = Number(action.parameters.max_seconds ?? 6);
        if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) {
          sanitizedAction.parameters.max_seconds = 6;
          modified = true;
        } else if (maxSeconds > rule.maxValue!) {
          sanitizedAction.parameters.max_seconds = rule.maxValue;
          modified = true;
        } else {
          sanitizedAction.parameters.max_seconds = maxSeconds;
        }

        if (modified) {
          return {
            safe: true,
            reason: '参数已自动调整到安全范围',
            sanitizedAction,
          };
        }
      } else {
        // 检查步数、角度等参数
        const paramValue = action.parameters.steps || action.parameters.angle || action.parameters.value;

        if (paramValue !== undefined) {
          if (rule.maxValue && paramValue > rule.maxValue) {
            // 自动修正参数
            const sanitizedAction = { ...action };
            const paramKey = action.parameters.steps !== undefined ? 'steps'
              : action.parameters.angle !== undefined ? 'angle'
              : 'value';

            sanitizedAction.parameters = {
              ...action.parameters,
              [paramKey]: rule.maxValue,
            };

            return {
              safe: true,
              reason: `参数值超出安全范围，已自动调整为 ${rule.maxValue}`,
              sanitizedAction,
            };
          }

          if (rule.minValue && paramValue < rule.minValue) {
            return {
              safe: false,
              reason: `参数值低于最小值 ${rule.minValue}`,
            };
          }
        }
      }
    }

    return { safe: true };
  }

  /**
   * 安全化动作参数
   */
  安全化动作参数(action: Action): Action {
    const checkResult = this.检查动作安全('sanitize', action);
    return checkResult.sanitizedAction || action;
  }

  /**
   * 获取允许的动作列表
   */
  获取允许动作(): string[] {
    return Array.from(this.ALLOWED_ACTIONS);
  }

  /**
   * 验证多个动作
   */
  验证动作(robotId: string, actions: Action[]): {
    validActions: Action[];
    rejectedActions: Array<{ action: Action; reason: string }>;
  } {
    const validActions: Action[] = [];
    const rejectedActions: Array<{ action: Action; reason: string }> = [];

    for (const action of actions) {
      const checkResult = this.检查动作安全(robotId, action);
      if (checkResult.safe) {
        validActions.push(checkResult.sanitizedAction || action);
      } else {
        rejectedActions.push({
          action,
          reason: checkResult.reason || '未知错误',
        });
      }
    }

    return { validActions, rejectedActions };
  }
}

export default 动作控制器;

export { 动作控制器 as ActionController };
