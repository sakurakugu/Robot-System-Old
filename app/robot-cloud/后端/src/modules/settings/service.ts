import config from '../../config';
import { 大模型供应商 } from '../../config/llm-providers';
import 数据库服务 from '../../core/database';

export class SettingsService {
  constructor(private database: 数据库服务) {}

  getParamsConfig() {
    const provider = this.database.get_参数('llm.provider') || '';
    const openaiKey = this.database.get_参数('openai.apiKey') || '';
    const openaiModel = this.database.get_参数('openai.model') || '';
    const openaiBaseUrl = this.database.get_参数('openai.baseUrl') || '';
    const bigKey = this.database.get_参数('bigmodel.apiKey') || '';
    const bigModel = this.database.get_参数('bigmodel.model') || '';
    const bigBaseUrl = this.database.get_参数('bigmodel.baseUrl') || '';
    const anthropicKey = this.database.get_参数('anthropic.apiKey') || '';
    const anthropicModel = this.database.get_参数('anthropic.model') || '';
    const anthropicBaseUrl = this.database.get_参数('anthropic.baseUrl') || '';
    const deepseekKey = this.database.get_参数('deepseek.apiKey') || '';
    const deepseekModel = this.database.get_参数('deepseek.model') || '';
    const deepseekBaseUrl = this.database.get_参数('deepseek.baseUrl') || '';
    const tongyiKey = this.database.get_参数('tongyi.apiKey') || '';
    const tongyiModel = this.database.get_参数('tongyi.model') || '';
    const tongyiBaseUrl = this.database.get_参数('tongyi.baseUrl') || '';

    return {
      provider,
      openai: {
        model: openaiModel,
        baseUrl: openaiBaseUrl,
        hasApiKey: !!(openaiKey && String(openaiKey).length > 0),
        apiKeyLength: openaiKey ? String(openaiKey).length : 0
      },
      bigmodel: {
        model: bigModel,
        baseUrl: bigBaseUrl,
        hasApiKey: !!(bigKey && String(bigKey).length > 0),
        apiKeyLength: bigKey ? String(bigKey).length : 0
      },
      anthropic: {
        model: anthropicModel,
        baseUrl: anthropicBaseUrl,
        hasApiKey: !!(anthropicKey && String(anthropicKey).length > 0),
        apiKeyLength: anthropicKey ? String(anthropicKey).length : 0
      },
      deepseek: {
        model: deepseekModel,
        baseUrl: deepseekBaseUrl,
        hasApiKey: !!(deepseekKey && String(deepseekKey).length > 0),
        apiKeyLength: deepseekKey ? String(deepseekKey).length : 0
      },
      tongyi: {
        model: tongyiModel,
        baseUrl: tongyiBaseUrl,
        hasApiKey: !!(tongyiKey && String(tongyiKey).length > 0),
        apiKeyLength: tongyiKey ? String(tongyiKey).length : 0
      }
    };
  }

  getLLMConfig() {
    const provider = config.llm.provider;
    const openai = config.llm.openai;
    const bigmodel = config.llm.bigmodel;
    
    // 获取所有服务商的配置
    const allConfigs: any = {
      provider
    };

    // OpenAI
    allConfigs.openai = {
      model: openai?.model || '',
      baseUrl: openai?.baseUrl || '',
      hasApiKey: !!(openai?.apiKey && String(openai.apiKey).length > 0),
      apiKeyLength: openai?.apiKey ? String(openai.apiKey).length : 0
    };

    // BigModel
    allConfigs.bigmodel = {
      model: bigmodel?.model || '',
      baseUrl: bigmodel?.baseUrl || '',
      hasApiKey: !!(bigmodel?.apiKey && String(bigmodel.apiKey).length > 0),
      apiKeyLength: bigmodel?.apiKey ? String(bigmodel.apiKey).length : 0
    };

    // Anthropic (如果有的话)
    const anthropicApiKey = this.database.get_设置('anthropic.apiKey');
    const anthropicModel = this.database.get_设置('anthropic.model');
    const anthropicBaseUrl = this.database.get_设置('anthropic.baseUrl');
    allConfigs.anthropic = {
      model: anthropicModel || '',
      baseUrl: anthropicBaseUrl || '',
      hasApiKey: !!(anthropicApiKey && String(anthropicApiKey).length > 0),
      apiKeyLength: anthropicApiKey ? String(anthropicApiKey).length : 0
    };

    // DeepSeek (如果有的话)
    const deepseekApiKey = this.database.get_设置('deepseek.apiKey');
    const deepseekModel = this.database.get_设置('deepseek.model');
    const deepseekBaseUrl = this.database.get_设置('deepseek.baseUrl');
    allConfigs.deepseek = {
      model: deepseekModel || '',
      baseUrl: deepseekBaseUrl || '',
      hasApiKey: !!(deepseekApiKey && String(deepseekApiKey).length > 0),
      apiKeyLength: deepseekApiKey ? String(deepseekApiKey).length : 0
    };

    // Tongyi (如果有的话)
    const tongyiApiKey = this.database.get_设置('tongyi.apiKey');
    const tongyiModel = this.database.get_设置('tongyi.model');
    const tongyiBaseUrl = this.database.get_设置('tongyi.baseUrl');
    allConfigs.tongyi = {
      model: tongyiModel || '',
      baseUrl: tongyiBaseUrl || '',
      hasApiKey: !!(tongyiApiKey && String(tongyiApiKey).length > 0),
      apiKeyLength: tongyiApiKey ? String(tongyiApiKey).length : 0
    };
    
    return allConfigs;
  }

