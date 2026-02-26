import { Router } from 'express';
import type { 机器人控制器 } from './controller';

export function createRobotRoutes(controller: 机器人控制器): Router {
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
  // router.post('/:uuid/test-connection', controller.testConnection);
  // router.post('/:uuid/connect', controller.connectRobot);
  router.post('/:uuid/update-firmware', controller.updateFirmware);

  // 日志标记
  router.post('/:uuid/logs/mark', controller.markLog);

  // 音量控制
  router.get('/:uuid/volume', controller.getVolume);
  router.post('/:uuid/volume', controller.setVolume);
  router.post('/:uuid/volume/mute', controller.setMute);

  // 相机控制
  router.post('/:uuid/camera/capture', controller.capturePhoto);

  // 配置管理
  router.get('/:uuid/config', controller.getConfig);
  router.post('/:uuid/config', controller.updateConfig);

  return router;
}
