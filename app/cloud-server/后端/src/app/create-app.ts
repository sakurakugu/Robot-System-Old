import cors from 'cors';
import express from 'express';
import { requireAuth, requireRole, withAuthContext } from '../features/account/middleware';
import { createAccountRoutes } from '../features/account/routes';
import { createKnowledgeRoutes } from '../features/knowledge/routes';
import { createFeedbackRoutes } from '../features/反馈/routes';
import { createConversationRoutes } from '../features/大模型交互/routes';
import { createLLMRoutes } from '../features/大模型管理/routes';
import { createUpdateRoutes } from '../features/更新管理/routes';
import { createRobotPackageRoutes } from '../features/机器人包管理/routes';
import { createRobotRoutes } from '../features/机器人管理/routes';
import { createSystemRoutes } from '../features/系统/routes';
import { createChoreoRoutes } from '../features/编舞系统/routes';
import { createRoleRoutes } from '../features/角色管理/routes';
import { createSettingsRoutes } from '../features/设置/routes';
import { logger } from '../infra/logger';
import { 发送Http错误 } from '../shared/http/controller';
import type { 应用上下文 } from './create-app-context';

async function 加载持久化配置(context: 应用上下文): Promise<void> {
  try {
    await context.服务.设置服务.loadPersistedAIConfig();
    await context.服务.大模型配置服务.loadPersistedConfig();

    const 活跃LLM = await context.服务.大模型配置服务.getActiveLLMConfig();
    logger.info('LLM 配置已加载', {
      provider: 活跃LLM.provider,
      model: 活跃LLM.model,
      hasApiKey: 活跃LLM.hasApiKey,
    });

    if (!活跃LLM.hasApiKey) {
      logger.warn('⚠️ 当前 LLM 供应商未配置 API Key，请访问前端设置页面进行配置');
    }
  } catch (error: any) {
    logger.error('加载持久化配置失败', error);
  }
}

export async function createApp(context: 应用上下文): Promise<express.Application> {
  const app = express();
  const 路由器 = express.Router();
  const 受保护路由器 = express.Router();

  await 加载持久化配置(context);

  app.use(cors());
  app.use(express.json());
  app.use(withAuthContext(context.服务.账号服务));

  app.use((请求, _响应, 下一步) => {
    logger.info(`${请求.method} ${请求.path}`, {
      ip: 请求.ip,
      query: 请求.query,
    });
    下一步();
  });

  受保护路由器.use(requireAuth);

  路由器.use('/auth', createAccountRoutes(context.控制器.账号控制器));
  路由器.use('/updates', createUpdateRoutes(context.控制器.更新控制器, {
    read: requireAuth,
    manage: requireRole('admin', 'super_admin'),
  }));
  路由器.use('/robot-packages', createRobotPackageRoutes(context.控制器.机器人包控制器, {
    read: requireAuth,
    manage: requireRole('admin', 'super_admin'),
  }));
  路由器.use('/', createSystemRoutes({
    获取在线机器人数量: () => context.WebSocket服务.getOnlineCount(),
    获取机器人总数: () => context.依赖.机器人仓库.countRobots(),
  }, {
    protectedRead: requireAuth,
  }));

  受保护路由器.use('/robots', createRobotRoutes(context.控制器.机器人控制器));
  受保护路由器.use('/conversations', createConversationRoutes(context.控制器.对话控制器));
  受保护路由器.use('/config', createLLMRoutes(context.控制器.大模型控制器, {
    updateLLM: requireRole('super_admin'),
  }));
  受保护路由器.use('/config', createSettingsRoutes(context.控制器.设置控制器, {
    updateAI: requireRole('super_admin'),
    updateUI: requireRole('admin', 'super_admin'),
  }));
  受保护路由器.use('/roles', createRoleRoutes(context.控制器.角色控制器));
  受保护路由器.use('/choreo', createChoreoRoutes(context.控制器.编舞控制器));
  受保护路由器.use('/knowledge', createKnowledgeRoutes(context.控制器.知识库控制器));
  受保护路由器.use('/feedback', createFeedbackRoutes(context.控制器.反馈控制器, {
    manage: requireRole('admin', 'super_admin'),
  }));
  路由器.use(受保护路由器);

  路由器.post('/robot/:robotId/command', requireAuth, context.控制器.对话控制器.sendCommand);

  app.use('/api/v1', 路由器);

  app.use((错误: any, _请求: express.Request, 响应: express.Response, _下一步: express.NextFunction) => {
    logger.error('未处理的错误', 错误);
    发送Http错误(响应, 错误);
  });

  return app;
}
