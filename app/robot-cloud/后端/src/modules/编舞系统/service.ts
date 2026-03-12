/**
 * 编舞系统服务
 * 负责项目管理、时间轴数据存储和动作执行
 */

import archiver from 'archiver';
import { spawn } from 'child_process';
import extractZip from 'extract-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';
import type DatabaseService from '../../core/database';
import { logger } from '../../core/logger';
import { PythonExecutor } from '../../core/services/python-executor';
import type WebSocketService from '../websocket/service';
import { ChoreoScheduler } from './scheduler';
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

// 数据目录配置
const APP_NAME = 'RobotDogChoreo';
const getDataDir = (): string => {
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, APP_NAME);
  } else if (os.platform() === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  } else {
    return path.join(os.homedir(), '.local', 'share', APP_NAME);
  }
};

const getProjectsDir = (): string => {
  return path.join(os.homedir(), 'Documents', `${APP_NAME}Projects`);
};

const DATA_DIR = process.env.CHOREO_DATA_DIR || getDataDir();
const PROJECTS_DIR = process.env.CHOREO_PROJECTS_DIR || getProjectsDir();

export class 编舞服务 {
  private projects: Map<string, ChoreoProject> = new Map();
  private executions: Map<string, ExecutionStatus> = new Map();
  private schedulers: Map<string, ChoreoScheduler> = new Map();
  private pythonExecutor: PythonExecutor;

  constructor(
    private database: DatabaseService,
    private wsService?: WebSocketService
  ) {
    this.ensureDirectories();
    this.loadProjectIndex();

    // PythonExecutor 保留给 SSH 连接测试和运控重启用
    this.pythonExecutor = new PythonExecutor(
      path.join(__dirname, '../../../../../dance-choreo/robot-control')
    );
  }

