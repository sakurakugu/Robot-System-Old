import type { RequestHandler } from 'express';
import { Router } from 'express';
import multer from 'multer';
import type { 机器人包控制器 } from './controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 最大 500MB
  fileFilter: (_req, file, cb) => {
    if (
      file.originalname.endsWith('.tar.gz') ||
      file.originalname.endsWith('.tgz') ||
      file.mimetype === 'application/gzip' ||
      file.mimetype === 'application/x-gzip' ||
      file.mimetype === 'application/x-tar'
    ) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 .tar.gz / .tgz 格式的包文件'));
    }
  },
});

const pkgFields = upload.fields([
  { name: 'agent', maxCount: 1 },
  { name: 'server', maxCount: 1 },
  { name: 'common', maxCount: 1 },
]);

export function createRobotPackageRoutes(
  controller: 机器人包控制器,
  guards?: { read?: RequestHandler; manage?: RequestHandler }
): Router {
  const router = Router();

  // 上传包（multipart/form-data，字段名 agent / server / common，至少一个）
  if (guards?.manage) {
    router.post('/upload', guards.manage, pkgFields, controller.upload);
  } else {
    router.post('/upload', pkgFields, controller.upload);
  }

  // 版本列表 ?channel=stable
  if (guards?.read) {
    router.get('/versions', guards.read, controller.list);
  } else {
    router.get('/versions', controller.list);
  }

  // 获取当前活跃版本信息（机器人和手机端下载前调用）
  router.get('/active', controller.getActive);

  // 下载安装包文件（:type = agent | server | common，不需要鉴权，机器人直接 HTTP 下载）
  router.get('/download/:type', controller.download);

  // 回滚到指定版本
  if (guards?.manage) {
    router.post('/rollback/:id', guards.manage, controller.rollback);
  } else {
    router.post('/rollback/:id', controller.rollback);
  }

  // 删除版本
  if (guards?.manage) {
    router.delete('/versions/:id', guards.manage, controller.delete);
  } else {
    router.delete('/versions/:id', controller.delete);
  }

  return router;
}
