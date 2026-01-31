import type { Request, Response } from 'express';
import type { RobotService } from './service';

/**
 * 机器人控制器
 */
export class RobotController {
  constructor(private robotService: RobotService) {}

  private getParam(req: Request, ...keys: string[]): string {
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
      const robots = this.robotService.getAllRobots();
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
      const groups = this.robotService.getGroups();
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
      const uuid = this.getParam(req, 'uuid', 'robotId');
      const robot = this.robotService.getRobot(uuid);
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
      const robot = await this.robotService.createRobot(req.body || {});
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
      const uuid = this.getParam(req, 'uuid');
      const robot = this.robotService.updateRobot(uuid, req.body || {});
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
      const uuid = this.getParam(req, 'uuid');
      this.robotService.deleteRobot(uuid);
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
      const uuid = this.getParam(req, 'uuid');
      const result = await this.robotService.testConnection(uuid);
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
      const uuid = this.getParam(req, 'uuid');
      const robot = await this.robotService.connectRobot(uuid);
      res.json({ success: true, data: robot, message: '连接成功' });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('缺少') ? 400 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 更新机器人固件
   */
  updateFirmware = async (req: Request, res: Response) => {
    try {
      const uuid = this.getParam(req, 'uuid');
      const result = await this.robotService.updateFirmware(uuid);
      res.json({ 
        success: true, 
        message: '客户端代码已成功更新到机器人',
        data: result,
      });
    } catch (error: any) {
      const status = error.message === '机器人不存在' ? 404 : (error.message.includes('缺少') ? 400 : 500);
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 发现局域网内的机器人（mDNS）
   */
  discoverRobots = async (req: Request, res: Response) => {
    try {
      const timeout = Math.max(1, Math.min(10, parseFloat(req.query.timeout as string) || 3));
      const result = await this.robotService.discoverRobots(timeout);
      
      if (result.success) {
        res.json({
          success: true,
          data: { robots: result.robots, count: result.robots.length },
        });
      } else {
        res.status(500).json({ success: false, error: result.error || '发现失败' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}
