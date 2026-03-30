import type { Request, Response } from 'express';
import type { 机器人服务 } from './service';

/**
 * 机器人控制器
 */
export class 机器人控制器 {
  constructor(private 机器人服务: 机器人服务) {}

  private 获取参数(req: Request, ...keys: string[]): string {
    for (const key of keys) {
      const v = (req.params as Record<string, unknown>)[key];
      if (v !== undefined) {
        return Array.isArray(v) ? String(v[0]) : String(v);
      }
    }
    return '';
  }

  /**
   * 获取所有机器人列表
   */
  getAllRobots = async (_req: Request, res: Response) => {
    try {
      const robots = await this.机器人服务.获取所有机器人();
      res.json({ success: true, data: { robots } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取机器人分组
   */
  getGroups = async (_req: Request, res: Response) => {
    try {
      const groups = await this.机器人服务.获取分组();
      res.json({ success: true, data: { groups } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取指定机器人
   */
  getRobot = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid', 'robotId');
      const robot = await this.机器人服务.获取机器人(uuid);
      if (!robot) {
        return res.status(404).json({ success: false, error: '机器人不存在' });
      }
      res.json({ success: true, data: robot });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 创建机器人
   */
  createRobot = async (req: Request, res: Response) => {
    try {
      const robot = await this.机器人服务.创建机器人(req.body || {});
      res.json({ success: true, data: robot });
    } catch (error: any) {
      const status = error.message.includes('无法') ? 400 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 更新机器人
   */
  updateRobot = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const robot = await this.机器人服务.更新机器人(uuid, req.body || {});
      res.json({ success: true, data: robot });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 删除机器人
   */
  deleteRobot = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      await this.机器人服务.删除机器人(uuid);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 测试机器人连接
   */
  testConnection = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const result = await this.机器人服务.测试连接(uuid);
      res.json({
        success: result.connected,
        connected: result.connected,
        message: result.message,
      });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('缺少') ? 400 : 500);
      res.status(status).json({ success: false, connected: false, error: error.message });
    }
  };

  /**
   * 连接机器人
   */
  connectRobot = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const robot = await this.机器人服务.连接机器人(uuid);
      res.json({ success: true, data: robot, message: '连接成功' });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('缺少') ? 400 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 更新机器人固件（推送安装包）
   */
  updateFirmware = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const channel = (req.query.channel as string) || 'stable';
      const result = await this.机器人服务.更新固件(uuid, channel);
      res.json({
        success: true,
        message: `安装包已成功推送到机器人，已下载: ${result.downloaded.join(', ')}`,
        data: result,
      });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('缺少') ? 400 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 写入日志标记
   */
  markLog = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const { message = '' } = req.body || {};
      const result = await this.机器人服务.写入日志标记(uuid, String(message));
      res.json({ success: true, ...result });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('未连接') || error.message.includes('未初始化') ? 503 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取机器人音量
   */
  getVolume = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const volumeInfo = await this.机器人服务.获取音量(uuid);
      res.json({ success: true, data: volumeInfo });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('缺少') ? 400 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 设置机器人音量
   */
  setVolume = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const { volume } = req.body || {};

      if (typeof volume !== 'number') {
        return res.status(400).json({ success: false, error: '缺少音量参数' });
      }

      await this.机器人服务.设置音量(uuid, volume);
      res.json({ success: true, message: `音量已设置为 ${volume}` });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('缺少') || error.message.includes('必须') ? 400 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 设置机器人静音
   */
  setMute = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const { mute } = req.body || {};

      if (typeof mute !== 'boolean') {
        return res.status(400).json({ success: false, error: '缺少静音参数' });
      }

      await this.机器人服务.设置静音(uuid, mute);
      res.json({ success: true, message: mute ? '已静音' : '已取消静音' });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('缺少') ? 400 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 拍照
   */
  capturePhoto = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const result = await this.机器人服务.拍照(uuid);
      res.json({ success: true, data: result });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('未连接') || error.message.includes('未初始化') ? 503 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取机器人配置
   */
  getConfig = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const config = await this.机器人服务.获取配置(uuid);
      res.json({ success: true, config });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('未连接') || error.message.includes('未初始化') ? 503 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 更新机器人配置
   */
  updateConfig = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const config = req.body;

      if (!config || typeof config !== 'object') {
        return res.status(400).json({ success: false, error: '缺少配置数据' });
      }

      const result = await this.机器人服务.更新配置(uuid, config);
      res.json({ success: true, ...result });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('未连接') || error.message.includes('未初始化') ? 503 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取机器人音频路由配置
   */
  getAudioRoute = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const data = await this.机器人服务.获取音频路由配置(uuid);
      res.json({ success: true, data });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 更新机器人音频路由配置
   */
  updateAudioRoute = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const config = req.body;
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ success: false, error: '缺少配置数据' });
      }
      const data = await this.机器人服务.更新音频路由配置(uuid, config);
      res.json({ success: true, data });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('必须指定') ? 400 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };
}


