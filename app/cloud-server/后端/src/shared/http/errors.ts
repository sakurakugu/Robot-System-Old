export class HttpError extends Error {
  constructor(
    public readonly 状态码: number,
    消息: string,
    public readonly 错误码?: string,
    public readonly 详情?: unknown,
  ) {
    super(消息);
    this.name = 'HttpError';
  }
}

export type Http错误匹配器 =
  | string
  | RegExp
  | ((错误: Error) => boolean);

export interface Http错误映射规则 {
  匹配: Http错误匹配器 | Http错误匹配器[];
  状态码: number;
  错误码?: string;
}

function 归一化错误(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error('服务器内部错误');
}

function 匹配错误(错误: Error, 匹配器: Http错误匹配器): boolean {
  if (typeof 匹配器 === 'string') {
    return 错误.message === 匹配器 || 错误.message.includes(匹配器);
  }
  if (匹配器 instanceof RegExp) {
    return 匹配器.test(错误.message);
  }
  return 匹配器(错误);
}

export function 规范化Http错误(
  error: unknown,
  默认状态码: number = 500,
  规则: Http错误映射规则[] = [],
): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  const 标准错误 = 归一化错误(error);
  for (const 规则项 of 规则) {
    const 匹配列表 = Array.isArray(规则项.匹配) ? 规则项.匹配 : [规则项.匹配];
    if (匹配列表.some((匹配器) => 匹配错误(标准错误, 匹配器))) {
      return new HttpError(规则项.状态码, 标准错误.message, 规则项.错误码);
    }
  }

  return new HttpError(默认状态码, 标准错误.message);
}

export const Http错误工厂 = {
  参数错误(消息: string, 错误码?: string, 详情?: unknown): HttpError {
    return new HttpError(400, 消息, 错误码, 详情);
  },
  未授权(消息: string = '未登录', 错误码?: string): HttpError {
    return new HttpError(401, 消息, 错误码);
  },
  禁止访问(消息: string = '权限不足', 错误码?: string): HttpError {
    return new HttpError(403, 消息, 错误码);
  },
  未找到(消息: string, 错误码?: string): HttpError {
    return new HttpError(404, 消息, 错误码);
  },
  冲突(消息: string, 错误码?: string): HttpError {
    return new HttpError(409, 消息, 错误码);
  },
  服务不可用(消息: string, 错误码?: string): HttpError {
    return new HttpError(503, 消息, 错误码);
  },
};
