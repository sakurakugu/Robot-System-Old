import { v7 as uuidv7 } from 'uuid';
import { logger } from "../logger";

export { uuidv7 };

/**
 * 解析动作指令
 * 格式：
 * - {{action=action_name}}
 * - {{action=action_name,param=value}}
 * - {{action=action_name,another_action}} - 会解析为两个单独的动作
 */
export function parseActions(text: string): Array<{ name: string; parameters: Record<string, any> }> {
  const actions: Array<{ name: string; parameters: Record<string, any> }> = [];
  // 使用更宽松的正则匹配所有 {{action=...}} 标记
  const actionRegex = /\{\{\s*action\s*=\s*([^}]+)\}\}/g;
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    const content = match[1].trim();

    try {
      // 按逗号分割内容
      const parts = content.split(',').map(s => s.trim()).filter(Boolean);

      if (parts.length === 0) continue;

      // 第一个部分总是动作名
      const actionName = parts[0];
      const parameters: Record<string, any> = {};

      // 处理后续部分
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];

        if (part.includes('=')) {
          // 这是一个参数 (key=value)
          const [key, value] = part.split('=').map(s => s.trim());
          if (key && value !== undefined) {
            parameters[key] = isNaN(Number(value)) ? value : Number(value);
          }
        } else {
          // 这是另一个动作名（如 shake_hand），将其作为独立动作
          actions.push({ name: part, parameters: {} });
        }
      }

      // 添加主动作
      actions.push({ name: actionName, parameters });
    } catch (error) {
      logger.error(`解析动作失败: ${match[0]}`, error);
    }
  }

  return actions;
}

/**
 * 移除文本中的动作标记
 * 支持各种格式：{{action=name}}, {{action=name,param=value}}, {{action=name1,name2}} 等
 */
export function removeActionTags(text: string): string {
  // 使用更宽松的正则，匹配任何 {{action=...}} 格式的标记
  return text.replace(/\{\{\s*action\s*=\s*[^}]+\}\}/g, '').trim();
}

/**
 * 检测文本中是否包含视觉识别标记
 */
export function hasVisionTag(text: string): boolean {
  return /\{\{\s*vision\s*=\s*true\s*\}\}/i.test(text);
}

// export function shouldForceVisionForObjectNavigation(text: string): boolean {
//   const normalized = text.trim();
//   if (!normalized) return false;
//   if (!/(走向|前往|去往|靠近|接近|朝着|向着|移动到|去到|去找|导航到)/.test(normalized)) {
//     return false;
//   }
//   if (/(米|步|度|秒|分钟|厘米|cm|mm|\bm\b|\bs\b)/i.test(normalized)) {
//     return false;
//   }
//   if (!/[\u4e00-\u9fa5a-zA-Z0-9]/.test(normalized)) {
//     return false;
//   }
//   return true;
// }

export interface NormalizedTargetPosition {
  label: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export function parseNormalizedTargetPosition(text: string): NormalizedTargetPosition | undefined {
  const toUnit = (value: string): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  };
  const tagRegex = /\{\{\s*([^}]+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(text)) !== null) {
    const content = match[1];
    const kv: Record<string, string> = {};
    const parts = content.split(',').map(item => item.trim()).filter(Boolean);
    for (const part of parts) {
      const splitIndex = part.indexOf('=');
      if (splitIndex <= 0) continue;
      const key = part.slice(0, splitIndex).trim().toLowerCase();
      const value = part.slice(splitIndex + 1).trim();
      kv[key] = value;
    }
    if (!(kv.cx && kv.cy && kv.w && kv.h)) {
      continue;
    }
    return {
      label: kv.target || kv.action || 'target',
      cx: toUnit(kv.cx),
      cy: toUnit(kv.cy),
      w: toUnit(kv.w),
      h: toUnit(kv.h),
    };
  }
  return undefined;
}

export function removeTargetTags(text: string): string {
  return text.replace(/\{\{\s*target\s*=\s*[^}]+\}\}/gi, '').trim();
}

/**
 * 移除文本中的视觉标记
 */
export function removeVisionTags(text: string): string {
  return text.replace(/\{\{\s*vision\s*=\s*true\s*\}\}/gi, '').trim();
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * 计算处理时间
 */
export function calculateProcessingTime(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Base64编码
 */
export function base64Encode(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Base64解码
 */
export function base64Decode(str: string): Buffer {
  return Buffer.from(str, 'base64');
}

/**
 * 验证机器狗ID格式
 */
export function isValidRobotId(id: string): boolean {
  // UUID格式验证
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * 限流器
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // 移除过期的请求
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
