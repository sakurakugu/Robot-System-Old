// 角色相关类型

// ============ 数据库实体 ============

/**
 * 角色记录
 */
export interface RoleRecord {
  uuid: string;
  name: string;
  description: string | null;
  llm_provider: string | null;    // 模型提供商
  llm_model: string | null;       // 模型名称
  temperature: number;            // 采样温度
  system_prompt: string | null;   // 系统提示词
  asr_provider: string | null;    // 语音识别提供商
  asr_model: string | null;       // 语音识别模型
  voice: string | null;           // 语音设置（音色等）
  intent_strategy: string | null; // 意图识别策略
  max_history: number;            // 最大对话历史条数
  is_default: number;             // 是否为默认角色（bool)
  created_at: string;             // 创建时间
  updated_at: string;             // 更新时间
}

// ============ DTO 类型 ============

/**
 * 创建角色 DTO
 */
export interface CreateRoleDto {
  name: string;
  description?: string;
  llm_provider?: string;
  llm_model?: string;
  temperature?: number;
  system_prompt?: string;
  asr_provider?: string;
  asr_model?: string;
  voice?: string;
  intent_strategy?: string;
  max_history?: number;
}

/**
 * 更新角色 DTO
 */
export interface UpdateRoleDto {
  name?: string;
  description?: string;
  llm_provider?: string;
  llm_model?: string;
  temperature?: number;
  system_prompt?: string;
  asr_provider?: string;
  asr_model?: string;
  voice?: string;
  intent_strategy?: string;
  max_history?: number;
}