  /**
   * 设置 WebSocket 服务（延迟注入）
   */
  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
  }

  /**
   * 确保数据目录存在
   */
  private ensureDirectories(): void {
    [DATA_DIR, PROJECTS_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`创建目录: ${dir}`);
      }
    });
  }

  /**
   * 加载项目索引
   */
  private loadProjectIndex(): void {
    const indexPath = path.join(DATA_DIR, 'project-index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        if (Array.isArray(data)) {
          data.forEach((p: ChoreoProject) => this.projects.set(p.uuid, p));
        }
        logger.info(`加载了 ${this.projects.size} 个编舞项目`);
      } catch (e) {
        logger.error('加载项目索引失败', e as Error);
      }
    }
  }

  /**
   * 保存项目索引
   */
  private saveProjectIndex(): void {
    const indexPath = path.join(DATA_DIR, 'project-index.json');
    const data = Array.from(this.projects.values());
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
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
  createProject(dto: CreateProjectDto): ChoreoProject {
    const uuid = uuidv7();
    const folderName = `${dto.name.replace(/[<>:"/\\|?*]/g, '_')}_${uuid.substring(0, 8)}`;
    const folderPath = path.join(PROJECTS_DIR, folderName);

    // 创建项目文件夹结构
    fs.mkdirSync(folderPath, { recursive: true });
    fs.mkdirSync(path.join(folderPath, 'audio'));
    fs.mkdirSync(path.join(folderPath, 'exports'));
    fs.mkdirSync(path.join(folderPath, 'backups'));

    const now = new Date().toISOString();
    const project: ChoreoProject = {
      uuid,
      name: dto.name,
      description: dto.description,
      folder_path: folderPath,
      created_at: now,
      updated_at: now,
    };

    // 创建项目元数据文件
    fs.writeFileSync(
      path.join(folderPath, 'project.json'),
      JSON.stringify(project, null, 2)
    );

    // 创建默认时间轴
    const defaultTimeline: TimelineData = {
      tracks: [],
      config: {
        duration: 60,
        pixelsPerSecond: 100,
        currentTime: 0,
        snapToGrid: true,
        gridSize: 0.5,
      },
    };
    fs.writeFileSync(
      path.join(folderPath, 'timeline.json'),
      JSON.stringify(defaultTimeline, null, 2)
    );

    // 保存到索引
    this.projects.set(uuid, project);
    this.saveProjectIndex();

    logger.info(`创建编舞项目: ${dto.name}`, { uuid });
    return project;
  }

  /**
   * 更新项目
   */
  updateProject(uuid: string, dto: UpdateProjectDto): ChoreoProject {
    const project = this.projects.get(uuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    project.updated_at = new Date().toISOString();

    // 更新元数据文件
    fs.writeFileSync(
      path.join(project.folder_path, 'project.json'),
      JSON.stringify(project, null, 2)
    );

    this.saveProjectIndex();
    return project;
  }

  /**
   * 删除项目
   */
  deleteProject(uuid: string): void {
    const project = this.projects.get(uuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    // 删除项目文件夹
    if (fs.existsSync(project.folder_path)) {
      fs.rmSync(project.folder_path, { recursive: true, force: true });
    }

    this.projects.delete(uuid);
    this.saveProjectIndex();

    logger.info(`删除编舞项目: ${project.name}`, { uuid });
  }

  /**
   * 打开项目（更新最后打开时间）
   */
  openProject(uuid: string): ChoreoProject {
    const project = this.projects.get(uuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    project.last_opened = new Date().toISOString();
    this.saveProjectIndex();
    return project;
  }

  // ==================== 项目机器人管理 ====================

  /**
   * 获取项目中的机器人列表
   */
  getProjectRobots(projectUuid: string): ChoreoRobot[] {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const robotsPath = path.join(project.folder_path, 'robots.json');
    if (!fs.existsSync(robotsPath)) {
      return [];
    }

    try {
      return JSON.parse(fs.readFileSync(robotsPath, 'utf-8'));
    } catch {
      return [];
    }
  }

  /**
   * 添加机器人到项目
   */
  addRobotToProject(projectUuid: string, dto: AddRobotToProjectDto): ChoreoRobot {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    // 验证机器人是否存在
    const mainRobot = this.database.getRobot(dto.robot_id);
    if (!mainRobot) {
      throw new Error('机器人不存在');
    }

    const robots = this.getProjectRobots(projectUuid);

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
    fs.writeFileSync(
      path.join(project.folder_path, 'robots.json'),
      JSON.stringify(robots, null, 2)
    );

    return robot;
  }

  /**
   * 从项目移除机器人
   */
  removeRobotFromProject(projectUuid: string, robotUuid: string): void {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const robots = this.getProjectRobots(projectUuid);
    const index = robots.findIndex((r) => r.uuid === robotUuid);
    if (index === -1) {
      throw new Error('机器人不在项目中');
    }

    robots.splice(index, 1);
    fs.writeFileSync(
      path.join(project.folder_path, 'robots.json'),
      JSON.stringify(robots, null, 2)
    );
  }

  // ==================== 时间轴管理 ====================

  /**
   * 获取时间轴数据
   */
  getTimeline(projectUuid: string): TimelineData {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const timelinePath = path.join(project.folder_path, 'timeline.json');
    if (!fs.existsSync(timelinePath)) {
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

    try {
      return JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
    } catch {
      throw new Error('时间轴数据损坏');
    }
  }

  /**
   * 保存时间轴数据
   */
  saveTimeline(projectUuid: string, dto: SaveTimelineDto): void {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const timelineData: TimelineData = {
      tracks: dto.tracks,
      config: dto.config,
      updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(project.folder_path, 'timeline.json'),
      JSON.stringify(timelineData, null, 2)
    );

    // 更新项目时间
    project.updated_at = new Date().toISOString();
    this.saveProjectIndex();

    logger.info(`保存时间轴数据`, { projectUuid, tracksCount: dto.tracks.length });
  }

  // ==================== 自定义动作管理 ====================

  /**
   * 获取自定义动作列表
   */
  getCustomActions(projectUuid: string): CustomAction[] {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const actionsPath = path.join(project.folder_path, 'custom-actions.json');
    if (!fs.existsSync(actionsPath)) {
      return [];
    }

    try {
      return JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
    } catch {
      return [];
    }
  }

  /**
   * 保存自定义动作
   */
  saveCustomAction(
    projectUuid: string,
    data: { name: string; description?: string; tracks: TimelineTrack[]; config: TimelineConfig }
  ): CustomAction {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const actions = this.getCustomActions(projectUuid);
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
    fs.writeFileSync(
      path.join(project.folder_path, 'custom-actions.json'),
      JSON.stringify(actions, null, 2)
    );

    return action;
  }

  // ==================== 音频管理 ====================

  /**
   * 获取音频文件路径
   */
  getAudioPath(projectUuid: string, filename: string): string {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const audioPath = path.join(project.folder_path, 'audio', filename);
    if (!fs.existsSync(audioPath)) {
      throw new Error('音频文件不存在');
    }

    return audioPath;
  }

  /**
   * 保存上传的音频文件
   */
  saveAudioFile(projectUuid: string, filename: string, buffer: Buffer): string {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const audioDir = path.join(project.folder_path, 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    // 添加时间戳避免重名
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    const safeFilename = `${basename}_${Date.now()}${ext}`;
    const audioPath = path.join(audioDir, safeFilename);

    fs.writeFileSync(audioPath, new Uint8Array(buffer));
    return safeFilename;
  }

  // ==================== 时间轴编译与执行 ====================

  /**
   * 编译时间轴为执行计划
   * 遍历所有轨道的 clips，按 executeAt 排序，生成 ScheduledAction 列表
   */
  compileTimeline(projectUuid: string): ExecutionPlan {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const timelineData = this.getTimeline(projectUuid);
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
  executeChoreo(projectUuid: string): ExecutionStatus {
    if (!this.wsService) {
      throw new Error('WebSocket 服务未初始化');
    }

    // 编译时间轴
    const plan = this.compileTimeline(projectUuid);

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
  getProjectFiles(projectUuid: string): any[] {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const readDirectory = (dirPath: string, relativePath: string = ''): any[] => {
      const items: any[] = [];

      try {
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
          // 跳过隐藏文件和特定文件夹
          if (file.startsWith('.') || file === 'node_modules' || file === 'backups') {
            continue;
          }

          const fullPath = path.join(dirPath, file);
          const relPath = relativePath ? path.join(relativePath, file) : file;
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            items.push({
              name: file,
              path: relPath,
              isDirectory: true,
              children: readDirectory(fullPath, relPath),
            });
          } else {
            items.push({
              name: file,
              path: relPath,
              isDirectory: false,
              size: stat.size,
              modifiedTime: stat.mtime,
            });
          }
        }
      } catch (error) {
        logger.error(`读取目录失败: ${dirPath}`, error);
      }

      // 排序：文件夹在前，文件在后，同类按名称排序
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return items;
    };

    return readDirectory(project.folder_path);
  }

  /**
   * 读取项目文件内容
   */
  getFileContent(projectUuid: string, filePath: string): string {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    if (!filePath) {
      throw new Error('文件路径是必需的');
    }

    // 防止目录遍历攻击
    const fullPath = path.join(project.folder_path, filePath);
    if (!fullPath.startsWith(project.folder_path)) {
      throw new Error('非法的文件路径');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('文件不存在');
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error('无法读取文件夹内容');
    }

    return fs.readFileSync(fullPath, 'utf-8');
  }

  /**
   * 保存项目文件内容
   */
  saveFileContent(projectUuid: string, filePath: string, content: string): void {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    if (!filePath) {
      throw new Error('文件路径是必需的');
    }

    // 防止目录遍历攻击
    const fullPath = path.join(project.folder_path, filePath);
    if (!fullPath.startsWith(project.folder_path)) {
      throw new Error('非法的文件路径');
    }

    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');

    // 更新项目时间
    project.updated_at = new Date().toISOString();
    this.saveProjectIndex();
  }

  /**
   * 删除项目文件
   */
  deleteFile(projectUuid: string, filePath: string): void {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    if (!filePath) {
      throw new Error('文件路径是必需的');
    }

    // 防止目录遍历攻击
    const fullPath = path.join(project.folder_path, filePath);
    if (!fullPath.startsWith(project.folder_path)) {
      throw new Error('非法的文件路径');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('文件不存在');
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    // 更新项目时间
    project.updated_at = new Date().toISOString();
    this.saveProjectIndex();
  }

  /**
   * 获取项目文件夹路径
   */
  getProjectFolder(projectUuid: string): string {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }
    return project.folder_path;
  }

  /**
   * 列出项目音频文件
   */
  listAudioFiles(projectUuid: string): string[] {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const audioDir = path.join(project.folder_path, 'audio');
    if (!fs.existsSync(audioDir)) {
      return [];
    }

    return fs.readdirSync(audioDir).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext);
    });
  }

  /**
   * 删除音频文件
   */
  deleteAudioFile(projectUuid: string, filename: string): void {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const audioPath = path.join(project.folder_path, 'audio', filename);
    if (!fs.existsSync(audioPath)) {
      throw new Error('音频文件不存在');
    }

    fs.unlinkSync(audioPath);
  }

  // ==================== 项目保存/导入/导出 ====================

  /**
   * 保存项目
   */
  saveProject(projectUuid: string): void {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    // 更新项目元数据
    project.updated_at = new Date().toISOString();

    // 写入 project.json
    fs.writeFileSync(
      path.join(project.folder_path, 'project.json'),
      JSON.stringify(project, null, 2)
    );

    this.saveProjectIndex();
    logger.info(`保存项目: ${project.name}`, { uuid: projectUuid });
  }

  /**
   * 导出项目为 .hhzip 文件
   */
  async exportProject(projectUuid: string): Promise<{ exportPath: string; fileName: string }> {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    // 确保 exports 目录存在
    const exportsDir = path.join(project.folder_path, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // 生成导出文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const exportFileName = `${project.name}_${timestamp}.hhzip`;
    const exportPath = path.join(exportsDir, exportFileName);

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

      // 添加项目文件夹中的所有文件到压缩包（排除 exports 和隐藏文件）
      const addFilesToArchive = (dirPath: string, basePath: string = '') => {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
          const fullPath = path.join(dirPath, item);
          const relativePath = basePath ? path.join(basePath, item) : item;

          // 跳过 exports 目录和隐藏文件
          if (item === 'exports' || item.startsWith('.')) {
            continue;
          }

          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            addFilesToArchive(fullPath, relativePath);
          } else {
            archive.file(fullPath, { name: relativePath });
          }
        }
      };

      addFilesToArchive(project.folder_path);
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
      let projectJsonPath: string | null = null;
      let projectRootDir: string = tempExtractDir;

      const findProjectJson = (dir: string): string | null => {
        const items = fs.readdirSync(dir);

        // 首先在当前目录查找
        if (items.includes('project.json')) {
          return path.join(dir, 'project.json');
        }

        // 如果有且仅有一个子目录，递归查找
        const subdirs = items.filter(item => {
          const itemPath = path.join(dir, item);
          return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
        });

        if (subdirs.length === 1) {
          return findProjectJson(path.join(dir, subdirs[0]));
        }

        return null;
      };

      projectJsonPath = findProjectJson(tempExtractDir);

      if (!projectJsonPath) {
        throw new Error('压缩包中未找到 project.json 文件');
      }

      // 确定项目根目录
      projectRootDir = path.dirname(projectJsonPath);

      // 读取 project.json
      const projectMeta = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));

      if (!projectMeta.name) {
        throw new Error('project.json 格式不正确，缺少 name 字段');
      }

      // 生成新的 UUID
      const newUuid = uuidv7();
      const folderName = `${projectMeta.name.replace(/[<>:"/\\|?*]/g, '_')}_${newUuid.substring(0, 8)}`;
      const targetPath = path.join(PROJECTS_DIR, folderName);

      // 移动项目文件夹到目标位置
      fs.renameSync(projectRootDir, targetPath);

      // 更新项目数据
      const now = new Date().toISOString();
      const project: ChoreoProject = {
        uuid: newUuid,
        name: projectMeta.name,
        description: projectMeta.description || '',
        folder_path: targetPath,
        created_at: projectMeta.created_at || now,
        updated_at: now,
      };

      // 更新 project.json
      fs.writeFileSync(
        path.join(targetPath, 'project.json'),
        JSON.stringify(project, null, 2)
      );

      // 保存到索引
      this.projects.set(newUuid, project);
      this.saveProjectIndex();

      logger.info(`导入项目成功: ${project.name}`, { uuid: newUuid });
      return project;
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
    }
  }

  // ==================== 项目机器人管理（扩展） ====================

  /**
   * 直接添加机器人配置到项目（不需要关联主机器人表）
   */
  addRobotToProjectDirect(projectUuid: string, dto: AddProjectRobotDirectDto): ProjectRobotConfig {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const robots = this.getProjectRobotsConfig(projectUuid);

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
    fs.writeFileSync(
      path.join(project.folder_path, 'robots.json'),
      JSON.stringify(robots, null, 2)
    );

    return robot;
  }

  /**
   * 获取项目机器人配置列表
   */
  getProjectRobotsConfig(projectUuid: string): ProjectRobotConfig[] {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const robotsPath = path.join(project.folder_path, 'robots.json');
    if (!fs.existsSync(robotsPath)) {
      return [];
    }

    try {
      return JSON.parse(fs.readFileSync(robotsPath, 'utf-8'));
    } catch {
      return [];
    }
  }

  /**
   * 更新项目机器人配置
   */
  updateProjectRobot(projectUuid: string, robotUuid: string, dto: UpdateProjectRobotDto): ProjectRobotConfig {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const robots = this.getProjectRobotsConfig(projectUuid);
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

    fs.writeFileSync(
      path.join(project.folder_path, 'robots.json'),
      JSON.stringify(robots, null, 2)
    );

    return robot;
  }

  /**
   * 删除项目机器人
   */
  deleteProjectRobot(projectUuid: string, robotUuid: string): void {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const robots = this.getProjectRobotsConfig(projectUuid);
    const index = robots.findIndex((r) => r.uuid === robotUuid);
    if (index === -1) {
      throw new Error('机器人不在项目中');
    }

    robots.splice(index, 1);
    fs.writeFileSync(
      path.join(project.folder_path, 'robots.json'),
      JSON.stringify(robots, null, 2)
    );
  }

  // ==================== 机器人连接测试 ====================

  /**
   * 测试机器人 SSH 连接
   */
  async testRobotConnection(projectUuid: string, robotUuid: string): Promise<ConnectionTestResult> {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const robots = this.getProjectRobotsConfig(projectUuid);
    const robot = robots.find((r) => r.uuid === robotUuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    logger.info('测试机器人连接', { projectUuid, robotUuid, ip: robot.robot_ip });

    return new Promise((resolve) => {
      const args = [
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=3',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        `firefly@${robot.robot_ip}`,
        'exit'
      ];

      const proc = spawn('ssh', args);
      let stderr = '';

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code) => {
        let result: ConnectionTestResult;

        if (code === 0) {
          result = { success: true, connected: true, message: 'SSH 测试成功' };
        } else if (stderr.includes('Permission denied')) {
          result = { success: true, connected: true, message: 'SSH 可达' };
        } else if (stderr.includes('Connection timed out')) {
          result = { success: false, connected: false, message: 'SSH 连接超时' };
        } else {
          result = { success: false, connected: false, message: stderr || 'SSH 测试失败' };
        }

        logger.info('测试连接结果', { projectUuid, robotUuid, ...result });
        resolve(result);
      });

      proc.on('error', () => {
        resolve({ success: false, connected: false, message: '无法执行ssh命令' });
      });
    });
  }

  /**
   * 通过 Python 连接机器人并自动配置
   */
  async connectRobot(projectUuid: string, robotUuid: string): Promise<ConnectionTestResult> {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const robots = this.getProjectRobotsConfig(projectUuid);
    const robot = robots.find((r) => r.uuid === robotUuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    // 测试 SSH 连接
    const sshResult = await this.pythonExecutor.testSshConnection({
      name: robot.name,
      robot_ip: robot.robot_ip,
    });

    if (!sshResult.success) {
      // 更新状态为 offline
      this.updateProjectRobot(projectUuid, robotUuid, { status: 'offline' });
      return {
        success: false,
        connected: false,
        message: sshResult.message
      };
    }

    // 自动配置
    const configResult = await this.pythonExecutor.autoConfigure({
      name: robot.name,
      robot_ip: robot.robot_ip,
      local_ip: robot.local_ip,
      local_port: robot.local_port,
    });

    // 更新状态
    this.updateProjectRobot(projectUuid, robotUuid, { status: 'online' });

    return {
      success: true,
      connected: true,
      message: sshResult.message + (configResult.message ? `；${configResult.message}` : ''),
      mode: configResult.mode,
    };
  }

  /**
   * 重启运控
   */
  async restartMotionControl(projectUuid: string, robotUuid: string): Promise<{ success: boolean; message: string }> {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const robots = this.getProjectRobotsConfig(projectUuid);
    const robot = robots.find((r) => r.uuid === robotUuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    return this.pythonExecutor.restartMotionControl({
      name: robot.name,
      robot_ip: robot.robot_ip,
      local_ip: robot.local_ip,
      local_port: robot.local_port,
    });
  }

}

export default 编舞服务;

export { 编舞服务 as ChoreoService };

