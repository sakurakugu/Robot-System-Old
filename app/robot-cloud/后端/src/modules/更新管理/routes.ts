import type { RequestHandler } from 'express';
import { Router } from 'express';
import multer from 'multer';
import type { 更新控制器 } from './controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 最大 200MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.android.package-archive' ||
      file.originalname.endsWith('.apk')
    ) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 APK 文件'));
    }
  },
});

export function createUpdateRoutes(
  controller: 更新控制器,
  guards?: { manage?: RequestHandler }
): Router {
  const router = Router();

  // 上传 APK（multipart/form-data，字段名 apk）
  if (guards?.manage) {
    router.post('/upload', guards.manage, upload.single('apk'), controller.upload);
  } else {
    router.post('/upload', upload.single('apk'), controller.upload);
  }

  // 检查更新 ?currentVersionCode=1&channel=stable
  router.get('/check', controller.check);

  // 下载 APK
  router.get('/download/:id', controller.download);

  // 版本列表 ?channel=stable
  router.get('/versions', controller.list);

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
