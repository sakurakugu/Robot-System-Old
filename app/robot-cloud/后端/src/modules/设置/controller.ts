import type { Request, Response } from 'express';
import 配置 from '../../config';
import type { 设置服务 } from './service';

/**
 * 设置控制器
 */
export class 设置控制器 {
  constructor(private settingsService: 设置服务) {}

  getAIConfig = async (_req: Request, res: Response) => {
    try {
      const data = await this.settingsService.getAIConfig();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  updateAIConfig = async (req: Request, res: Response) => {
    try {
      const data = await this.settingsService.updateAIConfig(req.body || {});
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  /**
   * 获取 UI 配置
   */
  getUIConfig = async (req: Request, res: Response) => {
    try {
      const data = await this.settingsService.getUIConfig();
      const host = (req.headers.host || '').trim();
      const serverUrl = data.serverUrl && String(data.serverUrl).length > 0 ? data.serverUrl : host;

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

      const baseWsUrl = resolveWsBaseUrl(serverUrl, 配置.port);

      // Web 前端专用 WebSocket URL（已移除手改支持，自动派生）
      // 注意：service 层已不再返回 webWsBusinessUrl 等字段，所以这里会回退到自动派生
      // 实际上前端 useWebSocket.ts 并没有使用这里返回的 wsBusinessUrl，而是直接使用默认路径
      // 但为了兼容可能的调试需求，这里仍保留完整 URL 的生成
      const wsBusinessUrl = `${baseWsUrl}/api/v1/web/business`;
      const wsAudioUploadUrl = `${baseWsUrl}/api/v1/web/audio/upload`;
      const wsAudioDownloadUrl = `${baseWsUrl}/api/v1/web/audio/download`;

      res.json({
        success: true,
        data: {
          ...data,
          serverUrl,
          wsBusinessUrl,
          wsAudioUploadUrl,
          wsAudioDownloadUrl
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
      await this.settingsService.updateUIConfig(req.body || {});
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

