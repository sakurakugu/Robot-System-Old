import fs from 'fs';
import path from 'path';
import { 编舞项目存储 } from './storage/project-storage';
import type {
  ChoreoProject,
  ChoreoRobot,
  ProjectRobotConfig,
} from './types';

const 异步文件系统 = fs.promises;

function 是关联机器人记录(value: unknown): value is ChoreoRobot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const 记录 = value as Record<string, unknown>;
  return typeof 记录.uuid === 'string'
    && typeof 记录.robot_id === 'string'
    && typeof 记录.name === 'string';
}

function 是项目机器人配置记录(value: unknown): value is ProjectRobotConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const 记录 = value as Record<string, unknown>;
  return typeof 记录.uuid === 'string'
    && typeof 记录.name === 'string'
    && typeof 记录.robot_ip === 'string'
    && typeof 记录.local_ip === 'string'
    && typeof 记录.local_port === 'number';
}

async function 读取JSON数组(filePath: string): Promise<unknown[]> {
  try {
    const raw = await 异步文件系统.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class 编舞项目机器人仓库 {
  constructor(private readonly 存储: 编舞项目存储) {}

  async 读取关联机器人(project: ChoreoProject): Promise<ChoreoRobot[]> {
    const 当前文件 = this.获取关联机器人文件路径(project);
    const 当前数据 = await 读取JSON数组(当前文件);
    if (当前数据.length > 0) {
      return 当前数据.filter(是关联机器人记录);
    }

    const 旧文件数据 = await 读取JSON数组(this.获取旧机器人文件路径(project));
    return 旧文件数据.filter(是关联机器人记录);
  }

  async 写入关联机器人(project: ChoreoProject, robots: ChoreoRobot[]): Promise<void> {
    await this.写入JSON数组(this.获取关联机器人文件路径(project), robots);
  }

  async 读取项目机器人配置(project: ChoreoProject): Promise<ProjectRobotConfig[]> {
    const 当前文件 = this.获取项目机器人配置文件路径(project);
    const 当前数据 = await 读取JSON数组(当前文件);
    if (当前数据.length > 0) {
      return 当前数据.filter(是项目机器人配置记录);
    }

    const 旧文件数据 = await 读取JSON数组(this.获取旧机器人文件路径(project));
    return 旧文件数据.filter(是项目机器人配置记录);
  }

  async 写入项目机器人配置(project: ChoreoProject, robots: ProjectRobotConfig[]): Promise<void> {
    await this.写入JSON数组(this.获取项目机器人配置文件路径(project), robots);
  }

  private async 写入JSON数组(filePath: string, data: unknown[]): Promise<void> {
    await 异步文件系统.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  private 获取关联机器人文件路径(project: ChoreoProject): string {
    return path.join(project.folder_path, 'project-robots.json');
  }

  private 获取项目机器人配置文件路径(project: ChoreoProject): string {
    return path.join(project.folder_path, 'project-robot-configs.json');
  }

  private 获取旧机器人文件路径(project: ChoreoProject): string {
    return path.join(project.folder_path, 'robots.json');
  }
}

export default 编舞项目机器人仓库;
