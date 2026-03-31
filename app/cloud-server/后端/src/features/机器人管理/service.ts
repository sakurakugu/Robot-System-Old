import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { v7 as uuidv7, validate as validUUID } from 'uuid';
import { logger } from '../../infra/logger';
import type {
  机器人命令服务接口,
  机器人安装包下载路径,
  机器人安装包哈希,
} from '../../infra/websocket/robot-command-gateway';
import { formatTimestamp } from '../../shared/utils/datetime';
import type { 机器人包服务 } from '../机器人包管理/service';
import type { RobotRepository } from './repository';
import type { CreateRobotDto, RobotRecord, RobotResponse, UpdateRobotDto, 音频路由配置 } from './types';

const 默认音频路由配置: 音频路由配置 = {
  mode: 'robot',
  targetPhoneDeviceId: null,
  fallback: 'robot',
  updatedAt: '',
};

export interface 机器人服务依赖 {
  机器人命令服务?: 机器人命令服务接口;
  机器人包服务?: 机器人包查询服务;
}

type 机器人包查询服务 = Pick<机器人包服务, 'getActive'>;

/**
 * 机器人服务
 */
export class 机器人服务 {
  private pythonCommand: string;
  private 机器人命令服务?: 机器人命令服务接口;
  private packageService?: 机器人包查询服务;

  constructor(private repository: RobotRepository, 依赖: 机器人服务依赖 = {}) {
    // Windows 上通常是 python，Linux/Mac 上通常是 python3
    this.pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    this.机器人命令服务 = 依赖.机器人命令服务;
    this.packageService = 依赖.机器人包服务;
  }

  /**
   * 转换数据库记录为 API 响应格式
   */
  private async 转换响应(record: RobotRecord | undefined): Promise<RobotResponse | undefined> {
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
    if (record.role_uuid) {
      role = await this.repository.getRoleById(record.role_uuid) || null;
    }

    return {
      ...record,
      tags,
      role,
    };
  }

  private 获取机器人记录(uuid: string): Promise<RobotRecord | undefined> {
    return this.repository.getRobot(uuid);
  }

  private 获取必需机器人命令服务(): 机器人命令服务接口 {
    if (!this.机器人命令服务) {
      throw new Error('机器人命令服务未初始化');
    }
    return this.机器人命令服务;
  }

  /**
   * 获取所有机器人
   */
  async 获取所有机器人(): Promise<RobotResponse[]> {
    const robots = await this.repository.listRobots();
    const result = await Promise.all(robots.map((robot) => this.转换响应(robot)));
    return result.filter((robot): robot is RobotResponse => robot !== undefined);
  }

  /**
   * 获取机器人详情
   */
  async 获取机器人(uuid: string): Promise<RobotResponse | undefined> {
    return this.转换响应(await this.获取机器人记录(uuid));
  }

  /**
   * 获取所有分组
   */
  获取分组(): Promise<string[]> {
    return this.repository.listGroups();
  }

  /**
   * 创建机器人
   */
  async 创建机器人(data: CreateRobotDto): Promise<RobotResponse> {
    const ip = data.ip || null;
    let uuid: string | null = null;

    // TODO: 目前这个改到了 云端，因此无法通过ssh连接机器狗了，需在手机端或其他端实现或者直接删除
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
        'if [ -f /home/firefly/sparkrobot/config/config.toml ]; then grep "^uuid" /home/firefly/sparkrobot/config/config.toml | cut -d"=" -f2 | tr -d \' \"\' | xargs; fi',
      ].join(' && ');

      try {
        const remoteUuid = await this.执行SSH命令(pythonScript, ip, remoteInitCmd);
        if (remoteUuid && validUUID(remoteUuid)) {
          uuid = remoteUuid;
          logger.info(`从机器人读取到UUID: ${uuid}`);
        }
      } catch {
        logger.warn('读取远程UUID失败，将生成新的');
      }

