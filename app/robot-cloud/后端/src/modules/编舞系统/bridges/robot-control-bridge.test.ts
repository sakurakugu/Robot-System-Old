import { EventEmitter } from 'events';
import { 编舞机器人控制桥接 } from './robot-control-bridge';

type Python执行器Mock = {
  testSshConnection: jest.Mock;
  autoConfigure: jest.Mock;
  restartMotionControl: jest.Mock;
};

type 可控子进程 = EventEmitter & {
  stderr: EventEmitter;
};

function 创建Python执行器Mock(): Python执行器Mock {
  return {
    testSshConnection: jest.fn(),
    autoConfigure: jest.fn(),
    restartMotionControl: jest.fn(),
  };
}

function 创建可控子进程(): 可控子进程 {
  const proc = new EventEmitter() as 可控子进程;
  proc.stderr = new EventEmitter();
  return proc;
}

describe('编舞机器人控制桥接', () => {
  it('SSH 权限拒绝时应识别为可达', async () => {
    const python执行器 = 创建Python执行器Mock();
    const 子进程 = 创建可控子进程();
    const 启动进程 = jest.fn(() => 子进程 as any);
    const 桥接 = new 编舞机器人控制桥接(python执行器 as any, 启动进程 as any);

    const 结果Promise = 桥接.testRobotConnection({
      robot_ip: '192.168.1.20',
    });

    子进程.stderr.emit('data', Buffer.from('Permission denied'));
    子进程.emit('close', 255);

    await expect(结果Promise).resolves.toEqual({
      success: true,
      connected: true,
      message: 'SSH 可达',
    });
    expect(启动进程).toHaveBeenCalledWith('ssh', expect.arrayContaining([
      '-o',
      'BatchMode=yes',
      'firefly@192.168.1.20',
      'exit',
    ]));
  });

  it('连接机器人应串联 SSH 测试与自动配置', async () => {
    const python执行器 = 创建Python执行器Mock();
    python执行器.testSshConnection.mockResolvedValue({
      success: true,
      message: 'SSH 连接成功',
    });
    python执行器.autoConfigure.mockResolvedValue({
      success: true,
      message: '自动配置完成',
      mode: 'wifi',
    });

    const 桥接 = new 编舞机器人控制桥接(python执行器 as any);
    const 结果 = await 桥接.connectRobot({
      name: '测试机器人',
      robot_ip: '192.168.1.20',
      local_ip: '192.168.1.2',
      local_port: 9000,
    });

    expect(python执行器.testSshConnection).toHaveBeenCalledWith({
      name: '测试机器人',
      robot_ip: '192.168.1.20',
    });
    expect(python执行器.autoConfigure).toHaveBeenCalledWith({
      name: '测试机器人',
      robot_ip: '192.168.1.20',
      local_ip: '192.168.1.2',
      local_port: 9000,
    });
    expect(结果).toEqual({
      success: true,
      connected: true,
      message: 'SSH 连接成功；自动配置完成',
      mode: 'wifi',
    });
  });

  it('重启运控应直接委托 Python 执行器', async () => {
    const python执行器 = 创建Python执行器Mock();
    python执行器.restartMotionControl.mockResolvedValue({
      success: true,
      message: '运控重启成功',
    });

    const 桥接 = new 编舞机器人控制桥接(python执行器 as any);
    const 结果 = await 桥接.restartMotionControl({
      name: '测试机器人',
      robot_ip: '192.168.1.20',
      local_ip: '192.168.1.2',
      local_port: 9000,
    });

    expect(python执行器.restartMotionControl).toHaveBeenCalledWith({
      name: '测试机器人',
      robot_ip: '192.168.1.20',
      local_ip: '192.168.1.2',
      local_port: 9000,
    });
    expect(结果).toEqual({
      success: true,
      message: '运控重启成功',
    });
  });
});
