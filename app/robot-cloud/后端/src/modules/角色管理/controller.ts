import type { Request, Response } from 'express';
import type { 角色服务 } from './service';

/**
 * 角色控制器
 */
export class 角色控制器 {
  constructor(private 角色服务: 角色服务) {} // 构造函数

  private 获取参数(req: Request, key: string): string {
    const v = (req.params as Record<string, unknown>)[key];
    return Array.isArray(v) ? String(v[0]) : String(v ?? '');
  }

  /**
   * 获取所有角色
   */
  getAllRoles = async (_req: Request, res: Response) => {
    try {
      const roles = this.角色服务.getAllRoles();
      res.json({ success: true, data: roles });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取角色详情
   */
  getRole = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const role = this.角色服务.getRole(uuid);

      if (!role) {
        return res.status(404).json({ success: false, error: '角色不存在' });
      }

      res.json({ success: true, data: role });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 创建角色
   */
  createRole = async (req: Request, res: Response) => {
    try {
      const data = req.body;
      if (!data.name) {
        return res.status(400).json({ success: false, error: '角色名称不能为空' });
      }

      const role = this.角色服务.createRole(data);
      res.status(201).json({ success: true, data: role });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 更新角色
   */
  updateRole = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const role = this.角色服务.updateRole(uuid, req.body);
      res.json({ success: true, data: role });
    } catch (error: any) {
      const status = error.message === '角色不存在' ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 删除角色
   */
  deleteRole = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      this.角色服务.deleteRole(uuid);
      res.json({ success: true, message: '角色删除成功' });
    } catch (error: any) {
      let status = 500;
      if (error.message.includes('正在使用')) status = 400;
      if (error.message === '默认角色无法删除') status = 403;
      if (error.message === '角色不存在') status = 404;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取使用角色的机器人列表
   */
  getRobotsByRole = async (req: Request, res: Response) => {
    try {
      const uuid = this.获取参数(req, 'uuid');
      const robots = this.角色服务.getRobotsByRole(uuid);
      res.json({ success: true, data: robots });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}


