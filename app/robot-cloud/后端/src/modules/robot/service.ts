import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';
import type DatabaseService from '../../core/database';
import { logger } from '../../core/logger';
import { formatTimestamp } from '../../core/utils/datetime';
import type { CreateRobotDto, RobotRecord, RobotResponse, UpdateRobotDto } from '../../types';
import type WebSocketService from '../websocket/service';

/**
 * 机器人服务
 */
export class 机器人服务 {
  private pythonCommand: string = 'python'; // 默认使用 python
  private websocketService?: WebSocketService;

  constructor(private database: DatabaseService) {
    // Windows 上通常是 python，Linux/Mac 上通常是 python3
    this.pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  }

  /**
   * 设置WebSocket服务（延迟注入，避免循环依赖）
   */
  setWebSocketService(service: WebSocketService): void {
    this.websocketService = service;
  }

  /**
   * 调用机器人 HTTP API
   */
  private async 调用机器人API(ip: string, path: string, options: {
    method?: string;
    body?: any;
  } = {}): Promise<any> {
    const method = options.method || 'GET';
    const url = `http://${ip}:8080${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: method !== 'GET' && options.body
          ? { 'Content-Type': 'application/json' }
          : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(5000), // 5秒超时
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`请求超时: ${url}`);
      }
      throw new Error(`API调用失败: ${error.message}`);
    }
  }

  /**
   * 转换数据库记录为 API 响应格式
   */
  private 转换响应(record: RobotRecord | undefined): RobotResponse | undefined {
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
  获取所有机器人(): RobotResponse[] {
    return this.database.getAllRobots()
      .map(r => this.转换响应(r))
      .filter((r): r is RobotResponse => r !== undefined);
  }

  /**
   * 获取机器人详情
   */
  获取机器人(uuid: string): RobotResponse | undefined {
    return this.转换响应(this.database.getRobot(uuid));
  }

  /**
   * 获取所有分组
   */
  获取分组(): string[] {
    return this.database.getAllGroups();
  }

  /**
   * 创建机器人
   */
  async 创建机器人(data: CreateRobotDto): Promise<RobotResponse> {
    const ip = data.ip || null;
    let uuid: string | null = null;

    // 如果提供了 IP，尝试 SSH 初始化
    if (ip) {
      const pythonScript = path.resolve(__dirname, '../../core/utils/ssh_helper.py');

      const canSsh = await this.测试SSH连接(pythonScript, ip);
      if (!canSsh) {
        throw new Error(`无法通过SSH连接到 ${ip}`);
      }

      // 读取或生成 UUID
      const remoteInitCmd = [
        'mkdir -p /home/firefly/sparkrobot/robot-agent',
        'mkdir -p /home/firefly/sparkrobot/config',
        'if [ -f /home/firefly/sparkrobot/config/配置.toml ]; then grep "^uuid" /home/firefly/sparkrobot/config/配置.toml | cut -d"=" -f2 | tr -d \' \"\' | xargs; fi',
      ].join(' && ');

      try {
        const remoteUuid = await this.执行SSH命令(pythonScript, ip, remoteInitCmd);
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (remoteUuid && uuidPattern.test(remoteUuid)) {
          uuid = remoteUuid;
          logger.info(`从机器人读取到UUID: ${uuid}`);
        }
      } catch (e) {
        logger.warn('读取远程UUID失败，将生成新的');
      }

      if (!uuid) {
        uuid = uuidv7();
        logger.info(`生成新UUID: ${uuid}`);

        const configToml = `# 火花机器人配置文件\n# 生成于 ${formatTimestamp()}\n\nuuid = "${uuid}"\n`;
        await this.写入SSH文件(pythonScript, ip, '/home/firefly/sparkrobot/config/配置.toml', configToml);
      }

      // 复制客户端代码
      const localClientPath = path.resolve(__dirname, '../../../../../robot-agent/robot-agent');
      const remoteClientPath = '/home/firefly/sparkrobot/robot-agent/robot-agent';
      const copyResult = await this.复制到机器人(pythonScript, ip, localClientPath, remoteClientPath);
      if (!copyResult.success) {
        throw new Error(`复制客户端代码失败: ${copyResult.error || '未知错误'}`);
      }

