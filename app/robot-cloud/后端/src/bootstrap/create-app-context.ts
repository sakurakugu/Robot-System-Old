import { PostgreSQL数据库客户端 } from '../core/db/client';
import DatabaseService from '../core/database';
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
import { 大模型管理控制器 } from '../modules/大模型管理/controller';
import { 大模型配置服务 } from '../modules/大模型管理/service';
import { 更新控制器 } from '../modules/更新管理/controller';
import { 更新服务 } from '../modules/更新管理/service';
import { 机器人包控制器 } from '../modules/机器人包管理/controller';
import { 机器人包服务 } from '../modules/机器人包管理/service';
import { 机器人控制器 } from '../modules/机器人管理/controller';
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
  数据库: DatabaseService;
  异步数据库: PostgreSQL数据库客户端;
  WebSocket服务: WebSocketService;
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

export function createAppContext(): 应用上下文 {
  const 数据库 = new DatabaseService();
  const 异步数据库 = new PostgreSQL数据库客户端();
  const 设置仓库 = new PostgresSettingsRepository(异步数据库);

  数据库.resetAllRobotsStatusToOffline();

  const WebSocket服务 = new WebSocketService(数据库);

  const 服务 = {
    机器人服务: new 机器人服务(数据库),
    对话服务: new 对话服务(数据库),
    大模型配置服务: new 大模型配置服务(设置仓库),
    设置服务: new 设置服务(设置仓库),
    角色服务: new 角色服务(
      new PostgresRoleRepository(异步数据库),
    ),
    编舞服务: new ChoreoService(数据库),
    更新服务: new 更新服务(数据库),
    机器人包服务: new 机器人包服务(数据库),
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
    对话控制器: new 对话控制器(服务.对话服务, 数据库),
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

  return {
    数据库,
    异步数据库,
    WebSocket服务,
    服务,
    控制器,
  };
}
