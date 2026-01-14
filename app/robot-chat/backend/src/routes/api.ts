import { Request, Response, Router } from 'express';
import os from 'os';
import DatabaseService from '../database';
import WebSocketService from '../websocket';
import { PostgresService } from '../database/postgres';

function createApiRoutes(
  database: DatabaseService,
  websocketService: WebSocketService,
  postgresService?: PostgresService
): Router {
  const router = Router();

  /**
   * 获取所有机器狗列表
   */
  router.get('/robots', (req: Request, res: Response) => {
    try {
      const handler = async () => {
        if (postgresService) {
          const list = await postgresService.getAllRobots();
          return list;
        }
        return database.getAllRobots();
      };
      const robots = websocketService ? undefined : undefined;
      Promise.resolve(handler())
        .then((list) => {
          res.json({
            success: true,
            data: {
              robots: list,
              onlineCount: websocketService.getOnlineCount(),
            },
          });
        })
        .catch((error: any) => {
          res.status(500).json({
            success: false,
            error: error.message,
          });
        });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 创建机器人
   */
  router.post('/robots', async (req: Request, res: Response) => {
    try {
      if (!postgresService) {
        return res.status(500).json({ success: false, error: 'Postgres 未配置' });
      }
      const { name, robot_ip, local_ip, local_port, group_name } = req.body || {};
      const robot = await postgresService.createRobot({
        name: name || null,
        robot_ip: robot_ip || null,
        local_ip: local_ip || null,
        local_port: local_port ?? null,
        group_name: group_name || null,
        status: 'offline',
        model: null,
        last_connected: null,
      });
      res.json({ success: true, data: robot });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 更新机器人
   */
  router.put('/robots/:uuid', async (req: Request, res: Response) => {
    try {
      if (!postgresService) {
        return res.status(500).json({ success: false, error: 'Postgres 未配置' });
      }
      const { uuid } = req.params;
      const updated = await postgresService.updateRobot(uuid, req.body || {});
      if (!updated) {
        return res.status(404).json({ success: false, error: '机器人不存在' });
      }
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 删除机器人
   */
  router.delete('/robots/:uuid', async (req: Request, res: Response) => {
    try {
      if (!postgresService) {
        return res.status(500).json({ success: false, error: 'Postgres 未配置' });
      }
      const { uuid } = req.params;
      await postgresService.deleteRobot(uuid);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 获取指定机器狗信息
   */
  router.get('/robots/:robotId', (req: Request, res: Response) => {
    try {
      const { robotId } = req.params;
      const handler = async () => {
        if (postgresService) {
          return await postgresService.getRobot(robotId);
        }
        return database.getRobot(robotId);
      };

      Promise.resolve(handler())
        .then((robot) => {
          if (!robot) {
            return res.status(404).json({
              success: false,
              error: '机器狗不存在',
            });
          }

          res.json({
            success: true,
            data: robot,
          });
        })
        .catch((error: any) => {
          res.status(500).json({
            success: false,
            error: error.message,
          });
        });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 获取对话历史
   */
  router.get('/conversations/:robotId', (req: Request, res: Response) => {
    try {
      const { robotId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const conversations = database.getConversationHistory(robotId, limit, offset);

      res.json({
        success: true,
        data: {
          conversations,
          limit,
          offset,
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
   * 获取系统状态
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const onlineRobots = websocketService.getOnlineCount();
      const allRobots = database.getAllRobots();

      res.json({
        success: true,
        data: {
          onlineRobots,
          totalRobots: allRobots.length,
          timestamp: new Date().toISOString(),
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
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
    });
  });

  /**
   * 获取本机IP
   */
  router.get('/network/local-ip', (req: Request, res: Response) => {
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

export default createApiRoutes;
