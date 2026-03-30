import type { Request, RequestHandler, Response } from 'express';
import {
  HttpError,
  type Http错误映射规则,
  规范化Http错误,
} from './errors';

type 标准响应结果 = {
  类型: '标准';
  状态码?: number;
  数据?: unknown;
  消息?: string;
};

type 原始响应结果 = {
  类型: '原始';
  状态码?: number;
  响应体: Record<string, unknown>;
};

export type 控制器结果 = 标准响应结果 | 原始响应结果 | void;

export interface 控制器处理选项 {
  默认错误状态码?: number;
  错误映射?: Http错误映射规则[];
}

export function 返回数据(
  数据?: unknown,
  选项: { 状态码?: number; 消息?: string } = {},
): 控制器结果 {
  return {
    类型: '标准',
    状态码: 选项.状态码,
    数据,
    消息: 选项.消息,
  };
}

export function 返回消息(消息: string, 状态码?: number): 控制器结果 {
  return {
    类型: '标准',
    状态码,
    消息,
  };
}

export function 返回原始响应(
  响应体: Record<string, unknown>,
  状态码?: number,
): 控制器结果 {
  return {
    类型: '原始',
    状态码,
    响应体,
  };
}

export function 发送Http错误(
  res: Response,
  error: unknown,
  选项: 控制器处理选项 = {},
): void {
  const Http错误 = 规范化Http错误(
    error,
    选项.默认错误状态码,
    选项.错误映射,
  );

  const 响应体: Record<string, unknown> = {
    success: false,
    error: Http错误.message,
  };

  if (Http错误.错误码) {
    响应体.code = Http错误.错误码;
  }
  if (Http错误.详情 !== undefined) {
    响应体.details = Http错误.详情;
  }

  res.status(Http错误.状态码).json(响应体);
}

function 发送成功响应(res: Response, 结果: Exclude<控制器结果, void>): void {
  if (结果.类型 === '原始') {
    res.status(结果.状态码 ?? 200).json(结果.响应体);
    return;
  }

  const 响应体: Record<string, unknown> = {
    success: true,
  };

  if (结果.数据 !== undefined) {
    响应体.data = 结果.数据;
  }
  if (结果.消息) {
    响应体.message = 结果.消息;
  }

  res.status(结果.状态码 ?? 200).json(响应体);
}

export function 处理控制器(
  处理器: (req: Request, res: Response) => Promise<控制器结果> | 控制器结果,
  选项: 控制器处理选项 = {},
): RequestHandler {
  return async (req, res) => {
    try {
      const 结果 = await 处理器(req, res);
      if (res.headersSent) {
        return;
      }
      if (结果 === undefined) {
        res.status(200).json({ success: true });
        return;
      }
      发送成功响应(res, 结果);
    } catch (error) {
      if (res.headersSent) {
        return;
      }
      发送Http错误(res, error, 选项);
    }
  };
}

export function 断言条件(
  条件: unknown,
  error: HttpError,
): asserts 条件 {
  if (!条件) {
    throw error;
  }
}
