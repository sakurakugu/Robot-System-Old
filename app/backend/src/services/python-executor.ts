import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';

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
 * Python执行器服务
 * 负责调用Python子进程执行机器人控制脚本
 */
export class PythonExecutor extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private readonly pythonPath: string;
  private readonly robotControlPath: string;

  constructor() {
    super();
    // Python可执行文件路径（可以配置为虚拟环境中的python）
    this.pythonPath = 'python3';
    // robot-control目录路径
    this.robotControlPath = path.join(__dirname, '../../../robot-control');
  }

  /**
   * 测试机器人连接
   */
  async testConnection(robot: RobotConfig): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const testScript = this.generateTestScript(robot);
      const scriptPath = path.join(this.robotControlPath, 'temp_test.py');
      
      // 写入临时测试脚本
      const fs = require('fs');
      fs.writeFileSync(scriptPath, testScript);

      const process = spawn(this.pythonPath, [scriptPath], {
        cwd: this.robotControlPath,
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        // 清理临时文件
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          console.error('清理临时文件失败:', e);
        }

        if (code === 0) {
          resolve({ success: true, message: '连接成功' });
        } else {
          resolve({ 
            success: false, 
            message: errorOutput || '连接失败' 
          });
        }
      });

      process.on('error', (error) => {
        reject(new Error(`执行失败: ${error.message}`));
      });

      // 设置超时
      setTimeout(() => {
        process.kill();
        reject(new Error('连接测试超时'));
      }, 10000);
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
      const fs = require('fs');
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
        
        lines.forEach(line => {
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
   * 生成测试连接脚本
   */
  private generateTestScript(robot: RobotConfig): string {
    return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from lib.api import CrazyRobotDog
import sys

try:
    dog = CrazyRobotDog(
        name="${robot.name}",
        robot_ip="${robot.robot_ip}",
        local_ip="${robot.local_ip}",
        local_port=${robot.local_port}
    )
    print("连接成功: ${robot.name}")
    sys.exit(0)
except Exception as e:
    print(f"连接失败: {e}", file=sys.stderr)
    sys.exit(1)
`;
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
      
      // 假设actions针对第一个机器人，可以扩展为支持多机器人
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
   * 执行Python文件
   */
  async execute(pythonFilePath: string, workingDirectory?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const cwd = workingDirectory || path.dirname(pythonFilePath);
      
      // 生成执行ID用于WebSocket推送
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const process = spawn(this.pythonPath, [pythonFilePath], {
        cwd: cwd,
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // 实时推送输出到WebSocket
        const lines = output.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            this.emit('output', { executionId, data: line });
          }
        });
      });

      process.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        
        // 实时推送错误到WebSocket
        const lines = error.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            this.emit('error', { executionId, error: line });
          }
        });
      });

      process.on('close', (code) => {
        this.emit('complete', { executionId, code: code || 0 });
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      process.on('error', (error) => {
        this.emit('error', { executionId, error: error.message });
        reject(new Error(`执行失败: ${error.message}`));
      });

      // 设置超时（60秒）
      setTimeout(() => {
        process.kill();
        this.emit('error', { executionId, error: '执行超时' });
        reject(new Error('执行超时'));
      }, 60000);
    });
  }

  /**
   * 清理所有进程
   */
  cleanup(): void {
    this.processes.forEach((process, id) => {
      process.kill('SIGTERM');
    });
    this.processes.clear();
  }
}

// 导出单例
export const pythonExecutor = new PythonExecutor();
