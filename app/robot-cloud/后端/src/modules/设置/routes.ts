import { Router } from 'express';
import type { 设置控制器 } from './controller';

export function createSettingsRoutes(controller: 设置控制器): Router {
  const router = Router();

  // AI 配置
  router.get('/ai', controller.getAIConfig);
  router.put('/ai', controller.updateAIConfig);

  // UI 配置
  router.get('/ui', controller.getUIConfig);
  router.put('/ui', controller.updateUIConfig);

  return router;
}
