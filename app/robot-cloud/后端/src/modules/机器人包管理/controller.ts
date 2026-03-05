import type { Request, Response } from 'express';
import type { PackageUploadItem, 机器人包服务 } from './service';
import { semverToVersionCode } from './service';
import type { PackageType, ReleaseChannel } from './types';

const VALID_PACKAGE_TYPES: PackageType[] = ['agent', 'server', 'common'];

export class 机器人包控制器 {
  constructor(private service: 机器人包服务) {}

  /** POST /robot-packages/upload — 上传机器人包 */
  upload = (req: Request, res: Response): void => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      if (!files || Object.keys(files).length === 0) {
        res.status(400).json({ success: false, error: '至少需要上传一个包文件' });
        return;
      }

      const { version, versionCode, channel, changelog } = req.body;
      if (!channel) {
        res.status(400).json({ success: false, error: '缺少 channel' });
        return;
      }
      if (!['stable', 'beta'].includes(channel)) {
        res.status(400).json({ success: false, error: 'channel 必须是 stable 或 beta' });
        return;
      }

      let normalizedVersionCode = Number(versionCode);
      if (!normalizedVersionCode) {
        if (!version) {
          res.status(400).json({ success: false, error: '缺少 version（如 1.2.3）或 versionCode' });
          return;
        }
        normalizedVersionCode = semverToVersionCode(String(version));
      }
      if (!Number.isInteger(normalizedVersionCode) || normalizedVersionCode <= 0) {
        res.status(400).json({ success: false, error: 'versionCode 必须是正整数' });
        return;
      }

      const items: PackageUploadItem[] = [];
      for (const type of VALID_PACKAGE_TYPES) {
        const fileArr = files[type];
        if (!fileArr || fileArr.length === 0) continue;
        const file = fileArr[0];
        const hash = req.body[`${type}Hash`];
        if (!hash) {
          res.status(400).json({ success: false, error: `缺少 ${type}Hash` });
          return;
        }
        items.push({ buffer: file.buffer, size: file.size, type, hash: String(hash) });
      }

      if (items.length === 0) {
        res.status(400).json({ success: false, error: '至少需要上传一个包文件' });
        return;
      }

      const info = this.service.uploadPackages(
        items,
        normalizedVersionCode,
        channel as ReleaseChannel,
        changelog
      );

      res.json({ success: true, data: info });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** GET /robot-packages/versions — 版本列表 */
  list = (req: Request, res: Response): void => {
    try {
      const channel = req.query.channel as ReleaseChannel | undefined;
      if (channel && !['stable', 'beta'].includes(channel)) {
        res.status(400).json({ success: false, error: 'channel 必须是 stable 或 beta' });
        return;
      }
      const versions = this.service.listVersions(channel);
      res.json({ success: true, data: versions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** POST /robot-packages/rollback/:id — 回滚到指定版本 */
  rollback = (req: Request, res: Response): void => {
    try {
      const id = Number(req.params.id);
      const info = this.service.rollback(id);
      res.json({ success: true, data: info });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** DELETE /robot-packages/versions/:id — 删除版本 */
  delete = (req: Request, res: Response): void => {
    try {
      const id = Number(req.params.id);
      this.service.deleteVersion(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}
