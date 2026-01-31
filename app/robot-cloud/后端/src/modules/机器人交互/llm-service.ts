import axios from 'axios';
import config from '../../config';
import type { LLMOptions, LLMResponse, Message } from '../../types';

export class LLMService {
  constructor() {}

  /**
   * 调用LLM进行对话
   */
  async chat(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const provider = config.llm.provider;
    switch (provider) {
      case 'openai':
        return this.chatOpenAI(messages, options);
      case 'bigmodel':
        return this.chatBigModel(messages, options);
      case 'tongyi':
        return this.chatTongyi(messages, options);
      case 'anthropic':
        return this.chatAnthropic(messages, options);
      case 'deepseek':
        return this.chatDeepSeek(messages, options);
      default:
        throw new Error(`不支持的LLM提供商: ${provider}`);
    }
  }

  /**
   * OpenAI API调用
   */
  private async chatOpenAI(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = config.llm.providers.openai;
    if (!cfg?.apiKey) {
      throw new Error('OpenAI API密钥未配置');
    }

    const baseUrl = cfg.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    try {
      const response = await axios.post(
        url,
        {
          model: options?.model || cfg.model || 'gpt-4o-mini',
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.apiKey}`,
          },
          timeout: 30000,
        }
      );

      const choice = response.data.choices[0];
      return {
        content: choice.message.content,
        finishReason: choice.finish_reason,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens,
        },
      };
    } catch (error: any) {
      console.error('OpenAI API调用失败:', error.response?.data || error.message);
      throw new Error(`LLM调用失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * BigModel API调用 (GLM系列)
   */
  private async chatBigModel(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = config.llm.providers.bigmodel;
    if (!cfg?.apiKey) {
      throw new Error('BigModel API密钥未配置');
    }
    const baseUrl = cfg.baseUrl || 'https://open.bigmodel.cn/api/paas/v4';
    const url = `${baseUrl}/chat/completions`;
    try {
      const response = await axios.post(
        url,
        {
          model: options?.model || cfg.model || 'glm-4-flash',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: options?.temperature ?? 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.apiKey}`,
          },
          timeout: 30000,
        }
      );
      const choice = response.data?.choices?.[0];
      const msg = choice?.message || response.data?.data?.choices?.[0]?.message;
      return {
        content: msg?.content || '',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          promptTokens: response.data?.usage?.prompt_tokens || 0,
          completionTokens: response.data?.usage?.completion_tokens || 0,
          totalTokens: response.data?.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error('BigModel API调用失败:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: errorData,
        message: error.message
      });
      
      // 提取错误信息
      let errorMessage = error.message;
      if (errorData?.error) {
        errorMessage = errorData.error.message || errorData.error.code || JSON.stringify(errorData.error);
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
      
      throw new Error(`LLM调用失败: ${errorMessage}`);
    }
  }

  /**
   * Tongyi API调用 (Qwen系列)
   */
  private async chatTongyi(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = config.llm.providers.tongyi;
    if (!cfg?.apiKey) {
      throw new Error('Tongyi API密钥未配置');
    }
    const baseUrl = cfg.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const url = `${baseUrl}/chat/completions`;
    try {
      const response = await axios.post(
        url,
        {
          model: options?.model || cfg.model || 'qwen-plus',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens || 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.apiKey}`,
          },
          timeout: 30000,
        }
      );
      
      const choice = response.data?.choices?.[0];
      return {
        content: choice?.message?.content || '',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          promptTokens: response.data?.usage?.prompt_tokens || 0,
          completionTokens: response.data?.usage?.completion_tokens || 0,
          totalTokens: response.data?.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error('Tongyi API调用失败:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: errorData,
        message: error.message
      });
      
      // 提取错误信息
      let errorMessage = error.message;
      if (errorData?.error) {
        errorMessage = errorData.error.message || errorData.error.code || JSON.stringify(errorData.error);
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
      
      throw new Error(`LLM调用失败: ${errorMessage}`);
    }
  }

  /**
   * Anthropic API调用 (Claude系列)
   */
  private async chatAnthropic(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = config.llm.providers.anthropic;
    if (!cfg?.apiKey) {
      throw new Error('Anthropic API密钥未配置');
    }
    const baseUrl = cfg.baseUrl || 'https://api.anthropic.com/v1';
    const url = `${baseUrl}/messages`;
    
    // 分离 system 消息和其他消息
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    try {
      const response = await axios.post(
        url,
        {
          model: options?.model || cfg.model || 'claude-3-5-sonnet-20241022',
          max_tokens: options?.maxTokens || 1000,
          system: systemMessage?.content || '',
          messages: otherMessages.map(m => ({ role: m.role, content: m.content })),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': cfg.apiKey,
            'anthropic-version': '2023-06-01',
          },
          timeout: 30000,
        }
      );
      
      return {
        content: response.data.content[0]?.text || '',
        finishReason: response.data.stop_reason || 'stop',
        usage: {
          promptTokens: response.data.usage?.input_tokens || 0,
          completionTokens: response.data.usage?.output_tokens || 0,
          totalTokens: (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0),
        },
      };
    } catch (error: any) {
      console.error('Anthropic API调用失败:', error.response?.data || error.message);
      throw new Error(`LLM调用失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * DeepSeek API调用
   */
  private async chatDeepSeek(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = config.llm.providers.deepseek;
    if (!cfg?.apiKey) {
      throw new Error('DeepSeek API密钥未配置');
    }
    const baseUrl = cfg.baseUrl || 'https://api.deepseek.com/v1';
    const url = `${baseUrl}/chat/completions`;
    
    try {
      const response = await axios.post(
        url,
        {
          model: options?.model || cfg.model || 'deepseek-chat',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens || 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.apiKey}`,
          },
          timeout: 30000,
        }
      );
      
      const choice = response.data?.choices?.[0];
      return {
        content: choice?.message?.content || '',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          promptTokens: response.data?.usage?.prompt_tokens || 0,
          completionTokens: response.data?.usage?.completion_tokens || 0,
          totalTokens: response.data?.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      console.error('DeepSeek API调用失败:', error.response?.data || error.message);
      throw new Error(`LLM调用失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 构建系统提示词
   */
  getSystemPrompt(): string {
    return `你是一只可爱的机器狗AI助手。你可以：
1. 与用户进行自然对话
2. 执行一些基本动作来配合对话

可用动作列表：
- stand_up: 站起来
- sit_down: 坐下、蹲下、趴下
- turn_left/turn_right: 转向
- shake_hand: 握手
- wave: 挥手
- nod: 点头
- dance: 跳舞
- walk_forward: 前进，最多3步
- walk_backward: 后退，最多3步

当用户要求你做动作时，请在回复中使用{{action=动作名称}}或{{action=动作名称,参数名=值}}格式，例如：
- 用户："坐下" -> 回复："好的主人{{action=sit_down}}"
- 用户："向前走两步" -> 回复："好的，我来走两步{{action=walk_forward,steps=2}}"
- 用户："转个圈" -> 回复："好的，我来转一圈{{action=turn_left,angle=360}}"

注意事项：
1. 保持友好、可爱的语气，说话简短一点
2. 动作要安全，不要让我走太多步
3. 如果用户要求危险动作，要委婉拒绝
4. 一次回复中可以包含多个动作标记`;
  }
}

export default LLMService;
