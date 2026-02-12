import 配置 from '../../config';
import { apiKeyManager } from '../../core/apikey-manager';
import type DatabaseService from '../../core/database';
import {
  LLM供应商列表,
  所有LLM供应商,
  验证模型,
  type LLMActiveConfigView,
  type LLMConfigView,
  type LLM供应商枚举,
  type LLM供应商选项,
} from './types';

type LLM配置更新参数 = {
  provider?: LLM供应商枚举;
  openai?: { apiKey?: string; model?: string; baseUrl?: string };
  anthropic?: { apiKey?: string; model?: string; baseUrl?: string };
  aliyun?: { apiKey?: string; model?: string; baseUrl?: string };
  deepseek?: { apiKey?: string; model?: string; baseUrl?: string };
  bigmodel?: { apiKey?: string; model?: string; baseUrl?: string };
};

export class 大模型配置服务 {
  constructor(private database: DatabaseService) { }

  private 获取设置键(provider: LLM供应商枚举, field: 'apiKey' | 'model' | 'baseUrl'): string {
    if (field === 'apiKey') {
      return `apiKey.${provider}`;
    }
    return `llm.${provider}.${field}`;
  }

  private 读取设置(settings: Record<string, string>, provider: LLM供应商枚举, field: 'apiKey' | 'model' | 'baseUrl'): string | undefined {
    return settings[this.获取设置键(provider, field)];
  }

  private 是否是有效的HttpUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  getLLMConfig(): LLMConfigView {
    const provider = 配置.llm.provider;
    const providers = {} as LLMConfigView['providers'];

    for (const p of 所有LLM供应商) {
      const cfg = 配置.llm.providers[p];
      providers[p] = {
        model: cfg.model,
        baseUrl: cfg.baseUrl || '',
        hasApiKey: apiKeyManager.has(p),
        apiKeyLength: apiKeyManager.length(p),
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
        const apiKey = providerData.apiKey.trim();
        apiKeyManager.set(provider, apiKey);
        if (apiKey) {
          this.database.setSetting(`apiKey.${provider}`, apiKey);
        } else {
          this.database.deleteSetting(`apiKey.${provider}`);
        }
      }
      if (typeof providerData.model === 'string') {
        if (!验证模型(provider, providerData.model)) {
          throw new Error(`模型 ${providerData.model} 不属于供应商 ${provider}`);
        }
        cfg.model = providerData.model;
        this.database.setSetting(`llm.${provider}.model`, providerData.model);
      }
      if (typeof providerData.baseUrl === 'string') {
        const baseUrl = providerData.baseUrl.trim();
        if (baseUrl && !this.是否是有效的HttpUrl(baseUrl)) {
          throw new Error(`无效的 baseUrl: ${baseUrl}`);
        }
        cfg.baseUrl = baseUrl || undefined;
        this.database.setSetting(`llm.${provider}.baseUrl`, baseUrl);
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
      const apiKey = this.读取设置(settings, p, 'apiKey');
      const cfg = 配置.llm.providers[p];
      const model = this.读取设置(settings, p, 'model');
      const baseUrl = this.读取设置(settings, p, 'baseUrl');

      if (apiKey !== undefined) apiKeyManager.set(p, apiKey);
      if (model !== undefined && 验证模型(p, model)) cfg.model = model;
      if (baseUrl !== undefined) cfg.baseUrl = baseUrl || undefined;

      // 允许从环境变量初始化（不再通过 llm.providers.*.apiKey 作为运行时入口）
      if (apiKey === undefined && p === 'openai' && 配置.asr.openai?.apiKey) {
        apiKeyManager.set(p, 配置.asr.openai.apiKey);
      }
      if (apiKey === undefined && p === 'aliyun' && 配置.asr.aliyun?.apiKey) {
        apiKeyManager.set(p, 配置.asr.aliyun.apiKey);
      }
    }
  }

  getActiveLLMConfig(): LLMActiveConfigView {
    const provider = 配置.llm.provider;
    const activeProvider = 配置.llm.providers[provider];
    return {
      provider,
      model: activeProvider.model,
      baseUrl: activeProvider.baseUrl || '',
      hasApiKey: apiKeyManager.has(provider),
    };
  }
}
