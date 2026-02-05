/**
 * Python 执行器服务
 * 负责调用 Python 子进程执行机器人控制脚本
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export interface RobotConfig {
  name: string;
  robot_ip: string;
  local_ip: string;
  local_port: number;
}

export interface ActionCommand {
  action: string;
  params?: any[];
  duration?: number;
}

export interface ExecutionOptions {
  robots: RobotConfig[];
  actions: ActionCommand[];
  onProgress?: (progress: number, message: string) => void;
  onOutput?: (data: string) => void;
  onError?: (error: string) => void;
}

/**
 * Python 执行器服务
 */
export class Python执行器 extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private readonly pythonPath: string;
  private readonly robotControlPath: string;

  constructor(robotControlPath?: string) {
    super();
    this.pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    // 默认使用 dance-choreo 的 robot-control 目录
    this.robotControlPath = robotControlPath || path.join(
      __dirname,
      '../../../../../dance-choreo/robot-control'
    );
  }

  /**
   * 重启运控
   */
  async restartMotionControl(
    robot: RobotConfig & { username?: string; password?: string }
  ): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const username = robot.username || 'firefly';
      const password = robot.password || 'firefly';
      const scriptPath = path.join(this.robotControlPath, 'tools', 'restart_motion.py');

      const process = spawn(this.pythonPath, [
        scriptPath,
        '--robot-ip', robot.robot_ip,
        '--username', username,
        '--password', password,
      ], {
        cwd: this.robotControlPath,
      });

      let stderr = '';
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: '运控重启成功' });
        } else {
          resolve({ success: false, message: stderr || '运控重启失败' });
        }
      });

      process.on('error', (error) => {
        reject(new Error(`执行失败: ${error.message}`));
      });
    });
  }

  /**
   * 测试 SSH 连接
   */
  async testSshConnection(
    robot: Pick<RobotConfig, 'name' | 'robot_ip'> & { username?: string; password?: string }
  ): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const username = robot.username || 'firefly';
      const password = robot.password || 'firefly';
      const scriptPath = path.join(this.robotControlPath, 'tools', 'test_ssh.py');

      const process = spawn(this.pythonPath, [
        scriptPath,
        '--ip', robot.robot_ip,
        '--username', username,
        '--password', password,
        '--name', robot.name,
      ], {
        cwd: this.robotControlPath,
      });

      let errorOutput = '';

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: 'SSH 连接成功' });
        } else {
          resolve({ success: false, message: errorOutput || 'SSH 连接失败' });
        }
      });

      process.on('error', (error) => {
        reject(new Error(`执行失败: ${error.message}`));
      });

      setTimeout(() => {
        process.kill();
        reject(new Error('SSH 连接测试超时'));
      }, 10000);
    });
  }

  /**
   * 自动检测连接模式并修改运控脚本与SDK配置
   */
  async autoConfigure(
    robot: RobotConfig & { username?: string; password?: string }
  ): Promise<{ success: boolean; message: string; mode?: 'ap' | 'wifi' }> {
    return new Promise((resolve, reject) => {
      const username = robot.username || 'firefly';
      const password = robot.password || 'firefly';
      const scriptPath = path.join(this.robotControlPath, 'tools', 'auto_config.py');

      const process = spawn(this.pythonPath, [
        scriptPath,
        '--robot-ip', robot.robot_ip,
        '--local-ip', robot.local_ip,
        '--local-port', String(robot.local_port),
        '--username', username,
        '--password', password,
      ], {
        cwd: this.robotControlPath,
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const modeMatch = stdout.match(/\[MODE:(ap|wifi)\]/);
          resolve({
            success: true,
            message: stdout.trim() || '自动配置完成',
            mode: modeMatch ? (modeMatch[1] as 'ap' | 'wifi') : undefined,
          });
        } else {
          resolve({ success: false, message: stderr || '自动配置失败' });
        }
      });

      process.on('error', (error) => {
        reject(new Error(`执行失败: ${error.message}`));
      });
    });
  }

  /**
   * 执行动作序列
   */
  async executeActions(executionId: string, options: ExecutionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = this.generateActionScript(options.robots, options.actions);
      const scriptPath = path.join(this.robotControlPath, `temp_${executionId}.py`);

      // 写入临时脚本
      fs.writeFileSync(scriptPath, script);

      const process = spawn(this.pythonPath, [scriptPath], {
        cwd: this.robotControlPath,
      });

      this.processes.set(executionId, process);

      let currentLine = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        if (options.onOutput) {
          options.onOutput(output);
        }

        // 解析进度信息
        currentLine += output;
        const lines = currentLine.split('\n');
        currentLine = lines.pop() || '';

        lines.forEach((line) => {
          // 查找进度标记，例如：[PROGRESS:50]
          const progressMatch = line.match(/\[PROGRESS:(\d+)\]/);
          if (progressMatch && options.onProgress) {
            const progress = parseInt(progressMatch[1]);
            options.onProgress(progress, line);
          }

          // 发送事件
          this.emit('output', { executionId, data: line });
        });
      });

      process.stderr.on('data', (data) => {
        const error = data.toString();
        if (options.onError) {
          options.onError(error);
        }
        this.emit('error', { executionId, error });
      });

      process.on('close', (code) => {
        // 清理临时文件
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          console.error('清理临时文件失败:', e);
        }

        this.processes.delete(executionId);
        this.emit('complete', { executionId, code });

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`执行失败，退出码: ${code}`));
        }
      });

      process.on('error', (error) => {
        this.emit('error', { executionId, error: error.message });
        reject(error);
      });
    });
  }

  /**
   * 停止执行
   */
  stopExecution(executionId: string): boolean {
    const process = this.processes.get(executionId);
    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * 生成动作执行脚本
   */
  private generateActionScript(robots: RobotConfig[], actions: ActionCommand[]): string {
    // 生成机器人初始化代码
    const robotInits = robots.map((robot, idx) => {
      return `dog${idx} = CrazyRobotDog(
    name="${robot.name}",
    robot_ip="${robot.robot_ip}",
    local_ip="${robot.local_ip}",
    local_port=${robot.local_port}
)`;
    }).join('\n\n');

    // 生成动作执行代码
    const actionCalls = actions.map((action, idx) => {
      const params = action.params ? action.params.join(', ') : '';
      const progress = Math.round(((idx + 1) / actions.length) * 100);

      return `# 动作 ${idx + 1}: ${action.action}
print("[PROGRESS:${progress}] 执行: ${action.action}")
dog0.${action.action}(${params})
${action.duration ? `time.sleep(${action.duration})` : ''}`;
    }).join('\n\n');

    return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from lib.api import CrazyRobotDog
import time
import sys

try:
    # 初始化机器人
    ${robotInits}
    
    print("[PROGRESS:0] 开始执行动作序列")
    
    # 执行动作序列
    ${actionCalls}
    
    print("[PROGRESS:100] 动作序列执行完成")
    sys.exit(0)
    
except Exception as e:
    print(f"执行失败: {e}", file=sys.stderr)
    sys.exit(1)
`;
  }

  /**
   * 获取当前运行的执行ID列表
   */
  getRunningExecutions(): string[] {
    return Array.from(this.processes.keys());
  }

  /**
   * 执行 Python 文件
   */
  execute(pythonFilePath: string, workingDirectory?: string): { executionId: string } {
    const cwd = workingDirectory || path.dirname(pythonFilePath);

    // 生成执行ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const process = spawn(this.pythonPath, [pythonFilePath], {
      cwd: cwd,
    });

    this.processes.set(executionId, process);

    process.stdout.on('data', (data) => {
      const output = data.toString();
      const lines = output.split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          this.emit('output', { executionId, data: line });
        }
      });
    });

    process.stderr.on('data', (data) => {
      const error = data.toString();
      const lines = error.split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          this.emit('error', { executionId, error: line });
        }
      });
    });

    process.on('close', (code) => {
      this.processes.delete(executionId);
      this.emit('complete', { executionId, code: code || 0 });
    });

    process.on('error', (error) => {
      this.processes.delete(executionId);
      this.emit('error', { executionId, error: error.message });
    });

    return { executionId };
  }

  /**
   * 清理所有进程
   */
  cleanup(): void {
    this.processes.forEach((process) => {
      process.kill('SIGTERM');
    });
    this.processes.clear();
  }
}

// 导出单例
export const pythonExecutor = new Python执行器();

export default Python执行器;

export { Python执行器 as PythonExecutor };
