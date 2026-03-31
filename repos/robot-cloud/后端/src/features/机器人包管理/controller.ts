import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { 处理控制器, 返回数据 } from '../../shared/http/controller';
import { Http错误工厂 } from '../../shared/http/errors';
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
  upload = 处理控制器(async (req: Request) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    if (!files || Object.keys(files).length === 0) {
      throw Http错误工厂.参数错误('至少需要上传一个包文件');
    }

    const { version, versionCode, channel, changelog } = req.body;
    if (!channel) {
      throw Http错误工厂.参数错误('缺少 channel');
    }
    if (!['stable', 'beta'].includes(channel)) {
      throw Http错误工厂.参数错误('channel 必须是 stable 或 beta');
    }

    let normalizedVersionCode = Number(versionCode);
    if (!normalizedVersionCode) {
      if (!version) {
        throw Http错误工厂.参数错误('缺少 version（如 1.2.3）或 versionCode');
      }
      normalizedVersionCode = semverToVersionCode(String(version));
    }
    if (!Number.isInteger(normalizedVersionCode) || normalizedVersionCode <= 0) {
      throw Http错误工厂.参数错误('versionCode 必须是正整数');
    }

    const items: PackageUploadItem[] = [];
    for (const type of VALID_PACKAGE_TYPES) {
      const fileArr = files[type];
      if (!fileArr || fileArr.length === 0) continue;
      const file = fileArr[0];
      const hash = req.body[`${type}Hash`];
      if (!hash) {
        throw Http错误工厂.参数错误(`缺少 ${type}Hash`);
      }
      items.push({ buffer: file.buffer, size: file.size, type, hash: String(hash) });
    }

    if (items.length === 0) {
      throw Http错误工厂.参数错误('至少需要上传一个包文件');
    }

    const info = await this.service.uploadPackages(
      items,
      normalizedVersionCode,
      channel as ReleaseChannel,
      changelog
    );

    return 返回数据(info);
  });

  /** GET /robot-packages/versions — 版本列表 */
  list = 处理控制器(async (req: Request) => {
    const channel = req.query.channel as ReleaseChannel | undefined;
    if (channel && !['stable', 'beta'].includes(channel)) {
      throw Http错误工厂.参数错误('channel 必须是 stable 或 beta');
    }
    const versions = await this.service.listVersions(channel);
    return 返回数据(versions);
  });

  /** POST /robot-packages/rollback/:id — 回滚到指定版本 */
  rollback = 处理控制器(async (req: Request) => {
    const id = Number(req.params.id);
    const info = await this.service.rollback(id);
    return 返回数据(info);
  }, {
    错误映射: [{ 匹配: '不存在', 状态码: 404 }],
  });

  /** DELETE /robot-packages/versions/:id — 删除版本 */
  delete = 处理控制器(async (req: Request) => {
    const id = Number(req.params.id);
    await this.service.deleteVersion(id);
  }, {
    错误映射: [{ 匹配: '不存在', 状态码: 404 }],
  });

  /** GET /robot-packages/active?channel=stable — 获取当前活跃版本信息 */
  getActive = 处理控制器(async (req: Request) => {
    const channel = (req.query.channel as ReleaseChannel) || 'stable';
    if (!['stable', 'beta'].includes(channel)) {
      throw Http错误工厂.参数错误('channel 必须是 stable 或 beta');
    }
    const info = await this.service.getActive(channel);
    if (!info) {
      throw Http错误工厂.未找到('没有可用的安装包');
    }
    return 返回数据(info);
  });

  /** GET /robot-packages/download/:type?channel=stable — 下载指定类型的安装包 */
  download = 处理控制器(async (req: Request, res: Response) => {
    const type = req.params.type as PackageType;
    if (!['agent', 'server', 'common'].includes(type)) {
      throw Http错误工厂.参数错误('无效的包类型，必须是 agent、server 或 common');
    }
    const channel = (req.query.channel as ReleaseChannel) || 'stable';
    if (!['stable', 'beta'].includes(channel)) {
      throw Http错误工厂.参数错误('channel 必须是 stable 或 beta');
    }
    const filePath = await this.service.getPackageFilePath(type, channel);
    if (!filePath) {
      throw Http错误工厂.未找到('找不到安装包文件，请先上传安装包');
    }
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
    } catch {
      throw Http错误工厂.未找到('找不到安装包文件，请先上传安装包');
    }
    const fileName = PACKAGE_FILENAMES[type];
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/gzip');
    res.sendFile(path.resolve(filePath));
  });
}
