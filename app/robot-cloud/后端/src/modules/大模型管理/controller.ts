import type { Request } from 'express';
import { 处理控制器, 返回数据 } from '../../core/http/controller';
import type { 大模型配置服务 } from './service';

export class 大模型管理控制器 {
  constructor(private llmConfigService: 大模型配置服务) { }

  getLLMConfig = 处理控制器(async () => 返回数据(await this.llmConfigService.getLLMConfig()));

  getLLMProviders = 处理控制器(async () => 返回数据(await this.llmConfigService.getLLMProviders()));

  updateLLMConfig = 处理控制器(async (req: Request) => 返回数据(
    await this.llmConfigService.updateLLMConfig(req.body || {}),
  ), {
    默认错误状态码: 400,
  });

  getActiveLLMConfig = 处理控制器(async () => 返回数据(await this.llmConfigService.getActiveLLMConfig()));
}