  getLLMProviders() {
    return 大模型供应商;
  }

  updateParams(data: {
    provider?: string;
    openai?: { apiKey?: string; model?: string; baseUrl?: string };
    bigmodel?: { apiKey?: string; model?: string; baseUrl?: string };
    anthropic?: { apiKey?: string; model?: string; baseUrl?: string };
    deepseek?: { apiKey?: string; model?: string; baseUrl?: string };
    tongyi?: { apiKey?: string; model?: string; baseUrl?: string };
  }) {
    if (typeof data.provider === 'string' && data.provider.length > 0) {
      this.database.set_参数('llm.provider', data.provider);
      this.database.set_设置('llm.provider', data.provider);
      (config.llm as any).provider = data.provider as any;
    }
    if (data.openai) {
      if (typeof data.openai.apiKey === 'string') {
        this.database.set_参数('openai.apiKey', data.openai.apiKey);
        this.database.set_设置('openai.apiKey', data.openai.apiKey);
        config.llm.openai = config.llm.openai || { apiKey: '', model: '' };
        config.llm.openai.apiKey = data.openai.apiKey;
      }
      if (typeof data.openai.model === 'string') {
        this.database.set_参数('openai.model', data.openai.model);
        this.database.set_设置('openai.model', data.openai.model);
        config.llm.openai = config.llm.openai || { apiKey: '', model: '' };
        config.llm.openai.model = data.openai.model;
      }
      if (typeof data.openai.baseUrl === 'string') {
        this.database.set_参数('openai.baseUrl', data.openai.baseUrl || '');
        this.database.set_设置('openai.baseUrl', data.openai.baseUrl || '');
        config.llm.openai = config.llm.openai || { apiKey: '', model: '' };
        config.llm.openai.baseUrl = data.openai.baseUrl || undefined;
      }
    }
    if (data.bigmodel) {
      if (typeof data.bigmodel.apiKey === 'string') {
        this.database.set_参数('bigmodel.apiKey', data.bigmodel.apiKey);
        this.database.set_设置('bigmodel.apiKey', data.bigmodel.apiKey);
        config.llm.bigmodel = config.llm.bigmodel || { apiKey: '', model: '' };
        config.llm.bigmodel.apiKey = data.bigmodel.apiKey;
      }
      if (typeof data.bigmodel.model === 'string') {
        this.database.set_参数('bigmodel.model', data.bigmodel.model);
        this.database.set_设置('bigmodel.model', data.bigmodel.model);
        config.llm.bigmodel = config.llm.bigmodel || { apiKey: '', model: '' };
        config.llm.bigmodel.model = data.bigmodel.model;
      }
      if (typeof data.bigmodel.baseUrl === 'string') {
        this.database.set_参数('bigmodel.baseUrl', data.bigmodel.baseUrl || '');
        this.database.set_设置('bigmodel.baseUrl', data.bigmodel.baseUrl || '');
        config.llm.bigmodel = config.llm.bigmodel || { apiKey: '', model: '' };
        config.llm.bigmodel.baseUrl = data.bigmodel.baseUrl || undefined;
      }
    }
    if (data.anthropic) {
      if (typeof data.anthropic.apiKey === 'string') {
        this.database.set_参数('anthropic.apiKey', data.anthropic.apiKey);
        this.database.set_设置('anthropic.apiKey', data.anthropic.apiKey);
      }
      if (typeof data.anthropic.model === 'string') {
        this.database.set_参数('anthropic.model', data.anthropic.model);
        this.database.set_设置('anthropic.model', data.anthropic.model);
      }
      if (typeof data.anthropic.baseUrl === 'string') {
        this.database.set_参数('anthropic.baseUrl', data.anthropic.baseUrl || '');
        this.database.set_设置('anthropic.baseUrl', data.anthropic.baseUrl || '');
      }
    }
    if (data.deepseek) {
      if (typeof data.deepseek.apiKey === 'string') {
        this.database.set_参数('deepseek.apiKey', data.deepseek.apiKey);
        this.database.set_设置('deepseek.apiKey', data.deepseek.apiKey);
      }
      if (typeof data.deepseek.model === 'string') {
        this.database.set_参数('deepseek.model', data.deepseek.model);
        this.database.set_设置('deepseek.model', data.deepseek.model);
      }
      if (typeof data.deepseek.baseUrl === 'string') {
        this.database.set_参数('deepseek.baseUrl', data.deepseek.baseUrl || '');
        this.database.set_设置('deepseek.baseUrl', data.deepseek.baseUrl || '');
      }
    }
    if (data.tongyi) {
      if (typeof data.tongyi.apiKey === 'string') {
        this.database.set_参数('tongyi.apiKey', data.tongyi.apiKey);
        this.database.set_设置('tongyi.apiKey', data.tongyi.apiKey);
        config.llm.tongyi = config.llm.tongyi || { apiKey: '', model: '' };
        config.llm.tongyi.apiKey = data.tongyi.apiKey;
      }
      if (typeof data.tongyi.model === 'string') {
        this.database.set_参数('tongyi.model', data.tongyi.model);
        this.database.set_设置('tongyi.model', data.tongyi.model);
        config.llm.tongyi = config.llm.tongyi || { apiKey: '', model: '' };
        config.llm.tongyi.model = data.tongyi.model;
      }
      if (typeof data.tongyi.baseUrl === 'string') {
        this.database.set_参数('tongyi.baseUrl', data.tongyi.baseUrl || '');
        this.database.set_设置('tongyi.baseUrl', data.tongyi.baseUrl || '');
        config.llm.tongyi = config.llm.tongyi || { apiKey: '', model: '' };
        config.llm.tongyi.baseUrl = data.tongyi.baseUrl || undefined;
      }
    }
    return { success: true };
  }

