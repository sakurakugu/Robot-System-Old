/**
 * 编舞系统服务
 * 负责项目管理、时间轴数据存储和动作执行
 */

import archiver from 'archiver';
import extractZip from 'extract-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';
import { logger } from '../../core/logger';
import type WebSocketService from '../websocket/service';
import type { RobotRepository } from '../机器人管理/repository';
import { 编舞机器人控制桥接 } from './bridges/robot-control-bridge';
import { ChoreoScheduler } from './scheduler';
import { 编舞项目存储 } from './storage/project-storage';
import type {
  AddProjectRobotDirectDto,
  AddRobotToProjectDto,
  ChoreoProject,
  ChoreoRobot,
  ChoreoWSMessage,
  ConnectionTestResult,
  CreateProjectDto,
  CustomAction,
  ExecutionPlan,
  ExecutionStatus,
  ProjectRobotConfig,
  SaveTimelineDto,
  ScheduledAction,
  TimelineConfig,
  TimelineData,
  TimelineTrack,
  UpdateProjectDto,
  UpdateProjectRobotDto,
} from './types';

type 编舞机器人查询仓库 = Pick<RobotRepository, 'getRobot'>;
type 编舞机器人控制桥接接口 = Pick<
  编舞机器人控制桥接,
  'testRobotConnection' | 'connectRobot' | 'restartMotionControl'
>;

function 创建默认时间轴(): TimelineData {
  return {
    tracks: [],
    config: {
      duration: 60,
      pixelsPerSecond: 100,
      currentTime: 0,
      snapToGrid: true,
      gridSize: 0.5,
    },
  };
}

export class 编舞服务 {
  private projects: Map<string, ChoreoProject> = new Map();
  private executions: Map<string, ExecutionStatus> = new Map();
  private schedulers: Map<string, ChoreoScheduler> = new Map();

  constructor(
    private readonly 机器人仓库: 编舞机器人查询仓库,
    private readonly 存储: 编舞项目存储 = new 编舞项目存储(),
    private readonly 机器人控制桥接: 编舞机器人控制桥接接口 = new 编舞机器人控制桥接(),
    private wsService?: WebSocketService
  ) {}

  async 初始化(): Promise<void> {
    await this.存储.初始化();
    const projects = await this.存储.加载项目索引();
    this.projects.clear();
    projects.forEach((project) => this.projects.set(project.uuid, project));
  }

