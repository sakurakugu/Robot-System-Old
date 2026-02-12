import { Router } from 'express';
import type { 大模型管理控制器 } from './controller';

export function createLLMRoutes(controller: 大模型管理控制器): Router {
  const router = Router();

  router.get('/llm', controller.getLLMConfig);
  router.get('/llm/providers', controller.getLLMProviders);
  router.get('/llm/active', controller.getActiveLLMConfig); // 新增获取当前使用的LLM配置的接口
  router.put('/llm', controller.updateLLMConfig);

  return router;
}
