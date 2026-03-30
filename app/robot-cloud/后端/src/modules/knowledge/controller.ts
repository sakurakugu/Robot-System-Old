import type { Request } from 'express';
import { 处理控制器, 返回数据 } from '../../core/http/controller';
import { type Http错误映射规则 } from '../../core/http/errors';
import type { KnowledgeService } from './service';

const 知识库写入错误映射: Http错误映射规则[] = [
  { 匹配: '不存在', 状态码: 404 },
];

export class KnowledgeController {
  constructor(private knowledgeService: KnowledgeService) {}

  private resolveParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
  }

  list = 处理控制器(async () => 返回数据(await this.knowledgeService.list()));

  create = 处理控制器(async (req: Request) => {
    const userId = req.authContext?.user?.id || null;
    const data = await this.knowledgeService.create(req.body || {}, userId);
    return 返回数据(data, { 状态码: 201 });
  }, {
    默认错误状态码: 400,
  });

  update = 处理控制器(async (req: Request) => {
    const userId = req.authContext?.user?.id || null;
    const data = await this.knowledgeService.update(this.resolveParam(req.params.id), req.body || {}, userId);
    return 返回数据(data);
  }, {
    默认错误状态码: 400,
    错误映射: 知识库写入错误映射,
  });

  remove = 处理控制器(async (req: Request) => {
    await this.knowledgeService.remove(this.resolveParam(req.params.id));
  }, {
    默认错误状态码: 400,
    错误映射: 知识库写入错误映射,
  });
}
