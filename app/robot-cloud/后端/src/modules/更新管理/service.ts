import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../../core/logger';
import type {
    AppVersionInfo,
    AppVersionRecord,
    ReleaseChannel,
    UpdateCheckResult,
} from './types';
import type { AppVersionRepository } from './repository';

/** APK 存储根目录 */
const APK_DIR = path.resolve(process.cwd(), 'data', 'apps', 'apk');

export function versionCodeToDisplay(versionCode: number): string {
  const safeCode = Math.max(0, Math.floor(versionCode));
  const major = Math.floor(safeCode / 1_000_000);
  const minor = Math.floor((safeCode % 1_000_000) / 1_000);
  const patch = safeCode % 1_000;
  return `${major}.${minor}.${patch}`;
}

export function semverToVersionCode(version: string): number {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error('版本格式必须为 x.y.z（如 1.2.3）');
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (minor > 999 || patch > 999) {
    throw new Error('版本号的次版本和补丁号必须小于等于 999');
  }

  return major * 1_000_000 + minor * 1_000 + patch;
}

function toVersionInfo(record: AppVersionRecord): AppVersionInfo {
  return {
    id: record.id,
    versionName: record.version_name,
    versionCode: record.version_code,
    channel: record.channel,
    fileName: record.file_name,
    fileSize: record.file_size,
    fileHash: record.file_hash,
    changelog: record.changelog,
    isActive: record.is_active === 1,
    uploadedAt: record.uploaded_at,
  };
}

export class 更新服务 {
  constructor(private repository: AppVersionRepository) {
    // 确保 APK 目录存在
    if (!fs.existsSync(APK_DIR)) {
      fs.mkdirSync(APK_DIR, { recursive: true });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  上传 APK                                                          */
  /* ------------------------------------------------------------------ */

  async uploadApk(
    file: { buffer: Buffer; size: number },
    versionCode: number,
    channel: ReleaseChannel,
    fileHash: string,
    changelog?: string
  ): Promise<AppVersionInfo> {
    const normalizedClientHash = fileHash.trim().toLowerCase();
    const hash = crypto.createHash('sha256').update(new Uint8Array(file.buffer)).digest('hex').toLowerCase();

    if (!/^[a-f0-9]{64}$/.test(normalizedClientHash)) {
      throw new Error('fileHash 必须是 64 位 SHA-256 十六进制字符串');
    }

    if (normalizedClientHash !== hash) {
      throw new Error('SHA-256 校验失败：上传文件与前端摘要不一致');
    }

    const versionName = String(versionCode);
    const safeVersion = versionName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${channel}_${safeVersion}_${versionCode}_${hash.slice(0, 8)}.apk`;
    const filePath = path.join(APK_DIR, fileName);

    fs.writeFileSync(filePath, new Uint8Array(file.buffer));
    logger.info(`APK 已保存: ${fileName} (${file.size} bytes)`);

    const record = await this.repository.withTransaction(async (repository) => {
      await repository.deactivateChannel(channel);
      return repository.createVersion({
        version_name: versionName,
        version_code: versionCode,
        channel,
        file_name: fileName,
        file_size: file.size,
        file_hash: normalizedClientHash,
        changelog: changelog || null,
        is_active: 1,
      });
    });

    return toVersionInfo(record);
  }

  /* ------------------------------------------------------------------ */
  /*  检查更新                                                          */
  /* ------------------------------------------------------------------ */

  async checkUpdate(
    currentVersionCode: number,
    channel: ReleaseChannel = 'stable',
  ): Promise<UpdateCheckResult> {
    const latest = await this.repository.getActiveVersion(channel);

    if (!latest) {
      return {
        hasUpdate: false,
        currentVersion: String(currentVersionCode),
        latestVersion: null,
        latestDisplayVersion: null,
        latestVersionCode: null,
        changelog: null,
        downloadId: null,
        fileSize: null,
        channel,
      };
    }

    const hasUpdate = latest.version_code > currentVersionCode;
    return {
      hasUpdate,
      currentVersion: String(currentVersionCode),
      latestVersion: latest.version_name,
      latestDisplayVersion: versionCodeToDisplay(latest.version_code),
      latestVersionCode: latest.version_code,
      changelog: latest.changelog,
      downloadId: hasUpdate ? latest.id : null,
      fileSize: hasUpdate ? latest.file_size : null,
      channel,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  下载 APK                                                          */
  /* ------------------------------------------------------------------ */

  async getApkPath(id: number): Promise<{ filePath: string; fileName: string } | null> {
    const record = await this.repository.getVersionById(id);
    if (!record) return null;

    const filePath = path.join(APK_DIR, record.file_name);
    if (!fs.existsSync(filePath)) {
      logger.error(`APK 文件不存在: ${filePath}`);
      return null;
    }

    return {
      filePath,
      fileName: `RobotPhone_${record.version_name}_${record.channel}.apk`,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  版本列表                                                          */
  /* ------------------------------------------------------------------ */

  async listVersions(channel?: ReleaseChannel): Promise<AppVersionInfo[]> {
    const rows = await this.repository.listVersions(channel);
    return rows.map(toVersionInfo);
  }

  /* ------------------------------------------------------------------ */
  /*  回滚                                                              */
  /* ------------------------------------------------------------------ */

  async rollback(id: number): Promise<AppVersionInfo | null> {
    const record = await this.repository.getVersionById(id);
    if (!record) return null;

    const filePath = path.join(APK_DIR, record.file_name);
    if (!fs.existsSync(filePath)) {
      logger.error(`回滚失败，APK 文件不存在: ${filePath}`);
      return null;
    }

    const updated = await this.repository.withTransaction(async (repository) => {
      await repository.deactivateChannel(record.channel);
      await repository.activateVersion(id);
      return repository.getVersionById(id);
    });

    logger.info(`已回滚到版本 ${record.version_name} (${record.channel})`);
    if (!updated) {
      return null;
    }
    return toVersionInfo(updated);
  }

  /* ------------------------------------------------------------------ */
  /*  删除版本                                                          */
  /* ------------------------------------------------------------------ */

  async deleteVersion(id: number): Promise<boolean> {
    const record = await this.repository.getVersionById(id);
    if (!record) return false;

    const filePath = path.join(APK_DIR, record.file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.repository.withTransaction(async (repository) => {
      await repository.deleteVersion(id);

      if (record.is_active === 1) {
        const newest = await repository.getLatestVersion(record.channel);
        if (newest) {
          await repository.activateVersion(newest.id);
        }
      }
    });

    logger.info(`已删除版本 ${record.version_name} (${record.channel})`);
    return true;
  }
}
