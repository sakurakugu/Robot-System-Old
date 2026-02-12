import { Router } from 'express';
import type { 对话控制器 } from '../大模型交互/controller';

export function createConversationRoutes(controller: 对话控制器): Router {
  const router = Router();

  router.get('/:robotId', controller.getHistory);
  router.post('/:robotId/command', controller.sendCommand);

  return router;
}
