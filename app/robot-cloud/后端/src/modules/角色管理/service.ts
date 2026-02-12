import { v7 as uuidv7 } from 'uuid';
import type DatabaseService from '../../core/database';
import { logger } from '../../core/logger';
import type { CreateRoleDto, RoleRecord, UpdateRoleDto } from './types';

/**
 * 角色服务
 */
export class 角色服务 {
  constructor(private database: DatabaseService) {}

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
      asr_provider: data.asr_provider,
      asr_model: data.asr_model,
      intent_strategy: data.intent_strategy,
      max_history: data.max_history ?? 10,
    });

    if (!role) {
      throw new Error('创建角色失败');
    }

    logger.info(`角色创建成功: ${uuid}`, { name: data.name });
    return role;
  }

  /**
   * 更新角色
   */
  updateRole(uuid: string, data: UpdateRoleDto): RoleRecord {
    const 现存角色 = this.database.getRole(uuid);
    if (!现存角色) {
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
      asr_provider: data.asr_provider,
      asr_model: data.asr_model,
      intent_strategy: data.intent_strategy,
      max_history: data.max_history,
    });

    if (!role) {
      throw new Error('更新角色失败');
    }

    logger.info(`角色更新成功: ${uuid}`);
    return role;
  }

  /**
   * 删除角色
   */
  deleteRole(uuid: string): void {
    // 检查是否为默认角色
    const role = this.database.getRole(uuid);
    if (!role) {
      throw new Error('角色不存在');
    }
    if (role.is_default === 1) {
      throw new Error('默认角色无法删除');
    }

    // 检查是否有机器人正在使用该角色（不自动解绑）
    const robots = this.database.getRobotsByRole(uuid);
    if (robots.length > 0) {
      throw new Error(`有 ${robots.length} 个机器人正在使用此角色，无法删除`);
    }

    this.database.deleteRole(uuid);
    logger.info(`角色删除成功: ${uuid}`);
  }

  /**
   * 获取使用该角色的机器人列表
   */
  getRobotsByRole(roleId: string): Array<{ uuid: string; name: string | null }> {
    return this.database.getRobotsByRole(roleId);
  }
}

