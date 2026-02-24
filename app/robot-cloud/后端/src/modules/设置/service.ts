import 配置 from '../../config';
import type DatabaseService from '../../core/database';
import type { AIConfig, UIConfig } from './types';

/**
 * 设置服务
 * 统一管理所有系统配置
 */
export class 设置服务 {
  constructor(private database: DatabaseService) { }

  /**
   * 加载 AI 相关配置（优先数据库，其次 .env）
   */
  loadPersistedAIConfig(): void {
    const appId = this.读取并迁移环境变量('asr.xunfei.appId', 'XUNFEI_ASR_APP_ID');
    const apiKey = this.读取并迁移环境变量('asr.xunfei.apiKey', 'XUNFEI_ASR_API_KEY');
    const apiSecret = this.读取并迁移环境变量('asr.xunfei.apiSecret', 'XUNFEI_ASR_API_SECRET');

    if (!配置.asr.xunfei) {
      配置.asr.xunfei = { appId: '', apiKey: '', apiSecret: '' };
    }

    配置.asr.xunfei.appId = appId;
    配置.asr.xunfei.apiKey = apiKey;
    配置.asr.xunfei.apiSecret = apiSecret;
  }

  getAIConfig(): AIConfig {
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

  updateAIConfig(data: Partial<{
    xunfeiAsr: {
      appId?: string;
      apiKey?: string;
      apiSecret?: string;
    };
  }>): { success: boolean } {
    if (!data.xunfeiAsr) {
      return { success: true };
    }

    if (!配置.asr.xunfei) {
      配置.asr.xunfei = { appId: '', apiKey: '', apiSecret: '' };
    }

    const xunfei = data.xunfeiAsr;
    if (typeof xunfei.appId === 'string') {
      const value = xunfei.appId.trim();
      配置.asr.xunfei.appId = value;
      this.更新设置值('asr.xunfei.appId', value);
    }
    if (typeof xunfei.apiKey === 'string') {
      const value = xunfei.apiKey.trim();
      配置.asr.xunfei.apiKey = value;
      this.更新设置值('asr.xunfei.apiKey', value);
    }
    if (typeof xunfei.apiSecret === 'string') {
      const value = xunfei.apiSecret.trim();
      配置.asr.xunfei.apiSecret = value;
      this.更新设置值('asr.xunfei.apiSecret', value);
    }

    return { success: true };
  }

  /**
   * 获取 UI 配置
   */
  getUIConfig(): UIConfig {
    const serverUrl = this.database.getSetting('ui.serverUrl') || '';
    const wsPath = this.database.getSetting('ui.wsPath') || 配置.ws.path;
    const wsControlUrl = this.database.getSetting('ui.wsControlUrl') || '';
    const wsBusinessUrl = this.database.getSetting('ui.wsBusinessUrl') || '';
    const wsAudioUploadUrl = this.database.getSetting('ui.wsAudioUploadUrl') || '';
    const wsAudioDownloadUrl = this.database.getSetting('ui.wsAudioDownloadUrl') || '';

    const mhRaw = this.database.getSetting('ui.maxHistory');
    const maxHistory = mhRaw ? parseInt(mhRaw, 10) || 10 : 10;

    let controlLayout: UIConfig['controlLayout'] = null;
    const layoutRaw = this.database.getSetting('ui.controlLayout');
    if (layoutRaw) {
      try {
        controlLayout = JSON.parse(layoutRaw);
      } catch {
        controlLayout = null;
      }
    }

    return {
      serverUrl,
      wsPath,
      wsControlUrl,
      wsBusinessUrl,
      wsAudioUploadUrl,
      wsAudioDownloadUrl,
      maxHistory,
      controlLayout,
    };
  }

  /**
   * 更新 UI 配置
   */
  updateUIConfig(data: Partial<{
    serverUrl: string;
    wsPath: string;
    wsControlUrl: string;
    wsBusinessUrl: string;
    wsAudioUploadUrl: string;
    wsAudioDownloadUrl: string;
    maxHistory: number | number[];
    controlLayout: Record<string, { x: number; y: number }> | string;
  }>): void {
    const stringFields = [
      'serverUrl', 'wsPath', 'wsControlUrl',
      'wsBusinessUrl', 'wsAudioUploadUrl', 'wsAudioDownloadUrl'
    ] as const;

    for (const field of stringFields) {
      if (typeof data[field] === 'string') {
        this.database.setSetting(`ui.${field}`, data[field] as string);
      }
    }

    if (data.maxHistory !== undefined) {
      const mh = Array.isArray(data.maxHistory)
        ? Number(data.maxHistory[0])
        : Number(data.maxHistory);
      if (!Number.isNaN(mh)) {
        this.database.setSetting('ui.maxHistory', String(mh));
      }
    }

    if (data.controlLayout !== undefined) {
      const layoutValue = typeof data.controlLayout === 'string'
        ? data.controlLayout
        : JSON.stringify(data.controlLayout || {});
      this.database.setSetting('ui.controlLayout', layoutValue);
    }
  }

  private 更新设置值(key: string, value: string): void {
    if (value.length > 0) {
      this.database.setSetting(key, value);
      return;
    }
    this.database.deleteSetting(key);
  }

  private 读取并迁移环境变量(dbKey: string, envKey: string): string {
    const persisted = this.database.getSetting(dbKey);
    if (persisted !== undefined) {
      return persisted;
    }

    const envValue = (process.env[envKey] || '').trim();
    if (envValue) {
      this.database.setSetting(dbKey, envValue);
    }
    return envValue;
  }
}


