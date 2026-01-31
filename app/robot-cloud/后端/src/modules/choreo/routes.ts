/**
 * 编舞系统路由
 */

import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import type { ChoreoController } from './controller';

// 配置 multer 用于音频上传（内存存储）
const audioUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('只能上传音频文件'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// 配置 multer 用于项目导入
const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'robot-dog-imports');
    const fs = require('fs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `import_${timestamp}${ext}`;
    cb(null, filename);
  },
});

const importUpload = multer({
  storage: importStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      ext === '.zip' ||
      ext === '.hhzip'
    ) {
      cb(null, true);
    } else {
      cb(new Error('只能上传 ZIP 或 HHZIP 压缩文件'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

export function createChoreoRoutes(controller: ChoreoController): Router {
  const router = Router();

  // ==================== 项目管理 ====================
  
  // 获取所有项目
  router.get('/projects', controller.getAllProjects);
  
  // 导入项目
  router.post('/projects/import', importUpload.single('project'), controller.importProject);
  
  // 获取单个项目
  router.get('/projects/:uuid', controller.getProject);
  
  // 创建项目
  router.post('/projects', controller.createProject);
  
  // 更新项目
  router.put('/projects/:uuid', controller.updateProject);
  
  // 删除项目
  router.delete('/projects/:uuid', controller.deleteProject);
  
  // 打开项目
  router.post('/projects/:uuid/open', controller.openProject);
  
  // 保存项目
  router.post('/projects/:uuid/save', controller.saveProject);
  
  // 导出项目
  router.get('/projects/:uuid/export', controller.exportProject);

  // ==================== 项目机器人管理 ====================
  
  // 获取项目机器人列表（关联主表）
  router.get('/projects/:uuid/robots', controller.getProjectRobots);
  
  // 添加机器人到项目（关联主表）
  router.post('/projects/:uuid/robots', controller.addRobotToProject);
  
  // 从项目移除机器人
  router.delete('/projects/:uuid/robots/:robotUuid', controller.removeRobotFromProject);
  
  // ==================== 项目机器人配置管理（直接存储） ====================
  
  // 获取项目机器人配置列表
  router.get('/projects/:uuid/robots-config', controller.getProjectRobotsConfig);
  
  // 直接添加机器人配置
  router.post('/projects/:uuid/robots-config', controller.addRobotToProjectDirect);
  
  // 更新机器人配置
  router.put('/projects/:uuid/robots-config/:robotUuid', controller.updateProjectRobot);
  
  // 删除机器人配置
  router.delete('/projects/:uuid/robots-config/:robotUuid', controller.deleteProjectRobot);
  
  // ==================== 机器人连接与控制 ====================
  
  // 测试机器人连接
  router.post('/projects/:uuid/robots/:robotUuid/test-connection', controller.testRobotConnection);
  
  // 连接机器人（Python 连接并自动配置）
  router.post('/projects/:uuid/robots/:robotUuid/connect', controller.connectRobot);
  
  // 重启运控
  router.post('/projects/:uuid/robots/:robotUuid/restart-motion', controller.restartMotionControl);

  // ==================== 时间轴管理 ====================
  
  // 获取时间轴数据
  router.get('/projects/:uuid/timeline', controller.getTimeline);
  
  // 保存时间轴数据
  router.post('/projects/:uuid/timeline', controller.saveTimeline);

  // ==================== 自定义动作管理 ====================
  
  // 获取自定义动作列表
  router.get('/projects/:uuid/custom-actions', controller.getCustomActions);
  
  // 保存自定义动作
  router.post('/projects/:uuid/custom-actions', controller.saveCustomAction);

  // ==================== 音频管理 ====================
  
  // 列出音频文件
  router.get('/projects/:uuid/audio', controller.listAudioFiles);
  
  // 获取音频文件
  router.get('/projects/:uuid/audio/:filename', controller.getAudio);
  
  // 上传音频文件
  router.post('/projects/:uuid/audio', audioUpload.single('audio'), controller.uploadAudio);
  
  // 删除音频文件
  router.delete('/projects/:uuid/audio/:filename', controller.deleteAudioFile);

  // ==================== 动作执行 ====================
  
  // 执行动作序列
  router.post('/projects/:uuid/execute', controller.executeActions);
  
  // 停止执行
  router.post('/executions/:executionId/stop', controller.stopExecution);
  
  // 获取执行状态
  router.get('/executions/:executionId', controller.getExecutionStatus);
  
  // 获取正在运行的执行列表
  router.get('/executions', controller.getRunningExecutions);

  // ==================== Python 脚本封装与运行 ====================
  
  // 封装项目为 Python 脚本
  router.post('/projects/:uuid/build', controller.buildProject);
  
  // 运行项目的 Python 脚本
  router.post('/projects/:uuid/run', controller.runProject);
  
  // 封装并运行
  router.post('/projects/:uuid/build-and-run', controller.buildAndRunProject);

  // ==================== 文件管理 ====================
  
  // 获取项目文件列表
  router.get('/projects/:uuid/files', controller.getProjectFiles);
  
  // 读取文件内容
  router.get('/projects/:uuid/files/content', controller.getFileContent);
  
  // 保存文件内容
  router.post('/projects/:uuid/files/content', controller.saveFileContent);
  
  // 删除文件
  router.delete('/projects/:uuid/files', controller.deleteFile);

  return router;
}

export default createChoreoRoutes;
