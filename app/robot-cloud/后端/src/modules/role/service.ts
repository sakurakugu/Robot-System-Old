import { v4 as uuidv4 } from 'uuid';
import 数据库服务 from '../../core/database';
import 日志服务 from '../../core/logger';
import { CreateRoleDto, RoleRecord, UpdateRoleDto } from './types';

export class RoleService {
  constructor(
    private database: 数据库服务,
    private logger: 日志服务
  ) {}

  /**
   * 创建角色
   */
  create_角色(data: CreateRoleDto): RoleRecord {
    try {
      const uuid = uuidv4();
      const role = this.database.create_角色({
        uuid,
        name: data.name,
        description: data.description,
        llm_provider: data.llm_provider,
        llm_model: data.llm_model,
        temperature: data.temperature,
        system_prompt: data.system_prompt,
        voice: data.voice,
        intent_strategy: data.intent_strategy,
        max_history: data.max_history
      });
      
      this.logger.info(`角色创建成功: ${uuid}`, { name: data.name });
      return role;
    } catch (error: any) {
      this.logger.error('创建角色失败', error);
      throw new Error(`创建角色失败: ${error.message}`);
    }
  }

  /**
   * 获取所有角色
   */
  get_所有角色(): RoleRecord[] {
    try {
      return this.database.get_所有角色();
    } catch (error: any) {
      this.logger.error('获取角色列表失败', error);
      throw new Error(`获取角色列表失败: ${error.message}`);
    }
  }

  /**
   * 获取角色详情
   */
  get_角色(uuid: string): RoleRecord | undefined {
    try {
      return this.database.get_角色(uuid);
    } catch (error: any) {
      this.logger.error(`获取角色详情失败: ${uuid}`, error);
      throw new Error(`获取角色详情失败: ${error.message}`);
    }
  }

  /**
   * 更新角色
   */
  update_角色(uuid: string, data: UpdateRoleDto): RoleRecord | undefined {
    try {
      const role = this.database.update_角色(uuid, data);
      this.logger.info(`角色更新成功: ${uuid}`);
      return role;
    } catch (error: any) {
      this.logger.error(`更新角色失败: ${uuid}`, error);
      throw new Error(`更新角色失败: ${error.message}`);
    }
  }

  /**
   * 删除角色
   */
  delete_角色(uuid: string): void {
    try {
      this.database.delete_角色(uuid);
      this.logger.info(`角色删除成功: ${uuid}`);
    } catch (error: any) {
      this.logger.error(`删除角色失败: ${uuid}`, error);
      throw new Error(`删除角色失败: ${error.message}`);
    }
  }

  /**
   * 获取使用该角色的机器人列表
   */
  get_所有使用角色的机器人(roleId: string) {
    try {
      return this.database.get_所有使用角色的机器人(roleId);
    } catch (error: any) {
      this.logger.error(`获取角色绑定的机器人失败: ${roleId}`, error);
      throw new Error(`获取角色绑定的机器人失败: ${error.message}`);
    }
  }
}
