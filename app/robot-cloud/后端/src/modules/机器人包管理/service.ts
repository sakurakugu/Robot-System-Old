import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type DatabaseService from '../../core/database';
import type { 同步数据库实例 } from '../../core/database/types';
import { logger } from '../../core/logger';
import type {
    PackageFileInfo,
    PackageType,
    ReleaseChannel,
    RobotPackageInfo,
    RobotPackageRecord,
} from './types';

/** 机器人包存储根目录 */
const PKG_DIR = path.resolve(process.cwd(), 'data', 'apps', 'robot-packages');

/** 版本码转显示字符串（1002003 → "1.2.3"） */
export function versionCodeToDisplay(versionCode: number): string {
  const safe = Math.max(0, Math.floor(versionCode));
  const major = Math.floor(safe / 1_000_000);
  const minor = Math.floor((safe % 1_000_000) / 1_000);
  const patch = safe % 1_000;
  return `${major}.${minor}.${patch}`;
}

/** 语义化版本转版本码（"1.2.3" → 1002003） */
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

function toPackageInfo(record: RobotPackageRecord): RobotPackageInfo {
  const agent: PackageFileInfo | null =
    record.agent_file_name !== null && record.agent_file_size !== null && record.agent_file_hash !== null
      ? { fileName: record.agent_file_name, fileSize: record.agent_file_size, fileHash: record.agent_file_hash }
      : null;

  const server: PackageFileInfo | null =
    record.server_file_name !== null && record.server_file_size !== null && record.server_file_hash !== null
      ? { fileName: record.server_file_name, fileSize: record.server_file_size, fileHash: record.server_file_hash }
      : null;

  const common: PackageFileInfo | null =
    record.common_file_name !== null && record.common_file_size !== null && record.common_file_hash !== null
      ? { fileName: record.common_file_name, fileSize: record.common_file_size, fileHash: record.common_file_hash }
      : null;

  return {
    id: record.id,
    versionCode: record.version_code,
    channel: record.channel,
    changelog: record.changelog,
    isActive: record.is_active === 1,
    uploadedAt: record.uploaded_at,
    agent,
    server,
    common,
  };
}

/** 验证文件哈希，返回计算出的哈希值 */
function verifyHash(buffer: Buffer, expectedHash: string): string {
  const normalized = expectedHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('fileHash 必须是 64 位 SHA-256 十六进制字符串');
  }
  const actual = crypto.createHash('sha256').update(new Uint8Array(buffer)).digest('hex').toLowerCase();
  if (normalized !== actual) {
    throw new Error('SHA-256 校验失败：上传文件与前端摘要不一致');
  }
  return actual;
}

export interface PackageUploadItem {
  buffer: Buffer;
  size: number;
  type: PackageType;
  hash: string;
}

export class 机器人包服务 {
  private db: 同步数据库实例;

