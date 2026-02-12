import { Router } from 'express';
import type { 角色控制器 } from './controller';

export function createRoleRoutes(controller: 角色控制器): Router {
  const router = Router();

  // CRUD
  router.get('/', controller.getAllRoles);
  router.get('/:uuid', controller.getRole);
  router.post('/', controller.createRole);
  router.put('/:uuid', controller.updateRole);
  router.delete('/:uuid', controller.deleteRole);

  // 关联查询
  router.get('/:uuid/robots', controller.getRobotsByRole);

  return router;
}
