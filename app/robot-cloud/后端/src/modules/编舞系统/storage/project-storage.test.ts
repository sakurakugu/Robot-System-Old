import fs from 'fs';
import os from 'os';
import path from 'path';
import { 编舞项目存储 } from './project-storage';
import type { ChoreoProject, TimelineData } from '../types';

jest.mock('../../../core/logger', () => ({
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
  存储: 编舞项目存储;
};

function 创建测试环境(): 测试环境 {
  const 临时目录 = fs.mkdtempSync(path.join(os.tmpdir(), 'choreo-storage-'));
  const 数据目录 = path.join(临时目录, 'data');
  const 项目目录 = path.join(临时目录, 'projects');

  return {
    临时目录,
    数据目录,
    项目目录,
    存储: new 编舞项目存储(数据目录, 项目目录),
  };
}

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

function 创建项目(环境: 测试环境): ChoreoProject {
  return {
    uuid: 'project-1',
    name: '测试项目',
    description: '说明',
    folder_path: path.join(环境.项目目录, '测试项目_project-1'),
    created_at: '2026-03-30T00:00:00.000Z',
    updated_at: '2026-03-30T00:00:00.000Z',
  };
}

describe('编舞项目存储', () => {
  let 环境: 测试环境;

  beforeEach(() => {
    环境 = 创建测试环境();
  });

  afterEach(() => {
    fs.rmSync(环境.临时目录, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('应初始化目录并读写项目索引', async () => {
    await 环境.存储.初始化();

    const 项目 = 创建项目(环境);
    await 环境.存储.保存项目索引([项目]);

    const 已加载项目 = await 环境.存储.加载项目索引();

    expect(fs.existsSync(环境.数据目录)).toBe(true);
    expect(fs.existsSync(环境.项目目录)).toBe(true);
    expect(已加载项目).toEqual([项目]);
  });

  it('应创建项目目录并持久化元数据和时间轴', async () => {
    await 环境.存储.初始化();

    const 项目 = 创建项目(环境);
    const 默认时间轴 = 创建默认时间轴();
    await 环境.存储.创建项目目录(项目, 默认时间轴);

    expect(fs.existsSync(path.join(项目.folder_path, 'project.json'))).toBe(true);
    expect(fs.existsSync(path.join(项目.folder_path, 'timeline.json'))).toBe(true);
    expect(fs.existsSync(path.join(项目.folder_path, 'audio'))).toBe(true);

    const 已保存时间轴 = await 环境.存储.读取时间轴(项目, 创建默认时间轴());
    expect(已保存时间轴).toEqual(默认时间轴);
  });

  it('应阻止项目文件越界写入', async () => {
    await 环境.存储.初始化();

    const 项目 = 创建项目(环境);
    await 环境.存储.创建项目目录(项目, 创建默认时间轴());

    await expect(
      环境.存储.保存项目文件(项目, '../escape.txt', 'bad'),
    ).rejects.toThrow('非法的文件路径');
  });
});
