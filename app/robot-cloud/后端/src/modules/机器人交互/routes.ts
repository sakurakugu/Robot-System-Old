import { Router } from 'express';
import type { ConversationController } from './controller';

export function createConversationRoutes(controller: ConversationController): Router {
  const router = Router();

  router.get('/:robotId', controller.getHistory);
  router.post('/:robotId/command', controller.sendCommand);

  return router;
}
