import type DatabaseService from '../../core/database';
import { parseActions, removeActionTags } from '../../core/utils/helpers';
import { ActionController } from './action-controller';
import { LLMService } from './llm-service';
import type { AIResponse, ConversationContext, Message } from './types';

export class 对话服务 {
  private llmService: LLMService;
  private actionController: ActionController;
  private conversationHistory: Map<string, Message[]>;

  constructor(private database: DatabaseService) {
    this.llmService = new LLMService();
    this.actionController = new ActionController();
    this.conversationHistory = new Map();
  }

  /**
   * 处理用户消息
   */
  async 处理消息(
    robotId: string,
    userMessage: string,
    context?: Partial<ConversationContext>
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // 获取或初始化对话历史
      let history = this.conversationHistory.get(robotId) || [];
      const maxHistory = context?.maxHistory || 10;

      // 保持历史记录在限制范围内
      if (history.length > maxHistory * 2) {
        history = history.slice(-maxHistory * 2);
      }

      // 构建消息列表
      const messages: Message[] = [
        {
          role: 'system',
          content: context?.systemPrompt || this.llmService.获取系统提示(),
          timestamp: new Date(),
        },
        ...history,
        {
          role: 'user',
          content: userMessage,
          timestamp: new Date(),
        },
      ];

      // 调用LLM
      const llmResponse = await this.llmService.对话(messages, {
        model: context?.model || '',
        temperature: context?.temperature
      });
      const responseText = llmResponse.content;

      // 解析动作指令
      const actions = parseActions(responseText);

      // 移除动作标记，得到纯文本回复
      const cleanText = removeActionTags(responseText);

      // 安全检查动作
      const { validActions, rejectedActions } = this.actionController.验证动作(
        robotId,
        actions
      );

      // 如果有被拒绝的动作，在回复中说明
      let finalText = cleanText;
      if (rejectedActions.length > 0) {
        const rejectedNames = rejectedActions.map((r: any) => r.action.name).join('、');
        finalText += `\n\n（注意：动作"${rejectedNames}"因安全原因无法执行）`;
      }

      // 更新对话历史
      history.push(
        {
          role: 'user',
          content: userMessage,
          timestamp: new Date(),
        },
        {
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
        }
      );
      this.conversationHistory.set(robotId, history);

      const responseTime = Date.now() - startTime;

      return {
        text: finalText,
        actions: validActions,
        metadata: {
          model: llmResponse.finishReason,
          tokensUsed: llmResponse.usage.totalTokens,
          responseTime,
        } as any,
      };
    } catch (error: any) {
      throw new Error(`对话处理失败: ${error.message}`);
    }
  }

  /**
   * 处理带视觉识别的消息
   * @param robotId 机器人ID
   * @param userMessage 用户消息
   * @param imageBase64 base64编码的图片
   */
  async 处理视觉消息(
    robotId: string,
    userMessage: string,
    imageBase64: string
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // 调用视觉模型进行分析
      const visionResponse = await this.llmService.视觉分析(userMessage, imageBase64);
      const responseText = visionResponse.content;

      // 解析动作指令（视觉识别结果中也可能包含动作）
      const actions = parseActions(responseText);

      // 移除动作标记
      const cleanText = removeActionTags(responseText);

      // 安全检查动作
      const { validActions, rejectedActions } = this.actionController.验证动作(
        robotId,
        actions
      );

      // 如果有被拒绝的动作，在回复中说明
      let finalText = cleanText;
      if (rejectedActions.length > 0) {
        const rejectedNames = rejectedActions.map((r: any) => r.action.name).join('、');
        finalText += `\n\n（注意：动作"${rejectedNames}"因安全原因无法执行）`;
      }

      // 更新对话历史（记录用户问题和AI回复）
      const history = this.conversationHistory.get(robotId) || [];
      history.push(
        {
          role: 'user',
          content: `[视觉识别] ${userMessage}`,
          timestamp: new Date(),
        },
        {
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
        }
      );
      this.conversationHistory.set(robotId, history);

      const responseTime = Date.now() - startTime;

      return {
        text: finalText,
        actions: validActions,
        metadata: {
          model: visionResponse.finishReason,
          tokensUsed: visionResponse.usage.totalTokens,
          responseTime,
          vision: true,
        } as any,
      };
    } catch (error: any) {
      throw new Error(`视觉识别处理失败: ${error.message}`);
    }
  }

  /**
   * 获取对话历史
   */
  获取历史(robotId: string, limit: number = 50, offset: number = 0) {
    return this.database.getConversations(robotId, limit, offset);
  }

  /**
   * 清除对话历史
   */
  清除历史(robotId: string) {
    this.conversationHistory.delete(robotId);
    this.database.clearConversations(robotId);
  }
}

export { 对话服务 as ConversationService };
