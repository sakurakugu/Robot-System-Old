/**
 * 编舞系统控制器
 */

import type { Request, Response } from 'express';
import fs from 'fs';
import {
  处理控制器,
  返回数据,
  返回消息,
  返回原始响应,
} from '../../core/http/controller';
import {
  Http错误工厂,
  type Http错误映射规则,
} from '../../core/http/errors';
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

const 编舞项目错误映射: Http错误映射规则[] = [
  { 匹配: '项目不存在', 状态码: 404 },
];

const 编舞项目机器人错误映射: Http错误映射规则[] = [
  ...编舞项目错误映射,
  { 匹配: ['机器人不存在', '机器人不在项目中'], 状态码: 404 },
  { 匹配: '机器人已在项目中', 状态码: 400 },
];

const 编舞文件错误映射: Http错误映射规则[] = [
  ...编舞项目错误映射,
  { 匹配: ['文件不存在', '音频文件不存在'], 状态码: 404 },
  { 匹配: ['非法的文件路径', '无法读取文件夹内容'], 状态码: 400 },
];

export class 编舞控制器 {
  constructor(private service: ChoreoService) {}

  // ==================== 项目管理 ====================

  /**
   * 获取所有项目
   */
  getAllProjects = 处理控制器(() => 返回数据(this.service.getAllProjects()));

  /**
   * 获取单个项目
   */
  getProject = 处理控制器((req: Request) => {
    const project = this.service.getProject(getParam(req.params.uuid));
    if (!project) {
      throw Http错误工厂.未找到('项目不存在');
    }
    return 返回数据(project);
  });

  /**
   * 创建项目
   */
  createProject = 处理控制器(async (req: Request) => {
    const dto: CreateProjectDto = req.body;
    if (!dto.name) {
      throw Http错误工厂.参数错误('项目名称是必需的');
    }
    const project = await this.service.createProject(dto);
    return 返回数据(project);
  });

