import type { Request } from 'express';
import {
  处理控制器,
  返回原始响应,
  返回数据,
  返回消息,
} from '../../shared/http/controller';
import {
  Http错误工厂,
  type Http错误映射规则,
} from '../../shared/http/errors';
import type { 机器人服务 } from './service';

const 机器人未找到错误映射: Http错误映射规则[] = [
  { 匹配: '机器人不存在', 状态码: 404 },
];

const 机器人参数错误映射: Http错误映射规则[] = [
  ...机器人未找到错误映射,
  { 匹配: '缺少', 状态码: 400 },
  { 匹配: '必须', 状态码: 400 },
  { 匹配: '无法', 状态码: 400 },
];

const 机器人命令服务错误映射: Http错误映射规则[] = [
  ...机器人未找到错误映射,
  { 匹配: ['未连接', '未初始化'], 状态码: 503 },
  { 匹配: ['缺少', '必须指定'], 状态码: 400 },
];

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
  getAllRobots = 处理控制器(async () => 返回数据({
    robots: await this.机器人服务.获取所有机器人(),
  }));

  /**
   * 获取机器人分组
   */
  getGroups = 处理控制器(async () => 返回数据({
    groups: await this.机器人服务.获取分组(),
  }));

  /**
   * 获取指定机器人
   */
  getRobot = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid', 'robotId');
    const robot = await this.机器人服务.获取机器人(uuid);
    if (!robot) {
      throw Http错误工厂.未找到('机器人不存在');
    }
    return 返回数据(robot);
  });

  /**
   * 创建机器人
   */
  createRobot = 处理控制器(async (req: Request) => 返回数据(
    await this.机器人服务.创建机器人(req.body || {}),
  ), {
    错误映射: 机器人参数错误映射,
  });

  /**
   * 更新机器人
   */
  updateRobot = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const robot = await this.机器人服务.更新机器人(uuid, req.body || {});
    return 返回数据(robot);
  }, {
    错误映射: 机器人未找到错误映射,
  });

  /**
   * 删除机器人
   */
  deleteRobot = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    await this.机器人服务.删除机器人(uuid);
  });

  /**
   * 测试机器人连接
   */
  testConnection = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const result = await this.机器人服务.测试连接(uuid);
    return 返回原始响应({
      success: result.connected,
      connected: result.connected,
      message: result.message,
    });
  }, {
    错误映射: 机器人参数错误映射,
  });

  /**
   * 连接机器人
   */
  connectRobot = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const robot = await this.机器人服务.连接机器人(uuid);
    return 返回数据(robot, { 消息: '连接成功' });
  }, {
    错误映射: 机器人参数错误映射,
  });

  /**
   * 更新机器人固件（推送安装包）
   */
  updateFirmware = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const channel = (req.query.channel as string) || 'stable';
    const result = await this.机器人服务.更新固件(uuid, channel);
    return 返回数据(result, {
      消息: `安装包已成功推送到机器人，已下载: ${result.downloaded.join(', ')}`,
    });
  }, {
    错误映射: 机器人参数错误映射,
  });

  /**
   * 写入日志标记
   */
  markLog = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const { message = '' } = req.body || {};
    const result = await this.机器人服务.写入日志标记(uuid, String(message));
    return 返回原始响应({ success: true, ...result });
  }, {
    错误映射: 机器人命令服务错误映射,
  });

  /**
   * 获取机器人音量
   */
  getVolume = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const volumeInfo = await this.机器人服务.获取音量(uuid);
    return 返回数据(volumeInfo);
  }, {
    错误映射: 机器人参数错误映射,
  });

  /**
   * 设置机器人音量
   */
  setVolume = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const { volume } = req.body || {};

    if (typeof volume !== 'number') {
      throw Http错误工厂.参数错误('缺少音量参数');
    }

    await this.机器人服务.设置音量(uuid, volume);
    return 返回消息(`音量已设置为 ${volume}`);
  }, {
    错误映射: 机器人参数错误映射,
  });

  /**
   * 设置机器人静音
   */
  setMute = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const { mute } = req.body || {};

    if (typeof mute !== 'boolean') {
      throw Http错误工厂.参数错误('缺少静音参数');
    }

    await this.机器人服务.设置静音(uuid, mute);
    return 返回消息(mute ? '已静音' : '已取消静音');
  }, {
    错误映射: 机器人参数错误映射,
  });

  /**
   * 拍照
   */
  capturePhoto = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const result = await this.机器人服务.拍照(uuid);
    return 返回数据(result);
  }, {
    错误映射: 机器人命令服务错误映射,
  });

  /**
   * 获取机器人配置
   */
  getConfig = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const config = await this.机器人服务.获取配置(uuid);
    return 返回原始响应({ success: true, config });
  }, {
    错误映射: 机器人命令服务错误映射,
  });

  /**
   * 更新机器人配置
   */
  updateConfig = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const config = req.body;

    if (!config || typeof config !== 'object') {
      throw Http错误工厂.参数错误('缺少配置数据');
    }

    const result = await this.机器人服务.更新配置(uuid, config);
    return 返回原始响应({ success: true, ...result });
  }, {
    错误映射: 机器人命令服务错误映射,
  });

  /**
   * 获取机器人音频路由配置
   */
  getAudioRoute = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const data = await this.机器人服务.获取音频路由配置(uuid);
    return 返回数据(data);
  }, {
    错误映射: 机器人未找到错误映射,
  });

  /**
   * 更新机器人音频路由配置
   */
  updateAudioRoute = 处理控制器(async (req: Request) => {
    const uuid = this.获取参数(req, 'uuid');
    const config = req.body;
    if (!config || typeof config !== 'object') {
      throw Http错误工厂.参数错误('缺少配置数据');
    }
    const data = await this.机器人服务.更新音频路由配置(uuid, config);
    return 返回数据(data);
  }, {
    错误映射: 机器人命令服务错误映射,
  });
}


