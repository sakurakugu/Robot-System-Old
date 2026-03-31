/**
 * 编舞系统服务
 * 负责项目管理、时间轴数据存储和动作执行
 */

import { logger } from '../../infra/logger';
import type { RobotRepository } from '../机器人管理/repository';
import { 编舞机器人控制桥接 } from './bridges/robot-control-bridge';
import type { 编舞执行消息网关 } from './execution-message-gateway';
import { 编舞执行服务 } from './execution-service';
import { 编舞项目文件资源服务 } from './project-file-resource-service';
import { 编舞项目管理服务 } from './project-management-service';
import { 编舞项目机器人服务 } from './project-robot-service';
import { 编舞项目存储 } from './storage/project-storage';
import { 编舞时间轴编译器 } from './timeline-compiler';
import { 编舞时间轴内容服务 } from './timeline-content-service';
import type {
  AddProjectRobotDirectDto,
  AddRobotToProjectDto,
  ChoreoProject,
  ChoreoRobot,
  ConnectionTestResult,
  CreateProjectDto,
  CustomAction,
  ExecutionPlan,
  ExecutionStatus,
  ProjectRobotConfig,
  SaveTimelineDto,
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
type 编舞项目机器人服务接口 = Pick<
  编舞项目机器人服务,
  | 'getProjectRobots'
  | 'addRobotToProject'
  | 'removeRobotFromProject'
  | 'addRobotToProjectDirect'
  | 'getProjectRobotsConfig'
  | 'updateProjectRobot'
  | 'deleteProjectRobot'
  | 'testRobotConnection'
  | 'connectRobot'
  | 'restartMotionControl'
>;
type 编舞项目文件资源服务接口 = Pick<
  编舞项目文件资源服务,
  | 'getProjectFiles'
  | 'getFileContent'
  | 'saveFileContent'
  | 'deleteFile'
  | 'getProjectFolder'
  | 'getAudioPath'
  | 'saveAudioFile'
  | 'listAudioFiles'
  | 'deleteAudioFile'
  | 'saveProject'
  | 'exportProject'
  | 'importProject'
>;
type 编舞项目管理服务接口 = Pick<
  编舞项目管理服务,
  | '初始化'
  | 'getAllProjects'
  | 'getProject'
  | '获取项目记录'
  | '保存项目索引'
  | '注册项目'
  | 'createProject'
  | 'updateProject'
  | 'deleteProject'
  | 'openProject'
>;
type 编舞时间轴内容服务接口 = Pick<
  编舞时间轴内容服务,
  | 'getTimeline'
  | 'saveTimeline'
  | 'getCustomActions'
  | 'saveCustomAction'
>;
type 编舞时间轴编译器接口 = Pick<编舞时间轴编译器, 'compile'>;

export interface 编舞服务依赖 {
  机器人仓库: 编舞机器人查询仓库;
  存储?: 编舞项目存储;
  机器人控制桥接?: 编舞机器人控制桥接接口;
  执行消息网关?: 编舞执行消息网关;
  执行服务?: 编舞执行服务;
  时间轴编译器?: 编舞时间轴编译器接口;
  项目机器人服务?: 编舞项目机器人服务接口;
  项目文件资源服务?: 编舞项目文件资源服务接口;
  项目管理服务?: 编舞项目管理服务接口;
  时间轴内容服务?: 编舞时间轴内容服务接口;
}

export class 编舞服务 {
  private readonly 执行服务: 编舞执行服务;
  private readonly 时间轴编译器: 编舞时间轴编译器接口;
  private readonly 项目管理服务: 编舞项目管理服务接口;
  private readonly 项目机器人服务: 编舞项目机器人服务接口;
  private readonly 项目文件资源服务: 编舞项目文件资源服务接口;
  private readonly 时间轴内容服务: 编舞时间轴内容服务接口;

  constructor({
    机器人仓库,
    存储 = new 编舞项目存储(),
    机器人控制桥接 = new 编舞机器人控制桥接(),
    执行消息网关,
    执行服务,
    时间轴编译器 = new 编舞时间轴编译器(),
    项目机器人服务,
    项目文件资源服务,
    项目管理服务,
    时间轴内容服务,
  }: 编舞服务依赖) {
    if (执行服务) {
      this.执行服务 = 执行服务;
    } else {
      if (!执行消息网关) {
        throw new Error('编舞执行消息网关未初始化');
      }
      this.执行服务 = new 编舞执行服务(执行消息网关);
    }
    this.时间轴编译器 = 时间轴编译器;

    const 管理服务 = 项目管理服务 ?? new 编舞项目管理服务(存储);
    this.项目管理服务 = 管理服务;
    this.项目机器人服务 = 项目机器人服务 ?? new 编舞项目机器人服务(
      (projectUuid) => 管理服务.获取项目记录(projectUuid),
      存储,
      机器人仓库,
      机器人控制桥接,
    );
    this.项目文件资源服务 = 项目文件资源服务 ?? new 编舞项目文件资源服务(
      (projectUuid) => 管理服务.获取项目记录(projectUuid),
      存储,
      () => 管理服务.保存项目索引(),
      (project) => 管理服务.注册项目(project),
    );
    this.时间轴内容服务 = 时间轴内容服务 ?? new 编舞时间轴内容服务(
      (projectUuid) => 管理服务.获取项目记录(projectUuid),
      存储,
      () => 管理服务.保存项目索引(),
    );
  }

  async 初始化(): Promise<void> {
    await this.项目管理服务.初始化();
  }

  private 获取项目记录(projectUuid: string): ChoreoProject {
    return this.项目管理服务.获取项目记录(projectUuid);
  }

  private async 保存项目索引(): Promise<void> {
    await this.项目管理服务.保存项目索引();
  }

  // ==================== 项目管理 ====================

  /**
   * 获取所有项目
   */
  getAllProjects(): ChoreoProject[] {
    return this.项目管理服务.getAllProjects();
  }

  /**
   * 获取单个项目
   */
  getProject(uuid: string): ChoreoProject | undefined {
    return this.项目管理服务.getProject(uuid);
  }

  /**
   * 创建项目
   */
  async createProject(dto: CreateProjectDto): Promise<ChoreoProject> {
    return this.项目管理服务.createProject(dto);
  }

  /**
   * 更新项目
   */
  async updateProject(uuid: string, dto: UpdateProjectDto): Promise<ChoreoProject> {
    return this.项目管理服务.updateProject(uuid, dto);
  }

  /**
   * 删除项目
   */
  async deleteProject(uuid: string): Promise<void> {
    await this.项目管理服务.deleteProject(uuid);
  }

  /**
   * 打开项目（更新最后打开时间）
   */
  async openProject(uuid: string): Promise<ChoreoProject> {
    return this.项目管理服务.openProject(uuid);
  }

  // ==================== 项目机器人管理 ====================

  /**
   * 获取项目中的机器人列表
   */
  async getProjectRobots(projectUuid: string): Promise<ChoreoRobot[]> {
    return this.项目机器人服务.getProjectRobots(projectUuid);
  }

  /**
   * 添加机器人到项目
   */
  async addRobotToProject(projectUuid: string, dto: AddRobotToProjectDto): Promise<ChoreoRobot> {
    return this.项目机器人服务.addRobotToProject(projectUuid, dto);
  }

  /**
   * 从项目移除机器人
   */
  async removeRobotFromProject(projectUuid: string, robotUuid: string): Promise<void> {
    await this.项目机器人服务.removeRobotFromProject(projectUuid, robotUuid);
  }

  // ==================== 时间轴管理 ====================

  /**
   * 获取时间轴数据
   */
  async getTimeline(projectUuid: string): Promise<TimelineData> {
    return this.时间轴内容服务.getTimeline(projectUuid);
  }

  /**
   * 保存时间轴数据
   */
  async saveTimeline(projectUuid: string, dto: SaveTimelineDto): Promise<void> {
    await this.时间轴内容服务.saveTimeline(projectUuid, dto);
  }

  // ==================== 自定义动作管理 ====================

  /**
   * 获取自定义动作列表
   */
  async getCustomActions(projectUuid: string): Promise<CustomAction[]> {
    return this.时间轴内容服务.getCustomActions(projectUuid);
  }

  /**
   * 保存自定义动作
   */
  async saveCustomAction(
    projectUuid: string,
    data: { name: string; description?: string; tracks: TimelineTrack[]; config: TimelineConfig }
  ): Promise<CustomAction> {
    return this.时间轴内容服务.saveCustomAction(projectUuid, data);
  }

  // ==================== 音频管理 ====================

  /**
   * 获取音频文件路径
   */
  async getAudioPath(projectUuid: string, filename: string): Promise<string> {
    return this.项目文件资源服务.getAudioPath(projectUuid, filename);
  }

  /**
   * 保存上传的音频文件
   */
  async saveAudioFile(projectUuid: string, filename: string, buffer: Buffer): Promise<string> {
    return this.项目文件资源服务.saveAudioFile(projectUuid, filename, buffer);
  }

  // ==================== 时间轴编译与执行 ====================

  /**
   * 编译时间轴为执行计划
   * 遍历所有轨道的 clips，按 executeAt 排序，生成 ScheduledAction 列表
   */
  async compileTimeline(projectUuid: string): Promise<ExecutionPlan> {
    this.获取项目记录(projectUuid);
    const timelineData = await this.getTimeline(projectUuid);
    return this.时间轴编译器.compile(projectUuid, timelineData);
  }

  /**
   * 执行编舞（编译时间轴 + 启动调度器）
   */
  async executeChoreo(projectUuid: string): Promise<ExecutionStatus> {
    const plan = await this.compileTimeline(projectUuid);
    return this.执行服务.startExecution(plan);
  }

  /**
   * 暂停执行
   */
  pauseExecution(executionId: string): boolean {
    return this.执行服务.pauseExecution(executionId);
  }

  /**
   * 恢复执行
   */
  resumeExecution(executionId: string): boolean {
    return this.执行服务.resumeExecution(executionId);
  }

  /**
   * 停止执行
   */
  stopExecution(executionId: string): boolean {
    return this.执行服务.stopExecution(executionId);
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(executionId: string): ExecutionStatus | undefined {
    return this.执行服务.getExecutionStatus(executionId);
  }

  /**
   * 获取正在运行的执行列表
   */
  getRunningExecutions(): ExecutionStatus[] {
    return this.执行服务.getRunningExecutions();
  }

  // ==================== 文件管理 ====================

  /**
   * 获取项目文件列表
   */
  async getProjectFiles(projectUuid: string): Promise<any[]> {
    return this.项目文件资源服务.getProjectFiles(projectUuid);
  }

  /**
   * 读取项目文件内容
   */
  async getFileContent(projectUuid: string, filePath: string): Promise<string> {
    return this.项目文件资源服务.getFileContent(projectUuid, filePath);
  }

  /**
   * 保存项目文件内容
   */
  async saveFileContent(projectUuid: string, filePath: string, content: string): Promise<void> {
    await this.项目文件资源服务.saveFileContent(projectUuid, filePath, content);
  }

  /**
   * 删除项目文件
   */
  async deleteFile(projectUuid: string, filePath: string): Promise<void> {
    await this.项目文件资源服务.deleteFile(projectUuid, filePath);
  }

  /**
   * 获取项目文件夹路径
   */
  getProjectFolder(projectUuid: string): string {
    return this.项目文件资源服务.getProjectFolder(projectUuid);
  }

  /**
   * 列出项目音频文件
   */
  async listAudioFiles(projectUuid: string): Promise<string[]> {
    return this.项目文件资源服务.listAudioFiles(projectUuid);
  }

  /**
   * 删除音频文件
   */
  async deleteAudioFile(projectUuid: string, filename: string): Promise<void> {
    await this.项目文件资源服务.deleteAudioFile(projectUuid, filename);
  }

  // ==================== 项目保存/导入/导出 ====================

  /**
   * 保存项目
   */
  async saveProject(projectUuid: string): Promise<void> {
    await this.项目文件资源服务.saveProject(projectUuid);
  }

  /**
   * 导出项目为 .hhzip 文件
   */
  async exportProject(projectUuid: string): Promise<{ exportPath: string; fileName: string }> {
    return this.项目文件资源服务.exportProject(projectUuid);
  }

  /**
   * 导入项目
   */
  async importProject(filePath: string, _originalName: string): Promise<ChoreoProject> {
    return this.项目文件资源服务.importProject(filePath, _originalName);
  }

  // ==================== 项目机器人管理（扩展） ====================

  /**
   * 直接添加机器人配置到项目（不需要关联主机器人表）
   */
  async addRobotToProjectDirect(projectUuid: string, dto: AddProjectRobotDirectDto): Promise<ProjectRobotConfig> {
    return this.项目机器人服务.addRobotToProjectDirect(projectUuid, dto);
  }

  /**
   * 获取项目机器人配置列表
   */
  async getProjectRobotsConfig(projectUuid: string): Promise<ProjectRobotConfig[]> {
    return this.项目机器人服务.getProjectRobotsConfig(projectUuid);
  }

  /**
   * 更新项目机器人配置
   */
  async updateProjectRobot(projectUuid: string, robotUuid: string, dto: UpdateProjectRobotDto): Promise<ProjectRobotConfig> {
    return this.项目机器人服务.updateProjectRobot(projectUuid, robotUuid, dto);
  }

  /**
   * 删除项目机器人
   */
  async deleteProjectRobot(projectUuid: string, robotUuid: string): Promise<void> {
    await this.项目机器人服务.deleteProjectRobot(projectUuid, robotUuid);
  }

  // ==================== 机器人连接测试 ====================

  /**
   * 测试机器人 SSH 连接
   */
  async testRobotConnection(projectUuid: string, robotUuid: string): Promise<ConnectionTestResult> {
    const result = await this.项目机器人服务.testRobotConnection(projectUuid, robotUuid);
    logger.info('测试连接结果', { projectUuid, robotUuid, ...result });
    return result;
  }

  /**
   * 通过 Python 连接机器人并自动配置
   */
  async connectRobot(projectUuid: string, robotUuid: string): Promise<ConnectionTestResult> {
    return this.项目机器人服务.connectRobot(projectUuid, robotUuid);
  }

  /**
   * 重启运控
   */
  async restartMotionControl(projectUuid: string, robotUuid: string): Promise<{ success: boolean; message: string }> {
    return this.项目机器人服务.restartMotionControl(projectUuid, robotUuid);
  }

}

export default 编舞服务;

export { 编舞服务 as ChoreoService };

