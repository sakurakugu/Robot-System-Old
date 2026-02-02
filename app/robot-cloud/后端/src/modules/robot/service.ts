import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';
import type DatabaseService from '../../core/database';
import type Logger from '../../core/logger';
import { formatTimestamp } from '../../core/utils/datetime';
import type { CreateRobotDto, RobotRecord, RobotResponse, UpdateRobotDto } from '../../types';

/**
 * 机器人服务
 */
export class RobotService {
  private pythonCommand: string = 'python'; // 默认使用 python

  constructor(
    private database: DatabaseService,
    private logger: Logger
  ) {
    // Windows 上通常是 python，Linux/Mac 上通常是 python3
    this.pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  }

  /**
   * 转换数据库记录为 API 响应格式
   */
  private toResponse(record: RobotRecord | undefined): RobotResponse | undefined {
    if (!record) return undefined;

    // 解析 tags JSON
    let tags: string[] = [];
    if (record.tags) {
      try {
        const parsed = JSON.parse(record.tags);
        tags = Array.isArray(parsed) ? parsed : [];
      } catch {
        tags = [];
      }
    }

    // 获取关联的角色
    let role = null;
    if (record.role_id) {
      role = this.database.getRole(record.role_id) || null;
    }

    return {
      ...record,
      tags,
      role,
    };
  }

  /**
   * 获取所有机器人
   */
  getAllRobots(): RobotResponse[] {
    return this.database.getAllRobots()
      .map(r => this.toResponse(r))
      .filter((r): r is RobotResponse => r !== undefined);
  }

  /**
   * 获取机器人详情
   */
  getRobot(uuid: string): RobotResponse | undefined {
    return this.toResponse(this.database.getRobot(uuid));
  }

  /**
   * 获取所有分组
   */
  getGroups(): string[] {
    return this.database.getAllGroups();
  }

  /**
   * 创建机器人
   */
  async createRobot(data: CreateRobotDto): Promise<RobotResponse> {
    const ip = data.ip || null;
    let uuid: string | null = null;

    // 如果提供了 IP，尝试 SSH 初始化
    if (ip) {
      const pythonScript = path.resolve(__dirname, '../../core/utils/ssh_helper.py');
      
      const canSsh = await this.testSSHConnection(pythonScript, ip);
      if (!canSsh) {
        throw new Error(`无法通过SSH连接到 ${ip}`);
      }

      // 读取或生成 UUID
      const remoteInitCmd = [
        'mkdir -p /home/firefly/sparkrobot/robot-agent',
        'mkdir -p /home/firefly/sparkrobot/config',
        'if [ -f /home/firefly/sparkrobot/config/config.toml ]; then grep "^uuid" /home/firefly/sparkrobot/config/config.toml | cut -d"=" -f2 | tr -d \' \"\' | xargs; fi',
      ].join(' && ');

      try {
        const remoteUuid = await this.executeSSHCommand(pythonScript, ip, remoteInitCmd);
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (remoteUuid && uuidPattern.test(remoteUuid)) {
          uuid = remoteUuid;
          this.logger.info(`从机器人读取到UUID: ${uuid}`);
        }
      } catch (e) {
        this.logger.warn('读取远程UUID失败，将生成新的');
      }

      if (!uuid) {
        uuid = uuidv7();
        this.logger.info(`生成新UUID: ${uuid}`);
        
        const configToml = `# 火花机器人配置文件\n# 生成于 ${formatTimestamp()}\n\nuuid = "${uuid}"\n`;
        await this.writeSSHFile(pythonScript, ip, '/home/firefly/sparkrobot/config/config.toml', configToml);
      }

      // 复制客户端代码
      const localClientPath = path.resolve(__dirname, '../../../../../robot-agent/robot-agent');
      const remoteClientPath = '/home/firefly/sparkrobot/robot-agent/robot-agent';
      const copyResult = await this.copyToRobot(pythonScript, ip, localClientPath, remoteClientPath);
      if (!copyResult.success) {
        throw new Error(`复制客户端代码失败: ${copyResult.error || '未知错误'}`);
      }

      this.logger.info(`机器人 ${ip} 初始化完成，UUID: ${uuid}`);
    }

    // 创建数据库记录
    const finalUuid = uuid || uuidv7();
    this.database.upsertRobot({
      uuid: finalUuid,
      name: data.name || null,
      model: data.model || null,
      ip: ip,
      group_name: data.group_name || null,
      sn: data.sn || null,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      status: 'offline',
      registered_at: new Date().toISOString(),
    });

    const result = this.getRobot(finalUuid);
    if (!result) {
      throw new Error('创建机器人失败');
    }
    return result;
  }

  /**
   * 更新机器人
   */
  updateRobot(uuid: string, data: UpdateRobotDto): RobotResponse {
    const existing = this.database.getRobot(uuid);
    if (!existing) {
      throw new Error('机器人不存在');
    }

    this.database.updateRobot(uuid, {
      name: data.name,
      model: data.model,
      ip: data.ip,
      group_name: data.group_name,
      sn: data.sn,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
      role_id: data.role_id,
    });

    const result = this.getRobot(uuid);
    if (!result) {
      throw new Error('更新机器人失败');
    }
    return result;
  }

  /**
   * 删除机器人
   */
  deleteRobot(uuid: string): void {
    this.database.deleteRobot(uuid);
  }

