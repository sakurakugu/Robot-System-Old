import fs from 'fs';
import os from 'os';
import path from 'path';

type 测试环境 = {
  临时目录: string;
  数据目录: string;
  项目目录: string;
};

type 机器人仓库Mock = {
  getRobot: jest.Mock;
};

type 机器人控制桥接Mock = {
  testRobotConnection: jest.Mock;
  connectRobot: jest.Mock;
  restartMotionControl: jest.Mock;
};

type 执行服务Mock = {
  setWebSocketService: jest.Mock;
  startExecution: jest.Mock;
  pauseExecution: jest.Mock;
  resumeExecution: jest.Mock;
  stopExecution: jest.Mock;
  getExecutionStatus: jest.Mock;
  getRunningExecutions: jest.Mock;
};

type 时间轴编译器Mock = {
  compile: jest.Mock;
};

type 项目机器人服务Mock = {
  getProjectRobots: jest.Mock;
  addRobotToProject: jest.Mock;
  removeRobotFromProject: jest.Mock;
  addRobotToProjectDirect: jest.Mock;
  getProjectRobotsConfig: jest.Mock;
  updateProjectRobot: jest.Mock;
  deleteProjectRobot: jest.Mock;
  testRobotConnection: jest.Mock;
  connectRobot: jest.Mock;
  restartMotionControl: jest.Mock;
};

type 项目文件资源服务Mock = {
  getProjectFiles: jest.Mock;
  getFileContent: jest.Mock;
  saveFileContent: jest.Mock;
  deleteFile: jest.Mock;
  getProjectFolder: jest.Mock;
  getAudioPath: jest.Mock;
  saveAudioFile: jest.Mock;
  listAudioFiles: jest.Mock;
  deleteAudioFile: jest.Mock;
  saveProject: jest.Mock;
  exportProject: jest.Mock;
  importProject: jest.Mock;
};

type 项目管理服务Mock = {
  初始化: jest.Mock;
  getAllProjects: jest.Mock;
  getProject: jest.Mock;
  获取项目记录: jest.Mock;
  保存项目索引: jest.Mock;
  注册项目: jest.Mock;
  createProject: jest.Mock;
  updateProject: jest.Mock;
  deleteProject: jest.Mock;
  openProject: jest.Mock;
};

type 时间轴内容服务Mock = {
  getTimeline: jest.Mock;
  saveTimeline: jest.Mock;
  getCustomActions: jest.Mock;
  saveCustomAction: jest.Mock;
};

type 创建编舞服务选项 = {
  机器人仓库?: 机器人仓库Mock;
  机器人控制桥接?: 机器人控制桥接Mock;
  执行服务?: 执行服务Mock;
  时间轴编译器?: 时间轴编译器Mock;
  项目机器人服务?: 项目机器人服务Mock;
  项目文件资源服务?: 项目文件资源服务Mock;
  项目管理服务?: 项目管理服务Mock;
  时间轴内容服务?: 时间轴内容服务Mock;
};

function 创建测试环境(): 测试环境 {
  const 临时目录 = fs.mkdtempSync(path.join(os.tmpdir(), 'choreo-service-'));
  return {
    临时目录,
    数据目录: path.join(临时目录, 'data'),
    项目目录: path.join(临时目录, 'projects'),
  };
}

function 创建机器人仓库Mock(): 机器人仓库Mock {
  return {
    getRobot: jest.fn(),
  };
}

function 创建机器人控制桥接Mock(): 机器人控制桥接Mock {
  return {
    testRobotConnection: jest.fn(),
    connectRobot: jest.fn(),
    restartMotionControl: jest.fn(),
  };
}

function 创建执行服务Mock(): 执行服务Mock {
  return {
    setWebSocketService: jest.fn(),
    startExecution: jest.fn(),
    pauseExecution: jest.fn(),
    resumeExecution: jest.fn(),
    stopExecution: jest.fn(),
    getExecutionStatus: jest.fn(),
    getRunningExecutions: jest.fn(),
  };
}

function 创建时间轴编译器Mock(): 时间轴编译器Mock {
  return {
    compile: jest.fn(),
  };
}

