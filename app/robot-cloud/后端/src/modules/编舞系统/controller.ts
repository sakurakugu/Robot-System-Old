/**
 * 编舞系统控制器
 */

import type { Request, Response } from 'express';
import fs from 'fs';
import { logger } from '../../core/logger';
import type { ChoreoService } from './service';
import type {
    AddProjectRobotDirectDto,
    AddRobotToProjectDto,
    CreateProjectDto,
    SaveTimelineDto,
    UpdateProjectDto,
    UpdateProjectRobotDto,
} from './types';

// 辅助函数：安全获取路由参数
const getParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

// 辅助函数：安全获取查询参数
const getQueryParam = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
};

const 清理临时文件 = async (filePath?: string): Promise<void> => {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      logger.error('清理临时文件失败', error as Error, { filePath });
    }
  }
};

export class 编舞控制器 {
  constructor(private service: ChoreoService) {}

  // ==================== 项目管理 ====================

  /**
   * 获取所有项目
   */
  getAllProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const projects = this.service.getAllProjects();
      res.json({ success: true, data: projects });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取单个项目
   */
  getProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const project = this.service.getProject(getParam(req.params.uuid));
      if (!project) {
        res.status(404).json({ success: false, error: '项目不存在' });
        return;
      }
      res.json({ success: true, data: project });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 创建项目
   */
  createProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: CreateProjectDto = req.body;
      if (!dto.name) {
        res.status(400).json({ success: false, error: '项目名称是必需的' });
        return;
      }
      const project = await this.service.createProject(dto);
      res.json({ success: true, data: project });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 更新项目
   */
  updateProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: UpdateProjectDto = req.body;
      const project = await this.service.updateProject(getParam(req.params.uuid), dto);
      res.json({ success: true, data: project });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 删除项目
   */
  deleteProject = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.service.deleteProject(getParam(req.params.uuid));
      res.json({ success: true, message: '项目已删除' });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 打开项目
   */
  openProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const project = await this.service.openProject(getParam(req.params.uuid));
      res.json({ success: true, data: project });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  // ==================== 项目机器人管理 ====================

