import { Router } from 'express';
import type { RobotController } from './controller';

export function createRobotRoutes(controller: RobotController): Router {
  const router = Router();

  // 列表与发现
  router.get('/', controller.getAllRobots);
  router.get('/groups', controller.getGroups);
  router.get('/discover', controller.discoverRobots);
  
  // CRUD
  router.get('/:uuid', controller.getRobot);
  router.post('/', controller.createRobot);
  router.put('/:uuid', controller.updateRobot);
  router.delete('/:uuid', controller.deleteRobot);
  
  // 连接管理
  router.post('/:uuid/test-connection', controller.testConnection);
  router.post('/:uuid/connect', controller.connectRobot);
  router.post('/:uuid/update-firmware', controller.updateFirmware);

  return router;
}
