import type { AccountService } from '../../features/account/service';
import type 对话服务 from '../../features/大模型交互/chat-service';
import type { ConversationRepository } from '../../features/大模型交互/repository';
import type { RobotRepository } from '../../features/机器人管理/repository';
import type { 机器人服务 } from '../../features/机器人管理/service';
import type { RobotRecord } from '../../features/机器人管理/types';
import type { RoleRepository } from '../../features/角色管理/repository';
import type { RoleRecord } from '../../features/角色管理/types';

export interface WebSocket运行依赖配置 {
  账号服务?: AccountService;
  机器人服务?: 机器人服务;
  对话服务?: 对话服务;
  对话仓库?: ConversationRepository;
  角色仓库?: RoleRepository;
  机器人仓库?: RobotRepository;
}

/**
 * 统一管理 WebSocket 运行时需要的 service / repository 依赖
 */
export class WebSocket运行依赖容器 {
  private 账号服务?: AccountService;
  private 对话服务?: 对话服务;
  private 对话仓库?: ConversationRepository;
  private 角色仓库?: RoleRepository;
  private 机器人仓库?: RobotRepository;
  private 机器人服务?: 机器人服务;

  配置依赖(依赖: WebSocket运行依赖配置): void {
    if (依赖.账号服务 !== undefined) {
      this.账号服务 = 依赖.账号服务;
    }
    if (依赖.机器人服务 !== undefined) {
      this.机器人服务 = 依赖.机器人服务;
    }
    if (依赖.对话服务 !== undefined) {
      this.对话服务 = 依赖.对话服务;
    }
    if (依赖.对话仓库 !== undefined) {
      this.对话仓库 = 依赖.对话仓库;
    }
    if (依赖.角色仓库 !== undefined) {
      this.角色仓库 = 依赖.角色仓库;
    }
    if (依赖.机器人仓库 !== undefined) {
      this.机器人仓库 = 依赖.机器人仓库;
    }
  }

  获取账号服务(): AccountService | undefined {
    return this.账号服务;
  }

  获取对话服务(): 对话服务 | undefined {
    return this.对话服务;
  }

  获取机器人服务(): 机器人服务 | undefined {
    return this.机器人服务;
  }

  获取机器人记录(robotId: string): Promise<RobotRecord | undefined> {
    return this.获取必需机器人仓库().getRobot(robotId);
  }

  async 更新机器人记录(robotId: string, data: Partial<RobotRecord>): Promise<void> {
    await this.获取必需机器人仓库().updateRobot(robotId, data);
  }

  async 新增或更新机器人记录(data: Partial<RobotRecord> & { uuid: string }): Promise<void> {
    await this.获取必需机器人仓库().upsertRobot(data);
  }

  获取角色记录(roleId: string): Promise<RoleRecord | undefined> {
    return this.获取必需角色仓库().getRole(roleId);
  }

  async 写入动作日志(data: Parameters<ConversationRepository['createActionLog']>[0]): Promise<void> {
    await this.获取必需对话仓库().createActionLog(data);
  }

  async 写入对话记录(data: Parameters<ConversationRepository['createConversation']>[0]): Promise<void> {
    await this.获取必需对话仓库().createConversation(data);
  }

  private 获取必需机器人仓库(): RobotRepository {
    if (!this.机器人仓库) {
      throw new Error('机器人仓库未初始化');
    }
    return this.机器人仓库;
  }

  private 获取必需角色仓库(): RoleRepository {
    if (!this.角色仓库) {
      throw new Error('角色仓库未初始化');
    }
    return this.角色仓库;
  }

  private 获取必需对话仓库(): ConversationRepository {
    if (!this.对话仓库) {
      throw new Error('对话仓库未初始化');
    }
    return this.对话仓库;
  }
}
