import 配置 from '../../config';
import { apiKeyManager } from '../../core/config/apikey-manager';
import type { SettingsRepository } from '../设置/repository';
import { 大模型配置服务 } from './service';
import { 所有LLM供应商, type LLM供应商配置, type LLM供应商枚举 } from './types';

function 创建设置仓库Mock(): jest.Mocked<SettingsRepository> {
  return {
    getSetting: jest.fn(),
    getSettings: jest.fn(),
    getAllSettings: jest.fn(),
    setSetting: jest.fn(),
    deleteSetting: jest.fn(),
  };
}

const 原始LLM配置 = {
  provider: 配置.llm.provider,
  providers: Object.fromEntries(
    所有LLM供应商.map((provider) => [provider, { ...配置.llm.providers[provider] }]),
  ) as Record<LLM供应商枚举, LLM供应商配置>,
};

const 原始ApiKey = Object.fromEntries(
  所有LLM供应商.map((provider) => [provider, apiKeyManager.get(provider)]),
) as Record<LLM供应商枚举, string>;

function 重置LLM配置(): void {
  配置.llm.provider = 原始LLM配置.provider;
  for (const provider of 所有LLM供应商) {
    配置.llm.providers[provider] = { ...原始LLM配置.providers[provider] };
    apiKeyManager.set(provider, 原始ApiKey[provider]);
  }
}

describe('大模型配置服务', () => {
  afterEach(() => {
    重置LLM配置();
    jest.clearAllMocks();
  });

  it('loadPersistedConfig 应加载持久化的大模型配置', async () => {
    const repository = 创建设置仓库Mock();
    repository.getAllSettings.mockResolvedValue({
      'llm.provider': 'deepseek',
      'apiKey.deepseek': 'sk-deepseek',
      'llm.deepseek.model': 'deepseek-reasoner',
      'llm.deepseek.baseUrl': 'https://deepseek.example.com/v1',
    });

    const service = new 大模型配置服务(repository);
    await service.loadPersistedConfig();
    const result = await service.getActiveLLMConfig();

    expect(result.provider).toBe('deepseek');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.baseUrl).toBe('https://deepseek.example.com/v1');
    expect(result.hasApiKey).toBe(true);
  });

  it('updateLLMConfig 应校验模型归属', async () => {
    const repository = 创建设置仓库Mock();
    const service = new 大模型配置服务(repository);

    await expect(
      service.updateLLMConfig({
        aliyun: {
          model: 'gpt-5',
        },
      }),
    ).rejects.toThrow('模型 gpt-5 不属于供应商 aliyun');
  });

  it('updateLLMConfig 应更新内存配置并持久化', async () => {
    const repository = 创建设置仓库Mock();
    const service = new 大模型配置服务(repository);

    await service.updateLLMConfig({
      provider: 'openai',
      openai: {
        apiKey: ' sk-openai ',
        model: 'gpt-5',
        baseUrl: 'https://openai.example.com/v1',
      },
    });

    const result = await service.getLLMConfig();

    expect(result.provider).toBe('openai');
    expect(result.providers.openai.model).toBe('gpt-5');
    expect(result.providers.openai.baseUrl).toBe('https://openai.example.com/v1');
    expect(result.providers.openai.hasApiKey).toBe(true);
    expect(repository.setSetting).toHaveBeenCalledWith('llm.provider', 'openai');
    expect(repository.setSetting).toHaveBeenCalledWith('apiKey.openai', 'sk-openai');
    expect(repository.setSetting).toHaveBeenCalledWith('llm.openai.model', 'gpt-5');
    expect(repository.setSetting).toHaveBeenCalledWith(
      'llm.openai.baseUrl',
      'https://openai.example.com/v1',
    );
  });
});