  constructor(database: DatabaseService) {
    this.db = database.getDb();

    // 确保存储目录存在
    for (const sub of ['agent', 'server', 'common'] as PackageType[]) {
      const dir = path.join(PKG_DIR, sub);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  上传包                                                             */
  /* ------------------------------------------------------------------ */

  uploadPackages(
    items: PackageUploadItem[],
    versionCode: number,
    channel: ReleaseChannel,
    changelog?: string
  ): RobotPackageInfo {
    if (items.length === 0) {
      throw new Error('至少需要上传一个包文件');
    }

    const saved: Partial<Record<PackageType, { fileName: string; fileSize: number; fileHash: string }>> = {};

    for (const item of items) {
      const hash = verifyHash(item.buffer, item.hash);
      const fileName = `${channel}_${versionCode}_${item.type}_${hash.slice(0, 8)}.tar.gz`;
      const filePath = path.join(PKG_DIR, item.type, fileName);
      fs.writeFileSync(filePath, new Uint8Array(item.buffer));
      logger.info(`机器人包已保存: ${fileName} (${item.size} bytes)`);
      saved[item.type] = { fileName, fileSize: item.size, fileHash: hash };
    }

    // 将同渠道其他版本设为非活跃
    this.db.prepare(`UPDATE robot_package_versions SET is_active = 0 WHERE channel = ?`).run(channel);

    const result = this.db
      .prepare(
        `INSERT INTO robot_package_versions
          (version_code, channel, changelog, is_active,
           agent_file_name, agent_file_size, agent_file_hash,
           server_file_name, server_file_size, server_file_hash,
           common_file_name, common_file_size, common_file_hash)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        versionCode,
        channel,
        changelog || null,
        saved.agent?.fileName ?? null,
        saved.agent?.fileSize ?? null,
        saved.agent?.fileHash ?? null,
        saved.server?.fileName ?? null,
        saved.server?.fileSize ?? null,
        saved.server?.fileHash ?? null,
        saved.common?.fileName ?? null,
        saved.common?.fileSize ?? null,
        saved.common?.fileHash ?? null
      );

    const record = this.db
      .prepare(`SELECT * FROM robot_package_versions WHERE id = ?`)
      .get(result.lastInsertRowid) as RobotPackageRecord;

    return toPackageInfo(record);
  }

  /* ------------------------------------------------------------------ */
  /*  版本列表                                                           */
  /* ------------------------------------------------------------------ */

  listVersions(channel?: ReleaseChannel): RobotPackageInfo[] {
    const records = channel
      ? (this.db
          .prepare(`SELECT * FROM robot_package_versions WHERE channel = ? ORDER BY version_code DESC, id DESC`)
          .all(channel) as RobotPackageRecord[])
      : (this.db
          .prepare(`SELECT * FROM robot_package_versions ORDER BY version_code DESC, id DESC`)
          .all() as RobotPackageRecord[]);

    return records.map(toPackageInfo);
  }

  /* ------------------------------------------------------------------ */
  /*  回滚                                                              */
  /* ------------------------------------------------------------------ */

  rollback(id: number): RobotPackageInfo {
    const record = this.db
      .prepare(`SELECT * FROM robot_package_versions WHERE id = ?`)
      .get(id) as RobotPackageRecord | undefined;

    if (!record) {
      throw new Error('版本不存在');
    }

    this.db
      .prepare(`UPDATE robot_package_versions SET is_active = 0 WHERE channel = ?`)
      .run(record.channel);
    this.db
      .prepare(`UPDATE robot_package_versions SET is_active = 1 WHERE id = ?`)
      .run(id);

    const updated = this.db
      .prepare(`SELECT * FROM robot_package_versions WHERE id = ?`)
      .get(id) as RobotPackageRecord;

    return toPackageInfo(updated);
  }

  /* ------------------------------------------------------------------ */
  /*  删除版本                                                           */
  /* ------------------------------------------------------------------ */

  deleteVersion(id: number): void {
    const record = this.db
      .prepare(`SELECT * FROM robot_package_versions WHERE id = ?`)
      .get(id) as RobotPackageRecord | undefined;

    if (!record) {
      throw new Error('版本不存在');
    }

    // 删除物理文件
    const fileEntries: Array<{ type: PackageType; fileName: string | null }> = [
      { type: 'agent', fileName: record.agent_file_name },
      { type: 'server', fileName: record.server_file_name },
      { type: 'common', fileName: record.common_file_name },
    ];

    for (const entry of fileEntries) {
      if (!entry.fileName) continue;
      const filePath = path.join(PKG_DIR, entry.type, entry.fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`已删除机器人包文件: ${filePath}`);
      }
    }

    this.db.prepare(`DELETE FROM robot_package_versions WHERE id = ?`).run(id);
    logger.info(`已删除机器人包版本记录 id=${id}`);
  }

  /* ------------------------------------------------------------------ */
  /*  获取活跃版本                                                       */
  /* ------------------------------------------------------------------ */

  getActive(channel: ReleaseChannel = 'stable'): RobotPackageInfo | null {
    const record = this.db
      .prepare(`SELECT * FROM robot_package_versions WHERE channel = ? AND is_active = 1 ORDER BY id DESC LIMIT 1`)
      .get(channel) as RobotPackageRecord | undefined;
    return record ? toPackageInfo(record) : null;
  }

  getPackageFilePath(type: PackageType, channel: ReleaseChannel = 'stable'): string | null {
    const info = this.getActive(channel);
    if (!info) return null;
    const fileInfo = info[type];
    if (!fileInfo) return null;
    return path.join(PKG_DIR, type, fileInfo.fileName);
  }
}
