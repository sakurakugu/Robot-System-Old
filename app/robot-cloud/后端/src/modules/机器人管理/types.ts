// 机器人相关类型
import type { RoleRecord } from '../角色管理/types';

// ============ 基础类型 ============

export type 机器人状态 = 'online' | 'offline' | 'error';

// ============ 数据库实体 ============

/**
 * 机器人记录
 */
export interface RobotRecord {
  uuid: string;
  name: string | null;
  model: string | null; // 机器狗型号
  version: string | null; // robot-agent 版本（不是运控版本）
  motion_control_version: string | null; // 运控版本
  server_version: string | null; // robot-server 版本
  ip: string | null; // 最后一次连接 IP
  group_name: string | null; // 组别名称
  tags: string | null; // JSON 数组 string
  sn: string | null;
  role_uuid: string | null;
  status: 机器人状态;
  last_connected_at: string | null; // 最后一次连接时间
  registered_at: string | null; // 机器人注册时间
  updated_at: string;
  created_at: string;
}

// ============ DTO 类型 ============

/**
 * 创建机器人 DTO
 */
export interface CreateRobotDto {
  name?: string;
  ip?: string;
  group_name?: string;
  model?: string;
  sn?: string;
  tags?: string[];
}

/**
 * 更新机器人 DTO
 */
export interface UpdateRobotDto {
  name?: string;
  ip?: string;
  group_name?: string;
  model?: string;
  sn?: string;
  tags?: string[];
  role_uuid?: string | null;
}

// ============ API 响应类型 ============

/**
 * 机器人 API 响应（带解析后的字段）
 */
// 继承 RobotRecord，重写 tags 字段为字符串数组，添加 role 字段
export interface RobotResponse extends Omit<RobotRecord, 'tags'> {
  tags: string[];
  role?: RoleRecord | null;
}
