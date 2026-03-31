import type { Request } from 'express';
import {
  处理控制器,
  返回数据,
  返回消息,
} from '../../shared/http/controller';
import { Http错误工厂 } from '../../shared/http/errors';
import type { 对话服务 } from './chat-service';
import type { ConversationRepository } from './repository';

export class 对话控制器 {
  constructor(
    private conversationService: 对话服务,
    private repository: ConversationRepository,
  ) {}

  private 获取参数(req: Request, key: string): string {
    const v = (req.params as Record<string, unknown>)[key];
    return Array.isArray(v) ? String(v[0]) : String(v ?? '');
  }

  /**
   * 获取对话历史
   */
  getHistory = 处理控制器((req: Request) => {
    const robotId = this.获取参数(req, 'robotId');
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    return this.conversationService.获取历史(robotId, limit, offset).then((conversations) => 返回数据({
      conversations,
      limit,
      offset,
    }));
  });

  /**
   * 发送文本到指定机器人（由前端控制面调用）
   */
  sendCommand = 处理控制器(async (req: Request) => {
      const robotId = this.获取参数(req, 'robotId');
      const { text } = req.body || {};
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw Http错误工厂.参数错误('缺少文本内容');
      }

      // 记录到对话历史（标记为控制端直接下发）
      await this.repository.createConversation({
        robot_id: robotId,
        type: 'text',
        user_input: `[controller] ${String(text)}`,
        ai_response: String(text),
        actions: [],
        processing_time: 0,
        metadata: { from: 'controller' },
      });

      return 返回消息('已发送');
  });
}