  /**
   * 测试连接
   */
  async testConnection(uuid: string): Promise<{ connected: boolean; message: string }> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!robot.ip) {
      throw new Error('缺少机器人IP');
    }

    // Ping 测试
    const pingOk = await new Promise<boolean>((resolve) => {
      const p = spawn('ping', ['-c', '1', '-W', '2', robot.ip!]);
      p.on('error', () => resolve(false));
      p.on('close', (code) => resolve(code === 0));
    });

    if (!pingOk) {
      return { connected: false, message: `网络不可达: ${robot.ip}` };
    }

    // SSH 端口测试
    const sshReachable = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: robot.ip!, port: 22 });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 3000);
      socket.on('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(false);
      });
    });

    if (sshReachable) {
      return { connected: true, message: `SSH端口可达: ${robot.ip}` };
    }

    return { connected: false, message: `SSH端口不可达: ${robot.ip}` };
  }

  /**
   * 通过 mDNS 发现机器人
   */
  async discoverRobots(timeout = 3): Promise<{
    success: boolean;
    robots: Array<{
      uuid: string;
      name: string;
      model: string;
      version: string;
      ip: string;
      port: number;
    }>;
    error?: string;
  }> {
    const pythonScript = path.resolve(__dirname, '../../core/scripts/mdns_discover.py');

    return new Promise((resolve) => {
      const p = spawn(this.pythonCommand, [pythonScript, timeout.toString()], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        p.kill();
        resolve({ success: false, robots: [], error: '扫描超时' });
      }, (timeout + 2) * 1000);

      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.stderr.on('data', (d) => { stderr += d.toString(); });

      p.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout) {
          try {
            const result = JSON.parse(stdout);
            resolve({ success: true, robots: result.robots || [] });
          } catch {
            resolve({ success: false, robots: [], error: '解析结果失败' });
          }
        } else {
          resolve({ success: false, robots: [], error: stderr || '发现失败' });
        }
      });
    });
  }

  // ==================== SSH 辅助方法 ====================

  private async testSSHConnection(pythonScript: string, ip: string): Promise<boolean> {
    return new Promise((resolve) => {
      const p = spawn(this.pythonCommand, [pythonScript, 'test', ip]);
      let stdout = '';
      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.on('error', () => resolve(false));
      p.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result.success && result.connected);
          } catch {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });
  }

  private async executeSSHCommand(pythonScript: string, ip: string, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const p = spawn(this.pythonCommand, [pythonScript, 'exec', ip, command]);
      let stdout = '';
      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.on('error', (e) => reject(e));
      p.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              resolve(result.output?.trim() || '');
            } else {
              reject(new Error(result.error || '远程命令执行失败'));
            }
          } catch {
            reject(new Error('解析输出失败'));
          }
        } else {
          reject(new Error('远程命令执行失败'));
        }
      });
    });
  }

  private async writeSSHFile(pythonScript: string, ip: string, remotePath: string, content: string): Promise<boolean> {
    return new Promise((resolve) => {
      const p = spawn(this.pythonCommand, [pythonScript, 'write', ip, remotePath, content]);
      let stdout = '';
      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.on('error', () => resolve(false));
      p.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout).success);
          } catch {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });
  }

  private async copyToRobot(pythonScript: string, ip: string, localPath: string, remotePath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const p = spawn(this.pythonCommand, [pythonScript, 'copy', ip, localPath, remotePath]);
      let stdout = '';
      let stderr = '';
      p.stdout.on('data', (d) => { stdout += d.toString(); });
      p.stderr.on('data', (d) => { stderr += d.toString(); });
      p.on('error', (err) => resolve({ success: false, error: err.message }));
      p.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ success: false, error: '解析输出失败' });
          }
        } else {
          resolve({ success: false, error: stderr || '复制失败' });
        }
      });
    });
  }

  /**
   * 连接机器人
   */
  async connectRobot(uuid: string): Promise<RobotResponse> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!robot.ip) {
      throw new Error('缺少机器人IP');
    }

    const pythonScript = path.resolve(__dirname, '../../core/utils/ssh_helper.py');
    const ok = await this.testSSHConnection(pythonScript, robot.ip);
    
    if (!ok) {
      throw new Error('连接失败');
    }

    this.database.updateRobot(uuid, { status: 'online' });
    const result = this.getRobot(uuid);
    if (!result) {
      throw new Error('更新状态失败');
    }
    return result;
  }

  /**
   * 更新固件
   */
  async updateFirmware(uuid: string): Promise<{ robotIp: string }> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!robot.ip) {
      throw new Error('缺少机器人IP地址');
    }

    const pythonScript = path.resolve(__dirname, '../../core/utils/ssh_helper.py');

    // 测试连接
    this.logger.info(`测试连接到 ${robot.ip}...`);
    const canConnect = await this.testSSHConnection(pythonScript, robot.ip);
    if (!canConnect) {
      throw new Error(`无法连接到机器人 ${robot.ip}`);
    }

    // 创建远程目录
    this.logger.info('创建远程目录...');
    const mkdirCmd = 'mkdir -p /home/firefly/sparkrobot/robot-agent && mkdir -p /home/firefly/sparkrobot/config';
    try {
      await this.executeSSHCommand(pythonScript, robot.ip, mkdirCmd);
    } catch {
      throw new Error('创建远程目录失败');
    }

    // 复制客户端代码
    this.logger.info('开始复制客户端代码...');
    const localClientPath = path.resolve(__dirname, '../../../../../robot-agent');
    const remoteClientPath = '/home/firefly/sparkrobot';
    const copyResult = await this.copyToRobot(pythonScript, robot.ip, localClientPath, remoteClientPath);
    
    if (!copyResult.success) {
      throw new Error(`复制客户端代码失败: ${copyResult.error || '未知错误'}`);
    }

    this.logger.info('固件更新成功');
    return { robotIp: robot.ip };
  }
}
