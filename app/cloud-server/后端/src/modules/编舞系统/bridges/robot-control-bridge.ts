import { spawn } from 'child_process';
import path from 'path';
import { PythonExecutor } from '../../../core/services/python-executor';
import type {
  ConnectionTestResult,
  ProjectRobotConfig,
} from '../types';

type 机器人控制参数 = Pick<ProjectRobotConfig, 'name' | 'robot_ip' | 'local_ip' | 'local_port'>;

type 编舞Python执行器 = Pick<PythonExecutor, 'testSshConnection' | 'autoConfigure' | 'restartMotionControl'>;

/**
 * 编舞系统的机器人控制桥接
 * 负责对接 SSH 测试与 Python 运控脚本
 */
export class 编舞机器人控制桥接 {
  constructor(
    private readonly pythonExecutor: 编舞Python执行器 = new PythonExecutor(
      path.join(__dirname, '../../../../../../dance-choreo/robot-control'), // TODO: 旧的删除了，这个路径是对的吗？
    ),
    private readonly 启动进程: typeof spawn = spawn,
  ) {}

  async testRobotConnection(
    robot: Pick<ProjectRobotConfig, 'robot_ip'>,
  ): Promise<ConnectionTestResult> {
    return new Promise((resolve) => {
      const args = [
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=3',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        `firefly@${robot.robot_ip}`,
        'exit',
      ];

      const proc = this.启动进程('ssh', args);
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, connected: true, message: 'SSH 测试成功' });
          return;
        }

        if (stderr.includes('Permission denied')) {
          resolve({ success: true, connected: true, message: 'SSH 可达' });
          return;
        }

        if (stderr.includes('Connection timed out')) {
          resolve({ success: false, connected: false, message: 'SSH 连接超时' });
          return;
        }

        resolve({ success: false, connected: false, message: stderr || 'SSH 测试失败' });
      });

      proc.on('error', () => {
        resolve({ success: false, connected: false, message: '无法执行ssh命令' });
      });
    });
  }

  async connectRobot(robot: 机器人控制参数): Promise<ConnectionTestResult> {
    const sshResult = await this.pythonExecutor.testSshConnection({
      name: robot.name,
      robot_ip: robot.robot_ip,
    });

    if (!sshResult.success) {
      return {
        success: false,
        connected: false,
        message: sshResult.message,
      };
    }

    const configResult = await this.pythonExecutor.autoConfigure({
      name: robot.name,
      robot_ip: robot.robot_ip,
      local_ip: robot.local_ip,
      local_port: robot.local_port,
    });

    return {
      success: true,
      connected: true,
      message: sshResult.message + (configResult.message ? `；${configResult.message}` : ''),
      mode: configResult.mode,
    };
  }

  async restartMotionControl(robot: 机器人控制参数): Promise<{ success: boolean; message: string }> {
    return this.pythonExecutor.restartMotionControl({
      name: robot.name,
      robot_ip: robot.robot_ip,
      local_ip: robot.local_ip,
      local_port: robot.local_port,
    });
  }
}

export default 编舞机器人控制桥接;
