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
import type Logger from '../../core/logger';
import { PythonExecutor } from '../../core/services/python-executor';
import type WebSocketService from '../websocket/service';
import type {
  ActionCommand,
  AddProjectRobotDirectDto,
  AddRobotToProjectDto,
  BuildResult,
  ChoreoProject,
  ChoreoRobot,
  ConnectionTestResult,
  CreateProjectDto,
  CustomAction,
  ExecutionStatus,
  ProjectRobotConfig,
  RunResult,
  SaveTimelineDto,
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
  private pythonExecutor: PythonExecutor;

  constructor(
    private database: DatabaseService,
    private logger: Logger,
    private wsService?: WebSocketService
  ) {
    this.ensureDirectories();
    this.loadProjectIndex();
    
    // 初始化 Python 执行器
    this.pythonExecutor = new PythonExecutor(
      path.join(__dirname, '../../../../../dance-choreo/robot-control')
    );
    
    // 监听 Python 执行器事件
    this.pythonExecutor.on('output', ({ executionId, data }) => {
      this.logger.info(`[${executionId}] ${data}`);
      // TODO: 扩展 WebSocket 服务支持编舞相关消息类型后启用广播
    });
    
    this.pythonExecutor.on('error', ({ executionId, error }) => {
      this.logger.error(`[${executionId}] ${error}`);
      // TODO: 扩展 WebSocket 服务支持编舞相关消息类型后启用广播
    });
    
    this.pythonExecutor.on('complete', ({ executionId, code }) => {
      this.logger.info(`[${executionId}] 执行完成，退出码: ${code}`);
      // TODO: 扩展 WebSocket 服务支持编舞相关消息类型后启用广播
    });
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
        this.logger.info(`创建目录: ${dir}`);
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
        this.logger.info(`加载了 ${this.projects.size} 个编舞项目`);
      } catch (e) {
        this.logger.error('加载项目索引失败', e as Error);
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

    this.logger.info(`创建编舞项目: ${dto.name}`, { uuid });
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

    this.logger.info(`删除编舞项目: ${project.name}`, { uuid });
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

    this.logger.info(`保存时间轴数据`, { projectUuid, tracksCount: dto.tracks.length });
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

  // ==================== 动作执行 ====================

  /**
   * 执行动作序列
   * 通过 WebSocket 向 robot-agent 发送动作指令
   */
  async executeActions(
    projectUuid: string,
    robotIds: string[],
    actions: ActionCommand[]
  ): Promise<string> {
    if (!this.wsService) {
      throw new Error('WebSocket 服务未初始化');
    }

    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const executionId = uuidv7();
    const now = new Date().toISOString();

    // 初始化执行状态
    const status: ExecutionStatus = {
      executionId,
      status: 'running',
      currentTime: 0,
      progress: 0,
      startedAt: now,
    };
    this.executions.set(executionId, status);

    // 异步执行动作
    this.runActionsAsync(executionId, robotIds, actions).catch((error) => {
      const status = this.executions.get(executionId);
      if (status) {
        status.status = 'error';
        status.error = error.message;
      }
    });

    this.logger.info(`开始执行动作序列`, {
      executionId,
      robotCount: robotIds.length,
      actionCount: actions.length,
    });

    return executionId;
  }

  /**
   * 异步执行动作序列
   */
  private async runActionsAsync(
    executionId: string,
    robotIds: string[],
    actions: ActionCommand[]
  ): Promise<void> {
    const status = this.executions.get(executionId);
    if (!status) return;

    try {
      // 舞蹈开始前，禁止所有机器人收音
      for (const robotId of robotIds) {
        await this.setAudioRecording(robotId, false);
      }

      for (let i = 0; i < actions.length; i++) {
        // 检查是否被停止
        if (status.status === 'stopped') {
          break;
        }

        const action = actions[i];
        status.progress = Math.round(((i + 1) / actions.length) * 100);
        status.message = `执行: ${action.action}`;

        // 向每个机器人发送动作指令
        for (const robotId of robotIds) {
          await this.sendActionToRobot(robotId, action);
        }

        // 广播进度
        this.broadcastExecutionProgress(executionId, status);

        // 如果动作有持续时间，等待
        // TODO: 根据动作的 duration 参数等待
      }

      status.status = 'completed';
      status.progress = 100;
      this.broadcastExecutionProgress(executionId, status);
    } catch (error: any) {
      status.status = 'error';
      status.error = error.message;
      this.broadcastExecutionProgress(executionId, status);
      throw error;
    }
  }

  /**
   * 设置机器人的收音状态
   */
  private async setAudioRecording(robotId: string, enabled: boolean): Promise<void> {
    if (!this.wsService) return;

    const message = {
      type: 'audio_control',
      robotId,
      timestamp: Date.now(),
      data: {
        enabled,
        source: 'choreo',
      },
    };

    this.wsService.sendToRobot(robotId, message, 'business');
  }

  /**
   * 向机器人发送动作指令
   */
  private async sendActionToRobot(robotId: string, action: ActionCommand): Promise<void> {
    if (!this.wsService) {
      throw new Error('WebSocket 服务未初始化');
    }

    // 通过 WebSocket 发送动作指令到 robot-agent
    const message = {
      type: 'action_command',
      robotId,
      timestamp: Date.now(),
      data: {
        action: action.action,
        parameters: action.parameters || {},
      },
    };

    // 使用 WebSocket 服务发送消息
    this.wsService.sendToRobot(robotId, message, 'business');
  }

  /**
   * 广播执行进度
   */
  private broadcastExecutionProgress(executionId: string, status: ExecutionStatus): void {
    // 编舞系统的执行进度广播暂时使用日志记录
    // TODO: 需要扩展 WebSocket 服务支持编舞相关消息类型
    this.logger.info('执行进度', {
      executionId,
      status: status.status,
      progress: status.progress,
      message: status.message,
    });
  }

  /**
   * 停止执行
   */
  stopExecution(executionId: string): boolean {
    const status = this.executions.get(executionId);
    if (!status || status.status !== 'running') {
      return false;
    }

    status.status = 'stopped';
    this.broadcastExecutionProgress(executionId, status);
    return true;
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(executionId: string): ExecutionStatus | undefined {
    return this.executions.get(executionId);
  }

  /**
   * 获取正在运行的执行列表
   */
  getRunningExecutions(): ExecutionStatus[] {
    return Array.from(this.executions.values()).filter(
      (s) => s.status === 'running'
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
        this.logger.error(`读取目录失败: ${dirPath}`, error as Error);
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
    this.logger.info(`保存项目: ${project.name}`, { uuid: projectUuid });
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
        this.logger.info(`项目已导出: ${exportFileName}`, { 
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
  async importProject(filePath: string, originalName: string): Promise<ChoreoProject> {
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

      this.logger.info(`导入项目成功: ${project.name}`, { uuid: newUuid });
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
    
    const now = new Date().toISOString();
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

    this.logger.info('测试机器人连接', { projectUuid, robotUuid, ip: robot.robot_ip });

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

        this.logger.info('测试连接结果', { projectUuid, robotUuid, ...result });
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

  // ==================== Python 脚本封装与运行 ====================

  /**
   * 封装项目为 Python 脚本
   */
  buildProject(projectUuid: string): BuildResult {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    // 读取时间轴数据
    const timelineData = this.getTimeline(projectUuid);
    
    // 获取项目机器人配置
    const robots = this.getProjectRobotsConfig(projectUuid);
    
    // 创建 build 目录
    const buildDir = path.join(project.folder_path, 'build');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    // 复制 lib 库到 build 目录
    const libSourcePath = path.join(__dirname, '../../../../../dance-choreo/robot-control/lib');
    const libTargetPath = path.join(buildDir, 'lib');
    
    if (fs.existsSync(libSourcePath)) {
      if (fs.existsSync(libTargetPath)) {
        fs.rmSync(libTargetPath, { recursive: true, force: true });
      }
      this.copyDirectory(libSourcePath, libTargetPath);
    }

    // 生成 Python 代码
    const pythonCode = this.generatePythonFromTimeline(timelineData, project.name, robots);
    
    // 写入 Python 文件
    const pythonFileName = `${this.sanitizeFilename(project.name)}.py`;
    const pythonFilePath = path.join(buildDir, pythonFileName);
    fs.writeFileSync(pythonFilePath, pythonCode, 'utf-8');

    this.logger.info(`封装项目成功: ${project.name}`, { uuid: projectUuid, pythonFile: pythonFileName });

    return {
      pythonFile: pythonFileName,
      buildPath: buildDir,
    };
  }

  /**
   * 运行项目的 Python 脚本
   */
  runProject(projectUuid: string): RunResult {
    const project = this.projects.get(projectUuid);
    if (!project) {
      throw new Error('项目不存在');
    }

    const buildDir = path.join(project.folder_path, 'build');
    const pythonFileName = `${this.sanitizeFilename(project.name)}.py`;
    const pythonFilePath = path.join(buildDir, pythonFileName);

    if (!fs.existsSync(pythonFilePath)) {
      throw new Error('未找到 Python 文件，请先封装');
    }

    const result = this.pythonExecutor.execute(pythonFilePath, buildDir);
    
    this.logger.info(`运行项目: ${project.name}`, { uuid: projectUuid, executionId: result.executionId });

    return result;
  }

  /**
   * 封装并运行项目
   */
  buildAndRunProject(projectUuid: string): RunResult {
    this.buildProject(projectUuid);
    return this.runProject(projectUuid);
  }

  /**
   * 复制目录
   */
  private copyDirectory(source: string, target: string): void {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const files = fs.readdirSync(source);
    for (const file of files) {
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);
      
      if (fs.statSync(sourcePath).isDirectory()) {
        this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  /**
   * 清理文件名
   */
  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
  }

  /**
   * 从时间轴生成 Python 代码
   */
  private generatePythonFromTimeline(
    timelineData: TimelineData, 
    projectName: string, 
    robots: ProjectRobotConfig[]
  ): string {
    const { tracks } = timelineData;
    
    this.logger.info('开始生成 Python 代码', {
      tracksCount: tracks?.length || 0,
      robotsCount: robots.length,
    });
    
    // 构建机器人映射
    const robotsMap = new Map<string, ProjectRobotConfig>();
    robots.forEach(robot => {
      robotsMap.set(robot.uuid, robot);
    });
    
    // 提取动作
    const actions: Array<{ time: number; robot: string; action: string; params: any }> = [];
    
    tracks.forEach((track, index) => {
      if (track.type === 'action' && track.robotId) {
        if (!robotsMap.has(track.robotId)) {
          this.logger.warn(`轨道 ${index} 绑定的机器狗 ${track.robotId} 不存在，跳过处理`);
          return;
        }
        
        // 处理 clips
        if (track.clips && Array.isArray(track.clips)) {
          track.clips.forEach((clip) => {
            if (clip.action) {
              actions.push({
                time: clip.startTime || 0,
                robot: track.robotId!,
                action: clip.action.action,
                params: clip.action.parameters || {},
              });
            }
          });
        }
      }
    });
    
    // 按时间排序
    actions.sort((a, b) => a.time - b.time);
    
    // 生成 Python 代码
    let code = `#!/usr/bin/env python3\n`;
    code += `# -*- coding: utf-8 -*-\n`;
    code += `# ${projectName}\n`;
    code += `# 自动生成于 ${new Date().toISOString()}\n\n`;
    code += `from lib.api import CrazyRobotDog\n`;
    code += `import time\n\n`;
    
    // 创建机器人变量映射
    const robotVarMap = new Map<string, string>();
    
    // 生成机器人配置
    if (robotsMap.size > 0) {
      code += `# 机器人配置\n`;
      code += `DOGS_CONFIG = {\n`;
      robotsMap.forEach((config) => {
        code += `    "${config.name}": ("${config.robot_ip}", ${config.local_port}),\n`;
      });
      code += `}\n\n`;
      
      // 使用第一个机器人的 local_ip
      const firstRobot = Array.from(robotsMap.values())[0];
      code += `LOCAL_IP = "${firstRobot.local_ip}"\n\n`;
      
      // 创建机器人实例
      code += `# 创建机器人实例\n`;
      let robotIndex = 1;
      robotsMap.forEach((config, uuid) => {
        const varName = `dog${robotIndex}`;
        robotVarMap.set(uuid, varName);
        code += `${varName} = CrazyRobotDog(\n`;
        code += `    name="${config.name}",\n`;
        code += `    robot_ip=DOGS_CONFIG["${config.name}"][0],\n`;
        code += `    local_ip=LOCAL_IP,\n`;
        code += `    local_port=DOGS_CONFIG["${config.name}"][1],\n`;
        code += `)\n\n`;
        robotIndex++;
      });
    } else {
      // 默认配置
      code += `# 默认机器人配置\n`;
      code += `DOGS_CONFIG = {\n`;
      code += `    "131": ("192.168.1.110", 10131),\n`;
      code += `}\n\n`;
      code += `LOCAL_IP = "192.168.1.105"\n\n`;
      code += `dog1 = CrazyRobotDog(\n`;
      code += `    name="131",\n`;
      code += `    robot_ip=DOGS_CONFIG["131"][0],\n`;
      code += `    local_ip=LOCAL_IP,\n`;
      code += `    local_port=DOGS_CONFIG["131"][1],\n`;
      code += `)\n\n`;
    }
    
    // 生成动作序列
    code += `# 动作序列\n`;
    if (actions.length > 0) {
      let lastTime = 0;
      actions.forEach((action) => {
        // 添加延迟
        if (action.time > lastTime) {
          const delay = action.time - lastTime;
          code += `time.sleep(${delay.toFixed(2)})\n`;
        }
        
        // 添加动作
        const robotVar = robotVarMap.get(action.robot) || 'dog1';
        const params: string[] = [];
        
        if (action.params.duration !== undefined) {
          params.push(String(action.params.duration));
        }
        if (action.params.angle !== undefined) {
          params.push(`angle=${action.params.angle}`);
        }
        if (action.params.direction) {
          params.push(`direction='${action.params.direction}'`);
        }
        
        const paramsStr = params.join(', ');
        code += `${robotVar}.${action.action}(${paramsStr})\n`;
        
        lastTime = action.time;
      });
    } else {
      code += `# 没有动作数据，添加默认动作\n`;
      code += `dog1.stand_up(0)\n`;
      code += `time.sleep(1)\n`;
      code += `dog1.attitude_rest()\n`;
    }
    
    return code;
  }
}

export default 编舞服务;

export { 编舞服务 as ChoreoService };
