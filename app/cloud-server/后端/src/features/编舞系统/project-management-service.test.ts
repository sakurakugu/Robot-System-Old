import fs from 'fs';
import os from 'os';
import path from 'path';
import { 编舞项目管理服务 } from './project-management-service';
import { 编舞项目存储 } from './storage/project-storage';

jest.mock('uuid', () => ({
  v7: jest.fn(() => '12345678-1234-1234-1234-123456789abc'),
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
  存储: 编舞项目存储;
};

function 创建测试环境(): 测试环境 {
  const 临时目录 = fs.mkdtempSync(path.join(os.tmpdir(), 'choreo-project-management-'));
  const 数据目录 = path.join(临时目录, 'data');
  const 项目目录 = path.join(临时目录, 'projects');

  return {
    临时目录,
    数据目录,
    项目目录,
    存储: new 编舞项目存储(数据目录, 项目目录),
  };
}

describe('编舞项目管理服务', () => {
  let 环境: 测试环境;

  beforeEach(() => {
    环境 = 创建测试环境();
  });

  afterEach(() => {
    fs.rmSync(环境.临时目录, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('应初始化目录并加载项目索引', async () => {
    await 环境.存储.初始化();
    fs.writeFileSync(
      path.join(环境.数据目录, 'project-index.json'),
      JSON.stringify([
        {
          uuid: 'project-1',
          name: '已存在项目',
          folder_path: path.join(环境.项目目录, 'project-1'),
          created_at: '2026-03-30T00:00:00.000Z',
          updated_at: '2026-03-30T00:00:00.000Z',
        },
      ], null, 2),
    );

    const 服务 = new 编舞项目管理服务(环境.存储);
    await 服务.初始化();

    expect(服务.getProject('project-1')?.name).toBe('已存在项目');
    expect(fs.existsSync(环境.数据目录)).toBe(true);
    expect(fs.existsSync(环境.项目目录)).toBe(true);
  });

  it('应创建更新打开并删除项目', async () => {
    const 服务 = new 编舞项目管理服务(环境.存储);
    await 服务.初始化();

    const 项目 = await 服务.createProject({
      name: '测试项目',
      description: '项目说明',
    });

    expect(fs.existsSync(path.join(项目.folder_path, 'project.json'))).toBe(true);
    expect(fs.existsSync(path.join(项目.folder_path, 'timeline.json'))).toBe(true);
    expect(服务.getAllProjects()).toHaveLength(1);

    const 更新后 = await 服务.updateProject(项目.uuid, { name: '重命名项目' });
    expect(更新后.name).toBe('重命名项目');

    const 打开后 = await 服务.openProject(项目.uuid);
    expect(打开后.last_opened).toBeTruthy();

    await 服务.deleteProject(项目.uuid);
    expect(服务.getProject(项目.uuid)).toBeUndefined();
  });
});