function 创建项目机器人服务Mock(): 项目机器人服务Mock {
  return {
    getProjectRobots: jest.fn(),
    addRobotToProject: jest.fn(),
    removeRobotFromProject: jest.fn(),
    addRobotToProjectDirect: jest.fn(),
    getProjectRobotsConfig: jest.fn(),
    updateProjectRobot: jest.fn(),
    deleteProjectRobot: jest.fn(),
    testRobotConnection: jest.fn(),
    connectRobot: jest.fn(),
    restartMotionControl: jest.fn(),
  };
}

function 创建项目文件资源服务Mock(): 项目文件资源服务Mock {
  return {
    getProjectFiles: jest.fn(),
    getFileContent: jest.fn(),
    saveFileContent: jest.fn(),
    deleteFile: jest.fn(),
    getProjectFolder: jest.fn(),
    getAudioPath: jest.fn(),
    saveAudioFile: jest.fn(),
    listAudioFiles: jest.fn(),
    deleteAudioFile: jest.fn(),
    saveProject: jest.fn(),
    exportProject: jest.fn(),
    importProject: jest.fn(),
  };
}

function 创建项目管理服务Mock(): 项目管理服务Mock {
  return {
    初始化: jest.fn(),
    getAllProjects: jest.fn(),
    getProject: jest.fn(),
    获取项目记录: jest.fn(),
    保存项目索引: jest.fn(),
    注册项目: jest.fn(),
    createProject: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
    openProject: jest.fn(),
  };
}

function 创建时间轴内容服务Mock(): 时间轴内容服务Mock {
  return {
    getTimeline: jest.fn(),
    saveTimeline: jest.fn(),
    getCustomActions: jest.fn(),
    saveCustomAction: jest.fn(),
  };
}

async function 创建编舞服务(
  环境: 测试环境,
  选项: 创建编舞服务选项 = {},
) {
  process.env.CHOREO_DATA_DIR = 环境.数据目录;
  process.env.CHOREO_PROJECTS_DIR = 环境.项目目录;

  jest.resetModules();
  const uuidValues = [
    '12345678-1234-1234-1234-123456789abc',
    '22345678-1234-1234-1234-123456789abc',
    '32345678-1234-1234-1234-123456789abc',
    '42345678-1234-1234-1234-123456789abc',
    '52345678-1234-1234-1234-123456789abc',
  ];
  jest.doMock('uuid', () => ({
    v7: jest.fn(() => uuidValues.shift() || '92345678-1234-1234-1234-123456789abc'),
  }));
  jest.doMock('../../core/services/python-executor', () => ({
    PythonExecutor: jest.fn().mockImplementation(() => ({})),
  }));
  jest.doMock('../../core/logger', () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  }));

  const { 编舞服务 } = await import('./service');
  const {
    机器人仓库 = 创建机器人仓库Mock(),
    机器人控制桥接,
    执行服务,
    时间轴编译器,
    项目机器人服务,
    项目文件资源服务,
    项目管理服务,
    时间轴内容服务,
  } = 选项;

  return new 编舞服务({
    机器人仓库: 机器人仓库 as any,
    机器人控制桥接: 机器人控制桥接 as any,
    执行服务: 执行服务 as any,
    时间轴编译器: 时间轴编译器 as any,
    项目机器人服务: 项目机器人服务 as any,
    项目文件资源服务: 项目文件资源服务 as any,
    项目管理服务: 项目管理服务 as any,
    时间轴内容服务: 时间轴内容服务 as any,
  });
}

