import { PostgreSQL数据库客户端 } from '../core/db/client';
import { 默认系统提示词 } from '../core/const';
import { logger } from '../core/logger';
import { AccountController } from '../modules/account/controller';
import { PostgresAccountRepository } from '../modules/account/repository';
import { AccountService } from '../modules/account/service';
import { KnowledgeController } from '../modules/knowledge/controller';
import { PostgresKnowledgeRepository } from '../modules/knowledge/repository';
import { KnowledgeService } from '../modules/knowledge/service';
import { 反馈控制器 } from '../modules/反馈/controller';
import { PostgresFeedbackRepository } from '../modules/反馈/repository';
import { 反馈服务 } from '../modules/反馈/service';
import WebSocketService from '../modules/websocket/service';
import { 对话服务 } from '../modules/大模型交互/chat-service';
import { 对话控制器 } from '../modules/大模型交互/controller';
import { PostgresConversationRepository } from '../modules/大模型交互/repository';
import { 大模型管理控制器 } from '../modules/大模型管理/controller';
import { 大模型配置服务 } from '../modules/大模型管理/service';
import { 更新控制器 } from '../modules/更新管理/controller';
import { PostgresAppVersionRepository } from '../modules/更新管理/repository';
import { 更新服务 } from '../modules/更新管理/service';
import { 机器人包控制器 } from '../modules/机器人包管理/controller';
import { PostgresRobotPackageRepository } from '../modules/机器人包管理/repository';
import { 机器人包服务 } from '../modules/机器人包管理/service';
import { 机器人控制器 } from '../modules/机器人管理/controller';
import { PostgresRobotRepository } from '../modules/机器人管理/repository';
import { 机器人服务 } from '../modules/机器人管理/service';
import { ChoreoController } from '../modules/编舞系统/controller';
import { ChoreoService } from '../modules/编舞系统/service';
import { 角色控制器 } from '../modules/角色管理/controller';
import { PostgresRoleRepository } from '../modules/角色管理/repository';
import { 角色服务 } from '../modules/角色管理/service';
import { 设置控制器 } from '../modules/设置/controller';
import { PostgresSettingsRepository } from '../modules/设置/repository';
import { 设置服务 } from '../modules/设置/service';

export interface 应用上下文 {
  异步数据库: PostgreSQL数据库客户端;
  WebSocket服务: WebSocketService;
  依赖: {
    机器人仓库: PostgresRobotRepository;
    角色仓库: PostgresRoleRepository;
    对话仓库: PostgresConversationRepository;
  };
  服务: {
    机器人服务: 机器人服务;
    对话服务: 对话服务;
    大模型配置服务: 大模型配置服务;
    设置服务: 设置服务;
    角色服务: 角色服务;
    编舞服务: ChoreoService;
    更新服务: 更新服务;
    机器人包服务: 机器人包服务;
    账号服务: AccountService;
    知识库服务: KnowledgeService;
    反馈服务: 反馈服务;
  };
  控制器: {
    机器人控制器: 机器人控制器;
    对话控制器: 对话控制器;
    大模型控制器: 大模型管理控制器;
    设置控制器: 设置控制器;
    角色控制器: 角色控制器;
    编舞控制器: ChoreoController;
    更新控制器: 更新控制器;
    机器人包控制器: 机器人包控制器;
    账号控制器: AccountController;
    知识库控制器: KnowledgeController;
    反馈控制器: 反馈控制器;
  };
}

async function 确保默认角色存在(角色仓库: PostgresRoleRepository): Promise<void> {
  const 默认角色 = await 角色仓库.getDefaultRole();
  if (默认角色) {
    if (默认角色.is_default !== 1) {
      await 角色仓库.updateRole(默认角色.uuid, { is_default: 1 });
      logger.info('已修正默认角色标记', { roleId: 默认角色.uuid });
    }
    return;
  }

  await 角色仓库.createRole({
    uuid: 'default-role',
    name: '默认角色',
    description: '系统默认的机器狗AI助手角色，无法删除和修改',
    temperature: 0.7,
    system_prompt: 默认系统提示词,
    asr_provider: 'aliyun',
    max_history: 10,
    is_default: 1,
  });

  logger.info('已创建默认角色');
}

export async function createAppContext(): Promise<应用上下文> {
  const 异步数据库 = new PostgreSQL数据库客户端();
  const 设置仓库 = new PostgresSettingsRepository(异步数据库);
  const 应用版本仓库 = new PostgresAppVersionRepository(异步数据库);
  const 机器人包仓库 = new PostgresRobotPackageRepository(异步数据库);
  const 机器人仓库 = new PostgresRobotRepository(异步数据库);
  const 对话仓库 = new PostgresConversationRepository(异步数据库);
  const 角色仓库 = new PostgresRoleRepository(异步数据库);

  await Promise.all([
    机器人仓库.resetAllRobotsStatusToOffline(),
    确保默认角色存在(角色仓库),
  ]);

  logger.info('已重置所有机器人状态为离线');

  const WebSocket服务 = new WebSocketService();

  const 服务 = {
    机器人服务: new 机器人服务(机器人仓库),
    对话服务: new 对话服务(对话仓库),
    大模型配置服务: new 大模型配置服务(设置仓库),
    设置服务: new 设置服务(设置仓库),
    角色服务: new 角色服务(角色仓库),
    编舞服务: new ChoreoService({
      机器人仓库,
    }),
    更新服务: new 更新服务(应用版本仓库),
    机器人包服务: new 机器人包服务(机器人包仓库),
    账号服务: new AccountService(
      new PostgresAccountRepository(异步数据库),
    ),
    知识库服务: new KnowledgeService(
      new PostgresKnowledgeRepository(异步数据库),
    ),
    反馈服务: new 反馈服务(
      new PostgresFeedbackRepository(异步数据库),
    ),
  };

  const 控制器 = {
    机器人控制器: new 机器人控制器(服务.机器人服务),
    对话控制器: new 对话控制器(服务.对话服务, 对话仓库),
    大模型控制器: new 大模型管理控制器(服务.大模型配置服务),
    设置控制器: new 设置控制器(服务.设置服务),
    角色控制器: new 角色控制器(服务.角色服务),
    编舞控制器: new ChoreoController(服务.编舞服务),
    更新控制器: new 更新控制器(服务.更新服务),
    机器人包控制器: new 机器人包控制器(服务.机器人包服务),
    账号控制器: new AccountController(服务.账号服务),
    知识库控制器: new KnowledgeController(服务.知识库服务),
    反馈控制器: new 反馈控制器(服务.反馈服务),
  };

  服务.编舞服务.setWebSocketService(WebSocket服务);
  服务.机器人服务.setWebSocketService(WebSocket服务);
  服务.机器人服务.set机器人包服务(服务.机器人包服务);
  WebSocket服务.set账号服务(服务.账号服务);
  WebSocket服务.set机器人服务(服务.机器人服务);
  WebSocket服务.set对话服务(服务.对话服务);
  WebSocket服务.set对话仓库(对话仓库);
  WebSocket服务.set角色仓库(角色仓库);
  WebSocket服务.set机器人仓库(机器人仓库);
  await 服务.编舞服务.初始化();

  return {
    异步数据库,
    WebSocket服务,
    依赖: {
      机器人仓库,
      角色仓库,
      对话仓库,
    },
    服务,
    控制器,
  };
}
