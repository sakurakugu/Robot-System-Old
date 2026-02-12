import cors from 'cors';
import express from 'express';
import DatabaseService from './core/database';
import { logger } from './core/logger';
import WebSocketService from './modules/websocket/service';
import { 对话服务 } from './modules/大模型交互/chat-service';
import { 对话控制器 } from './modules/大模型交互/controller';
import { createConversationRoutes } from './modules/大模型交互/routes';
import { 大模型管理控制器 } from './modules/大模型管理/controller';
import { createLLMRoutes } from './modules/大模型管理/routes';
import { 大模型配置服务 } from './modules/大模型管理/service';
import { 机器人控制器 } from './modules/机器人管理/controller';
import { createRobotRoutes } from './modules/机器人管理/routes';
import { 机器人服务 } from './modules/机器人管理/service';
import { createSystemRoutes } from './modules/系统/routes';
import { ChoreoController } from './modules/编舞系统/controller';
import { createChoreoRoutes } from './modules/编舞系统/routes';
import { ChoreoService } from './modules/编舞系统/service';
import { 角色控制器 } from './modules/角色管理/controller';
import { createRoleRoutes } from './modules/角色管理/routes';
import { 角色服务 } from './modules/角色管理/service';
import { 设置控制器 } from './modules/设置/controller';
import { createSettingsRoutes } from './modules/设置/routes';
import { 设置服务 } from './modules/设置/service';

export class 应用程序 {
  public 应用: express.Application;
  public 数据库: DatabaseService;
  public WebSocket服务: WebSocketService;

  // 服务实例
  private 机器人服务: 机器人服务;
  private 对话服务: 对话服务;
  private 大模型配置服务: 大模型配置服务;
  private 设置服务: 设置服务;
  private 角色服务: 角色服务;
  private 编舞服务: ChoreoService;

  // 控制器实例
  private 机器人控制器: 机器人控制器;
  private 对话控制器: 对话控制器;
  private 大模型控制器: 大模型管理控制器;
  private 设置控制器: 设置控制器;
  private 角色控制器: 角色控制器;
  private 编舞控制器: ChoreoController;

  constructor() {
    this.应用 = express();
    this.数据库 = new DatabaseService();
    this.WebSocket服务 = new WebSocketService(this.数据库);

    // 初始化服务
    this.机器人服务 = new 机器人服务(this.数据库);
    this.对话服务 = new 对话服务(this.数据库);
    this.大模型配置服务 = new 大模型配置服务(this.数据库);
    this.设置服务 = new 设置服务(this.数据库);
    this.角色服务 = new 角色服务(this.数据库);
    this.编舞服务 = new ChoreoService(this.数据库);

    // 初始化控制器
    this.机器人控制器 = new 机器人控制器(this.机器人服务);
    this.对话控制器 = new 对话控制器(this.对话服务, this.数据库);
    this.大模型控制器 = new 大模型管理控制器(this.大模型配置服务);
    this.设置控制器 = new 设置控制器(this.设置服务);
    this.角色控制器 = new 角色控制器(this.角色服务);
    this.编舞控制器 = new ChoreoController(this.编舞服务);

    // 加载持久化配置
    this.加载持久化配置();
    this.设置中间件();
    this.设置路由();

    // 延迟注入 WebSocket 服务到编舞服务
    this.编舞服务.setWebSocketService(this.WebSocket服务);
    // 延迟注入 WebSocket 服务到机器人服务
    this.机器人服务.setWebSocketService(this.WebSocket服务);
    // 延迟注入机器人服务和对话服务到WebSocket服务
    this.WebSocket服务.set机器人服务(this.机器人服务);
    this.WebSocket服务.set对话服务(this.对话服务);
  }

  /**
   * 从数据库加载持久化配置
   */
  private 加载持久化配置(): void {
    try {
      this.大模型配置服务.loadPersistedConfig();

      const 活跃LLM = this.大模型配置服务.getActiveLLMConfig();
      logger.info(`LLM 配置已加载`, {
        provider: 活跃LLM.provider,
        model: 活跃LLM.model,
        hasApiKey: 活跃LLM.hasApiKey,
      });

      if (!活跃LLM.hasApiKey) {
        logger.warn('⚠️ 当前 LLM 供应商未配置 API Key，请访问前端设置页面进行配置');
      }
    } catch (e: any) {
      logger.error('加载持久化配置失败', e);
    }
  }

  /**
   * 设置中间件
   */
  private 设置中间件(): void {
    this.应用.use(cors());
    this.应用.use(express.json());

    // 请求日志
    this.应用.use((请求, 响应, 下一步) => {
      logger.info(`${请求.method} ${请求.path}`, {
        ip: 请求.ip,
        query: 请求.query,
      });
      下一步();
    });
  }

  /**
   * 设置路由
   */
  private 设置路由(): void {
    const 路由器 = express.Router();

    // 注册各模块路由
    路由器.use('/robots', createRobotRoutes(this.机器人控制器));
    路由器.use('/conversations', createConversationRoutes(this.对话控制器));
    路由器.use('/config', createLLMRoutes(this.大模型控制器));
    路由器.use('/config', createSettingsRoutes(this.设置控制器));
    路由器.use('/roles', createRoleRoutes(this.角色控制器));
    路由器.use('/choreo', createChoreoRoutes(this.编舞控制器));
    路由器.use('/', createSystemRoutes(this.数据库, this.WebSocket服务));

    // 兼容旧路由
    路由器.post('/robot/:robotId/command', (请求, 响应) => {
      this.对话控制器.sendCommand(请求, 响应);
    });

    // 挂载到 /api/v1 路径
    this.应用.use('/api/v1', 路由器);

    // 错误处理
    this.应用.use((错误: any, 请求: express.Request, 响应: express.Response, 下一步: express.NextFunction) => {
      logger.error('未处理的错误', 错误);
      响应.status(500).json({
        success: false,
        error: 错误.message || '服务器内部错误',
      });
    });
  }
}

