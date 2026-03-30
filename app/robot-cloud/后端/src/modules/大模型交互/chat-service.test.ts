import type { ConversationRecord } from '../../types';
import type { ConversationRepository } from './repository';
import { 对话服务 } from './chat-service';

jest.mock('../../core/utils/helpers', () => ({
  parseActions: jest.fn(() => []),
}));

jest.mock('../机器人交互/action-controller', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    验证动作: jest.fn((_robotId, actions) => ({
      validActions: actions,
      rejectedActions: [],
    })),
  })),
}));

jest.mock('./llm-service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    获取系统提示: jest.fn(() => '系统提示'),
    对话: jest.fn(async () => ({
      content: '助手回复',
      model: 'mock-model',
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    })),
    视觉分析: jest.fn(async () => ({
      content: '视觉回复',
      model: 'mock-vision-model',
      finishReason: 'stop',
      usage: {
        promptTokens: 11,
        completionTokens: 22,
        totalTokens: 33,
      },
    })),
  })),
}));

function 创建对话仓库Mock(): jest.Mocked<ConversationRepository> {
  return {
    createConversation: jest.fn(),
    getRecentConversationMessages: jest.fn(),
    listConversations: jest.fn(),
    clearConversations: jest.fn(),
    createActionLog: jest.fn(),
    listActionLogs: jest.fn(),
  };
}

function 创建对话记录(partial: Partial<ConversationRecord> = {}): ConversationRecord {
  return {
    uuid: 1,
    robot_id: 'robot-1',
    conversation_id: 'conv-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    type: 'text',
    user_input: '用户问题',
    ai_response: '助手回复',
    actions: '[]',
    processing_time: 123,
    metadata: '{"from":"test"}',
    ...partial,
  };
}

describe('对话服务', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('处理消息 在内存历史为空时应回灌数据库历史', async () => {
    const repository = 创建对话仓库Mock();
    repository.getRecentConversationMessages.mockResolvedValue([
      {
        role: 'user',
        content: '上一个问题',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        role: 'assistant',
        content: '上一个回答',
        timestamp: new Date('2026-01-01T00:00:01.000Z'),
      },
    ]);

    const service = new 对话服务(repository);
    const result = await service.处理消息('robot-1', '新的问题', { maxHistory: 2 });

    expect(repository.getRecentConversationMessages).toHaveBeenCalledWith('robot-1', 2);
    expect(result.text).toBe('助手回复');
    expect(result.metadata.model).toBe('mock-model');
    expect(result.metadata.tokensUsed).toBe(30);
  });

  it('获取历史 应委托仓库查询', async () => {
    const repository = 创建对话仓库Mock();
    repository.listConversations.mockResolvedValue([创建对话记录()]);

    const service = new 对话服务(repository);
    const result = await service.获取历史('robot-1', 20, 5);

    expect(repository.listConversations).toHaveBeenCalledWith('robot-1', 20, 5);
    expect(result).toHaveLength(1);
    expect(result[0].robot_id).toBe('robot-1');
  });

  it('清除历史 应清掉内存并删除数据库记录', async () => {
    const repository = 创建对话仓库Mock();
    repository.getRecentConversationMessages.mockResolvedValue([]);

    const service = new 对话服务(repository);
    await service.处理消息('robot-1', '先写入一条');
    await service.清除历史('robot-1');

    expect(repository.clearConversations).toHaveBeenCalledWith('robot-1');
  });
});
