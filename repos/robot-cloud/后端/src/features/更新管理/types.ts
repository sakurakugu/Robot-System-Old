/** 发布渠道 */
export type ReleaseChannel = 'stable' | 'beta';

/** 数据库中的版本记录 */
export interface AppVersionRecord {
  id: number;
  version_name: string;
  version_code: number;
  channel: ReleaseChannel;
  file_name: string;
  file_size: number;
  file_hash: string;
  changelog: string | null;
  is_active: number; // 0 | 1
  uploaded_at: string;
}

/** 前端展示用的版本信息 */
export interface AppVersionInfo {
  id: number;
  versionName: string;
  versionCode: number;
  channel: ReleaseChannel;
  fileName: string;
  fileSize: number;
  fileHash: string;
  changelog: string | null;
  isActive: boolean;
  uploadedAt: string;
}

/** 检查更新返回 */
export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  latestDisplayVersion: string | null;
  latestVersionCode: number | null;
  changelog: string | null;
  downloadId: number | null;
  fileSize: number | null;
  channel: ReleaseChannel;
}

/** 上传请求体 */
export interface UploadBody {
  version?: string;
  versionCode: number;
  fileHash: string;
  channel: ReleaseChannel;
  changelog?: string;
}
