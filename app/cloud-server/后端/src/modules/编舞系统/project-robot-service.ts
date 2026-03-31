import { v7 as uuidv7 } from 'uuid';
import type { RobotRepository } from '../机器人管理/repository';
import { 编舞机器人控制桥接 } from './bridges/robot-control-bridge';
import { 编舞项目机器人仓库 } from './project-robot-repository';
import { 编舞项目存储 } from './storage/project-storage';
import type {
  AddProjectRobotDirectDto,
  AddRobotToProjectDto,
  ChoreoProject,
  ChoreoRobot,
  ConnectionTestResult,
  ProjectRobotConfig,
  UpdateProjectRobotDto,
} from './types';

type 编舞机器人查询仓库 = Pick<RobotRepository, 'getRobot'>;
type 编舞机器人控制桥接接口 = Pick<
  编舞机器人控制桥接,
  'testRobotConnection' | 'connectRobot' | 'restartMotionControl'
>;
type 项目获取器 = (projectUuid: string) => ChoreoProject;

/**
 * 编舞项目机器人服务
 * 负责项目内机器人配置读写、主机器人关联和连接控制编排
 */
export class 编舞项目机器人服务 {
  constructor(
    private readonly 获取项目记录: 项目获取器,
    存储: 编舞项目存储,
    private readonly 机器人仓库: 编舞机器人查询仓库,
    private readonly 机器人控制桥接: 编舞机器人控制桥接接口,
    private readonly 项目机器人仓库: 编舞项目机器人仓库 = new 编舞项目机器人仓库(存储),
  ) {}

  async getProjectRobots(projectUuid: string): Promise<ChoreoRobot[]> {
    const project = this.获取项目记录(projectUuid);
    return this.项目机器人仓库.读取关联机器人(project);
  }

  async addRobotToProject(projectUuid: string, dto: AddRobotToProjectDto): Promise<ChoreoRobot> {
    const project = this.获取项目记录(projectUuid);
    const mainRobot = await this.机器人仓库.getRobot(dto.robot_id);
    if (!mainRobot) {
      throw new Error('机器人不存在');
    }

    const robots = await this.getProjectRobots(projectUuid);
    if (robots.find((robot) => robot.robot_id === dto.robot_id)) {
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
    await this.项目机器人仓库.写入关联机器人(project, robots);
    return robot;
  }

  async removeRobotFromProject(projectUuid: string, robotUuid: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    const robots = await this.getProjectRobots(projectUuid);
    const index = robots.findIndex((robot) => robot.uuid === robotUuid);
    if (index === -1) {
      throw new Error('机器人不在项目中');
    }

    robots.splice(index, 1);
    await this.项目机器人仓库.写入关联机器人(project, robots);
  }

  async addRobotToProjectDirect(
    projectUuid: string,
    dto: AddProjectRobotDirectDto,
  ): Promise<ProjectRobotConfig> {
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
    await this.项目机器人仓库.写入项目机器人配置(project, robots);
    return robot;
  }

  async getProjectRobotsConfig(projectUuid: string): Promise<ProjectRobotConfig[]> {
    const project = this.获取项目记录(projectUuid);
    return this.项目机器人仓库.读取项目机器人配置(project);
  }

  async updateProjectRobot(
    projectUuid: string,
    robotUuid: string,
    dto: UpdateProjectRobotDto,
  ): Promise<ProjectRobotConfig> {
    const project = this.获取项目记录(projectUuid);
    const robots = await this.getProjectRobotsConfig(projectUuid);
    const index = robots.findIndex((robot) => robot.uuid === robotUuid);
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

    await this.项目机器人仓库.写入项目机器人配置(project, robots);
    return robot;
  }

  async deleteProjectRobot(projectUuid: string, robotUuid: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    const robots = await this.getProjectRobotsConfig(projectUuid);
    const index = robots.findIndex((robot) => robot.uuid === robotUuid);
    if (index === -1) {
      throw new Error('机器人不在项目中');
    }

    robots.splice(index, 1);
    await this.项目机器人仓库.写入项目机器人配置(project, robots);
  }

  async testRobotConnection(projectUuid: string, robotUuid: string): Promise<ConnectionTestResult> {
    const robot = await this.获取项目机器人配置记录(projectUuid, robotUuid);
    return this.机器人控制桥接.testRobotConnection(robot);
  }

  async connectRobot(projectUuid: string, robotUuid: string): Promise<ConnectionTestResult> {
    const robot = await this.获取项目机器人配置记录(projectUuid, robotUuid);
    const result = await this.机器人控制桥接.connectRobot(robot);

    await this.updateProjectRobot(projectUuid, robotUuid, {
      status: result.success ? 'online' : 'offline',
    });

    return result;
  }

  async restartMotionControl(
    projectUuid: string,
    robotUuid: string,
  ): Promise<{ success: boolean; message: string }> {
    const robot = await this.获取项目机器人配置记录(projectUuid, robotUuid);
    return this.机器人控制桥接.restartMotionControl(robot);
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
}

export default 编舞项目机器人服务;
