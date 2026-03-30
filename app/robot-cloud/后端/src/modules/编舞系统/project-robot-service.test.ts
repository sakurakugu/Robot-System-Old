import fs from 'fs';
import os from 'os';
import path from 'path';
import { 编舞项目机器人服务 } from './project-robot-service';
import { 编舞项目存储 } from './storage/project-storage';
import type { ChoreoProject } from './types';

jest.mock('uuid', () => ({
  v7: jest.fn(() => '12345678-1234-1234-1234-123456789abc'),
}));

type 测试环境 = {
  临时目录: string;
  数据目录: string;
  项目目录: string;
  存储: 编舞项目存储;
  项目: ChoreoProject;
};

type 机器人仓库Mock = {
  getRobot: jest.Mock;
};

type 机器人控制桥接Mock = {
  testRobotConnection: jest.Mock;
  connectRobot: jest.Mock;
  restartMotionControl: jest.Mock;
};

function 创建测试环境(): 测试环境 {
  const 临时目录 = fs.mkdtempSync(path.join(os.tmpdir(), 'choreo-project-robot-'));
  const 数据目录 = path.join(临时目录, 'data');
  const 项目目录 = path.join(临时目录, 'projects');
  const 项目: ChoreoProject = {
    uuid: 'project-1',
    name: '机器人项目',
    description: '测试项目',
    folder_path: path.join(项目目录, '机器人项目_project-1'),
    created_at: '2026-03-30T00:00:00.000Z',
    updated_at: '2026-03-30T00:00:00.000Z',
  };

  return {
    临时目录,
    数据目录,
    项目目录,
    存储: new 编舞项目存储(数据目录, 项目目录),
    项目,
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

describe('编舞项目机器人服务', () => {
  let 环境: 测试环境;

  beforeEach(async () => {
    环境 = 创建测试环境();
    await 准备项目目录(环境);
  });

  afterEach(() => {
    fs.rmSync(环境.临时目录, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('应管理项目内主机器人关联', async () => {
    const 机器人仓库 = 创建机器人仓库Mock();
    机器人仓库.getRobot.mockResolvedValue({
      uuid: 'robot-main-1',
      name: '主机器人',
    });

    const 服务 = new 编舞项目机器人服务(
      () => 环境.项目,
      环境.存储,
      机器人仓库 as any,
      创建机器人控制桥接Mock() as any,
    );

    const 机器人 = await 服务.addRobotToProject(环境.项目.uuid, {
      robot_id: 'robot-main-1',
    });

    expect(机器人.name).toBe('主机器人');
    expect(机器人仓库.getRobot).toHaveBeenCalledWith('robot-main-1');
    expect(await 服务.getProjectRobots(环境.项目.uuid)).toHaveLength(1);

    await expect(
      服务.addRobotToProject(环境.项目.uuid, { robot_id: 'robot-main-1' }),
    ).rejects.toThrow('机器人已在项目中');

    await 服务.removeRobotFromProject(环境.项目.uuid, 机器人.uuid);
    expect(await 服务.getProjectRobots(环境.项目.uuid)).toEqual([]);
  });

  it('应管理项目机器人配置并持久化状态更新', async () => {
    const 服务 = new 编舞项目机器人服务(
      () => 环境.项目,
      环境.存储,
      创建机器人仓库Mock() as any,
      创建机器人控制桥接Mock() as any,
    );

    const 机器人 = await 服务.addRobotToProjectDirect(环境.项目.uuid, {
      name: '直连机器人',
      robot_ip: '192.168.1.20',
      local_ip: '192.168.1.2',
      local_port: 9000,
      group_name: '测试组',
    });

    const 更新后 = await 服务.updateProjectRobot(环境.项目.uuid, 机器人.uuid, {
      status: 'online',
      name: '已连接机器人',
    });

    expect(更新后.status).toBe('online');
    expect(更新后.name).toBe('已连接机器人');
    expect(await 服务.getProjectRobotsConfig(环境.项目.uuid)).toHaveLength(1);

    await 服务.deleteProjectRobot(环境.项目.uuid, 机器人.uuid);
    expect(await 服务.getProjectRobotsConfig(环境.项目.uuid)).toEqual([]);
  });

  it('应通过桥接连接机器人并回写状态', async () => {
    const 机器人控制桥接 = 创建机器人控制桥接Mock();
    机器人控制桥接.connectRobot.mockResolvedValue({
      success: true,
      connected: true,
      message: '连接成功',
      mode: 'wifi',
    });

    const 服务 = new 编舞项目机器人服务(
      () => 环境.项目,
      环境.存储,
      创建机器人仓库Mock() as any,
      机器人控制桥接 as any,
    );

    const 机器人 = await 服务.addRobotToProjectDirect(环境.项目.uuid, {
      name: '待连接机器人',
      robot_ip: '192.168.1.20',
      local_ip: '192.168.1.2',
      local_port: 9000,
    });

    const 结果 = await 服务.connectRobot(环境.项目.uuid, 机器人.uuid);

    expect(机器人控制桥接.connectRobot).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 机器人.uuid,
        robot_ip: '192.168.1.20',
      }),
    );
    expect(结果.connected).toBe(true);
    expect((await 服务.getProjectRobotsConfig(环境.项目.uuid))[0].status).toBe('online');
  });
});
