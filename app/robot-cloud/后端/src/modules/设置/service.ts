import 配置 from '../../config';
import type DatabaseService from '../../core/database';
import type { UIConfig } from './types';

/**
 * 设置服务
 * 统一管理所有系统配置
 */
export class 设置服务 {
  constructor(private database: DatabaseService) { }

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

}