  /**
   * 更新项目
   */
  updateProject = 处理控制器(async (req: Request) => {
    const dto: UpdateProjectDto = req.body;
    const project = await this.service.updateProject(getParam(req.params.uuid), dto);
    return 返回数据(project);
  }, {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 删除项目
   */
  deleteProject = 处理控制器(async (req: Request) => {
    await this.service.deleteProject(getParam(req.params.uuid));
    return 返回消息('项目已删除');
  }, {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 打开项目
   */
  openProject = 处理控制器(async (req: Request) => 返回数据(
    await this.service.openProject(getParam(req.params.uuid)),
  ), {
    错误映射: 编舞项目错误映射,
  });

  // ==================== 项目机器人管理 ====================

  /**
   * 获取项目机器人列表
   */
  getProjectRobots = 处理控制器(async (req: Request) => 返回数据(
    await this.service.getProjectRobots(getParam(req.params.uuid)),
  ), {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 添加机器人到项目
   */
  addRobotToProject = 处理控制器(async (req: Request) => {
    const dto: AddRobotToProjectDto = req.body;
    if (!dto.robot_id) {
      throw Http错误工厂.参数错误('机器人 ID 是必需的');
    }
    const robot = await this.service.addRobotToProject(getParam(req.params.uuid), dto);
    return 返回数据(robot);
  }, {
    错误映射: 编舞项目机器人错误映射,
  });

  /**
   * 从项目移除机器人
   */
  removeRobotFromProject = 处理控制器(async (req: Request) => {
    await this.service.removeRobotFromProject(getParam(req.params.uuid), getParam(req.params.robotUuid));
    return 返回消息('机器人已移除');
  }, {
    错误映射: 编舞项目机器人错误映射,
  });

  // ==================== 时间轴管理 ====================

  /**
   * 获取时间轴数据
   */
  getTimeline = 处理控制器(async (req: Request) => 返回数据(
    await this.service.getTimeline(getParam(req.params.uuid)),
  ), {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 保存时间轴数据
   */
  saveTimeline = 处理控制器(async (req: Request) => {
    const dto: SaveTimelineDto = req.body;
    await this.service.saveTimeline(getParam(req.params.uuid), dto);
    return 返回消息('时间轴已保存');
  }, {
    错误映射: 编舞项目错误映射,
  });

  // ==================== 自定义动作管理 ====================

  /**
   * 获取自定义动作列表
   */
  getCustomActions = 处理控制器(async (req: Request) => 返回数据(
    await this.service.getCustomActions(getParam(req.params.uuid)),
  ), {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 保存自定义动作
   */
  saveCustomAction = 处理控制器(async (req: Request) => {
    const { name, description, tracks, config } = req.body;
    if (!name || !tracks) {
      throw Http错误工厂.参数错误('名称和轨道数据是必需的');
    }
    const action = await this.service.saveCustomAction(getParam(req.params.uuid), {
      name,
      description,
      tracks,
      config,
    });
    return 返回数据(action);
  }, {
    错误映射: 编舞项目错误映射,
  });

  // ==================== 音频管理 ====================

  /**
   * 获取音频文件
   */
  getAudio = 处理控制器(async (req: Request, res: Response) => {
    const audioPath = await this.service.getAudioPath(getParam(req.params.uuid), getParam(req.params.filename));
    res.sendFile(audioPath);
  }, {
    错误映射: 编舞文件错误映射,
  });

  /**
   * 上传音频文件（需要配合 multer 中间件）
   */
  uploadAudio = 处理控制器(async (req: Request) => {
    if (!req.file) {
      throw Http错误工厂.参数错误('没有上传文件');
    }

    const filename = await this.service.saveAudioFile(
      getParam(req.params.uuid),
      req.file.originalname,
      req.file.buffer
    );

    return 返回数据({
      filename,
      originalname: req.file.originalname,
      size: req.file.size,
      url: `/api/v1/choreo/projects/${getParam(req.params.uuid)}/audio/${filename}`,
    });
  }, {
    错误映射: 编舞项目错误映射,
  });

  // ==================== 动作执行 ====================

  /**
   * 执行编舞（编译时间轴 + 启动调度器）
   */
  executeChoreo = 处理控制器(async (req: Request) => 返回数据(
    await this.service.executeChoreo(getParam(req.params.uuid)),
    { 消息: '编舞已开始执行' },
  ), {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 暂停执行
   */
  pauseExecution = 处理控制器((req: Request) => {
    const paused = this.service.pauseExecution(getParam(req.params.executionId));
    return 返回原始响应({
      success: paused,
      message: paused ? '执行已暂停' : '未找到执行任务或不可暂停',
    });
  });

  /**
   * 恢复执行
   */
  resumeExecution = 处理控制器((req: Request) => {
    const resumed = this.service.resumeExecution(getParam(req.params.executionId));
    return 返回原始响应({
      success: resumed,
      message: resumed ? '执行已恢复' : '未找到执行任务或不可恢复',
    });
  });

  /**
   * 停止执行
   */
  stopExecution = 处理控制器((req: Request) => {
    const stopped = this.service.stopExecution(getParam(req.params.executionId));
    return 返回原始响应({
      success: stopped,
      message: stopped ? '执行已停止' : '未找到执行任务或已完成',
    });
  });

  /**
   * 获取执行状态
   */
  getExecutionStatus = 处理控制器((req: Request) => {
    const status = this.service.getExecutionStatus(getParam(req.params.executionId));
    if (!status) {
      throw Http错误工厂.未找到('执行任务不存在');
    }
    return 返回数据(status);
  });

  /**
   * 获取正在运行的执行列表
   */
  getRunningExecutions = 处理控制器(() => 返回数据(this.service.getRunningExecutions()));

  // ==================== 文件管理 ====================

  /**
   * 获取项目文件列表
   */
  getProjectFiles = 处理控制器(async (req: Request) => 返回数据(
    await this.service.getProjectFiles(getParam(req.params.uuid)),
  ), {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 读取文件内容
   */
  getFileContent = 处理控制器(async (req: Request) => {
    const filePath = getQueryParam(req.query.path);
    const content = await this.service.getFileContent(getParam(req.params.uuid), filePath);
    return 返回数据(content);
  }, {
    错误映射: 编舞文件错误映射,
  });

  /**
   * 保存文件内容
   */
  saveFileContent = 处理控制器(async (req: Request) => {
    const { path: filePath, content } = req.body;
    await this.service.saveFileContent(getParam(req.params.uuid), filePath, content);
    return 返回消息('文件已保存');
  }, {
    错误映射: 编舞文件错误映射,
  });

  /**
   * 删除文件
   */
  deleteFile = 处理控制器(async (req: Request) => {
    const filePath = getQueryParam(req.query.path);
    await this.service.deleteFile(getParam(req.params.uuid), filePath);
    return 返回消息('文件已删除');
  }, {
    错误映射: 编舞文件错误映射,
  });

  /**
   * 列出项目音频文件
   */
  listAudioFiles = 处理控制器(async (req: Request) => 返回数据(
    await this.service.listAudioFiles(getParam(req.params.uuid)),
  ), {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 删除音频文件
   */
  deleteAudioFile = 处理控制器(async (req: Request) => {
    await this.service.deleteAudioFile(getParam(req.params.uuid), getParam(req.params.filename));
    return 返回消息('音频文件已删除');
  }, {
    错误映射: 编舞文件错误映射,
  });

  // ==================== 项目保存/导入/导出 ====================

  /**
   * 保存项目
   */
  saveProject = 处理控制器(async (req: Request) => {
    await this.service.saveProject(getParam(req.params.uuid));
    return 返回消息('工程保存成功');
  }, {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 导出项目
   */
  exportProject = 处理控制器(async (req: Request, res: Response) => {
    const { exportPath, fileName } = await this.service.exportProject(getParam(req.params.uuid));

    res.download(exportPath, fileName, async (err) => {
      await 清理临时文件(exportPath);
      if (err) {
        logger.error('下载文件时出错', err as Error);
      }
    });
  }, {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 导入项目（需配合 multer 中间件）
   */
  importProject = 处理控制器(async (req: Request) => {
    if (!req.file) {
      throw Http错误工厂.参数错误('没有上传文件');
    }

    try {
      const project = await this.service.importProject(req.file.path, req.file.originalname);
      return 返回数据(project);
    } finally {
      await 清理临时文件(req.file?.path);
    }
  });

  // ==================== 项目机器人管理（扩展） ====================

  /**
   * 直接添加机器人到项目
   */
  addRobotToProjectDirect = 处理控制器(async (req: Request) => {
    const dto: AddProjectRobotDirectDto = req.body;
    if (!dto.name || !dto.robot_ip || !dto.local_ip || dto.local_port === undefined) {
      throw Http错误工厂.参数错误('缺少必要参数');
    }
    const robot = await this.service.addRobotToProjectDirect(getParam(req.params.uuid), dto);
    return 返回数据(robot);
  }, {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 获取项目机器人配置列表
   */
  getProjectRobotsConfig = 处理控制器(async (req: Request) => 返回数据(
    await this.service.getProjectRobotsConfig(getParam(req.params.uuid)),
  ), {
    错误映射: 编舞项目错误映射,
  });

  /**
   * 更新项目机器人配置
   */
  updateProjectRobot = 处理控制器(async (req: Request) => {
    const dto: UpdateProjectRobotDto = req.body;
    const robot = await this.service.updateProjectRobot(getParam(req.params.uuid), getParam(req.params.robotUuid), dto);
    return 返回数据(robot);
  }, {
    错误映射: 编舞项目机器人错误映射,
  });

  /**
   * 删除项目机器人
   */
  deleteProjectRobot = 处理控制器(async (req: Request) => {
    await this.service.deleteProjectRobot(getParam(req.params.uuid), getParam(req.params.robotUuid));
    return 返回消息('机器人已删除');
  }, {
    错误映射: 编舞项目机器人错误映射,
  });

  // ==================== 机器人连接测试 ====================

  /**
   * 测试机器人连接
   */
  testRobotConnection = 处理控制器(async (req: Request) => 返回原始响应(
    await this.service.testRobotConnection(
      getParam(req.params.uuid),
      getParam(req.params.robotUuid)
    ) as unknown as Record<string, unknown>,
  ), {
    错误映射: 编舞项目机器人错误映射,
  });

  /**
   * 连接机器人（Python 连接并自动配置）
   */
  connectRobot = 处理控制器(async (req: Request) => 返回原始响应(
    await this.service.connectRobot(
      getParam(req.params.uuid),
      getParam(req.params.robotUuid)
    ) as unknown as Record<string, unknown>,
  ), {
    错误映射: 编舞项目机器人错误映射,
  });

  /**
   * 重启运控
   */
  restartMotionControl = 处理控制器(async (req: Request) => 返回原始响应(
    await this.service.restartMotionControl(
      getParam(req.params.uuid),
      getParam(req.params.robotUuid)
    ) as unknown as Record<string, unknown>,
  ), {
    错误映射: 编舞项目机器人错误映射,
  });

}

export default 编舞控制器;

export { 编舞控制器 as ChoreoController };
