import { Router } from 'express';
import { requireRole } from '../account/middleware';
import type { KnowledgeController } from './controller';

export function createKnowledgeRoutes(controller: KnowledgeController): Router {
  const router = Router();

  router.get('/', controller.list);
  router.post('/', requireRole('admin', 'super_admin'), controller.create);
  router.put('/:id', requireRole('admin', 'super_admin'), controller.update);
  router.delete('/:id', requireRole('admin', 'super_admin'), controller.remove);

  return router;
}
