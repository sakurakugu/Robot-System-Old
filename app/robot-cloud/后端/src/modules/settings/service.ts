import config from '../../config';
import { LLM_PROVIDERS, type LLMProviderOption } from '../../config/llm-providers';
import type DatabaseService from '../../core/database';
import type { LLMProvider } from '../../types';

/**
 * LLM 配置视图（不暴露完整 API Key）
 */
interface LLMConfigView {
  provider: LLMProvider;
  providers: Record<LLMProvider, {
    model: string;
    baseUrl: string;
    hasApiKey: boolean;
    apiKeyLength: number;
  }>;
}

/**
 * UI 配置
 */
interface UIConfig {
  serverUrl: string;
  wsPath: string;
  wsControlUrl: string;
  wsBusinessUrl: string;
  wsAudioUploadUrl: string;
  wsAudioDownloadUrl: string;
  maxHistory: number;
  controlLayout: Record<string, { x: number; y: number }> | null;
}

/**
 * 设置服务
 * 统一管理所有系统配置
 */
export class SettingsService {
  constructor(private database: DatabaseService) {}

  /**
   * 获取 LLM 配置（用于前端显示）
   */
  getLLMConfig(): LLMConfigView {
    const provider = config.llm.provider;
    const providers = {} as LLMConfigView['providers'];

    const allProviders: LLMProvider[] = ['openai', 'anthropic', 'tongyi', 'deepseek', 'bigmodel'];
    
    for (const p of allProviders) {
      const cfg = config.llm.providers[p];
      providers[p] = {
        model: cfg.model,
        baseUrl: cfg.baseUrl || '',
        hasApiKey: !!cfg.apiKey && cfg.apiKey.length > 0,
        apiKeyLength: cfg.apiKey?.length || 0,
      };
    }

    return { provider, providers };
  }

  /**
   * 获取 LLM 供应商列表
   */
  getLLMProviders(): LLMProviderOption[] {
    return LLM_PROVIDERS;
  }

  /**
   * 更新 LLM 配置
   */
  updateLLMConfig(data: {
    provider?: LLMProvider;
    openai?: { apiKey?: string; model?: string; baseUrl?: string };
    anthropic?: { apiKey?: string; model?: string; baseUrl?: string };
    tongyi?: { apiKey?: string; model?: string; baseUrl?: string };
    deepseek?: { apiKey?: string; model?: string; baseUrl?: string };
    bigmodel?: { apiKey?: string; model?: string; baseUrl?: string };
  }): { success: boolean } {
    // 更新 provider
    if (data.provider) {
      const validProviders: LLMProvider[] = ['openai', 'anthropic', 'tongyi', 'deepseek', 'bigmodel'];
      if (validProviders.includes(data.provider)) {
        config.llm.provider = data.provider;
        this.database.setSetting('llm.provider', data.provider);
      }
    }

    // 更新各供应商配置
    const providers: LLMProvider[] = ['openai', 'anthropic', 'tongyi', 'deepseek', 'bigmodel'];
    for (const provider of providers) {
      const providerData = data[provider];
      if (!providerData) continue;

      const cfg = config.llm.providers[provider];
      
      if (typeof providerData.apiKey === 'string') {
        cfg.apiKey = providerData.apiKey;
        this.database.setSetting(`${provider}.apiKey`, providerData.apiKey);
      }
      if (typeof providerData.model === 'string') {
        cfg.model = providerData.model;
        this.database.setSetting(`${provider}.model`, providerData.model);
      }
      if (typeof providerData.baseUrl === 'string') {
        cfg.baseUrl = providerData.baseUrl || undefined;
        this.database.setSetting(`${provider}.baseUrl`, providerData.baseUrl);
      }
    }

    return { success: true };
  }

  /**
   * 获取 UI 配置
   */
  getUIConfig(): UIConfig {
    const serverUrl = this.database.getSetting('ui.serverUrl') || '';
    const wsPath = this.database.getSetting('ui.wsPath') || config.ws.path;
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

  /**
   * 从数据库加载配置到内存
   */
  loadPersistedConfig(): void {
    const settings = this.database.getAllSettings();

    // 加载 provider
    const provider = settings['llm.provider'] as LLMProvider;
    if (provider && ['openai', 'anthropic', 'tongyi', 'deepseek', 'bigmodel'].includes(provider)) {
      config.llm.provider = provider;
    }

    // 加载各供应商配置
    const providers: LLMProvider[] = ['openai', 'anthropic', 'tongyi', 'deepseek', 'bigmodel'];
    for (const p of providers) {
      const cfg = config.llm.providers[p];
      const apiKey = settings[`${p}.apiKey`];
      const model = settings[`${p}.model`];
      const baseUrl = settings[`${p}.baseUrl`];

      if (apiKey) cfg.apiKey = apiKey;
      if (model) cfg.model = model;
      if (baseUrl) cfg.baseUrl = baseUrl;
    }
  }

  /**
   * 获取当前激活的 LLM 配置
   */
  getActiveLLMConfig() {
    const provider = config.llm.provider;
    return {
      provider,
      ...config.llm.providers[provider],
    };
  }
}
