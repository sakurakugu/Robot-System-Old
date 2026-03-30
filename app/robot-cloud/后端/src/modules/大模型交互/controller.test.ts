import express from 'express';
import request from 'supertest';
import type { ConversationRecord } from '../../types';
import type { 对话服务 } from './chat-service';
import { 对话控制器 } from './controller';
import type { ConversationRepository } from './repository';

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

function 创建应用() {
  const conversationService = {
    获取历史: jest.fn(),
  } as unknown as 对话服务;

  const repository = {
    createConversation: jest.fn(),
  } as unknown as ConversationRepository;

  const controller = new 对话控制器(conversationService, repository);
  const app = express();
  app.use(express.json());
  app.get('/history/:robotId', controller.getHistory);
  app.post('/command/:robotId', controller.sendCommand);

  return { app, conversationService, repository };
}

describe('对话控制器', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('getHistory 应返回对话历史', async () => {
    const { app, conversationService } = 创建应用();
    (conversationService.获取历史 as jest.Mock).mockResolvedValue([创建对话记录()]);

    const response = await request(app).get('/history/robot-1?limit=20&offset=5');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.limit).toBe(20);
    expect(response.body.data.offset).toBe(5);
    expect((conversationService.获取历史 as jest.Mock)).toHaveBeenCalledWith('robot-1', 20, 5);
  });

  it('sendCommand 应写入控制端对话记录', async () => {
    const { app, repository } = 创建应用();

    const response = await request(app)
      .post('/command/robot-1')
      .send({ text: '前进' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect((repository.createConversation as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        robot_id: 'robot-1',
        user_input: '[controller] 前进',
        ai_response: '前进',
        metadata: { from: 'controller' },
      }),
    );
  });

  it('sendCommand 缺少文本时应返回 400', async () => {
    const { app, repository } = 创建应用();

    const response = await request(app)
      .post('/command/robot-1')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect((repository.createConversation as jest.Mock)).not.toHaveBeenCalled();
  });
});
