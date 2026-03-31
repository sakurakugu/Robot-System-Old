import type { RequestHandler } from 'express';
import { Router } from 'express';
import type { 反馈控制器 } from './controller';

export function createFeedbackRoutes(
  controller: 反馈控制器,
  guards?: { manage?: RequestHandler }
): Router {
  const router = Router();
  router.post('/', controller.submit);

  if (guards?.manage) {
    router.get('/', guards.manage, controller.list);
    router.get('/:id', guards.manage, controller.detail);
    router.patch('/:id/status', guards.manage, controller.updateStatus);
  } else {
    router.get('/', controller.list);
    router.get('/:id', controller.detail);
    router.patch('/:id/status', controller.updateStatus);
  }

  return router;
}
