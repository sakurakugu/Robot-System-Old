import 配置 from '../../config';
import type { SettingsRepository } from './repository';
import type { AIConfig, UIConfig } from './types';

/**
 * 设置服务
 * 统一管理所有系统配置
 */
export class 设置服务 {
  constructor(private repository: SettingsRepository) { }

  /**
   * 加载 AI 相关配置（优先数据库，其次 .env）
   */
  async loadPersistedAIConfig(): Promise<void> {
    const [appId, apiKey, apiSecret] = await Promise.all([
      this.读取并迁移环境变量('asr.xunfei.appId', 'XUNFEI_ASR_APP_ID'),
      this.读取并迁移环境变量('asr.xunfei.apiKey', 'XUNFEI_ASR_API_KEY'),
      this.读取并迁移环境变量('asr.xunfei.apiSecret', 'XUNFEI_ASR_API_SECRET'),
    ]);

    if (!配置.asr.xunfei) {
      配置.asr.xunfei = { appId: '', apiKey: '', apiSecret: '' };
    }

    配置.asr.xunfei.appId = appId;
    配置.asr.xunfei.apiKey = apiKey;
    配置.asr.xunfei.apiSecret = apiSecret;
  }

  async getAIConfig(): Promise<AIConfig> {
    const xunfei = 配置.asr.xunfei || { appId: '', apiKey: '', apiSecret: '' };
    return {
      xunfeiAsr: {
        hasAppId: xunfei.appId.length > 0,
        appIdLength: xunfei.appId.length,
        hasApiKey: xunfei.apiKey.length > 0,
        apiKeyLength: xunfei.apiKey.length,
        hasApiSecret: xunfei.apiSecret.length > 0,
        apiSecretLength: xunfei.apiSecret.length,
      },
    };
  }

  async updateAIConfig(data: Partial<{
    xunfeiAsr: {
      appId?: string;
      apiKey?: string;
      apiSecret?: string;
    };
  }>): Promise<{ success: boolean }> {
    if (!data.xunfeiAsr) {
      return { success: true };
    }

    if (!配置.asr.xunfei) {
      配置.asr.xunfei = { appId: '', apiKey: '', apiSecret: '' };
    }

    const xunfei = data.xunfeiAsr;
    const 任务列表: Promise<void>[] = [];

    if (typeof xunfei.appId === 'string') {
      const value = xunfei.appId.trim();
      配置.asr.xunfei.appId = value;
      任务列表.push(this.更新设置值('asr.xunfei.appId', value));
    }
    if (typeof xunfei.apiKey === 'string') {
      const value = xunfei.apiKey.trim();
      配置.asr.xunfei.apiKey = value;
      任务列表.push(this.更新设置值('asr.xunfei.apiKey', value));
    }
    if (typeof xunfei.apiSecret === 'string') {
      const value = xunfei.apiSecret.trim();
      配置.asr.xunfei.apiSecret = value;
      任务列表.push(this.更新设置值('asr.xunfei.apiSecret', value));
    }

    await Promise.all(任务列表);

    return { success: true };
  }

  /**
   * 获取 UI 配置
   */
  async getUIConfig(): Promise<UIConfig> {
    const settings = await this.repository.getSettings([
      'ui.serverUrl',
      'ui.maxHistory',
      'ui.controlLayout',
    ]);

    const serverUrl = settings['ui.serverUrl'] || '';
    const mhRaw = settings['ui.maxHistory'];
    const maxHistory = mhRaw ? parseInt(mhRaw, 10) || 10 : 10;

    let controlLayout: UIConfig['controlLayout'] = null;
    const layoutRaw = settings['ui.controlLayout'];
    if (layoutRaw) {
      try {
        controlLayout = JSON.parse(layoutRaw);
      } catch {
        controlLayout = null;
      }
    }

    // Web 前端专用 WebSocket 配置（已移除手改支持，由 controller 层自动派生）

    return {
      serverUrl,
      maxHistory,
      controlLayout,
    };
  }

  /**
   * 更新 UI 配置
   */
  async updateUIConfig(data: Partial<{
    serverUrl: string;
    webWsBusinessUrl: string;
    webWsAudioUploadUrl: string;
    webWsAudioDownloadUrl: string;
    maxHistory: number | number[];
    controlLayout: Record<string, { x: number; y: number }> | string;
  }>): Promise<void> {
    const 任务列表: Promise<void>[] = [];

    if (typeof data.serverUrl === 'string') {
      const value = data.serverUrl.trim();
      if (value.length > 0) {
        任务列表.push(this.repository.setSetting('ui.serverUrl', value));
      } else {
        任务列表.push(this.repository.deleteSetting('ui.serverUrl'));
      }
    }

    // Web 前端专用 WebSocket 配置（已移除手改支持，改为自动派生）

    if (data.maxHistory !== undefined) {
      const mh = Array.isArray(data.maxHistory)
        ? Number(data.maxHistory[0])
        : Number(data.maxHistory);
      if (!Number.isNaN(mh)) {
        任务列表.push(this.repository.setSetting('ui.maxHistory', String(mh)));
      }
    }

    if (data.controlLayout !== undefined) {
      const layoutValue = typeof data.controlLayout === 'string'
        ? data.controlLayout
        : JSON.stringify(data.controlLayout || {});
      任务列表.push(this.repository.setSetting('ui.controlLayout', layoutValue));
    }

    await Promise.all(任务列表);
  }

  private async 更新设置值(key: string, value: string): Promise<void> {
    if (value.length > 0) {
      await this.repository.setSetting(key, value);
      return;
    }
    await this.repository.deleteSetting(key);
  }

  private async 读取并迁移环境变量(dbKey: string, envKey: string): Promise<string> {
    const persisted = await this.repository.getSetting(dbKey);
    if (persisted !== undefined) {
      return persisted;
    }

    const envValue = (process.env[envKey] || '').trim();
    if (envValue) {
      await this.repository.setSetting(dbKey, envValue);
    }
    return envValue;
  }
}


