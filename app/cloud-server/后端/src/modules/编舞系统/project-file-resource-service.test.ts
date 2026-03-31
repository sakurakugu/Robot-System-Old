import fs from 'fs';
import os from 'os';
import path from 'path';
import { 编舞项目文件资源服务 } from './project-file-resource-service';
import { 编舞项目存储 } from './storage/project-storage';
import type { ChoreoProject, TimelineData } from './types';

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
  const 临时目录 = fs.mkdtempSync(path.join(os.tmpdir(), 'choreo-file-resource-'));
  const 数据目录 = path.join(临时目录, 'data');
  const 项目目录 = path.join(临时目录, 'projects');
  const 项目: ChoreoProject = {
    uuid: 'project-1',
    name: '文件项目',
    description: '测试项目',
    folder_path: path.join(项目目录, '文件项目_project-1'),
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

async function 准备项目目录(环境: 测试环境): Promise<void> {
  await 环境.存储.初始化();
  await 环境.存储.创建项目目录(环境.项目, 创建默认时间轴());
}

describe('编舞项目文件资源服务', () => {
  let 环境: 测试环境;

  beforeEach(async () => {
    环境 = 创建测试环境();
    await 准备项目目录(环境);
  });

  afterEach(() => {
    fs.rmSync(环境.临时目录, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('应管理项目文件和音频资源', async () => {
    const 保存项目索引 = jest.fn().mockResolvedValue(undefined);
    const 服务 = new 编舞项目文件资源服务(
      () => 环境.项目,
      环境.存储,
      保存项目索引,
      jest.fn(),
    );

    await 服务.saveFileContent(环境.项目.uuid, 'scripts/main.py', 'print("hello")');
    expect(await 服务.getFileContent(环境.项目.uuid, 'scripts/main.py')).toBe('print("hello")');

    const 文件树 = await 服务.getProjectFiles(环境.项目.uuid);
    expect(文件树.find((item) => item.name === 'scripts')?.isDirectory).toBe(true);
    expect(保存项目索引).toHaveBeenCalled();

    const 文件名 = await 服务.saveAudioFile(环境.项目.uuid, 'voice.wav', Buffer.from('audio'));
    expect((await 服务.listAudioFiles(环境.项目.uuid))).toContain(文件名);
    expect(fs.existsSync(await 服务.getAudioPath(环境.项目.uuid, 文件名))).toBe(true);

    await 服务.deleteAudioFile(环境.项目.uuid, 文件名);
    await 服务.deleteFile(环境.项目.uuid, 'scripts/main.py');
    await expect(
      服务.getFileContent(环境.项目.uuid, 'scripts/main.py'),
    ).rejects.toThrow('文件不存在');
  });

  it('应导出并导入项目', async () => {
    const 保存项目索引 = jest.fn().mockResolvedValue(undefined);
    const 注册项目 = jest.fn();
    const 服务 = new 编舞项目文件资源服务(
      () => 环境.项目,
      环境.存储,
      保存项目索引,
      注册项目,
    );

    await 服务.saveFileContent(环境.项目.uuid, 'scripts/run.py', 'print("run")');
    const { exportPath } = await 服务.exportProject(环境.项目.uuid);
    expect(fs.existsSync(exportPath)).toBe(true);

    const 导入项目 = await 服务.importProject(exportPath, path.basename(exportPath));

    expect(导入项目.uuid).toBe('22345678-1234-1234-1234-123456789abc');
    expect(导入项目.name).toBe('文件项目');
    expect(fs.existsSync(path.join(导入项目.folder_path, 'scripts', 'run.py'))).toBe(true);
    expect(注册项目).toHaveBeenCalledWith(expect.objectContaining({
      uuid: '22345678-1234-1234-1234-123456789abc',
      name: '文件项目',
    }));
    expect(保存项目索引).toHaveBeenCalled();
  });
});
