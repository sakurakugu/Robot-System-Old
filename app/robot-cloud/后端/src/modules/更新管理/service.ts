import type Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type DatabaseService from '../../core/database';
import { logger } from '../../core/logger';
import type {
    AppVersionInfo,
    AppVersionRecord,
    ReleaseChannel,
    UpdateCheckResult,
} from './types';

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
  private db: Database.Database;

  constructor(database: DatabaseService) {
    this.db = database.getDb();

    // 确保 APK 目录存在
    if (!fs.existsSync(APK_DIR)) {
      fs.mkdirSync(APK_DIR, { recursive: true });
    }

    // 确保表存在
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_name TEXT NOT NULL,
        version_code INTEGER NOT NULL,
        channel TEXT NOT NULL CHECK(channel IN ('stable', 'beta')),
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_hash TEXT NOT NULL,
        changelog TEXT,
        is_active INTEGER DEFAULT 0,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_app_versions_channel ON app_versions(channel);
      CREATE INDEX IF NOT EXISTS idx_app_versions_active ON app_versions(is_active);
    `);
  }

  /* ------------------------------------------------------------------ */
  /*  上传 APK                                                          */
  /* ------------------------------------------------------------------ */

  uploadApk(
    file: { buffer: Buffer; size: number },
    versionCode: number,
    channel: ReleaseChannel,
    fileHash: string,
    changelog?: string
  ): AppVersionInfo {
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

    // 将同渠道其他版本设为非活跃
    this.db.prepare(`UPDATE app_versions SET is_active = 0 WHERE channel = ?`).run(channel);

    // 插入记录并设为活跃
    const result = this.db
      .prepare(
        `INSERT INTO app_versions (version_name, version_code, channel, file_name, file_size, file_hash, changelog, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(versionName, versionCode, channel, fileName, file.size, normalizedClientHash, changelog || null);

    const record = this.db
      .prepare(`SELECT * FROM app_versions WHERE id = ?`)
      .get(result.lastInsertRowid) as AppVersionRecord;

    return toVersionInfo(record);
  }

  /* ------------------------------------------------------------------ */
  /*  检查更新                                                          */
  /* ------------------------------------------------------------------ */

  checkUpdate(currentVersionCode: number, channel: ReleaseChannel = 'stable'): UpdateCheckResult {
    const latest = this.db
      .prepare(
        `SELECT * FROM app_versions WHERE channel = ? AND is_active = 1 ORDER BY version_code DESC LIMIT 1`
      )
      .get(channel) as AppVersionRecord | undefined;

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

  getApkPath(id: number): { filePath: string; fileName: string } | null {
    const record = this.db
      .prepare(`SELECT * FROM app_versions WHERE id = ?`)
      .get(id) as AppVersionRecord | undefined;
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

  listVersions(channel?: ReleaseChannel): AppVersionInfo[] {
    let rows: AppVersionRecord[];
    if (channel) {
      rows = this.db
        .prepare(
          `SELECT * FROM app_versions WHERE channel = ? ORDER BY version_code DESC, uploaded_at DESC`
        )
        .all(channel) as AppVersionRecord[];
    } else {
      rows = this.db
        .prepare(`SELECT * FROM app_versions ORDER BY version_code DESC, uploaded_at DESC`)
        .all() as AppVersionRecord[];
    }
    return rows.map(toVersionInfo);
  }

  /* ------------------------------------------------------------------ */
  /*  回滚                                                              */
  /* ------------------------------------------------------------------ */

  rollback(id: number): AppVersionInfo | null {
    const record = this.db
      .prepare(`SELECT * FROM app_versions WHERE id = ?`)
      .get(id) as AppVersionRecord | undefined;
    if (!record) return null;

    const filePath = path.join(APK_DIR, record.file_name);
    if (!fs.existsSync(filePath)) {
      logger.error(`回滚失败，APK 文件不存在: ${filePath}`);
      return null;
    }

    this.db.prepare(`UPDATE app_versions SET is_active = 0 WHERE channel = ?`).run(record.channel);
    this.db.prepare(`UPDATE app_versions SET is_active = 1 WHERE id = ?`).run(id);

    logger.info(`已回滚到版本 ${record.version_name} (${record.channel})`);
    return toVersionInfo({ ...record, is_active: 1 });
  }

  /* ------------------------------------------------------------------ */
  /*  删除版本                                                          */
  /* ------------------------------------------------------------------ */

  deleteVersion(id: number): boolean {
    const record = this.db
      .prepare(`SELECT * FROM app_versions WHERE id = ?`)
      .get(id) as AppVersionRecord | undefined;
    if (!record) return false;

    const filePath = path.join(APK_DIR, record.file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    this.db.prepare(`DELETE FROM app_versions WHERE id = ?`).run(id);

    if (record.is_active === 1) {
      const newest = this.db
        .prepare(
          `SELECT * FROM app_versions WHERE channel = ? ORDER BY version_code DESC LIMIT 1`
        )
        .get(record.channel) as AppVersionRecord | undefined;
      if (newest) {
        this.db.prepare(`UPDATE app_versions SET is_active = 1 WHERE id = ?`).run(newest.id);
      }
    }

    logger.info(`已删除版本 ${record.version_name} (${record.channel})`);
    return true;
  }
}
