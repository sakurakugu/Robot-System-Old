import type { Request, Response } from 'express';
import type DatabaseService from '../../core/database';
import type { ConversationService } from './service';

export class 对话控制器 {
  constructor(
    private conversationService: ConversationService,
    private database: DatabaseService
  ) {}

  private 获取参数(req: Request, key: string): string {
    const v = (req.params as Record<string, unknown>)[key];
    return Array.isArray(v) ? String(v[0]) : String(v ?? '');
  }

  /**
   * 获取对话历史
   */
  getHistory = async (req: Request, res: Response) => {
    try {
      const robotId = this.获取参数(req, 'robotId');
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const conversations = this.conversationService.获取历史(robotId, limit, offset);

      res.json({
        success: true,
        data: {
          conversations,
          limit,
          offset,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  /**
   * 发送文本到指定机器人（由前端控制面调用）
   */
  sendCommand = async (req: Request, res: Response) => {
    try {
      const robotId = this.获取参数(req, 'robotId');
      const { text } = req.body || {};
      if (typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ success: false, error: '缺少文本内容' });
      }

      // 记录到对话历史（标记为控制端直接下发）
      this.database.insertConversation({
        robot_id: robotId,
        type: 'text',
        user_input: `[controller] ${String(text)}`,
        ai_response: String(text),
        actions: [],
        processing_time: 0,
        metadata: { from: 'controller' },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

export { 对话控制器 as ConversationController };