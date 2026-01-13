import { Request, Response, Router } from 'express';
import DatabaseService from '../database';
import WebSocketService from '../websocket';

function createApiRoutes(
  database: DatabaseService,
  websocketService: WebSocketService
): Router {
  const router = Router();

  /**
   * 获取所有机器狗列表
   */
  router.get('/robots', (req: Request, res: Response) => {
    try {
      const robots = database.getAllRobots();
      res.json({
        success: true,
        data: {
          robots,
          onlineCount: websocketService.getOnlineCount(),
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
   * 获取指定机器狗信息
   */
  router.get('/robots/:robotId', (req: Request, res: Response) => {
    try {
      const { robotId } = req.params;
      const robot = database.getRobot(robotId);

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

  return router;
}

export default createApiRoutes;