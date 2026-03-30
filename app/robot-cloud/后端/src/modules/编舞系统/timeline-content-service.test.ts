import fs from 'fs';
import os from 'os';
import path from 'path';
import { 编舞时间轴内容服务 } from './timeline-content-service';
import { 编舞项目存储 } from './storage/project-storage';
import type { ChoreoProject } from './types';

jest.mock('uuid', () => ({
  v7: jest.fn(() => '22345678-1234-1234-1234-123456789abc'),
}));

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

type 测试环境 = {
  临时目录: string;
  数据目录: string;
  项目目录: string;
  项目: ChoreoProject;
  存储: 编舞项目存储;
};

function 创建测试环境(): 测试环境 {
  const 临时目录 = fs.mkdtempSync(path.join(os.tmpdir(), 'choreo-timeline-content-'));
  const 数据目录 = path.join(临时目录, 'data');
  const 项目目录 = path.join(临时目录, 'projects');
  const 项目: ChoreoProject = {
    uuid: 'project-1',
    name: '时间轴项目',
    description: '测试项目',
    folder_path: path.join(项目目录, '时间轴项目_project-1'),
    created_at: '2026-03-30T00:00:00.000Z',
    updated_at: '2026-03-30T00:00:00.000Z',
  };

  return {
    临时目录,
    数据目录,
    项目目录,
    项目,
    存储: new 编舞项目存储(数据目录, 项目目录),
  };
}

async function 准备项目目录(环境: 测试环境): Promise<void> {
  await 环境.存储.初始化();
  await 环境.存储.创建项目目录(环境.项目, {
    tracks: [],
    config: {
      duration: 60,
      pixelsPerSecond: 100,
      currentTime: 0,
      snapToGrid: true,
      gridSize: 0.5,
    },
  });
}

describe('编舞时间轴内容服务', () => {
  let 环境: 测试环境;

  beforeEach(async () => {
    环境 = 创建测试环境();
    await 准备项目目录(环境);
  });

  afterEach(() => {
    fs.rmSync(环境.临时目录, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('应读取并保存时间轴数据', async () => {
    const 保存项目索引 = jest.fn().mockResolvedValue(undefined);
    const 服务 = new 编舞时间轴内容服务(
      () => 环境.项目,
      环境.存储,
      保存项目索引,
    );

    const 默认时间轴 = await 服务.getTimeline(环境.项目.uuid);
    expect(默认时间轴.tracks).toEqual([]);

    await 服务.saveTimeline(环境.项目.uuid, {
      tracks: [
        {
          id: 'track-1',
          name: '轨道一',
          type: 'action',
          robotId: 'robot-1',
          blocks: [
            {
              id: 'block-1',
              name: '前进',
              startTime: 1,
              duration: 2,
              actionType: 'forward',
            },
          ],
        },
      ],
      config: {
        duration: 10,
        pixelsPerSecond: 100,
        currentTime: 0,
        snapToGrid: true,
        gridSize: 0.5,
      },
    });

    const 已保存 = await 服务.getTimeline(环境.项目.uuid);
    expect(已保存.tracks).toHaveLength(1);
    expect(已保存.updated_at).toBeTruthy();
    expect(保存项目索引).toHaveBeenCalled();
  });

  it('应读取并保存自定义动作', async () => {
    const 服务 = new 编舞时间轴内容服务(
      () => 环境.项目,
      环境.存储,
      jest.fn().mockResolvedValue(undefined),
    );

    const 动作 = await 服务.saveCustomAction(环境.项目.uuid, {
      name: '招手',
      description: '测试动作',
      tracks: [],
      config: {
        duration: 10,
        pixelsPerSecond: 100,
        currentTime: 0,
        snapToGrid: true,
        gridSize: 0.5,
      },
    });

    const 动作列表 = await 服务.getCustomActions(环境.项目.uuid);
    expect(动作.uuid).toBe('22345678-1234-1234-1234-123456789abc');
    expect(动作列表).toHaveLength(1);
    expect(动作列表[0].name).toBe('招手');
  });
});
