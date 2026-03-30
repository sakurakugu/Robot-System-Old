import type { Request, Response } from 'express';
import type { 更新服务 } from './service';
import { semverToVersionCode } from './service';
import type { ReleaseChannel } from './types';

export class 更新控制器 {
  constructor(private service: 更新服务) {}

  /** POST /updates/upload — 上传 APK */
  upload = async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: '缺少 APK 文件' });
        return;
      }

      const { version, versionCode, fileHash, channel, changelog } = req.body;
      if (!channel || !fileHash) {
        res.status(400).json({ success: false, error: '缺少 channel / fileHash' });
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

      const info = await this.service.uploadApk(
        { buffer: file.buffer, size: file.size },
        normalizedVersionCode,
        channel as ReleaseChannel,
        String(fileHash),
        changelog
      );

      res.json({ success: true, data: info });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** GET /updates/check — 检查更新 */
  check = async (req: Request, res: Response): Promise<void> => {
    try {
      const currentVersionCode = Number(req.query.currentVersionCode) || 0;
      const channel = (req.query.channel as ReleaseChannel) || 'stable';

      if (!['stable', 'beta'].includes(channel)) {
        res.status(400).json({ success: false, error: 'channel 必须是 stable 或 beta' });
        return;
      }

      const result = await this.service.checkUpdate(currentVersionCode, channel);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** GET /updates/download/:id — 下载 APK */
  download = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const result = await this.service.getApkPath(id);
      if (!result) {
        res.status(404).json({ success: false, error: '版本不存在或文件丢失' });
        return;
      }

      res.download(result.filePath, result.fileName);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** GET /updates/versions — 版本列表 */
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const channel = req.query.channel as ReleaseChannel | undefined;
      if (channel && !['stable', 'beta'].includes(channel)) {
        res.status(400).json({ success: false, error: 'channel 必须是 stable 或 beta' });
        return;
      }

      const versions = await this.service.listVersions(channel);
      res.json({ success: true, data: versions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** POST /updates/rollback/:id — 回滚 */
  rollback = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const result = await this.service.rollback(id);
      if (!result) {
        res.status(404).json({ success: false, error: '版本不存在或文件丢失' });
        return;
      }

      res.json({ success: true, data: result, message: `已回滚到 ${result.versionName}` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** DELETE /updates/versions/:id — 删除版本 */
  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const ok = await this.service.deleteVersion(id);
      if (!ok) {
        res.status(404).json({ success: false, error: '版本不存在' });
        return;
      }

      res.json({ success: true, message: '已删除' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}
