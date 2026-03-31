import { Router } from 'express';
import type { 对话控制器 } from './controller';

export function createConversationRoutes(controller: 对话控制器): Router {
  const router = Router();

  router.get('/:robotId', controller.getHistory);
  router.post('/:robotId/command', controller.sendCommand);

  return router;
}
