import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { 设置控制器 } from './controller';

export function createSettingsRoutes(
  controller: 设置控制器,
  guards?: { updateAI?: RequestHandler; updateUI?: RequestHandler }
): Router {
  const router = Router();

  // AI 配置
  router.get('/ai', controller.getAIConfig);
  if (guards?.updateAI) {
    router.put('/ai', guards.updateAI, controller.updateAIConfig);
  } else {
    router.put('/ai', controller.updateAIConfig);
  }

  // UI 配置
  router.get('/ui', controller.getUIConfig);
  if (guards?.updateUI) {
    router.put('/ui', guards.updateUI, controller.updateUIConfig);
  } else {
    router.put('/ui', controller.updateUIConfig);
  }

  return router;
}
