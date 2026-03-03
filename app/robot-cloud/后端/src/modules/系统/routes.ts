import type { Request, Response } from 'express';
import { Router } from 'express';
import os from 'os';
import type DatabaseService from '../../core/database';
import { formatTimestamp } from '../../core/utils/datetime';
import type WebSocketService from '../websocket/service';

export function createSystemRoutes(
  database: DatabaseService,
  websocketService: WebSocketService
): Router {
  const router = Router();

  /**
   * 获取系统状态
   */
  router.get('/status', (_req: Request, res: Response) => {
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
  });

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
  router.get('/network/local-ip', (_req: Request, res: Response) => {
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
  });

  return router;
}