describe('编舞服务', () => {
  let 环境: 测试环境;

  beforeEach(() => {
    环境 = 创建测试环境();
  });

  afterEach(() => {
    delete process.env.CHOREO_DATA_DIR;
    delete process.env.CHOREO_PROJECTS_DIR;
    fs.rmSync(环境.临时目录, { recursive: true, force: true });
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('初始化应创建目录并加载项目索引', async () => {
    fs.mkdirSync(环境.数据目录, { recursive: true });
    const 项目 = {
      uuid: 'project-1',
      name: '已存在项目',
      description: '说明',
      folder_path: path.join(环境.项目目录, 'project-1'),
      created_at: '2026-03-30T00:00:00.000Z',
      updated_at: '2026-03-30T00:00:00.000Z',
    };
    fs.writeFileSync(
      path.join(环境.数据目录, 'project-index.json'),
      JSON.stringify([项目], null, 2),
    );

    const 服务 = await 创建编舞服务(环境);
    await 服务.初始化();

    expect(fs.existsSync(环境.数据目录)).toBe(true);
    expect(fs.existsSync(环境.项目目录)).toBe(true);
    expect(服务.getProject('project-1')).toEqual(项目);
  });

  it('项目管理接口应异步创建更新打开并删除项目', async () => {
    const 服务 = await 创建编舞服务(环境);
    await 服务.初始化();

    const 项目 = await 服务.createProject({
      name: '测试项目',
      description: '项目说明',
    });

    expect(fs.existsSync(path.join(项目.folder_path, 'project.json'))).toBe(true);
    expect(fs.existsSync(path.join(项目.folder_path, 'timeline.json'))).toBe(true);
    expect(fs.existsSync(path.join(项目.folder_path, 'audio'))).toBe(true);

    const 更新后项目 = await 服务.updateProject(项目.uuid, {
      name: '重命名项目',
    });
    expect(更新后项目.name).toBe('重命名项目');

    const 打开后项目 = await 服务.openProject(项目.uuid);
    expect(打开后项目.last_opened).toBeTruthy();

    await 服务.deleteProject(项目.uuid);
    expect(服务.getProject(项目.uuid)).toBeUndefined();

    const 索引内容 = JSON.parse(
      fs.readFileSync(path.join(环境.数据目录, 'project-index.json'), 'utf-8'),
    );
    expect(索引内容).toEqual([]);
  });

  it('时间轴与自定义动作应通过异步文件接口持久化', async () => {
    const 服务 = await 创建编舞服务(环境);
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '动作项目',
    });

    const 默认时间轴 = await 服务.getTimeline(项目.uuid);
    expect(默认时间轴.config.duration).toBe(60);
    expect(默认时间轴.tracks).toEqual([]);

    await 服务.saveTimeline(项目.uuid, {
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

    const 已保存时间轴 = await 服务.getTimeline(项目.uuid);
    expect(已保存时间轴.tracks).toHaveLength(1);
    expect(已保存时间轴.updated_at).toBeTruthy();

    const 动作 = await 服务.saveCustomAction(项目.uuid, {
      name: '招手',
      description: '测试动作',
      tracks: 已保存时间轴.tracks,
      config: 已保存时间轴.config,
    });
    const 动作列表 = await 服务.getCustomActions(项目.uuid);
    expect(动作.uuid).toBe('22345678-1234-1234-1234-123456789abc');
    expect(动作列表).toHaveLength(1);
    expect(动作列表[0].name).toBe('招手');
  });

  it('保存项目应异步写回 project.json', async () => {
    const 服务 = await 创建编舞服务(环境);
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '保存项目',
      description: '旧说明',
    });

    const 内存项目 = 服务.getProject(项目.uuid)!;
    内存项目.description = '新说明';

    await 服务.saveProject(项目.uuid);

    const projectJson = JSON.parse(
      fs.readFileSync(path.join(项目.folder_path, 'project.json'), 'utf-8'),
    );
    expect(projectJson.description).toBe('新说明');
    expect(projectJson.updated_at).toBeTruthy();
  });

  it('文件管理接口应异步保存读取列出并删除文件', async () => {
    const 服务 = await 创建编舞服务(环境);
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '文件项目',
    });

    await 服务.saveFileContent(项目.uuid, 'scripts/main.py', 'print("hello")');
    const 内容 = await 服务.getFileContent(项目.uuid, 'scripts/main.py');
    expect(内容).toBe('print("hello")');

    const 文件树 = await 服务.getProjectFiles(项目.uuid);
    const scriptsDir = 文件树.find((item) => item.name === 'scripts');
    expect(scriptsDir?.isDirectory).toBe(true);
    expect(scriptsDir?.children?.[0]?.path).toBe(path.join('scripts', 'main.py'));

    await expect(
      服务.saveFileContent(项目.uuid, '../escape.txt', 'bad'),
    ).rejects.toThrow('非法的文件路径');

    await 服务.deleteFile(项目.uuid, 'scripts/main.py');
    await expect(
      服务.getFileContent(项目.uuid, 'scripts/main.py'),
    ).rejects.toThrow('文件不存在');
  });

  it('音频管理接口应异步保存列出定位并删除音频文件', async () => {
    const 服务 = await 创建编舞服务(环境);
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '音频项目',
    });

    const 文件名 = await 服务.saveAudioFile(
      项目.uuid,
      'voice.wav',
      Buffer.from('fake-audio'),
    );
    expect(文件名.endsWith('.wav')).toBe(true);

    const 音频列表 = await 服务.listAudioFiles(项目.uuid);
    expect(音频列表).toContain(文件名);

    const 音频路径 = await 服务.getAudioPath(项目.uuid, 文件名);
    expect(fs.existsSync(音频路径)).toBe(true);

    await 服务.deleteAudioFile(项目.uuid, 文件名);
    const 删除后列表 = await 服务.listAudioFiles(项目.uuid);
    expect(删除后列表).not.toContain(文件名);
    await expect(
      服务.getAudioPath(项目.uuid, 文件名),
    ).rejects.toThrow('音频文件不存在');
  });

  it('项目机器人配置应异步保存更新删除', async () => {
    const 机器人仓库 = 创建机器人仓库Mock();
    机器人仓库.getRobot.mockResolvedValue({
      uuid: 'robot-main-1',
      name: '主机器人',
    });
    const 服务 = await 创建编舞服务(环境, { 机器人仓库 });
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '机器人项目',
    });

    const 主机器人 = await 服务.addRobotToProject(项目.uuid, {
      robot_id: 'robot-main-1',
    });
    expect(主机器人.name).toBe('主机器人');
    expect(机器人仓库.getRobot).toHaveBeenCalledWith('robot-main-1');

    const 直接机器人 = await 服务.addRobotToProjectDirect(项目.uuid, {
      name: '直连机器人',
      robot_ip: '192.168.1.20',
      local_ip: '192.168.1.2',
      local_port: 9000,
      group_name: '测试组',
    });
    expect(直接机器人.uuid).toBe('32345678-1234-1234-1234-123456789abc');

    const 配置列表 = await 服务.getProjectRobotsConfig(项目.uuid);
    expect(配置列表).toHaveLength(2);

    const 更新后 = await 服务.updateProjectRobot(项目.uuid, 直接机器人.uuid, {
      status: 'online',
      name: '已连接机器人',
    });
    expect(更新后.status).toBe('online');
    expect(更新后.name).toBe('已连接机器人');

    await 服务.deleteProjectRobot(项目.uuid, 直接机器人.uuid);
    const 删除后列表 = await 服务.getProjectRobotsConfig(项目.uuid);
    expect(删除后列表).toHaveLength(1);

    await 服务.removeRobotFromProject(项目.uuid, 主机器人.uuid);
    const 删除主机器人后 = await 服务.getProjectRobots(项目.uuid);
    expect(删除主机器人后).toEqual([]);
  });

  it('导出并导入项目应通过异步文件接口完成', async () => {
    const 服务 = await 创建编舞服务(环境);
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '导出项目',
      description: '导出说明',
    });
    await 服务.saveFileContent(项目.uuid, 'scripts/run.py', 'print("run")');

    const { exportPath } = await 服务.exportProject(项目.uuid);
    expect(fs.existsSync(exportPath)).toBe(true);

    const 导入项目 = await 服务.importProject(exportPath, path.basename(exportPath));
    expect(导入项目.uuid).toBe('22345678-1234-1234-1234-123456789abc');
    expect(导入项目.name).toBe('导出项目');
    expect(fs.existsSync(path.join(导入项目.folder_path, 'scripts', 'run.py'))).toBe(true);
  });

  it('连接机器人应通过桥接执行并更新在线状态', async () => {
    const 机器人控制桥接 = 创建机器人控制桥接Mock();
    机器人控制桥接.connectRobot.mockResolvedValue({
      success: true,
      connected: true,
      message: 'SSH 连接成功；自动配置完成',
      mode: 'wifi',
    });

    const 服务 = await 创建编舞服务(环境, {
      机器人仓库: 创建机器人仓库Mock(),
      机器人控制桥接,
    });
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '连接项目',
    });

    const 机器人 = await 服务.addRobotToProjectDirect(项目.uuid, {
      name: '待连接机器人',
      robot_ip: '192.168.1.20',
      local_ip: '192.168.1.2',
      local_port: 9000,
    });

    const 结果 = await 服务.connectRobot(项目.uuid, 机器人.uuid);

    expect(机器人控制桥接.connectRobot).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 机器人.uuid,
        name: '待连接机器人',
        robot_ip: '192.168.1.20',
      }),
    );
    expect(结果.mode).toBe('wifi');

    const 配置列表 = await 服务.getProjectRobotsConfig(项目.uuid);
    expect(配置列表[0].status).toBe('online');
  });

  it('连接失败时应通过桥接结果回写离线状态', async () => {
    const 机器人控制桥接 = 创建机器人控制桥接Mock();
    机器人控制桥接.connectRobot.mockResolvedValue({
      success: false,
      connected: false,
      message: 'SSH 连接失败',
    });

    const 服务 = await 创建编舞服务(环境, {
      机器人仓库: 创建机器人仓库Mock(),
      机器人控制桥接,
    });
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '连接失败项目',
    });

    const 机器人 = await 服务.addRobotToProjectDirect(项目.uuid, {
      name: '待连接机器人',
      robot_ip: '192.168.1.20',
      local_ip: '192.168.1.2',
      local_port: 9000,
    });

    await 服务.updateProjectRobot(项目.uuid, 机器人.uuid, { status: 'online' });

    const 结果 = await 服务.connectRobot(项目.uuid, 机器人.uuid);
    expect(结果.success).toBe(false);

    const 配置列表 = await 服务.getProjectRobotsConfig(项目.uuid);
    expect(配置列表[0].status).toBe('offline');
  });

  it('执行编舞应编译计划后委托执行服务', async () => {
    const 执行服务 = 创建执行服务Mock();
    执行服务.startExecution.mockReturnValue({
      executionId: 'schedule-1',
      scheduleId: 'schedule-1',
      status: 'running',
      currentTime: 0,
      progress: 0,
      startedAt: '2026-03-30T00:00:00.000Z',
    });

    const 服务 = await 创建编舞服务(环境, {
      机器人仓库: 创建机器人仓库Mock(),
      执行服务,
    });
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '执行项目',
    });

    await 服务.saveTimeline(项目.uuid, {
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
              actionParams: { speed: 1 },
            },
          ],
        },
      ],
      config: {
        duration: 8,
        pixelsPerSecond: 100,
        currentTime: 0,
        snapToGrid: true,
        gridSize: 0.5,
      },
    });

    const 状态 = await 服务.executeChoreo(项目.uuid);

    expect(执行服务.startExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUuid: 项目.uuid,
        totalDuration: 8000,
        robotIds: ['robot-1'],
        actions: [
          expect.objectContaining({
            robotId: 'robot-1',
            action: 'forward',
            executeAt: 1000,
            duration: 2000,
            parameters: { speed: 1 },
          }),
        ],
      }),
    );
    expect(状态.status).toBe('running');
  });

  it('编译时间轴应委托独立编译器', async () => {
    const 时间轴编译器 = 创建时间轴编译器Mock();
    时间轴编译器.compile.mockReturnValue({
      scheduleId: 'compiled-1',
      projectUuid: 'ignored',
      totalDuration: 6000,
      robotIds: ['robot-1'],
      actions: [
        {
          robotId: 'robot-1',
          action: 'sit',
          executeAt: 500,
          duration: 1000,
        },
      ],
    });

    const 服务 = await 创建编舞服务(环境, {
      机器人仓库: 创建机器人仓库Mock(),
      时间轴编译器,
    });
    await 服务.初始化();
    const 项目 = await 服务.createProject({
      name: '编译项目',
    });

    await 服务.saveTimeline(项目.uuid, {
      tracks: [
        {
          id: 'track-1',
          name: '轨道一',
          type: 'action',
          robotId: 'robot-1',
          blocks: [
            {
              id: 'block-1',
              name: '坐下',
              startTime: 0.5,
              duration: 1,
              actionType: 'sit',
            },
          ],
        },
      ],
      config: {
        duration: 6,
        pixelsPerSecond: 100,
        currentTime: 0,
        snapToGrid: true,
        gridSize: 0.5,
      },
    });

    const 计划 = await 服务.compileTimeline(项目.uuid);

    expect(时间轴编译器.compile).toHaveBeenCalledWith(
      项目.uuid,
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            id: 'track-1',
          }),
        ],
        config: expect.objectContaining({
          duration: 6,
        }),
      }),
    );
    expect(计划.scheduleId).toBe('compiled-1');
  });

  it('设置 WebSocket 服务应委托执行服务', async () => {
    const 执行服务 = 创建执行服务Mock();
    const 服务 = await 创建编舞服务(环境, {
      机器人仓库: 创建机器人仓库Mock(),
      执行服务,
    });
    const ws服务 = { broadcast: jest.fn() };

    服务.setWebSocketService(ws服务 as any);

    expect(执行服务.setWebSocketService).toHaveBeenCalledWith(ws服务);
  });

  it('项目机器人相关接口应委托独立项目机器人服务', async () => {
    const 项目机器人服务 = 创建项目机器人服务Mock();
    项目机器人服务.getProjectRobots.mockResolvedValue([{ uuid: 'robot-1' }]);
    项目机器人服务.connectRobot.mockResolvedValue({
      success: true,
      connected: true,
      message: 'ok',
    });

    const 服务 = await 创建编舞服务(环境, {
      机器人仓库: 创建机器人仓库Mock(),
      项目机器人服务,
    });

    expect(await 服务.getProjectRobots('project-1')).toEqual([{ uuid: 'robot-1' }]);
    expect(项目机器人服务.getProjectRobots).toHaveBeenCalledWith('project-1');

    const 结果 = await 服务.connectRobot('project-1', 'robot-1');
    expect(结果.success).toBe(true);
    expect(项目机器人服务.connectRobot).toHaveBeenCalledWith('project-1', 'robot-1');
  });

  it('文件与资源相关接口应委托独立项目文件资源服务', async () => {
    const 项目文件资源服务 = 创建项目文件资源服务Mock();
    项目文件资源服务.getProjectFiles.mockResolvedValue([{ name: 'scripts' }]);
    项目文件资源服务.exportProject.mockResolvedValue({
      exportPath: 'D:/tmp/test.hhzip',
      fileName: 'test.hhzip',
    });

    const 服务 = await 创建编舞服务(环境, {
      机器人仓库: 创建机器人仓库Mock(),
      项目文件资源服务,
    });

    expect(await 服务.getProjectFiles('project-1')).toEqual([{ name: 'scripts' }]);
    expect(项目文件资源服务.getProjectFiles).toHaveBeenCalledWith('project-1');

    const 导出结果 = await 服务.exportProject('project-1');
    expect(导出结果.fileName).toBe('test.hhzip');
    expect(项目文件资源服务.exportProject).toHaveBeenCalledWith('project-1');
  });

  it('项目管理相关接口应委托独立项目管理服务', async () => {
    const 项目管理服务 = 创建项目管理服务Mock();
    项目管理服务.createProject.mockResolvedValue({
      uuid: 'project-1',
      name: '测试项目',
      folder_path: 'D:/tmp/project-1',
      created_at: '2026-03-30T00:00:00.000Z',
      updated_at: '2026-03-30T00:00:00.000Z',
    });

    const 服务 = await 创建编舞服务(环境, {
      机器人仓库: 创建机器人仓库Mock(),
      项目管理服务,
    });

    const 项目 = await 服务.createProject({ name: '测试项目' });
    expect(项目.uuid).toBe('project-1');
    expect(项目管理服务.createProject).toHaveBeenCalledWith({ name: '测试项目' });
  });

  it('时间轴与自定义动作接口应委托独立时间轴内容服务', async () => {
    const 时间轴内容服务 = 创建时间轴内容服务Mock();
    时间轴内容服务.getTimeline.mockResolvedValue({
      tracks: [],
      config: {
        duration: 10,
        pixelsPerSecond: 100,
        currentTime: 0,
        snapToGrid: true,
        gridSize: 0.5,
      },
    });
    时间轴内容服务.saveCustomAction.mockResolvedValue({
      uuid: 'action-1',
      name: '招手',
      tracks: [],
      config: {
        duration: 10,
        pixelsPerSecond: 100,
        currentTime: 0,
        snapToGrid: true,
        gridSize: 0.5,
      },
      created_at: '2026-03-30T00:00:00.000Z',
      updated_at: '2026-03-30T00:00:00.000Z',
    });

    const 服务 = await 创建编舞服务(环境, {
      机器人仓库: 创建机器人仓库Mock(),
      时间轴内容服务,
    });

    const 时间轴 = await 服务.getTimeline('project-1');
    expect(时间轴.config.duration).toBe(10);
    expect(时间轴内容服务.getTimeline).toHaveBeenCalledWith('project-1');

    const 动作 = await 服务.saveCustomAction('project-1', {
      name: '招手',
      tracks: [],
      config: {
        duration: 10,
        pixelsPerSecond: 100,
        currentTime: 0,
        snapToGrid: true,
        gridSize: 0.5,
      },
    });
    expect(动作.uuid).toBe('action-1');
    expect(时间轴内容服务.saveCustomAction).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({ name: '招手' }),
    );
  });
});
