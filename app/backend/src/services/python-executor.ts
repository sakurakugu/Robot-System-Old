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
   * 重启运控
   */
  async restartMotionControl(robot: RobotConfig & { username?: string; password?: string }): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const username = robot.username || 'firefly';
      const password = robot.password || 'firefly';
      const script = this.generateRestartMotionScript(robot.robot_ip, username, password);
      const scriptPath = path.join(this.robotControlPath, 'temp_restart_motion.py');
      
      const fs = require('fs');
      fs.writeFileSync(scriptPath, script);

      const process = spawn(this.pythonPath, [scriptPath], {
        cwd: this.robotControlPath,
      });

      let stderr = '';
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          console.error('清理临时文件失败:', e);
        }
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
   * 测试机器人连接（使用 Python 控制层）
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
   * 测试 SSH 连接（非交互，自动安装依赖）
   */
  async testSshConnection(
    robot: Pick<RobotConfig, 'name' | 'robot_ip'> & { username?: string; password?: string }
  ): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const username = robot.username || 'firefly';
      const password = robot.password || 'firefly';
      const testScript = this.generateSshTestScript(robot.robot_ip, username, password, robot.name);
      const scriptPath = path.join(this.robotControlPath, 'temp_ssh_test.py');
      
      const fs = require('fs');
      fs.writeFileSync(scriptPath, testScript);

      const process = spawn(this.pythonPath, [scriptPath], {
        cwd: this.robotControlPath,
      });

      let errorOutput = '';

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          console.error('清理临时文件失败:', e);
        }

        if (code === 0) {
          resolve({ success: true, message: 'SSH 连接成功' });
        } else {
          resolve({ 
            success: false, 
            message: errorOutput || 'SSH 连接失败' 
          });
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
  async autoConfigure(robot: RobotConfig & { username?: string; password?: string }): Promise<{ success: boolean; message: string; mode?: 'ap' | 'wifi' }> {
    return new Promise((resolve, reject) => {
      const username = robot.username || 'firefly';
      const password = robot.password || 'firefly';
      const script = this.generateAutoConfigScript({
        name: robot.name,
        robot_ip: robot.robot_ip,
        local_ip: robot.local_ip,
        local_port: robot.local_port,
        username,
        password
      });
      const scriptPath = path.join(this.robotControlPath, 'temp_auto_config.py');
      
      const fs = require('fs');
      fs.writeFileSync(scriptPath, script);

      const process = spawn(this.pythonPath, [scriptPath], {
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
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          console.error('清理临时文件失败:', e);
        }
        if (code === 0) {
          // 试图从输出中解析模式标记
          const modeMatch = stdout.match(/\[MODE:(ap|wifi)\]/);
          resolve({ success: true, message: stdout.trim() || '自动配置完成', mode: (modeMatch ? (modeMatch[1] as 'ap' | 'wifi') : undefined) });
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
   * 生成 SSH 测试脚本（自动确保安装 paramiko）
   */
  private generateSshTestScript(ip: string, username: string, password: string, name: string): string {
    return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import subprocess

def ensure_package(pkg, import_name=None):
    if import_name is None:
        import_name = pkg
    try:
        __import__(import_name)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

ensure_package("paramiko")
import paramiko

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname="${ip}", username="${username}", password="${password}", timeout=7)
    client.close()
    print("SSH 连接成功: ${name} (${ip})")
    sys.exit(0)
except Exception as e:
    print(f"SSH 连接失败: {e}", file=sys.stderr)
    sys.exit(1)
`;
  }

  /**
   * 生成自动配置脚本（SSH + 修改 YAML 和启动脚本）
   */
  private generateAutoConfigScript(robot: { name: string; robot_ip: string; local_ip: string; local_port: number; username: string; password: string }): string {
    return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import subprocess
import re

def ensure_package(pkg, import_name=None):
    if import_name is None:
        import_name = pkg
    try:
        __import__(import_name)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

ensure_package("paramiko")
ensure_package("ruamel.yaml", "ruamel.yaml")
import paramiko
from ruamel.yaml import YAML

ROBOT_IP = "${robot.robot_ip}"
LOCAL_IP = "${robot.local_ip}"
LOCAL_PORT = ${robot.local_port}
USERNAME = "${robot.username}"
PASSWORD = "${robot.password}"

START_SCRIPT = "/opt/app_launch/start_motion_control.sh"
SDK_CONFIG = "/opt/export/config/sdk_config.yaml"

def exec_cmd(client, cmd, use_sudo=False):
    if use_sudo:
        cmd = f"echo {PASSWORD} | sudo -S {cmd}"
    stdin, stdout, stderr = client.exec_command(cmd)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="ignore")
    err = stderr.read().decode("utf-8", errors="ignore")
    return code == 0, out, err

def write_file(client, content, target_path, description):
    temp_path = "/tmp/" + target_path.split("/")[-1]
    ok, _, err = exec_cmd(client, f"cat > {temp_path} << 'EOF'\\n{content}\\nEOF")
    if not ok:
        print(f"写入临时文件失败: {err}", file=sys.stderr)
        return False
    ok, _, err = exec_cmd(client, f"cp {temp_path} {target_path}", use_sudo=True)
    if not ok:
        print(f"复制{description}失败: {err}", file=sys.stderr)
        return False
    return True

def detect_mode(client):
    ok, out, err = exec_cmd(client, "ip addr show wlan0")
    if not ok:
        print(f"获取网络信息失败: {err}", file=sys.stderr)
        return None
    ip_match = re.search(r"inet (\\d+\\.\\d+\\.\\d+\\.\\d+)", out)
    ip = ip_match.group(1) if ip_match else None
    if ip and ip.startswith("192.168.234."):
        return "ap"
    # 再看启动脚本中是否包含 SDK_CLIENT_IP
    ok2, script, err2 = exec_cmd(client, f"cat {START_SCRIPT}", use_sudo=True)
    if ok2 and "SDK_CLIENT_IP" in script:
        return "wifi"
    return "wifi" if ip else "ap"

def update_sdk_config(client):
    ok, content, err = exec_cmd(client, f"cat {SDK_CONFIG}", use_sudo=True)
    if not ok:
        print(f"读取SDK配置失败: {err}", file=sys.stderr)
        return False
    yaml = YAML()
    try:
        data = yaml.load(content) or {}
        data["target_ip"] = str(LOCAL_IP)
        data["target_port"] = int(LOCAL_PORT)
        from io import StringIO
        out_stream = StringIO()
        yaml.dump(data, out_stream)
        new_content = out_stream.getvalue()
    except Exception as e:
        print(f"YAML 解析失败: {e}", file=sys.stderr)
        return False
    return write_file(client, new_content, SDK_CONFIG, "SDK配置文件")

def update_start_script(client, mode):
    ok, content, err = exec_cmd(client, f"cat {START_SCRIPT}", use_sudo=True)
    if not ok:
        print(f"读取启动脚本失败: {err}", file=sys.stderr)
        return False
    # 移除旧的 SDK_CLIENT_IP 配置
    content = re.sub(r"\\nexport SDK_CLIENT_IP=.*\\n", "\\n", content)
    if mode == "wifi":
        # 插入新的 SDK_CLIENT_IP 配置在 ROBOT_TYPE 之后
        if re.search(r"(export ROBOT_TYPE=\\w+)", content):
            content = re.sub(r"(export ROBOT_TYPE=\\w+)", r"\\1\\nexport SDK_CLIENT_IP='${robot.robot_ip}'", content)
        else:
            content = content + f"\\nexport SDK_CLIENT_IP='${robot.robot_ip}'\\n"
    # ap 模式则不插入
    return write_file(client, content, START_SCRIPT, "运控启动脚本")

def main():
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname=ROBOT_IP, username=USERNAME, password=PASSWORD, timeout=10)
        mode = detect_mode(client)
        if not mode:
            print("无法检测连接模式", file=sys.stderr)
            sys.exit(1)
        if not update_sdk_config(client):
            print("更新SDK配置失败", file=sys.stderr)
            sys.exit(1)
        if not update_start_script(client, mode):
            print("更新运控脚本失败", file=sys.stderr)
            sys.exit(1)
        client.close()
        print(f"[MODE:{mode}] 自动配置完成: 模式={mode}, target_ip={LOCAL_IP}, target_port={LOCAL_PORT}")
        sys.exit(0)
    except Exception as e:
        print(f"自动配置异常: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
  }

  /**
   * 生成重启运控脚本
   */
  private generateRestartMotionScript(ip: string, username: string, password: string): string {
    return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import subprocess

def ensure_package(pkg, import_name=None):
    if import_name is None:
        import_name = pkg
    try:
        __import__(import_name)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

ensure_package("paramiko")
import paramiko

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname="${ip}", username="${username}", password="${password}", timeout=10)
    cmd = "echo ${password} | sudo -S robot-launch restart 4"
    stdin, stdout, stderr = client.exec_command(cmd)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="ignore")
    err = stderr.read().decode("utf-8", errors="ignore")
    client.close()
    if code == 0:
        print("运控重启成功")
        sys.exit(0)
    else:
        print(err or "运控重启失败", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"异常: {e}", file=sys.stderr)
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
  execute(pythonFilePath: string, workingDirectory?: string): { executionId: string } {
    const cwd = workingDirectory || path.dirname(pythonFilePath);
    
    // 生成执行ID用于WebSocket推送
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const process = spawn(this.pythonPath, [pythonFilePath], {
      cwd: cwd,
    });
    
    // 将进程存储到Map中，以便可以停止执行
    this.processes.set(executionId, process);

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
      this.processes.delete(executionId);
      this.emit('complete', { executionId, code: code || 0 });
    });

    process.on('error', (error) => {
      this.processes.delete(executionId);
      this.emit('error', { executionId, error: error.message });
    });

    // 立即返回executionId，不等待进程完成
    return { executionId };
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
