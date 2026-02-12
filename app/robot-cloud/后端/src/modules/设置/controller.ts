import type { Request, Response } from 'express';
import 配置 from '../../config';
import type { 设置服务 } from './service';

/**
 * 设置控制器
 */
export class 设置控制器 {
  constructor(private settingsService: 设置服务) {}

  /**
   * 获取 UI 配置
   */
  getUIConfig = async (req: Request, res: Response) => {
    try {
      const data = this.settingsService.getUIConfig();
      const host = (req.headers.host || '').trim();
      const serverUrl = data.serverUrl && String(data.serverUrl).length > 0 ? data.serverUrl : host;
      const wsPath = data.wsPath && String(data.wsPath).length > 0 ? data.wsPath : '/api/v1/interaction/connect';

      const resolveWsBaseUrl = (input: string, port: number) => {
        const hasScheme = /^https?:\/\//i.test(input);
        const baseUrl = hasScheme ? input : `${req.protocol}://${input}`;
        try {
          const u = new URL(baseUrl);
          const scheme = u.protocol === 'https:' ? 'wss:' : 'ws:';
          return `${scheme}//${u.hostname}:${port}`;
        } catch {
          return `ws://${input}:${port}`;
        }
      };

      const wsControlUrl = data.wsControlUrl || resolveWsBaseUrl(serverUrl, 配置.port);
      const wsBusinessUrl = data.wsBusinessUrl || resolveWsBaseUrl(serverUrl, 配置.port);
      const wsAudioUploadUrl = data.wsAudioUploadUrl || resolveWsBaseUrl(serverUrl, 配置.port);
      const wsAudioDownloadUrl = data.wsAudioDownloadUrl || resolveWsBaseUrl(serverUrl, 配置.port);

      res.json({
        success: true,
        data: {
          ...data,
          serverUrl,
          wsPath,
          wsControlUrl,
          wsBusinessUrl,
          wsAudioUploadUrl,
          wsAudioDownloadUrl,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * 更新 UI 配置
   */
  updateUIConfig = async (req: Request, res: Response) => {
    try {
      this.settingsService.updateUIConfig(req.body || {});
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

export { 设置控制器 as SettingsController };

