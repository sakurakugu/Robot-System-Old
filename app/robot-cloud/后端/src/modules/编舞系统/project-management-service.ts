import { v7 as uuidv7 } from 'uuid';
import { logger } from '../../core/logger';
import { 编舞项目存储 } from './storage/project-storage';
import { 创建默认时间轴 } from './timeline-defaults';
import type {
  ChoreoProject,
  CreateProjectDto,
  TimelineData,
  UpdateProjectDto,
} from './types';

type 默认时间轴工厂 = () => TimelineData;
type 项目ID生成器 = () => string;

/**
 * 编舞项目管理服务
 * 负责项目索引、项目 CRUD 和项目注册
 */
export class 编舞项目管理服务 {
  private readonly projects: Map<string, ChoreoProject> = new Map();

  constructor(
    private readonly 存储: 编舞项目存储,
    private readonly 获取默认时间轴: 默认时间轴工厂 = 创建默认时间轴,
    private readonly 生成项目ID: 项目ID生成器 = uuidv7,
  ) {}

  async 初始化(): Promise<void> {
    await this.存储.初始化();
    const projects = await this.存储.加载项目索引();
    this.projects.clear();
    projects.forEach((project) => this.projects.set(project.uuid, project));
  }

  getAllProjects(): ChoreoProject[] {
    return Array.from(this.projects.values()).sort((a, b) => {
      const aTime = a.last_opened || a.created_at;
      const bTime = b.last_opened || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  getProject(uuid: string): ChoreoProject | undefined {
    return this.projects.get(uuid);
  }

  获取项目记录(uuid: string): ChoreoProject {
    const project = this.projects.get(uuid);
    if (!project) {
      throw new Error('项目不存在');
    }
    return project;
  }

  注册项目(project: ChoreoProject): void {
    this.projects.set(project.uuid, project);
  }

  async 保存项目索引(): Promise<void> {
    await this.存储.保存项目索引(this.projects.values());
  }

  async createProject(dto: CreateProjectDto): Promise<ChoreoProject> {
    const uuid = this.生成项目ID();
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

    await this.存储.创建项目目录(project, this.获取默认时间轴());
    this.projects.set(uuid, project);
    await this.保存项目索引();

    logger.info(`创建编舞项目: ${dto.name}`, { uuid });
    return project;
  }

  async updateProject(uuid: string, dto: UpdateProjectDto): Promise<ChoreoProject> {
    const project = this.获取项目记录(uuid);

    if (dto.name !== undefined) {
      project.name = dto.name;
    }
    if (dto.description !== undefined) {
      project.description = dto.description;
    }
    project.updated_at = new Date().toISOString();

    await this.存储.保存项目元数据(project);
    await this.保存项目索引();
    return project;
  }

  async deleteProject(uuid: string): Promise<void> {
    const project = this.获取项目记录(uuid);

    this.projects.delete(uuid);
    await this.存储.删除项目目录(project);
    await this.保存项目索引();

    logger.info(`删除编舞项目: ${project.name}`, { uuid });
  }

  async openProject(uuid: string): Promise<ChoreoProject> {
    const project = this.获取项目记录(uuid);

    project.last_opened = new Date().toISOString();
    await this.保存项目索引();
    return project;
  }
}

export default 编舞项目管理服务;
