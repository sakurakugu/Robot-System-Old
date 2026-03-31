import type { Request } from 'express';
import { 处理控制器, 返回数据 } from '../../core/http/controller';
import type { Http错误映射规则 } from '../../core/http/errors';
import type { 反馈服务 } from './service';

const 反馈错误映射: Http错误映射规则[] = [
  { 匹配: '不存在', 状态码: 404 },
];

export class 反馈控制器 {
  constructor(private feedbackService: 反馈服务) {}

  private resolveParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
  }

  submit = 处理控制器(async (req: Request) => {
      const data = await this.feedbackService.submit(req.body || {}, {
        clientType: String(req.header('x-client-type') || 'unknown'),
        deviceName: String(req.header('x-device-name') || ''),
        userId: req.authContext?.user?.id || null,
      });
      return 返回数据(data, { 状态码: 201 });
  }, {
    默认错误状态码: 400,
  });

  list = 处理控制器(async (req: Request) => {
      const data = await this.feedbackService.list({
        limit: Number(req.query.limit || 20),
        offset: Number(req.query.offset || 0),
        status: req.query.status as any,
      });
      return 返回数据(data);
  }, {
    默认错误状态码: 400,
  });

  detail = 处理控制器(async (req: Request) => 返回数据(
    await this.feedbackService.detail(this.resolveParam(req.params.id)),
  ), {
    默认错误状态码: 400,
    错误映射: 反馈错误映射,
  });

  updateStatus = 处理控制器(async (req: Request) => 返回数据(
    await this.feedbackService.updateStatus(
      this.resolveParam(req.params.id),
      req.body || {},
      req.authContext?.user?.id || null
    ),
  ), {
    默认错误状态码: 400,
    错误映射: 反馈错误映射,
  });
}
