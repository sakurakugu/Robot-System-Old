import 配置 from '../../config';
import type DatabaseService from '../../core/database';
import { LLM供应商列表, 所有LLM供应商, type LLMConfigView, type LLM供应商枚举, type LLM供应商选项 } from './types';

type LLM配置更新参数 = {
  provider?: LLM供应商枚举;
  openai?: { apiKey?: string; model?: string; baseUrl?: string };
  anthropic?: { apiKey?: string; model?: string; baseUrl?: string };
  tongyi?: { apiKey?: string; model?: string; baseUrl?: string };
  deepseek?: { apiKey?: string; model?: string; baseUrl?: string };
  bigmodel?: { apiKey?: string; model?: string; baseUrl?: string };
};

export class 大模型配置服务 {
  constructor(private database: DatabaseService) { }

  getLLMConfig(): LLMConfigView {
    const provider = 配置.llm.provider;
    const providers = {} as LLMConfigView['providers'];

    for (const p of 所有LLM供应商) {
      const cfg = 配置.llm.providers[p];
      providers[p] = {
        model: cfg.model,
        baseUrl: cfg.baseUrl || '',
        hasApiKey: !!cfg.apiKey && cfg.apiKey.length > 0,
        apiKeyLength: cfg.apiKey?.length || 0,
      };
    }

    return { provider, providers };
  }

  getLLMProviders(): LLM供应商选项[] {
    return LLM供应商列表;
  }

  updateLLMConfig(data: LLM配置更新参数): { success: boolean } {
    if (data.provider && 所有LLM供应商.includes(data.provider)) {
      配置.llm.provider = data.provider;
      this.database.setSetting('llm.provider', data.provider);
    }

    for (const provider of 所有LLM供应商) {
      const providerData = data[provider];
      if (!providerData) continue;

      const cfg = 配置.llm.providers[provider];
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

  loadPersistedConfig(): void {
    const settings = this.database.getAllSettings();

    const provider = settings['llm.provider'] as LLM供应商枚举;
    if (provider && 所有LLM供应商.includes(provider)) {
      配置.llm.provider = provider;
    }

    for (const p of 所有LLM供应商) {
      const cfg = 配置.llm.providers[p];
      const apiKey = settings[`${p}.apiKey`];
      const model = settings[`${p}.model`];
      const baseUrl = settings[`${p}.baseUrl`];

      if (apiKey) cfg.apiKey = apiKey;
      if (model) cfg.model = model;
      if (baseUrl) cfg.baseUrl = baseUrl;
    }
  }

  getActiveLLMConfig() {
    const provider = 配置.llm.provider;
    return {
      provider,
      ...配置.llm.providers[provider],
    };
  }
}
