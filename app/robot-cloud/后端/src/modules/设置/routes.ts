import { Router } from 'express';
import type { SettingsController } from './controller';

export function createSettingsRoutes(controller: SettingsController): Router {
  const router = Router();

  // LLM 配置
  router.get('/llm', controller.getLLMConfig);
  router.get('/llm/providers', controller.getLLMProviders);
  router.get('/llm/active', controller.getActiveLLMConfig);
  router.put('/llm', controller.updateLLMConfig);

  // UI 配置
  router.get('/ui', controller.getUIConfig);
  router.put('/ui', controller.updateUIConfig);

  return router;
}
