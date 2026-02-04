import cors from 'cors';
import express from 'express';
import DatabaseService from './core/database';
import Logger from './core/logger';
import { ChoreoController } from './modules/choreo/controller';
import { createChoreoRoutes } from './modules/choreo/routes';
import { ChoreoService } from './modules/choreo/service';
import { RobotController } from './modules/robot/controller';
import { createRobotRoutes } from './modules/robot/routes';
import { RobotService } from './modules/robot/service';
import { RoleController } from './modules/role/controller';
import { createRoleRoutes } from './modules/role/routes';
import { RoleService } from './modules/role/service';
import { SettingsController } from './modules/settings/controller';
import { createSettingsRoutes } from './modules/settings/routes';
import { SettingsService } from './modules/settings/service';
import { createSystemRoutes } from './modules/system/routes';
import WebSocketService from './modules/websocket/service';
import { ConversationController } from './modules/机器人交互/controller';
import { createConversationRoutes } from './modules/机器人交互/routes';
import { ConversationService } from './modules/机器人交互/service';

export class Application {
  public app: express.Application;
  public logger: Logger;
  public database: DatabaseService;
  public websocketService: WebSocketService;

  // 服务实例
  private robotService: RobotService;
  private conversationService: ConversationService;
  private settingsService: SettingsService;
  private roleService: RoleService;
  private choreoService: ChoreoService;

  // 控制器实例
  private robotController: RobotController;
  private conversationController: ConversationController;
  private settingsController: SettingsController;
  private roleController: RoleController;
  private choreoController: ChoreoController;

  constructor() {
    this.app = express();
    this.logger = new Logger();
    this.database = new DatabaseService();
    this.websocketService = new WebSocketService(this.logger, this.database);

    // 初始化服务
    this.robotService = new RobotService(this.database, this.logger);
    this.conversationService = new ConversationService(this.database);
    this.settingsService = new SettingsService(this.database);
    this.roleService = new RoleService(this.database, this.logger);
    this.choreoService = new ChoreoService(this.database, this.logger);

    // 初始化控制器
    this.robotController = new RobotController(this.robotService);
    this.conversationController = new ConversationController(this.conversationService, this.database);
    this.settingsController = new SettingsController(this.settingsService);
    this.roleController = new RoleController(this.roleService);
    this.choreoController = new ChoreoController(this.choreoService);

    // 加载持久化配置
    this.loadPersistedConfig();
    this.setupMiddleware();
    this.setupRoutes();

    // 延迟注入 WebSocket 服务到编舞服务
    this.choreoService.setWebSocketService(this.websocketService);
    // 延迟注入 WebSocket 服务到机器人服务
    this.robotService.setWebSocketService(this.websocketService);
  }

  /**
   * 从数据库加载持久化配置
   */
  private loadPersistedConfig(): void {
    try {
      this.settingsService.loadPersistedConfig();
      
      const activeLLM = this.settingsService.getActiveLLMConfig();
      this.logger.info(`LLM 配置已加载`, {
        provider: activeLLM.provider,
        model: activeLLM.model,
        hasApiKey: !!activeLLM.apiKey,
      });

      if (!activeLLM.apiKey) {
        this.logger.warn('⚠️ 当前 LLM 供应商未配置 API Key，请访问前端设置页面进行配置');
      }
    } catch (e: any) {
      this.logger.error('加载持久化配置失败', e);
    }
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // 请求日志
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        query: req.query,
      });
      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    const router = express.Router();

    // 注册各模块路由
    router.use('/robots', createRobotRoutes(this.robotController));
    router.use('/conversations', createConversationRoutes(this.conversationController));
    router.use('/config', createSettingsRoutes(this.settingsController));
    router.use('/roles', createRoleRoutes(this.roleController));
    router.use('/choreo', createChoreoRoutes(this.choreoController));
    router.use('/', createSystemRoutes(this.database, this.websocketService));

    // 兼容旧路由
    router.post('/robot/:robotId/command', (req, res) => {
      this.conversationController.sendCommand(req, res);
    });

    // 挂载到 /api/v1 路径
    this.app.use('/api/v1', router);

    // 错误处理
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('未处理的错误', err);
      res.status(500).json({
        success: false,
        error: err.message || '服务器内部错误',
      });
    });
  }
}
