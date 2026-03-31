import type { Request } from 'express';
import 配置 from '../../config';
import { 处理控制器, 返回数据 } from '../../shared/http/controller';
import type { 设置服务 } from './service';

/**
 * 设置控制器
 */
export class 设置控制器 {
  constructor(private settingsService: 设置服务) {}

  getAIConfig = 处理控制器(async () => 返回数据(await this.settingsService.getAIConfig()));

  updateAIConfig = 处理控制器(async (req: Request) => 返回数据(
    await this.settingsService.updateAIConfig(req.body || {}),
  ), {
    默认错误状态码: 400,
  });

  /**
   * 获取 UI 配置
   */
  getUIConfig = 处理控制器(async (req: Request) => {
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

    return 返回数据({
      ...data,
      serverUrl,
      wsBusinessUrl,
      wsAudioUploadUrl,
      wsAudioDownloadUrl,
    });
  });

  /**
   * 更新 UI 配置
   */
  updateUIConfig = 处理控制器(async (req: Request) => {
    await this.settingsService.updateUIConfig(req.body || {});
  });
}