      if (!uuid) {
        uuid = uuidv7();
        logger.info(`生成新UUID: ${uuid}`);

        const configToml = `# 火花机器人配置文件\n# 生成于 ${formatTimestamp()}\n\nuuid = "${uuid}"\n`;
        await this.写入SSH文件(pythonScript, ip, '/home/firefly/sparkrobot/config/config.toml', configToml);
      }

      logger.info(`机器人 ${ip} 初始化完成，UUID: ${uuid}`);
    }

    // 创建数据库记录
    const finalUuid = uuid || uuidv7();
    await this.repository.upsertRobot({
      uuid: finalUuid,
      name: data.name || null,
      model: data.model || null,
      ip: ip,
      group_name: data.group_name || null,
      sn: data.sn || null,
      tags: data.tags ? JSON.stringify(data.tags) : null, // SQLite 不支持JSON数组，存为 JSON 字符串
      status: 'offline',
      registered_at: new Date().toISOString(),
    });

    const result = await this.获取机器人(finalUuid);
    if (!result) {
      throw new Error('创建机器人失败');
    }
    return result;
  }

  /**
   * 更新机器人
   */
  async 更新机器人(uuid: string, data: UpdateRobotDto): Promise<RobotResponse> {
    const existing = await this.获取机器人记录(uuid);
    if (!existing) {
      throw new Error('机器人不存在');
    }

    await this.repository.updateRobot(uuid, {
      name: data.name,
      model: data.model,
      ip: data.ip,
      group_name: data.group_name,
      sn: data.sn,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
      role_uuid: data.role_uuid,
    });

    const result = await this.获取机器人(uuid);
    if (!result) {
      throw new Error('更新机器人失败');
    }
    return result;
  }

  /**
   * 删除机器人
   */
  删除机器人(uuid: string): Promise<void> {
    return this.repository.deleteRobot(uuid);
  }

  /**
   * 测试连接
   */
  async 测试连接(uuid: string): Promise<{ connected: boolean; message: string }> {
    const robot = await this.获取机器人记录(uuid);
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

  /**
   * 连接机器人
   */
  async 连接机器人(uuid: string): Promise<RobotResponse> {
    const robot = await this.获取机器人记录(uuid);
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

    await this.repository.updateRobot(uuid, { status: 'online' });
    const result = await this.获取机器人(uuid);
    if (!result) {
      throw new Error('更新状态失败');
    }
    return result;
  }

  /**
   * 推送安装包到机器人：通过 WebSocket 通道告知机器人从云端 HTTP 下载安装包
   */
  async 更新固件(uuid: string, channel: string = 'stable'): Promise<{ downloaded: string[] }> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!this.packageService) {
      throw new Error('机器人包服务未初始化');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    const releaseChannel = channel as 'stable' | 'beta';
    const pkgInfo = await this.packageService.getActive(releaseChannel);
    if (!pkgInfo) {
      throw new Error(`没有可用的安装包（channel: ${channel}），请先在包管理页面上传安装包`);
    }

    // 构建各包的下载路径和哈希（机器人收到后自行拼接HTTP基础URL）
    const downloadPaths: 机器人安装包下载路径 = {};
    const hashes: 机器人安装包哈希 = {};

    if (pkgInfo.agent) {
      downloadPaths.agent = `/api/v1/robot-packages/download/agent?channel=${channel}`;
      hashes.agent = pkgInfo.agent.fileHash;
    }
    if (pkgInfo.server) {
      downloadPaths.server = `/api/v1/robot-packages/download/server?channel=${channel}`;
      hashes.server = pkgInfo.server.fileHash;
    }
    if (pkgInfo.common) {
      downloadPaths.common = `/api/v1/robot-packages/download/common?channel=${channel}`;
      hashes.common = pkgInfo.common.fileHash;
    }

    logger.info(`开始推送安装包到机器人 ${uuid}，包含: ${Object.keys(downloadPaths).join(', ')}`);

    const result = await 机器人命令服务.请求推送安装包(uuid, downloadPaths, hashes);
    if (!result.success) {
      throw new Error(result.error || '推送安装包失败');
    }

    logger.info(`安装包推送成功，已下载: ${(result.downloaded || []).join(', ')}`);
    return { downloaded: result.downloaded || [] };
  }

  async 写入日志标记(uuid: string, message: string): Promise<{ marker?: string }> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      const result = await 机器人命令服务.请求日志标记(uuid, message);
      if (!result.success) {
        throw new Error(result.error || '写入日志标记失败');
      }
      return { marker: result.marker };
    } catch (error: any) {
      throw new Error(`写入日志标记失败: ${error.message}`);
    }
  }

  /**
   * 获取机器人音量（通过WebSocket）
   */
  async 获取音量(uuid: string): Promise<{ volume: number; muted: boolean }> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送获取音量命令并等待响应
      const result = await 机器人命令服务.请求获取机器人音量(uuid);

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
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (volume < 0 || volume > 100) {
      throw new Error('音量值必须在 0-100 之间');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送设置音量命令并等待响应
      const result = await 机器人命令服务.请求设置机器人音量(uuid, volume);

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
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送设置静音命令并等待响应
      const result = await 机器人命令服务.请求设置机器人静音(uuid, mute);

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
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送拍照命令并等待响应
      const result = await 机器人命令服务.请求机器人拍照(uuid);

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
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送获取配置命令并等待响应
      const result = await 机器人命令服务.请求获取机器人配置(uuid);

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
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送更新配置命令并等待响应
      const result = await 机器人命令服务.请求更新机器人配置(uuid, config);

      if (!result.success) {
        throw new Error(result.error || '更新配置失败');
      }

      return result.data;
    } catch (error: any) {
      throw new Error(`更新配置失败: ${error.message}`);
    }
  }

  /**
   * 获取音频路由配置（数据库持久化）
   */
  async 获取音频路由配置(uuid: string): Promise<音频路由配置> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!robot.audio_route_config) {
      return { ...默认音频路由配置, updatedAt: robot.updated_at };
    }

    try {
      const parsed = JSON.parse(robot.audio_route_config) as Partial<音频路由配置>;
      return {
        mode: parsed.mode === 'phone' || parsed.mode === 'mute' ? parsed.mode : 'robot',
        targetPhoneDeviceId: typeof parsed.targetPhoneDeviceId === 'string' && parsed.targetPhoneDeviceId.trim()
          ? parsed.targetPhoneDeviceId.trim()
          : null,
        fallback: parsed.fallback === 'drop' ? 'drop' : 'robot',
        updatedAt: parsed.updatedAt || robot.updated_at,
      };
    } catch {
      return { ...默认音频路由配置, updatedAt: robot.updated_at };
    }
  }

  /**
   * 更新音频路由配置（数据库持久化）
   */
  async 更新音频路由配置(uuid: string, input: Partial<音频路由配置>): Promise<音频路由配置> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const current = await this.获取音频路由配置(uuid);
    const next: 音频路由配置 = {
      mode: input.mode === 'phone' || input.mode === 'mute' || input.mode === 'robot' ? input.mode : current.mode,
      targetPhoneDeviceId: input.targetPhoneDeviceId === null
        ? null
        : (typeof input.targetPhoneDeviceId === 'string' && input.targetPhoneDeviceId.trim()
          ? input.targetPhoneDeviceId.trim()
          : current.targetPhoneDeviceId),
      fallback: input.fallback === 'drop' || input.fallback === 'robot' ? input.fallback : current.fallback,
      updatedAt: new Date().toISOString(),
    };

    if (next.mode === 'phone' && !next.targetPhoneDeviceId) {
      throw new Error('phone 模式下必须指定 targetPhoneDeviceId');
    }

    await this.repository.updateRobot(uuid, {
      audio_route_config: JSON.stringify(next),
    });

    return next;
  }
}


