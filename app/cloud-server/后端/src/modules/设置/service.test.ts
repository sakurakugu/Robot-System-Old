import 配置 from '../../config';
import type { SettingsRepository } from './repository';
import { 设置服务 } from './service';

function 创建设置仓库Mock(): jest.Mocked<SettingsRepository> {
  return {
    getSetting: jest.fn(),
    getSettings: jest.fn(),
    getAllSettings: jest.fn(),
    setSetting: jest.fn(),
    deleteSetting: jest.fn(),
  };
}

const 原始讯飞配置 = 配置.asr.xunfei ? { ...配置.asr.xunfei } : undefined;
const 原始环境变量 = {
  appId: process.env.XUNFEI_ASR_APP_ID,
  apiKey: process.env.XUNFEI_ASR_API_KEY,
  apiSecret: process.env.XUNFEI_ASR_API_SECRET,
};

function 重置讯飞配置(): void {
  if (原始讯飞配置) {
    配置.asr.xunfei = { ...原始讯飞配置 };
    return;
  }

  delete 配置.asr.xunfei;
}

function 重置环境变量(): void {
  if (原始环境变量.appId === undefined) {
    delete process.env.XUNFEI_ASR_APP_ID;
  } else {
    process.env.XUNFEI_ASR_APP_ID = 原始环境变量.appId;
  }

  if (原始环境变量.apiKey === undefined) {
    delete process.env.XUNFEI_ASR_API_KEY;
  } else {
    process.env.XUNFEI_ASR_API_KEY = 原始环境变量.apiKey;
  }

  if (原始环境变量.apiSecret === undefined) {
    delete process.env.XUNFEI_ASR_API_SECRET;
  } else {
    process.env.XUNFEI_ASR_API_SECRET = 原始环境变量.apiSecret;
  }
}

describe('设置服务', () => {
  afterEach(() => {
    重置讯飞配置();
    重置环境变量();
    jest.clearAllMocks();
  });

  it('loadPersistedAIConfig 应迁移环境变量到数据库', async () => {
    const repository = 创建设置仓库Mock();
    repository.getSetting.mockResolvedValue(undefined);

    process.env.XUNFEI_ASR_APP_ID = ' app-id ';
    process.env.XUNFEI_ASR_API_KEY = ' api-key ';
    process.env.XUNFEI_ASR_API_SECRET = ' api-secret ';

    const service = new 设置服务(repository);
    await service.loadPersistedAIConfig();

    expect(配置.asr.xunfei).toEqual({
      appId: 'app-id',
      apiKey: 'api-key',
      apiSecret: 'api-secret',
    });
    expect(repository.setSetting).toHaveBeenCalledWith('asr.xunfei.appId', 'app-id');
    expect(repository.setSetting).toHaveBeenCalledWith('asr.xunfei.apiKey', 'api-key');
    expect(repository.setSetting).toHaveBeenCalledWith('asr.xunfei.apiSecret', 'api-secret');
  });

  it('getUIConfig 应返回持久化的 UI 配置', async () => {
    const repository = 创建设置仓库Mock();
    repository.getSettings.mockResolvedValue({
      'ui.serverUrl': 'cloud.example.com',
      'ui.maxHistory': '12',
      'ui.controlLayout': '{"left":{"x":1,"y":2}}',
    });

    const service = new 设置服务(repository);
    const result = await service.getUIConfig();

    expect(result.serverUrl).toBe('cloud.example.com');
    expect(result.maxHistory).toBe(12);
    expect(result.controlLayout).toEqual({
      left: { x: 1, y: 2 },
    });
  });

  it('updateUIConfig 应删除空 serverUrl 并更新其他字段', async () => {
    const repository = 创建设置仓库Mock();
    const service = new 设置服务(repository);

    await service.updateUIConfig({
      serverUrl: ' ',
      maxHistory: [18],
      controlLayout: {
        right: { x: 4, y: 6 },
      },
    });

    expect(repository.deleteSetting).toHaveBeenCalledWith('ui.serverUrl');
    expect(repository.setSetting).toHaveBeenCalledWith('ui.maxHistory', '18');
    expect(repository.setSetting).toHaveBeenCalledWith(
      'ui.controlLayout',
      '{"right":{"x":4,"y":6}}',
    );
  });
});
