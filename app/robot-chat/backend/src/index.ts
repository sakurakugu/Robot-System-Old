import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import config from './config';
import DatabaseService from './database';
import createApiRoutes from './routes/api';
import LoggerService from './utils/logger';
import WebSocketService from './websocket';
import { PostgresService } from './database/postgres';

class Application {
  private app: express.Application;
  private server: any;
  private logger: LoggerService;
  private database: DatabaseService;
  private websocketService: WebSocketService;
  private postgresService?: PostgresService;

  constructor() {
    this.app = express();
    this.logger = new LoggerService();
    this.database = new DatabaseService();
    this.websocketService = new WebSocketService(this.logger, this.database);
    try {
      this.postgresService = config.database.type === 'postgresql' ? new PostgresService() : undefined;
    } catch {
      this.postgresService = undefined;
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(cors());

    // JSON解析
    this.app.use(express.json());

    // 请求日志
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // API路由
    this.app.use('/api', createApiRoutes(this.database, this.websocketService, this.postgresService));

    // 根路径
    this.app.get('/', (req, res) => {
      res.json({
        name: '机器狗对话管理系统',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          websocket: config.ws.path,
          api: '/api',
        },
      });
    });

    // 404处理
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: '接口不存在',
      });
    });

    // 错误处理
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('服务器错误', err);
      res.status(500).json({
        success: false,
        error: err.message || '服务器内部错误',
      });
    });
  }

  /**
   * 启动服务
   */
  async start(): Promise<void> {
    try {
      // 创建HTTP服务器
      this.server = createServer(this.app);

      // 初始化WebSocket服务
      this.websocketService.init(this.server, config.ws.path);

      // 启动服务器
      this.server.listen(config.port, () => {
        this.logger.info(`服务器已启动`, {
          port: config.port,
          env: config.nodeEnv,
          wsPath: config.ws.path,
        });

//         console.log(`
// ╔════════════════════════════════════════════════════╗
// ║   机器狗对话管理系统 - Robot Dog Conversation      ║
// ╠════════════════════════════════════════════════════╣
// ║   HTTP服务: http://localhost:${config.port}                 ║
// ║   WebSocket: ws://localhost:${config.port}${config.ws.path}   ║
// ║   环境: ${config.nodeEnv}                            ║
// ╚════════════════════════════════════════════════════╝
//         `);
      });

      // 优雅关闭
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
    } catch (error: any) {
      this.logger.error('启动失败', error);
      process.exit(1);
    }
  }

  /**
   * 关闭服务
   */
  private async shutdown(): Promise<void> {
    this.logger.info('正在关闭服务...');

    try {
      // 关闭WebSocket服务
      this.websocketService.close();

      // 关闭HTTP服务器
      if (this.server) {
        this.server.close();
      }

      // 关闭数据库连接
      this.database.close();

      this.logger.info('服务已关闭');
      process.exit(0);
    } catch (error: any) {
      this.logger.error('关闭服务时出错', error);
      process.exit(1);
    }
  }
}

// 启动应用
const app = new Application();
app.start().catch((error) => {
  console.error('应用启动失败:', error);
  process.exit(1);
});