  updateLLMConfig(data: {
    provider?: string;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }) {
    const validProviders = ['openai', 'bigmodel', 'anthropic', 'deepseek', 'tongyi'];
    const finalProvider = validProviders.includes(data.provider || '') 
      ? data.provider 
      : config.llm.provider;
    
    config.llm.provider = finalProvider as any;
    this.database.set_设置('llm.provider', finalProvider as string);

    // 根据服务商保存配置
    if (finalProvider === 'openai') {
      config.llm.openai = config.llm.openai || { apiKey: '', model: '' };
      if (typeof data.apiKey === 'string') {
        config.llm.openai.apiKey = data.apiKey;
        this.database.set_设置('openai.apiKey', data.apiKey);
      }
      if (typeof data.model === 'string') {
        config.llm.openai.model = data.model;
        this.database.set_设置('openai.model', data.model);
      }
      if (typeof data.baseUrl === 'string') {
        config.llm.openai.baseUrl = data.baseUrl || undefined;
        this.database.set_设置('openai.baseUrl', data.baseUrl || '');
      }
    } else if (finalProvider === 'bigmodel') {
      config.llm.bigmodel = config.llm.bigmodel || { apiKey: '', model: '' };
      if (typeof data.apiKey === 'string') {
        config.llm.bigmodel.apiKey = data.apiKey;
        this.database.set_设置('bigmodel.apiKey', data.apiKey);
      }
      if (typeof data.model === 'string') {
        config.llm.bigmodel.model = data.model;
        this.database.set_设置('bigmodel.model', data.model);
      }
      if (typeof data.baseUrl === 'string') {
        config.llm.bigmodel.baseUrl = data.baseUrl || undefined;
        this.database.set_设置('bigmodel.baseUrl', data.baseUrl || '');
      }
    } else if (finalProvider === 'anthropic') {
      if (typeof data.apiKey === 'string') {
        this.database.set_设置('anthropic.apiKey', data.apiKey);
      }
      if (typeof data.model === 'string') {
        this.database.set_设置('anthropic.model', data.model);
      }
      if (typeof data.baseUrl === 'string') {
        this.database.set_设置('anthropic.baseUrl', data.baseUrl || '');
      }
    } else if (finalProvider === 'deepseek') {
      if (typeof data.apiKey === 'string') {
        this.database.set_设置('deepseek.apiKey', data.apiKey);
      }
      if (typeof data.model === 'string') {
        this.database.set_设置('deepseek.model', data.model);
      }
      if (typeof data.baseUrl === 'string') {
        this.database.set_设置('deepseek.baseUrl', data.baseUrl || '');
      }
    } else if (finalProvider === 'tongyi') {
      config.llm.tongyi = config.llm.tongyi || { apiKey: '', model: '' };
      if (typeof data.apiKey === 'string') {
        config.llm.tongyi.apiKey = data.apiKey;
        this.database.set_设置('tongyi.apiKey', data.apiKey);
      }
      if (typeof data.model === 'string') {
        config.llm.tongyi.model = data.model;
        this.database.set_设置('tongyi.model', data.model);
      }
      if (typeof data.baseUrl === 'string') {
        config.llm.tongyi.baseUrl = data.baseUrl || undefined;
        this.database.set_设置('tongyi.baseUrl', data.baseUrl || '');
      }
    }

    return { provider: config.llm.provider };
  }

