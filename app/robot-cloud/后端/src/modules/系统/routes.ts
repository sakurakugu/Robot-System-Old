import type { Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import os from 'os';
import type DatabaseService from '../../core/database';
import { formatTimestamp } from '../../core/utils/datetime';
import type WebSocketService from '../websocket/service';

export function createSystemRoutes(
  database: DatabaseService,
  websocketService: WebSocketService,
  guards?: { protectedRead?: RequestHandler }
): Router {
  const router = Router();

  /**
   * 获取系统状态
   */
  const 状态处理器 = (_req: Request, res: Response) => {
    try {
      const onlineRobots = websocketService.getOnlineCount();
      const allRobots = database.getAllRobots();

      res.json({
        success: true,
        data: {
          onlineRobots,
          totalRobots: allRobots.length,
          timestamp: formatTimestamp(),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
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
      res.status(500).json({ success: false, error: error.message });
    }
  };
  if (guards?.protectedRead) {
    router.get('/network/local-ip', guards.protectedRead, 本机IP处理器);
  } else {
    router.get('/network/local-ip', 本机IP处理器);
  }

  return router;
}
