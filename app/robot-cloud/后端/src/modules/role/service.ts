import { v7 as uuidv7 } from 'uuid';
import type DatabaseService from '../../core/database';
import type Logger from '../../core/logger';
import type { CreateRoleDto, RoleRecord, UpdateRoleDto } from '../../types';

/**
 * 角色服务
 */
export class RoleService {
  constructor(
    private database: DatabaseService,
    private logger: Logger
  ) {}

  /**
   * 获取所有角色
   */
  getAllRoles(): RoleRecord[] {
    return this.database.getAllRoles();
  }

  /**
   * 获取角色详情
   */
  getRole(uuid: string): RoleRecord | undefined {
    return this.database.getRole(uuid);
  }

  /**
   * 创建角色
   */
  createRole(data: CreateRoleDto): RoleRecord {
    const uuid = uuidv7();
    
    const role = this.database.createRole({
      uuid,
      name: data.name,
      description: data.description,
      llm_provider: data.llm_provider,
      llm_model: data.llm_model,
      temperature: data.temperature ?? 0.7,
      system_prompt: data.system_prompt,
      voice: data.voice,
      intent_strategy: data.intent_strategy,
      max_history: data.max_history ?? 10,
    });
    
    if (!role) {
      throw new Error('创建角色失败');
    }
    
    this.logger.info(`角色创建成功: ${uuid}`, { name: data.name });
    return role;
  }

  /**
   * 更新角色
   */
  updateRole(uuid: string, data: UpdateRoleDto): RoleRecord {
    const existing = this.database.getRole(uuid);
    if (!existing) {
      throw new Error('角色不存在');
    }

    const role = this.database.updateRole(uuid, {
      name: data.name,
      description: data.description,
      llm_provider: data.llm_provider,
      llm_model: data.llm_model,
      temperature: data.temperature,
      system_prompt: data.system_prompt,
      voice: data.voice,
      intent_strategy: data.intent_strategy,
      max_history: data.max_history,
    });

    if (!role) {
      throw new Error('更新角色失败');
    }

    this.logger.info(`角色更新成功: ${uuid}`);
    return role;
  }

  /**
   * 删除角色
   */
  deleteRole(uuid: string): void {
    // 检查是否有机器人正在使用该角色
    const robots = this.database.getRobotsByRole(uuid);
    if (robots.length > 0) {
      throw new Error(`有 ${robots.length} 个机器人正在使用此角色，无法删除`);
    }

    this.database.deleteRole(uuid);
    this.logger.info(`角色删除成功: ${uuid}`);
  }

  /**
   * 获取使用该角色的机器人列表
   */
  getRobotsByRole(roleId: string): Array<{ uuid: string; name: string | null }> {
    return this.database.getRobotsByRole(roleId);
  }
}
