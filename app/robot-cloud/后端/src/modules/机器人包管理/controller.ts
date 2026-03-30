import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import type { PackageUploadItem, 机器人包服务 } from './service';
import { semverToVersionCode } from './service';
import type { PackageType, ReleaseChannel } from './types';

/** 包类型到安装包文件名映射 */
const PACKAGE_FILENAMES: Record<PackageType, string> = {
  agent: 'robot-agent.tar.gz',
  server: 'robot-server.tar.gz',
  common: 'sparkrobot-common.tar.gz',
};

const VALID_PACKAGE_TYPES: PackageType[] = ['agent', 'server', 'common'];

export class 机器人包控制器 {
  constructor(private service: 机器人包服务) {}

  /** POST /robot-packages/upload — 上传机器人包 */
  upload = async (req: Request, res: Response): Promise<void> => {
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

      const info = await this.service.uploadPackages(
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

  /** POST /robot-packages/rollback/:id — 回滚到指定版本 */
  rollback = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const info = await this.service.rollback(id);
      res.json({ success: true, data: info });
    } catch (error: any) {
      const status = error.message.includes('不存在') ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /** DELETE /robot-packages/versions/:id — 删除版本 */
  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      await this.service.deleteVersion(id);
      res.json({ success: true });
    } catch (error: any) {
      const status = error.message.includes('不存在') ? 404 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  /** GET /robot-packages/active?channel=stable — 获取当前活跃版本信息 */
  getActive = async (req: Request, res: Response): Promise<void> => {
    try {
      const channel = (req.query.channel as ReleaseChannel) || 'stable';
      if (!['stable', 'beta'].includes(channel)) {
        res.status(400).json({ success: false, error: 'channel 必须是 stable 或 beta' });
        return;
      }
      const info = await this.service.getActive(channel);
      if (!info) {
        res.status(404).json({ success: false, error: '没有可用的安装包' });
        return;
      }
      res.json({ success: true, data: info });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** GET /robot-packages/download/:type?channel=stable — 下载指定类型的安装包 */
  download = async (req: Request, res: Response): Promise<void> => {
    try {
      const type = req.params.type as PackageType;
      if (!['agent', 'server', 'common'].includes(type)) {
        res.status(400).json({ success: false, error: '无效的包类型，必须是 agent、server 或 common' });
        return;
      }
      const channel = (req.query.channel as ReleaseChannel) || 'stable';
      if (!['stable', 'beta'].includes(channel)) {
        res.status(400).json({ success: false, error: 'channel 必须是 stable 或 beta' });
        return;
      }
      const filePath = await this.service.getPackageFilePath(type, channel);
      if (!filePath || !fs.existsSync(filePath)) {
        res.status(404).json({ success: false, error: '找不到安装包文件，请先上传安装包' });
        return;
      }
      const fileName = PACKAGE_FILENAMES[type];
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/gzip');
      res.sendFile(path.resolve(filePath));
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}
