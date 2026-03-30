import type { Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import os from 'os';
import { 发送Http错误 } from '../../core/http/controller';
import { formatTimestamp } from '../../core/utils/datetime';

export interface 系统路由依赖 {
  获取在线机器人数量(): number;
  获取机器人总数(): Promise<number>;
}

export function createSystemRoutes(
  依赖: 系统路由依赖,
  guards?: { protectedRead?: RequestHandler }
): Router {
  const router = Router();

  /**
   * 获取系统状态
   */
  const 状态处理器 = async (_req: Request, res: Response) => {
    try {
      const onlineRobots = 依赖.获取在线机器人数量();
      const totalRobots = await 依赖.获取机器人总数();

      res.json({
        success: true,
        data: {
          onlineRobots,
          totalRobots,
          timestamp: formatTimestamp(),
        },
      });
    } catch (error: any) {
      发送Http错误(res, error);
    }
  };
  if (guards?.protectedRead) {
    router.get('/status', guards.protectedRead, 状态处理器);
  } else {
    router.get('/status', 状态处理器);
  }

  /**
   * 健康检查
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: formatTimestamp(),
      },
    });
  });

  /**
   * 获取本机IP
   */
  const 本机IP处理器 = (_req: Request, res: Response) => {
    try {
      const interfaces = os.networkInterfaces();
      const addresses: string[] = [];
      Object.keys(interfaces).forEach((ifname) => {
        interfaces[ifname]?.forEach((iface) => {
          if (iface.family !== 'IPv4' || iface.internal) return;
          addresses.push(iface.address);
        });
      });
      const ip = addresses[0] || '';
      res.json({ success: true, data: { ip, all: addresses } });
    } catch (error: any) {
      发送Http错误(res, error);
    }
  };
  if (guards?.protectedRead) {
    router.get('/network/local-ip', guards.protectedRead, 本机IP处理器);
  } else {
    router.get('/network/local-ip', 本机IP处理器);
  }

  return router;
}
