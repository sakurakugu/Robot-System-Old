import { v7 as uuidv7 } from 'uuid';
import { logger } from '../../core/logger';
import { 编舞项目存储 } from './storage/project-storage';
import { 创建默认时间轴 } from './timeline-defaults';
import type {
  ChoreoProject,
  CustomAction,
  SaveTimelineDto,
  TimelineConfig,
  TimelineData,
  TimelineTrack,
} from './types';

type 项目获取器 = (projectUuid: string) => ChoreoProject;
type 项目索引保存器 = () => Promise<void>;
type 默认时间轴工厂 = () => TimelineData;
type 动作ID生成器 = () => string;

/**
 * 编舞时间轴内容服务
 * 负责时间轴和自定义动作的读取、保存与项目时间更新
 */
export class 编舞时间轴内容服务 {
  constructor(
    private readonly 获取项目记录: 项目获取器,
    private readonly 存储: 编舞项目存储,
    private readonly 保存项目索引: 项目索引保存器,
    private readonly 获取默认时间轴: 默认时间轴工厂 = 创建默认时间轴,
    private readonly 生成动作ID: 动作ID生成器 = uuidv7,
  ) {}

  async getTimeline(projectUuid: string): Promise<TimelineData> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取时间轴(project, this.获取默认时间轴());
  }

  async saveTimeline(projectUuid: string, dto: SaveTimelineDto): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    const timelineData: TimelineData = {
      tracks: dto.tracks,
      config: dto.config,
      updated_at: new Date().toISOString(),
    };

    await this.存储.保存时间轴(project, timelineData);
    project.updated_at = new Date().toISOString();
    await this.保存项目索引();

    logger.info('保存时间轴数据', {
      projectUuid,
      tracksCount: dto.tracks.length,
    });
  }

  async getCustomActions(projectUuid: string): Promise<CustomAction[]> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取自定义动作(project);
  }

  async saveCustomAction(
    projectUuid: string,
    data: { name: string; description?: string; tracks: TimelineTrack[]; config: TimelineConfig },
  ): Promise<CustomAction> {
    const project = this.获取项目记录(projectUuid);
    const actions = await this.getCustomActions(projectUuid);
    const now = new Date().toISOString();
    const action: CustomAction = {
      uuid: this.生成动作ID(),
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
}

export default 编舞时间轴内容服务;