  getUIConfig() {
    const serverUrl = this.database.get_设置('ui.serverUrl') || '';
    const wsPath = this.database.get_设置('ui.wsPath') || config.ws.path || '/api/v1/interaction/connect';
    const wsControlUrl = this.database.get_设置('ui.wsControlUrl') || '';
    const wsBusinessUrl = this.database.get_设置('ui.wsBusinessUrl') || '';
    const wsAudioUploadUrl = this.database.get_设置('ui.wsAudioUploadUrl') || '';
    const wsAudioDownloadUrl = this.database.get_设置('ui.wsAudioDownloadUrl') || '';
    const mhRaw = this.database.get_设置('ui.maxHistory');
    const maxHistory = mhRaw ? parseInt(mhRaw, 10) || 10 : 10;
    const layoutRaw = this.database.get_设置('ui.controlLayout');
    let controlLayout: any = null;
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

  updateUIConfig(data: {
    serverUrl?: string;
    wsPath?: string;
    wsControlUrl?: string;
    wsBusinessUrl?: string;
    wsAudioUploadUrl?: string;
    wsAudioDownloadUrl?: string;
    maxHistory?: number | number[];
    controlLayout?: Record<string, { x: number; y: number }> | string;
  }) {
    if (typeof data.serverUrl === 'string') {
      this.database.set_设置('ui.serverUrl', data.serverUrl);
    }
    if (typeof data.wsPath === 'string') {
      this.database.set_设置('ui.wsPath', data.wsPath);
    }
    if (typeof data.wsControlUrl === 'string') {
      this.database.set_设置('ui.wsControlUrl', data.wsControlUrl);
    }
    if (typeof data.wsBusinessUrl === 'string') {
      this.database.set_设置('ui.wsBusinessUrl', data.wsBusinessUrl);
    }
    if (typeof data.wsAudioUploadUrl === 'string') {
      this.database.set_设置('ui.wsAudioUploadUrl', data.wsAudioUploadUrl);
    }
    if (typeof data.wsAudioDownloadUrl === 'string') {
      this.database.set_设置('ui.wsAudioDownloadUrl', data.wsAudioDownloadUrl);
    }
    if (typeof data.maxHistory !== 'undefined') {
      const mh = Array.isArray(data.maxHistory) ? Number(data.maxHistory[0]) : Number(data.maxHistory);
      if (!Number.isNaN(mh)) {
        this.database.set_设置('ui.maxHistory', String(mh));
      }
    }
    if (typeof data.controlLayout !== 'undefined') {
      const layoutValue = typeof data.controlLayout === 'string'
        ? data.controlLayout
        : JSON.stringify(data.controlLayout || {});
      this.database.set_设置('ui.controlLayout', layoutValue);
    }
  }

  checkUpdate(robotId?: string) {
    const robot = robotId ? this.database.get_机器人(robotId) : undefined;
    return {
      checkedAt: new Date().toISOString(),
      app: { currentVersion: '', latestVersion: '', hasUpdate: false },
      firmware: { currentVersion: robot?.version || '', latestVersion: robot?.version || '', hasUpdate: false },
    };
  }
}
