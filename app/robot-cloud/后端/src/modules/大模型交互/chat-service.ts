import type DatabaseService from '../../core/database';
import { logger } from "../../core/logger";
import { parseActions } from "../../core/utils/helpers";
import ActionController from "../机器人交互/action-controller";
import LLM服务 from "./llm-service";
import { AI响应, ConversationContext, Message } from "./types";

export class 对话服务 {
  private static readonly 最大会话数 = 500;
  private static readonly 会话过期毫秒 = 30 * 60 * 1000;
  private llmService: LLM服务;
  private actionController: ActionController;
  private conversationHistory: Map<string, Message[]>;
  private lastActiveAt: Map<string, number>;

  constructor(private database: DatabaseService) {
    this.llmService = new LLM服务();
    this.actionController = new ActionController();
    this.conversationHistory = new Map();
    this.lastActiveAt = new Map();
  }

  private 裁剪历史(history: Message[], maxHistory: number): Message[] {
    const limit = Math.max(1, maxHistory) * 2;
    return history.length > limit ? history.slice(-limit) : history;
  }

  private 更新会话(robotId: string): void {
    const now = Date.now();
    if (this.lastActiveAt.has(robotId)) {
      // 通过删除再插入维持最近活跃顺序
      this.lastActiveAt.delete(robotId);
    }
    this.lastActiveAt.set(robotId, now);

    for (const [id, activeAt] of this.lastActiveAt.entries()) {
      if (now - activeAt > 对话服务.会话过期毫秒) {
        this.lastActiveAt.delete(id);
        this.conversationHistory.delete(id);
      }
    }

    while (this.conversationHistory.size > 对话服务.最大会话数) {
      const oldestKey = this.lastActiveAt.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.lastActiveAt.delete(oldestKey);
      this.conversationHistory.delete(oldestKey);
    }
  }

  /**
   * 处理用户消息
   */
  async 处理消息(
    robotId: string,
    userMessage: string,
    context?: Partial<ConversationContext>,
  ): Promise<AI响应> {
    const startTime = Date.now();

    try {
      this.更新会话(robotId);
      // 获取或初始化对话历史
      let history = this.conversationHistory.get(robotId) || [];
      const maxHistory = context?.maxHistory || 10;

      // 保持历史记录在限制范围内
      history = this.裁剪历史(history, maxHistory);

      // 构建消息列表
      const messages: Message[] = [
        {
          role: "system",
          content: context?.systemPrompt || this.llmService.获取系统提示(),
          timestamp: new Date(),
        },
        ...history,
        {
          role: "user",
          content: userMessage,
          timestamp: new Date(),
        },
      ];

      // 调用LLM
      const llmResponse = await this.llmService.对话(messages, {
        model: context?.model || "",
        temperature: context?.temperature,
      });
      const responseText = llmResponse.content;

      // 解析动作指令
      const actions = parseActions(responseText);

      // 移除动作标记，得到纯文本回复 (测试中，这个先注释掉)
      // const cleanText = removeActionTags(responseText);
      const cleanText = responseText;

      // 安全检查动作
      const { validActions, rejectedActions } = this.actionController.验证动作(
        robotId,
        actions,
      );

      // 如果有被拒绝的动作，在回复中说明
      let finalText = cleanText;
      if (rejectedActions.length > 0) {
        const rejectedNames = rejectedActions
          .map((r) => r.action.name)
          .join("、");
        finalText += `\n\n（注意：动作"${rejectedNames}"因安全原因无法执行）`;
      }

      // 更新对话历史
      history.push(
        {
          role: "user",
          content: userMessage,
          timestamp: new Date(),
        },
        {
          role: "assistant",
          content: responseText,
          timestamp: new Date(),
        },
      );
      this.conversationHistory.set(robotId, history);

      const responseTime = Date.now() - startTime;

      return {
        text: finalText,
        actions: validActions,
        metadata: {
          model: llmResponse.model || context?.model || '',
          tokensUsed: llmResponse.usage.totalTokens,
          responseTime,
        },
      };
    } catch (error: any) {
      logger.error("处理消息失败:", error);
      throw error;
    }
  }

  // /**
  //  * 清除对话历史
  //  */
  // 清除历史(robotId: string): void {
  //   this.conversationHistory.delete(robotId);
  //   this.lastActiveAt.delete(robotId);
  // }

  // /**
  //  * 获取对话历史
  //  */
  // 获取历史(robotId: string): Message[] {
  //   return this.conversationHistory.get(robotId) || [];
  // }

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

  /**
   * 处理带视觉识别的消息
   * @param robotId 机器人ID
   * @param userMessage 用户消息
   * @param imageBase64 base64编码的图片
   */
  async 处理视觉消息(
    robotId: string,
    userMessage: string,
    imageBase64: string,
    maxHistory = 10,
  ): Promise<AI响应> {
    const startTime = Date.now();

    try {
      this.更新会话(robotId);
      // 调用视觉模型进行分析
      const visionResponse = await this.llmService.视觉分析(userMessage, imageBase64);
      const responseText = visionResponse.content;

      // 解析动作指令（视觉识别结果中也可能包含动作）
      const actions = parseActions(responseText);

      // 移除动作标记
      const cleanText = responseText;

      // 安全检查动作
      const { validActions, rejectedActions } = this.actionController.验证动作(
        robotId,
        actions
      );

      // 如果有被拒绝的动作，在回复中说明
      let finalText = cleanText;
      if (rejectedActions.length > 0) {
        const rejectedNames = rejectedActions.map((r) => r.action.name).join('、');
        finalText += `\n\n（注意：动作"${rejectedNames}"因安全原因无法执行）`;
      }

      // 更新对话历史（记录用户问题和AI回复）
      const history = this.裁剪历史(this.conversationHistory.get(robotId) || [], maxHistory);
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
          model: visionResponse.model || 'qwen-vl-plus',
          tokensUsed: visionResponse.usage.totalTokens,
          responseTime,
          vision: true,
        },
      };
    } catch (error: any) {
      logger.error('视觉识别处理失败:', error);
      throw error;
    }
  }
}

export default 对话服务;