  /**
   * 获取项目机器人列表
   */
  getProjectRobots = async (req: Request, res: Response): Promise<void> => {
    try {
      const robots = await this.service.getProjectRobots(getParam(req.params.uuid));
      res.json({ success: true, data: robots });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 添加机器人到项目
   */
  addRobotToProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: AddRobotToProjectDto = req.body;
      if (!dto.robot_id) {
        res.status(400).json({ success: false, error: '机器人 ID 是必需的' });
        return;
      }
      const robot = await this.service.addRobotToProject(getParam(req.params.uuid), dto);
      res.json({ success: true, data: robot });
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '机器人不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message === '机器人已在项目中') {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 从项目移除机器人
   */
  removeRobotFromProject = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.service.removeRobotFromProject(getParam(req.params.uuid), getParam(req.params.robotUuid));
      res.json({ success: true, message: '机器人已移除' });
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '机器人不在项目中') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  // ==================== 时间轴管理 ====================

  /**
   * 获取时间轴数据
   */
  getTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const timeline = await this.service.getTimeline(getParam(req.params.uuid));
      res.json({ success: true, data: timeline });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 保存时间轴数据
   */
  saveTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: SaveTimelineDto = req.body;
      await this.service.saveTimeline(getParam(req.params.uuid), dto);
      res.json({ success: true, message: '时间轴已保存' });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  // ==================== 自定义动作管理 ====================

  /**
   * 获取自定义动作列表
   */
  getCustomActions = async (req: Request, res: Response): Promise<void> => {
    try {
      const actions = await this.service.getCustomActions(getParam(req.params.uuid));
      res.json({ success: true, data: actions });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 保存自定义动作
   */
  saveCustomAction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, tracks, config } = req.body;
      if (!name || !tracks) {
        res.status(400).json({ success: false, error: '名称和轨道数据是必需的' });
        return;
      }
      const action = await this.service.saveCustomAction(getParam(req.params.uuid), {
        name,
        description,
        tracks,
        config,
      });
      res.json({ success: true, data: action });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  // ==================== 音频管理 ====================

  /**
   * 获取音频文件
   */
  getAudio = async (req: Request, res: Response): Promise<void> => {
    try {
      const audioPath = await this.service.getAudioPath(getParam(req.params.uuid), getParam(req.params.filename));
      res.sendFile(audioPath);
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '音频文件不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 上传音频文件（需要配合 multer 中间件）
   */
  uploadAudio = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: '没有上传文件' });
        return;
      }

      const filename = await this.service.saveAudioFile(
        getParam(req.params.uuid),
        req.file.originalname,
        req.file.buffer
      );

      res.json({
        success: true,
        data: {
          filename,
          originalname: req.file.originalname,
          size: req.file.size,
          url: `/api/v1/choreo/projects/${getParam(req.params.uuid)}/audio/${filename}`,
        },
      });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  // ==================== 动作执行 ====================

  /**
   * 执行编舞（编译时间轴 + 启动调度器）
   */
  executeChoreo = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = await this.service.executeChoreo(getParam(req.params.uuid));
      res.json({
        success: true,
        data: status,
        message: '编舞已开始执行',
      });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 暂停执行
   */
  pauseExecution = async (req: Request, res: Response): Promise<void> => {
    try {
      const paused = this.service.pauseExecution(getParam(req.params.executionId));
      res.json({
        success: paused,
        message: paused ? '执行已暂停' : '未找到执行任务或不可暂停',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 恢复执行
   */
  resumeExecution = async (req: Request, res: Response): Promise<void> => {
    try {
      const resumed = this.service.resumeExecution(getParam(req.params.executionId));
      res.json({
        success: resumed,
        message: resumed ? '执行已恢复' : '未找到执行任务或不可恢复',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 停止执行
   */
  stopExecution = async (req: Request, res: Response): Promise<void> => {
    try {
      const stopped = this.service.stopExecution(getParam(req.params.executionId));
      res.json({
        success: stopped,
        message: stopped ? '执行已停止' : '未找到执行任务或已完成',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取执行状态
   */
  getExecutionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = this.service.getExecutionStatus(getParam(req.params.executionId));
      if (!status) {
        res.status(404).json({ success: false, error: '执行任务不存在' });
        return;
      }
      res.json({ success: true, data: status });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取正在运行的执行列表
   */
  getRunningExecutions = async (req: Request, res: Response): Promise<void> => {
    try {
      const executions = this.service.getRunningExecutions();
      res.json({ success: true, data: executions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // ==================== 文件管理 ====================

  /**
   * 获取项目文件列表
   */
  getProjectFiles = async (req: Request, res: Response): Promise<void> => {
    try {
      const files = await this.service.getProjectFiles(getParam(req.params.uuid));
      res.json({ success: true, data: files });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 读取文件内容
   */
  getFileContent = async (req: Request, res: Response): Promise<void> => {
    try {
      const filePath = getQueryParam(req.query.path);
      const content = await this.service.getFileContent(getParam(req.params.uuid), filePath);
      res.json({ success: true, data: content });
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '文件不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message === '非法的文件路径' || error.message === '无法读取文件夹内容') {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 保存文件内容
   */
  saveFileContent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { path: filePath, content } = req.body;
      await this.service.saveFileContent(getParam(req.params.uuid), filePath, content);
      res.json({ success: true, message: '文件已保存' });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message === '非法的文件路径') {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 删除文件
   */
  deleteFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const filePath = getQueryParam(req.query.path);
      await this.service.deleteFile(getParam(req.params.uuid), filePath);
      res.json({ success: true, message: '文件已删除' });
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '文件不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message === '非法的文件路径') {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 列出项目音频文件
   */
  listAudioFiles = async (req: Request, res: Response): Promise<void> => {
    try {
      const files = await this.service.listAudioFiles(getParam(req.params.uuid));
      res.json({ success: true, data: files });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 删除音频文件
   */
  deleteAudioFile = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.service.deleteAudioFile(getParam(req.params.uuid), getParam(req.params.filename));
      res.json({ success: true, message: '音频文件已删除' });
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '音频文件不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  // ==================== 项目保存/导入/导出 ====================

  /**
   * 保存项目
   */
  saveProject = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.service.saveProject(getParam(req.params.uuid));
      res.json({ success: true, message: '工程保存成功' });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 导出项目
   */
  exportProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { exportPath, fileName } = await this.service.exportProject(getParam(req.params.uuid));

      res.download(exportPath, fileName, async (err) => {
        // 下载完成后删除临时文件
        await 清理临时文件(exportPath);
        if (err) {
          logger.error('下载文件时出错', err as Error);
        }
      });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 导入项目（需配合 multer 中间件）
   */
  importProject = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: '没有上传文件' });
        return;
      }

      const project = await this.service.importProject(req.file.path, req.file.originalname);

      // 清理临时文件
      await 清理临时文件(req.file.path);

      res.json({ success: true, data: project });
    } catch (error: any) {
      // 清理临时文件
      await 清理临时文件(req.file?.path);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // ==================== 项目机器人管理（扩展） ====================

  /**
   * 直接添加机器人到项目
   */
  addRobotToProjectDirect = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: AddProjectRobotDirectDto = req.body;
      if (!dto.name || !dto.robot_ip || !dto.local_ip || dto.local_port === undefined) {
        res.status(400).json({ success: false, error: '缺少必要参数' });
        return;
      }
      const robot = await this.service.addRobotToProjectDirect(getParam(req.params.uuid), dto);
      res.json({ success: true, data: robot });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 获取项目机器人配置列表
   */
  getProjectRobotsConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const robots = await this.service.getProjectRobotsConfig(getParam(req.params.uuid));
      res.json({ success: true, data: robots });
    } catch (error: any) {
      if (error.message === '项目不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 更新项目机器人配置
   */
  updateProjectRobot = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: UpdateProjectRobotDto = req.body;
      const robot = await this.service.updateProjectRobot(getParam(req.params.uuid), getParam(req.params.robotUuid), dto);
      res.json({ success: true, data: robot });
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '机器人不在项目中') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 删除项目机器人
   */
  deleteProjectRobot = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.service.deleteProjectRobot(getParam(req.params.uuid), getParam(req.params.robotUuid));
      res.json({ success: true, message: '机器人已删除' });
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '机器人不在项目中') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  // ==================== 机器人连接测试 ====================

  /**
   * 测试机器人连接
   */
  testRobotConnection = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.testRobotConnection(
        getParam(req.params.uuid),
        getParam(req.params.robotUuid)
      );
      res.json(result);
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '机器人不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 连接机器人（Python 连接并自动配置）
   */
  connectRobot = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.connectRobot(
        getParam(req.params.uuid),
        getParam(req.params.robotUuid)
      );
      res.json(result);
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '机器人不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

  /**
   * 重启运控
   */
  restartMotionControl = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.restartMotionControl(
        getParam(req.params.uuid),
        getParam(req.params.robotUuid)
      );
      res.json(result);
    } catch (error: any) {
      if (error.message === '项目不存在' || error.message === '机器人不存在') {
        res.status(404).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

}

export default 编舞控制器;

export { 编舞控制器 as ChoreoController };