  /**
   * 设置 WebSocket 服务（延迟注入）
   */
  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
  }

  private 获取项目记录(projectUuid: string): ChoreoProject {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }
    return project;
  }

  private async 保存项目索引(): Promise<void> {
    await this.存储.保存项目索引(this.projects.values());
  }

  private async 获取项目机器人配置记录(
    projectUuid: string,
    robotUuid: string,
  ): Promise<ProjectRobotConfig> {
    const robots = await this.getProjectRobotsConfig(projectUuid);
    const robot = robots.find((item) => item.uuid === robotUuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }
    return robot;
  }

  // ==================== 项目管理 ====================

  /**
   * 获取所有项目
   */
  getAllProjects(): ChoreoProject[] {
    return Array.from(this.projects.values()).sort((a, b) => {
      const aTime = a.last_opened || a.created_at;
      const bTime = b.last_opened || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  /**
   * 获取单个项目
   */
  getProject(uuid: string): ChoreoProject | undefined {
    return this.projects.get(uuid);
  }

  /**
   * 创建项目
   */
  async createProject(dto: CreateProjectDto): Promise<ChoreoProject> {
    const uuid = uuidv7();
    const folderPath = this.存储.生成项目目录路径(dto.name, uuid);

    const now = new Date().toISOString();
    const project: ChoreoProject = {
      uuid,
      name: dto.name,
      description: dto.description,
      folder_path: folderPath,
      created_at: now,
      updated_at: now,
    };

    const defaultTimeline = 创建默认时间轴();
    await this.存储.创建项目目录(project, defaultTimeline);

    // 保存到索引
    this.projects.set(uuid, project);
    await this.保存项目索引();

    logger.info(`创建编舞项目: ${dto.name}`, { uuid });
    return project;
  }

  /**
   * 更新项目
   */
  async updateProject(uuid: string, dto: UpdateProjectDto): Promise<ChoreoProject> {
    const project = this.获取项目记录(uuid);

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    project.updated_at = new Date().toISOString();

    await this.存储.保存项目元数据(project);
    await this.保存项目索引();
    return project;
  }

  /**
   * 删除项目
   */
  async deleteProject(uuid: string): Promise<void> {
    const project = this.获取项目记录(uuid);

    this.projects.delete(uuid);
    await this.存储.删除项目目录(project);
    await this.保存项目索引();

    logger.info(`删除编舞项目: ${project.name}`, { uuid });
  }

  /**
   * 打开项目（更新最后打开时间）
   */
  async openProject(uuid: string): Promise<ChoreoProject> {
    const project = this.获取项目记录(uuid);

    project.last_opened = new Date().toISOString();
    await this.保存项目索引();
    return project;
  }

  // ==================== 项目机器人管理 ====================

  /**
   * 获取项目中的机器人列表
   */
  async getProjectRobots(projectUuid: string): Promise<ChoreoRobot[]> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取项目机器人<ChoreoRobot>(project);
  }

  /**
   * 添加机器人到项目
   */
  async addRobotToProject(projectUuid: string, dto: AddRobotToProjectDto): Promise<ChoreoRobot> {
    const project = this.获取项目记录(projectUuid);

    // 验证机器人是否存在
    const mainRobot = await this.机器人仓库.getRobot(dto.robot_id);
    if (!mainRobot) {
      throw new Error('机器人不存在');
    }

    const robots = await this.getProjectRobots(projectUuid);

    // 检查是否已添加
    if (robots.find((r) => r.robot_id === dto.robot_id)) {
      throw new Error('机器人已在项目中');
    }

    const now = new Date().toISOString();
    const robot: ChoreoRobot = {
      uuid: uuidv7(),
      robot_id: dto.robot_id,
      name: dto.name || mainRobot.name || '未命名机器人',
      track_index: dto.track_index ?? robots.length,
      color: dto.color,
      created_at: now,
      updated_at: now,
    };

    robots.push(robot);
    await this.存储.写入项目机器人(project, robots);

    return robot;
  }

  /**
   * 从项目移除机器人
   */
  async removeRobotFromProject(projectUuid: string, robotUuid: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);

    const robots = await this.getProjectRobots(projectUuid);
    const index = robots.findIndex((r) => r.uuid === robotUuid);
    if (index === -1) {
      throw new Error('机器人不在项目中');
    }

    robots.splice(index, 1);
    await this.存储.写入项目机器人(project, robots);
  }

  // ==================== 时间轴管理 ====================

  /**
   * 获取时间轴数据
   */
  async getTimeline(projectUuid: string): Promise<TimelineData> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取时间轴(project, 创建默认时间轴());
  }

  /**
   * 保存时间轴数据
   */
  async saveTimeline(projectUuid: string, dto: SaveTimelineDto): Promise<void> {
    const project = this.获取项目记录(projectUuid);

    const timelineData: TimelineData = {
      tracks: dto.tracks,
      config: dto.config,
      updated_at: new Date().toISOString(),
    };

    await this.存储.保存时间轴(project, timelineData);

    // 更新项目时间
    project.updated_at = new Date().toISOString();
    await this.保存项目索引();

    logger.info(`保存时间轴数据`, { projectUuid, tracksCount: dto.tracks.length });
  }

  // ==================== 自定义动作管理 ====================

  /**
   * 获取自定义动作列表
   */
  async getCustomActions(projectUuid: string): Promise<CustomAction[]> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取自定义动作(project);
  }

  /**
   * 保存自定义动作
   */
  async saveCustomAction(
    projectUuid: string,
    data: { name: string; description?: string; tracks: TimelineTrack[]; config: TimelineConfig }
  ): Promise<CustomAction> {
    const project = this.获取项目记录(projectUuid);

    const actions = await this.getCustomActions(projectUuid);
    const now = new Date().toISOString();

    const action: CustomAction = {
      uuid: uuidv7(),
      name: data.name,
      description: data.description,
      tracks: data.tracks,
      config: data.config,
      created_at: now,
      updated_at: now,
    };

    actions.push(action);
    await this.存储.保存自定义动作列表(project, actions);

    return action;
  }

  // ==================== 音频管理 ====================

  /**
   * 获取音频文件路径
   */
  async getAudioPath(projectUuid: string, filename: string): Promise<string> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.获取音频路径(project, filename);
  }

  /**
   * 保存上传的音频文件
   */
  async saveAudioFile(projectUuid: string, filename: string, buffer: Buffer): Promise<string> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.保存音频文件(project, filename, buffer);
  }

  // ==================== 时间轴编译与执行 ====================

  /**
   * 编译时间轴为执行计划
   * 遍历所有轨道的 clips，按 executeAt 排序，生成 ScheduledAction 列表
   */
  async compileTimeline(projectUuid: string): Promise<ExecutionPlan> {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const timelineData = await this.getTimeline(projectUuid);
    const { tracks, config } = timelineData;

    const scheduleId = uuidv7();
    const actions: ScheduledAction[] = [];
    const robotIdSet = new Set<string>();

    for (const track of tracks) {
      if (track.type !== 'action') continue;

      const blocks = track.blocks ?? [];

      for (const block of blocks) {
        // 块级 robotId 优先，其次取轨道级 robotId
        const robotId = block.robotId || track.robotId;
        if (!robotId) continue;

        const actionName = block.actionType;
        if (!actionName) continue;

        const parameters = block.actionParams;

        robotIdSet.add(robotId);

        actions.push({
          robotId,
          action: actionName,
          parameters,
          executeAt: Math.round(block.startTime * 1000),
          duration: Math.round(block.duration * 1000),
        });
      }
    }

    // 按执行时间排序
    actions.sort((a, b) => a.executeAt - b.executeAt);

    // 检测同一机器人同一时刻的冲突动作
    for (let i = 0; i < actions.length - 1; i++) {
      const curr = actions[i];
      const next = actions[i + 1];
      if (curr.robotId === next.robotId && curr.executeAt === next.executeAt) {
        logger.warn('检测到同一机器人同一时刻的冲突动作', {
          robotId: curr.robotId,
          time: curr.executeAt,
          action1: curr.action,
          action2: next.action,
        });
      }
    }

    const totalDuration = Math.round(config.duration * 1000);

    logger.info('时间轴编译完成', {
      scheduleId,
      actionCount: actions.length,
      robotCount: robotIdSet.size,
      totalDuration,
    });

    return {
      scheduleId,
      projectUuid,
      totalDuration,
      actions,
      robotIds: Array.from(robotIdSet),
    };
  }

  /**
   * 执行编舞（编译时间轴 + 启动调度器）
   */
  async executeChoreo(projectUuid: string): Promise<ExecutionStatus> {
    if (!this.wsService) {
      throw new Error('WebSocket 服务未初始化');
    }

    // 编译时间轴
    const plan = await this.compileTimeline(projectUuid);

    if (plan.actions.length === 0) {
      throw new Error('时间轴中没有可执行的动作（请确保动作块已绑定机器人且已选择动作类型）');
    }

    if (plan.robotIds.length === 0) {
      throw new Error('没有绑定机器人的轨道，无法执行');
    }

    // 创建调度器
    const scheduler = new ChoreoScheduler(this.wsService);
    const executionId = plan.scheduleId;

    // 初始化执行状态
    const status: ExecutionStatus = {
      executionId,
      scheduleId: plan.scheduleId,
      status: 'running',
      currentTime: 0,
      progress: 0,
      startedAt: new Date().toISOString(),
    };
    this.executions.set(executionId, status);
    this.schedulers.set(executionId, scheduler);

    // 广播回调：发送给所有 UI 客户端并更新执行状态
    const onBroadcast = (message: ChoreoWSMessage) => {
      // broadcast 只做 JSON.stringify，类型断言安全
      this.wsService!.broadcast(message as unknown as import('../../types').ServerMessage, 'business');

      // 同步更新执行状态
      if (message.type === 'choreo_progress') {
        status.currentTime = message.data.currentTime;
        status.progress = message.data.progress;
      } else if (message.type === 'choreo_complete') {
        status.status = 'completed';
        status.progress = 100;
        status.currentTime = message.data.totalDuration;
        this.schedulers.delete(executionId);
      } else if (message.type === 'choreo_stop') {
        status.status = 'stopped';
        status.message = message.data.message;
        this.schedulers.delete(executionId);
      }
    };

    // 启动调度
    scheduler.start(plan, onBroadcast);

    logger.info('编舞执行已启动', {
      executionId,
      projectUuid,
      actionCount: plan.actions.length,
      robotCount: plan.robotIds.length,
    });

    return status;
  }

  /**
   * 暂停执行
   */
  pauseExecution(executionId: string): boolean {
    const scheduler = this.schedulers.get(executionId);
    const status = this.executions.get(executionId);
    if (!scheduler || !status) return false;

    const result = scheduler.pause();
    if (result) {
      status.status = 'paused';
      status.currentTime = scheduler.getCurrentTime();
    }
    return result;
  }

  /**
   * 恢复执行
   */
  resumeExecution(executionId: string): boolean {
    const scheduler = this.schedulers.get(executionId);
    const status = this.executions.get(executionId);
    if (!scheduler || !status) return false;

    const result = scheduler.resume();
    if (result) {
      status.status = 'running';
    }
    return result;
  }

  /**
   * 停止执行
   */
  stopExecution(executionId: string): boolean {
    const scheduler = this.schedulers.get(executionId);
    const status = this.executions.get(executionId);
    if (!status || (status.status !== 'running' && status.status !== 'paused')) {
      return false;
    }

    if (scheduler) {
      scheduler.stop('manual');
      this.schedulers.delete(executionId);
    }

    status.status = 'stopped';
    return true;
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(executionId: string): ExecutionStatus | undefined {
    const status = this.executions.get(executionId);
    // 如果调度器还在运行，同步最新时间
    const scheduler = this.schedulers.get(executionId);
    if (status && scheduler) {
      status.currentTime = scheduler.getCurrentTime();
      status.progress = scheduler.getProgress();
    }
    return status;
  }

  /**
   * 获取正在运行的执行列表
   */
  getRunningExecutions(): ExecutionStatus[] {
    return Array.from(this.executions.values()).filter(
      (s) => s.status === 'running' || s.status === 'paused'
    );
  }

  // ==================== 文件管理 ====================

  /**
   * 获取项目文件列表
   */
  async getProjectFiles(projectUuid: string): Promise<any[]> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取项目文件树(project);
  }

  /**
   * 读取项目文件内容
   */
  async getFileContent(projectUuid: string, filePath: string): Promise<string> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取项目文件(project, filePath);
  }

  /**
   * 保存项目文件内容
   */
  async saveFileContent(projectUuid: string, filePath: string, content: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    await this.存储.保存项目文件(project, filePath, content);

    // 更新项目时间
    project.updated_at = new Date().toISOString();
    await this.保存项目索引();
  }

  /**
   * 删除项目文件
   */
  async deleteFile(projectUuid: string, filePath: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    await this.存储.删除项目文件(project, filePath);

    // 更新项目时间
    project.updated_at = new Date().toISOString();
    await this.保存项目索引();
  }

  /**
   * 获取项目文件夹路径
   */
  getProjectFolder(projectUuid: string): string {
    const project = this.获取项目记录(projectUuid);
    return project.folder_path;
  }

  /**
   * 列出项目音频文件
   */
  async listAudioFiles(projectUuid: string): Promise<string[]> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.列出音频文件(project);
  }

  /**
   * 删除音频文件
   */
  async deleteAudioFile(projectUuid: string, filename: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    await this.存储.删除音频文件(project, filename);
  }

  // ==================== 项目保存/导入/导出 ====================

  /**
   * 保存项目
   */
  async saveProject(projectUuid: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);

    // 更新项目元数据
    project.updated_at = new Date().toISOString();

    await this.存储.保存项目元数据(project);
    await this.保存项目索引();
    logger.info(`保存项目: ${project.name}`, { uuid: projectUuid });
  }

  /**
   * 导出项目为 .hhzip 文件
   */
  async exportProject(projectUuid: string): Promise<{ exportPath: string; fileName: string }> {
    const project = this.获取项目记录(projectUuid);
    const { exportPath, fileName: exportFileName, exportFiles } = await this.存储.准备项目导出(project);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(exportPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        logger.info(`项目已导出: ${exportFileName}`, {
          uuid: projectUuid,
          size: archive.pointer()
        });
        resolve({ exportPath, fileName: exportFileName });
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      for (const file of exportFiles) {
        archive.file(file.fullPath, { name: file.relativePath });
      }
      archive.finalize();
    });
  }

  /**
   * 导入项目
   */
  async importProject(filePath: string, _originalName: string): Promise<ChoreoProject> {
    const tempExtractDir = path.join(os.tmpdir(), 'robot-dog-extracts', `extract_${Date.now()}`);

    try {
      // 解压文件
      await extractZip(filePath, { dir: tempExtractDir });

      // 查找 project.json 文件
      const projectJsonPath = await this.存储.查找项目元文件(tempExtractDir);

      if (!projectJsonPath) {
        throw new Error('压缩包中未找到 project.json 文件');
      }

      // 确定项目根目录
      const projectRootDir = path.dirname(projectJsonPath);

      // 读取 project.json
      const projectMeta = await this.存储.读取JSON对象<Partial<ChoreoProject>>(projectJsonPath);
      const 项目名称 = projectMeta.name;

      if (!项目名称) {
        throw new Error('project.json 格式不正确，缺少 name 字段');
      }

      // 生成新的 UUID
      const newUuid = uuidv7();
      const targetPath = this.存储.生成项目目录路径(项目名称, newUuid);

      // 移动项目文件夹到目标位置
      await this.存储.移动目录(projectRootDir, targetPath);

      // 更新项目数据
      const now = new Date().toISOString();
      const project: ChoreoProject = {
        uuid: newUuid,
        name: 项目名称,
        description: projectMeta.description || '',
        folder_path: targetPath,
        created_at: projectMeta.created_at || now,
        updated_at: now,
      };

      await this.存储.保存项目元数据(project);

      // 保存到索引
      this.projects.set(newUuid, project);
      await this.保存项目索引();

      logger.info(`导入项目成功: ${project.name}`, { uuid: newUuid });
      return project;
    } finally {
      // 清理临时文件
      await this.存储.删除目录(tempExtractDir);
    }
  }

  // ==================== 项目机器人管理（扩展） ====================

  /**
   * 直接添加机器人配置到项目（不需要关联主机器人表）
   */
  async addRobotToProjectDirect(projectUuid: string, dto: AddProjectRobotDirectDto): Promise<ProjectRobotConfig> {
    const project = this.获取项目记录(projectUuid);

    const robots = await this.getProjectRobotsConfig(projectUuid);

    const robot: ProjectRobotConfig = {
      uuid: uuidv7(),
      name: dto.name,
      robot_ip: dto.robot_ip,
      local_ip: dto.local_ip,
      local_port: dto.local_port,
      group_name: dto.group_name,
      status: 'offline',
    };

    robots.push(robot);
    await this.存储.写入项目机器人(project, robots);

    return robot;
  }

  /**
   * 获取项目机器人配置列表
   */
  async getProjectRobotsConfig(projectUuid: string): Promise<ProjectRobotConfig[]> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取项目机器人<ProjectRobotConfig>(project);
  }

  /**
   * 更新项目机器人配置
   */
  async updateProjectRobot(projectUuid: string, robotUuid: string, dto: UpdateProjectRobotDto): Promise<ProjectRobotConfig> {
    const project = this.获取项目记录(projectUuid);

    const robots = await this.getProjectRobotsConfig(projectUuid);
    const index = robots.findIndex((r) => r.uuid === robotUuid);
    if (index === -1) {
      throw new Error('机器人不在项目中');
    }

    const robot = robots[index];
    if (dto.name !== undefined) robot.name = dto.name;
    if (dto.robot_ip !== undefined) robot.robot_ip = dto.robot_ip;
    if (dto.local_ip !== undefined) robot.local_ip = dto.local_ip;
    if (dto.local_port !== undefined) robot.local_port = dto.local_port;
    if (dto.group_name !== undefined) robot.group_name = dto.group_name;
    if (dto.status !== undefined) robot.status = dto.status;

    await this.存储.写入项目机器人(project, robots);

    return robot;
  }

  /**
   * 删除项目机器人
   */
  async deleteProjectRobot(projectUuid: string, robotUuid: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);

    const robots = await this.getProjectRobotsConfig(projectUuid);
    const index = robots.findIndex((r) => r.uuid === robotUuid);
    if (index === -1) {
      throw new Error('机器人不在项目中');
    }

    robots.splice(index, 1);
    await this.存储.写入项目机器人(project, robots);
  }

  // ==================== 机器人连接测试 ====================

  /**
   * 测试机器人 SSH 连接
   */
  async testRobotConnection(projectUuid: string, robotUuid: string): Promise<ConnectionTestResult> {
    const robot = await this.获取项目机器人配置记录(projectUuid, robotUuid);

    logger.info('测试机器人连接', { projectUuid, robotUuid, ip: robot.robot_ip });
    const result = await this.机器人控制桥接.testRobotConnection(robot);
    logger.info('测试连接结果', { projectUuid, robotUuid, ...result });
    return result;
  }

  /**
   * 通过 Python 连接机器人并自动配置
   */
  async connectRobot(projectUuid: string, robotUuid: string): Promise<ConnectionTestResult> {
    const robot = await this.获取项目机器人配置记录(projectUuid, robotUuid);
    const result = await this.机器人控制桥接.connectRobot(robot);

    await this.updateProjectRobot(projectUuid, robotUuid, {
      status: result.success ? 'online' : 'offline',
    });

    return result;
  }

  /**
   * 重启运控
   */
  async restartMotionControl(projectUuid: string, robotUuid: string): Promise<{ success: boolean; message: string }> {
    const robot = await this.获取项目机器人配置记录(projectUuid, robotUuid);
    return this.机器人控制桥接.restartMotionControl(robot);
  }

}

export default 编舞服务;

export { 编舞服务 as ChoreoService };

