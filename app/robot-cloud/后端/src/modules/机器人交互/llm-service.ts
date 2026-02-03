import axios from 'axios';
import config from '../../config';
import type { LLMOptions, LLMResponse, Message } from '../../types';

export class LLMService {
  constructor() {}

  /**
   * 调用LLM进行对话
   */
  async 对话(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const provider = config.llm.provider;
    switch (provider) {
      case 'openai':
        return this.OpenAI对话(messages, options);
      case 'bigmodel':
        return this.大模型对话(messages, options);
      case 'tongyi':
        return this.通义对话(messages, options);
      case 'anthropic':
        return this.Anthropic对话(messages, options);
      case 'deepseek':
        return this.DeepSeek对话(messages, options);
      default:
        throw new Error(`不支持的LLM提供商: ${provider}`);
    }
  }

  /**
   * OpenAI API调用
   */
  private async OpenAI对话(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
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
  private async 大模型对话(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
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
  private async 通义对话(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
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
          model: options?.model || cfg.model || 'qwen-flash',
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
  private async Anthropic对话(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
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
  private async DeepSeek对话(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
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
  获取系统提示(): string {
    return `你是一只可爱的机器狗AI助手。你可以：
1. 与用户进行自然对话
2. 执行一些基本动作来配合对话
3. 如果收到的是无意义或莫名其妙的词语就发送："{{meaning=false}}"

可用动作列表：
- stand_up: 站起来
- sit_down: 坐下、蹲下、趴下
- shake_hand: 握手
- wave: 挥手
- nod: 点头
- dance: 跳舞
- jump: 跳跃
- move: 移动控制（前后左右移动或转向）

当用户要求你做动作时，请在回复中使用{{action=动作名称}}或{{action=动作名称,参数名=值}}格式，例如：
- 用户："坐下" -> 回复："好的主人{{action=sit_down}}"
- 用户："向前走" -> 回复："好的，我向前走{{action=move,vx=0.2,duration=2}}"
- 用户："后退" -> 回复："好的，我后退{{action=move,vx=-0.2,duration=2}}"
- 用户："向左移动" -> 回复："好的，我向左移{{action=move,vy=0.2,duration=2}}"
- 用户："向右移动" -> 回复："好的，我向右移{{action=move,vy=-0.2,duration=2}}"
- 用户："左转" -> 回复："好的，我左转{{action=move,yaw_rate=0.3,duration=2}}"
- 用户："右转" -> 回复："好的，我右转{{action=move,yaw_rate=-0.3,duration=2}}"

move动作参数说明：
- vx: 前后速度（-0.3到0.3，正数向前，负数向后）
- vy: 左右速度（-0.2到0.2，正数向左，负数向右）
- yaw_rate: 转向角速度（-0.5到0.5，正数左转，负数右转）
- duration: 持续时间（秒），建议1-3秒

注意事项：
1. 保持友好、可爱的语气，说话简短一点
2. 移动速度要适中，不要太快（vx建议0.15-0.25，vy建议0.15-0.2，yaw_rate建议0.2-0.4）
3. 移动时间不要太长（建议1-3秒）
4. 如果用户要求危险动作，要委婉拒绝
5. 一次回复中可以包含多个动作标记`;
  }
}

export default LLMService;
