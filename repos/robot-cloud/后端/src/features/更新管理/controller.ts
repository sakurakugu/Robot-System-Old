import type { Request, Response } from 'express';
import { 处理控制器, 返回数据, 返回消息 } from '../../shared/http/controller';
import { Http错误工厂 } from '../../shared/http/errors';
import type { 更新服务 } from './service';
import { semverToVersionCode } from './service';
import type { ReleaseChannel } from './types';

export class 更新控制器 {
  constructor(private service: 更新服务) {}

  /** POST /updates/upload — 上传 APK */
  upload = 处理控制器(async (req: Request) => {
    const file = req.file;
    if (!file) {
      throw Http错误工厂.参数错误('缺少 APK 文件');
    }

    const { version, versionCode, fileHash, channel, changelog } = req.body;
    if (!channel || !fileHash) {
      throw Http错误工厂.参数错误('缺少 channel / fileHash');
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

    const info = await this.service.uploadApk(
      { buffer: file.buffer, size: file.size },
      normalizedVersionCode,
      channel as ReleaseChannel,
      String(fileHash),
      changelog
    );

    return 返回数据(info);
  });

  /** GET /updates/check — 检查更新 */
  check = 处理控制器(async (req: Request) => {
    const currentVersionCode = Number(req.query.currentVersionCode) || 0;
    const channel = (req.query.channel as ReleaseChannel) || 'stable';

    if (!['stable', 'beta'].includes(channel)) {
      throw Http错误工厂.参数错误('channel 必须是 stable 或 beta');
    }

    const result = await this.service.checkUpdate(currentVersionCode, channel);
    return 返回数据(result);
  });

  /** GET /updates/download/:id — 下载 APK */
  download = 处理控制器(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const result = await this.service.getApkPath(id);
    if (!result) {
      throw Http错误工厂.未找到('版本不存在或文件丢失');
    }

    res.download(result.filePath, result.fileName);
  });

  /** GET /updates/versions — 版本列表 */
  list = 处理控制器(async (req: Request) => {
    const channel = req.query.channel as ReleaseChannel | undefined;
    if (channel && !['stable', 'beta'].includes(channel)) {
      throw Http错误工厂.参数错误('channel 必须是 stable 或 beta');
    }

    const versions = await this.service.listVersions(channel);
    return 返回数据(versions);
  });

  /** POST /updates/rollback/:id — 回滚 */
  rollback = 处理控制器(async (req: Request) => {
    const id = Number(req.params.id);
    const result = await this.service.rollback(id);
    if (!result) {
      throw Http错误工厂.未找到('版本不存在或文件丢失');
    }

    return 返回数据(result, { 消息: `已回滚到 ${result.versionName}` });
  });

  /** DELETE /updates/versions/:id — 删除版本 */
  delete = 处理控制器(async (req: Request) => {
    const id = Number(req.params.id);
    const ok = await this.service.deleteVersion(id);
    if (!ok) {
      throw Http错误工厂.未找到('版本不存在');
    }

    return 返回消息('已删除');
  });
}