      logger.info(`机器人 ${ip} 初始化完成，UUID: ${uuid}`);
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

    const result = this.获取机器人(finalUuid);
    if (!result) {
      throw new Error('创建机器人失败');
    }
    return result;
  }

  /**
   * 更新机器人
   */
  更新机器人(uuid: string, data: UpdateRobotDto): RobotResponse {
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

    const result = this.获取机器人(uuid);
    if (!result) {
      throw new Error('更新机器人失败');
    }
    return result;
  }

  /**
   * 删除机器人
   */
  删除机器人(uuid: string): void {
    this.database.deleteRobot(uuid);
  }

  /**
   * 测试连接
   */
  async 测试连接(uuid: string): Promise<{ connected: boolean; message: string }> {
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
  async 发现机器人(timeout = 3): Promise<{
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

  private async 测试SSH连接(pythonScript: string, ip: string): Promise<boolean> {
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

  private async 执行SSH命令(pythonScript: string, ip: string, command: string): Promise<string> {
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

  private async 写入SSH文件(pythonScript: string, ip: string, remotePath: string, content: string): Promise<boolean> {
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

  private async 复制到机器人(pythonScript: string, ip: string, localPath: string, remotePath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const p = spawn(this.pythonCommand, [pythonScript, 'copy', ip, localPath, remotePath]);
      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // 设置 2 分钟超时
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          p.kill();
          logger.error(`复制超时 (${ip}): ${stderr}`);
          resolve({ success: false, error: '复制超时（2分钟）' });
        }
      }, 120000);

      p.stdout.on('data', (d) => {
        const data = d.toString();
        stdout += data;
        // 实时输出进度日志
        if (data.includes('[INFO]') || data.includes('[SUCCESS]') || data.includes('[ERROR]')) {
          logger.debug(data.trim());
        }
      });

      p.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      p.on('error', (err) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          resolve({ success: false, error: err.message });
        }
      });

      p.on('close', (code) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          if (code === 0) {
            try {
              resolve(JSON.parse(stdout));
            } catch {
              resolve({ success: false, error: '解析输出失败' });
            }
          } else {
            logger.error(`复制失败 (${ip}, code=${code}): ${stderr}`);
            resolve({ success: false, error: stderr || '复制失败' });
          }
        }
      });
    });
  }

  /**
   * 连接机器人
   */
  async 连接机器人(uuid: string): Promise<RobotResponse> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!robot.ip) {
      throw new Error('缺少机器人IP');
    }

    const pythonScript = path.resolve(__dirname, '../../core/utils/ssh_helper.py');
    const ok = await this.测试SSH连接(pythonScript, robot.ip);

    if (!ok) {
      throw new Error('连接失败');
    }

    this.database.updateRobot(uuid, { status: 'online' });
    const result = this.获取机器人(uuid);
    if (!result) {
      throw new Error('更新状态失败');
    }
    return result;
  }

  /**
   * 更新固件
   */
  async 更新固件(uuid: string): Promise<{ robotIp: string }> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!robot.ip) {
      throw new Error('缺少机器人IP地址');
    }

    const pythonScript = path.resolve(__dirname, '../../core/utils/ssh_helper.py');

    // 测试连接
    logger.info(`测试连接到 ${robot.ip}...`);
    const canConnect = await this.测试SSH连接(pythonScript, robot.ip);
    if (!canConnect) {
      throw new Error(`无法连接到机器人 ${robot.ip}`);
    }

    // 创建远程目录
    logger.info('创建远程目录...');
    const mkdirCmd = 'mkdir -p /home/firefly/sparkrobot/robot-agent && mkdir -p /home/firefly/sparkrobot/config';
    try {
      await this.执行SSH命令(pythonScript, robot.ip, mkdirCmd);
    } catch {
      throw new Error('创建远程目录失败');
    }

    // 复制客户端代码
    logger.info('开始复制客户端代码...');
    const localClientPath = path.resolve(__dirname, '../../../../../robot-agent');
    const remoteClientPath = '/home/firefly/sparkrobot';
    const copyResult = await this.复制到机器人(pythonScript, robot.ip, localClientPath, remoteClientPath);

    if (!copyResult.success) {
      throw new Error(`复制客户端代码失败: ${copyResult.error || '未知错误'}`);
    }

    logger.info('固件更新成功');
    return { robotIp: robot.ip };
  }

  /**
   * 获取机器人音量（通过WebSocket）
   */
  async 获取音量(uuid: string): Promise<{ volume: number; muted: boolean }> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!this.websocketService) {
      throw new Error('WebSocket服务未初始化');
    }

    try {
      // 通过WebSocket发送获取音量命令并等待响应
      const result = await this.websocketService.请求获取机器人音量(uuid);

      if (!result.success || !result.data) {
        throw new Error(result.error || '获取音量失败');
      }

      return result.data;
    } catch (error: any) {
      throw new Error(`获取音量失败: ${error.message}`);
    }
  }

  /**
   * 设置机器人音量（通过WebSocket）
   */
  async 设置音量(uuid: string, volume: number): Promise<void> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!this.websocketService) {
      throw new Error('WebSocket服务未初始化');
    }

    if (volume < 0 || volume > 100) {
      throw new Error('音量值必须在 0-100 之间');
    }

    try {
      // 通过WebSocket发送设置音量命令并等待响应
      const result = await this.websocketService.请求设置机器人音量(uuid, volume);

      if (!result.success) {
        throw new Error(result.error || '设置音量失败');
      }
    } catch (error: any) {
      throw new Error(`设置音量失败: ${error.message}`);
    }
  }

  /**
   * 设置机器人静音（通过WebSocket）
   */
  async 设置静音(uuid: string, mute: boolean): Promise<void> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!this.websocketService) {
      throw new Error('WebSocket服务未初始化');
    }

    try {
      // 通过WebSocket发送设置静音命令并等待响应
      const result = await this.websocketService.请求设置机器人静音(uuid, mute);

      if (!result.success) {
        throw new Error(result.error || '设置静音失败');
      }
    } catch (error: any) {
      throw new Error(`设置静音失败: ${error.message}`);
    }
  }

  /**
   * 拍照并获取base64图片（通过WebSocket）
   */
  async 拍照(uuid: string): Promise<{ image: string; format: string }> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!this.websocketService) {
      throw new Error('WebSocket服务未初始化');
    }

    try {
      // 通过WebSocket发送拍照命令并等待响应
      const result = await this.websocketService.请求机器人拍照(uuid);

      if (!result.success || !result.image) {
        throw new Error(result.error || '拍照失败');
      }

      return {
        image: result.image,
        format: result.format || 'jpeg',
      };
    } catch (error: any) {
      throw new Error(`拍照失败: ${error.message}`);
    }
  }

  /**
   * 获取机器人配置（通过WebSocket）
   */
  async 获取配置(uuid: string): Promise<any> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!this.websocketService) {
      throw new Error('WebSocket服务未初始化');
    }

    try {
      // 通过WebSocket发送获取配置命令并等待响应
      const result = await this.websocketService.请求获取机器人配置(uuid);

      if (!result.success || !result.data) {
        throw new Error(result.error || '获取配置失败');
      }

      return result.data;
    } catch (error: any) {
      throw new Error(`获取配置失败: ${error.message}`);
    }
  }

  /**
   * 更新机器人配置（通过WebSocket）
   */
  async 更新配置(uuid: string, config: any): Promise<any> {
    const robot = this.database.getRobot(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!this.websocketService) {
      throw new Error('WebSocket服务未初始化');
    }

    try {
      // 通过WebSocket发送更新配置命令并等待响应
      const result = await this.websocketService.请求更新机器人配置(uuid, config);

      if (!result.success) {
        throw new Error(result.error || '更新配置失败');
      }

      return result.data;
    } catch (error: any) {
      throw new Error(`更新配置失败: ${error.message}`);
    }
  }
}

export { 机器人服务 as RobotService };

