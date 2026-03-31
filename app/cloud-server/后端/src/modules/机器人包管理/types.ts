/** 发布渠道 */
export type ReleaseChannel = 'stable' | 'beta';

/** 包类型 */
export type PackageType = 'agent' | 'server' | 'common';

/** 数据库中的版本记录 */
export interface RobotPackageRecord {
  id: number;
  version_code: number;
  channel: ReleaseChannel;
  changelog: string | null;
  is_active: number; // 0 | 1
  uploaded_at: string;
  // agent 包
  agent_file_name: string | null;
  agent_file_size: number | null;
  agent_file_hash: string | null;
  // server 包
  server_file_name: string | null;
  server_file_size: number | null;
  server_file_hash: string | null;
  // common 包
  common_file_name: string | null;
  common_file_size: number | null;
  common_file_hash: string | null;
}

/** 单个包文件信息 */
export interface PackageFileInfo {
  fileName: string;
  fileSize: number;
  fileHash: string;
}

/** 前端展示用的版本信息 */
export interface RobotPackageInfo {
  id: number;
  versionCode: number;
  channel: ReleaseChannel;
  changelog: string | null;
  isActive: boolean;
  uploadedAt: string;
  agent: PackageFileInfo | null;
  server: PackageFileInfo | null;
  common: PackageFileInfo | null;
}
