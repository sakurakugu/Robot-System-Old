import { Router } from 'express';
import { RoleController } from './controller';

export function createRoleRoutes(controller: RoleController): Router {
  const router = Router();

  // 角色管理
  router.post('/', controller.create_角色.bind(controller));
  router.get('/', controller.get_所有角色.bind(controller));
  router.get('/:uuid', controller.get_角色.bind(controller));
  router.put('/:uuid', controller.update_角色.bind(controller));
  router.delete('/:uuid', controller.delete_角色.bind(controller));

  // 获取角色绑定的机器人
  router.get('/:uuid/robots', controller.get_所有使用角色的机器人.bind(controller));

  return router;
}
