import type { Request } from 'express';
import { 处理控制器, 返回数据, 返回消息 } from '../../core/http/controller';
import type { Http错误映射规则 } from '../../core/http/errors';
import { Http错误工厂 } from '../../core/http/errors';
import type { 角色服务 } from './service';

const 角色写入错误映射: Http错误映射规则[] = [
  { 匹配: '角色不存在', 状态码: 404 },
  { 匹配: '默认角色无法删除', 状态码: 403 },
  { 匹配: '正在使用', 状态码: 400 },
];

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
  getAllRoles = 处理控制器(async () => 返回数据(await this.角色服务.getAllRoles()));

  /**
   * 获取角色详情
   */
  getRole = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const role = await this.角色服务.getRole(uuid);

    if (!role) {
      throw Http错误工厂.未找到('角色不存在');
    }

    return 返回数据(role);
  });

  /**
   * 创建角色
   */
  createRole = 处理控制器(async (req: Request) => {
    const data = req.body;
    if (!data.name) {
      throw Http错误工厂.参数错误('角色名称不能为空');
    }

    const role = await this.角色服务.createRole(data);
    return 返回数据(role, { 状态码: 201 });
  }, {
    默认错误状态码: 500,
  });

  /**
   * 更新角色
   */
  updateRole = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const role = await this.角色服务.updateRole(uuid, req.body);
    return 返回数据(role);
  }, {
    错误映射: 角色写入错误映射,
  });

  /**
   * 删除角色
   */
  deleteRole = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    await this.角色服务.deleteRole(uuid);
    return 返回消息('角色删除成功');
  }, {
    错误映射: 角色写入错误映射,
  });

  /**
   * 获取使用角色的机器人列表
   */
  getRobotsByRole = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const robots = await this.角色服务.getRobotsByRole(uuid);
    return 返回数据(robots);
  });
}


