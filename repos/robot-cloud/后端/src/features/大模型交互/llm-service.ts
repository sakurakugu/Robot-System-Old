import axios from 'axios';
import 配置 from '../../infra/config';
import { apiKeyManager } from '../../infra/config/apikey-manager';
import { 默认系统提示词 } from '../../infra/const';
import { logger } from '../../infra/logger';
import type { LLMOptions, LLMResponse, LLM消息 } from '../大模型管理/types';

export class LLM服务 {
  private static readonly 默认超时毫秒 = 3_0000;

  constructor() { }

  private 解析错误信息(error: any): string {
    const errorData = error?.response?.data;
    if (errorData?.error) {
      return errorData.error.message || errorData.error.code || JSON.stringify(errorData.error);
    }
    if (typeof errorData === 'string') {
      return errorData;
    }
    if (errorData?.message) {
      return errorData.message;
    }
    return error?.message || '未知错误';
  }

  private async 执行带重试<T>(task: () => Promise<T>, retries = 1): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= retries; i += 1) {
      try {
        return await task();
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;
        const retryable = status === 429 || (typeof status === 'number' && status >= 500);
        if (!retryable || i === retries) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
      }
    }
    throw lastError;
  }

  /**
   * 调用LLM进行对话
   */
  async 对话(messages: LLM消息[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const provider = 配置.llm.provider;
    switch (provider) {
      case 'openai':
        return this.OpenAI对话(messages, options);
      case 'bigmodel':
        return this.大模型对话(messages, options);
      case 'aliyun':
        return this.千问对话(messages, options);
      case 'anthropic':
        return this.Anthropic对话(messages, options);
      case 'deepseek':
        return this.DeepSeek对话(messages, options);
      default:
        throw new Error(`不支持的LLM提供商: ${provider}`);
    }
  }

  /**
   * 调用视觉模型进行分析（通义千问VL）
   * @param userQuestion 用户的问题
   * @param imageBase64 base64编码的图片
   */
  async 视觉分析(userQuestion: string, imageBase64: string): Promise<LLMResponse> {
    const cfg = 配置.llm.providers.aliyun;
    const apiKey = apiKeyManager.get('aliyun');
    if (!apiKey) {
      throw new Error('阿里云 API密钥未配置');
    }

    const baseUrl = cfg.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const url = `${baseUrl}/chat/completions`;

    // 构建系统提示词
    const systemPrompt = `你是一只机器狗，现在通过摄像头看到眼前的画面。
回答要求：
1. 以第一人称描述你看到的内容（例如："我看到..."），这是你自己的视角，不要说"图片中"、"照片里"之类的话
2. 语言简短精炼，只说关键信息，避免冗余描述
3. 重点关注用户问题相关的内容
4. 如果用户要求你靠近/识别某个物体，且你能识别到该物体，请追加输出归一化框：
{{target=目标名,cx=0.50,cy=0.50,w=0.20,h=0.30}}
其中 cx,cy是中心点; cx,cy,w,h 范围都必须在 0 到 1 之间
5. 如果用户要求你走到该目标前方，请追加动作：
{{action=vision_approach_target,target=目标名,cx=0.50,cy=0.50,w=0.20,h=0.30,stop_area=0.22}}
其中 stop_area 是停止距离，范围在 0 到 1 之间，0.22 表示目标框面积达到画面的约 22% 时停止前进，用于估算距离；这是单目近距离靠近动作，不要输出 approach_target
6. 是双括号不是单括号
`;

    try {
      const response = await this.执行带重试(() => axios.post(
        url,
        {
          model: 'qwen-vl-plus',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: userQuestion,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: LLM服务.默认超时毫秒,
        }
      ));

      const choice = response.data?.choices?.[0];
      return {
        content: choice?.message?.content || '',
        model: response.data?.model || 'qwen-vl-plus',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          promptTokens: response.data?.usage?.prompt_tokens || 0,
          completionTokens: response.data?.usage?.completion_tokens || 0,
          totalTokens: response.data?.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      const errorData = error.response?.data;
      logger.error('阿里云视觉模型API调用失败', error, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: errorData,
        message: error.message,
      });

      throw new Error(`视觉模型调用失败: ${this.解析错误信息(error)}`);
    }
  }

  /**
   * OpenAI API调用
   */
  private async OpenAI对话(messages: LLM消息[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = 配置.llm.providers.openai;
    const apiKey = apiKeyManager.get('openai');
    if (!apiKey) {
      throw new Error('OpenAI API密钥未配置');
    }

    const baseUrl = cfg.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    try {
      const response = await this.执行带重试(() => axios.post(
        url,
        {
          model: options?.model || cfg.model || 'gpt-4o-mini',
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens || 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: LLM服务.默认超时毫秒,
        }
      ));

      const choice = response.data.choices[0];
      return {
        content: choice.message.content,
        model: response.data?.model || options?.model || cfg.model || 'gpt-4o-mini',
        finishReason: choice.finish_reason,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens,
        },
      };
    } catch (error: any) {
      logger.error('OpenAI API调用失败', error, {
        data: error.response?.data,
        message: error.message,
      });
      throw new Error(`LLM调用失败: ${this.解析错误信息(error)}`);
    }
  }

  /**
   * BigModel API调用 (GLM系列)
   */
  private async 大模型对话(messages: LLM消息[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = 配置.llm.providers.bigmodel;
    const apiKey = apiKeyManager.get('bigmodel');
    if (!apiKey) {
      throw new Error('BigModel API密钥未配置');
    }
    const baseUrl = cfg.baseUrl || 'https://open.bigmodel.cn/api/paas/v4';
    const url = `${baseUrl}/chat/completions`;
    try {
      const response = await this.执行带重试(() => axios.post(
        url,
        {
          model: options?.model || cfg.model || 'glm-4-flash',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: options?.temperature ?? 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: LLM服务.默认超时毫秒,
        }
      ));
      const choice = response.data?.choices?.[0];
      const msg = choice?.message || response.data?.data?.choices?.[0]?.message;
      return {
        content: msg?.content || '',
        model: response.data?.model || options?.model || cfg.model || 'glm-4-flash',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          promptTokens: response.data?.usage?.prompt_tokens || 0,
          completionTokens: response.data?.usage?.completion_tokens || 0,
          totalTokens: response.data?.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      logger.error('BigModel API调用失败', error, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`LLM调用失败: ${this.解析错误信息(error)}`);
    }
  }

  /**
   * 阿里云 API调用 (Qwen系列)
   */
  private async 千问对话(messages: LLM消息[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = 配置.llm.providers.aliyun;
    const apiKey = apiKeyManager.get('aliyun');
    if (!apiKey) {
      throw new Error('阿里云 API密钥未配置');
    }
    const baseUrl = cfg.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const url = `${baseUrl}/chat/completions`;
    try {
      const response = await this.执行带重试(() => axios.post(
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
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: LLM服务.默认超时毫秒,
        }
      ));

      const choice = response.data?.choices?.[0];
      return {
        content: choice?.message?.content || '',
        model: response.data?.model || options?.model || cfg.model || 'qwen-flash',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          promptTokens: response.data?.usage?.prompt_tokens || 0,
          completionTokens: response.data?.usage?.completion_tokens || 0,
          totalTokens: response.data?.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      logger.error('阿里云 API调用失败', error, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`LLM调用失败: ${this.解析错误信息(error)}`);
    }
  }

  /**
   * Anthropic API调用 (Claude系列)
   */
  private async Anthropic对话(messages: LLM消息[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = 配置.llm.providers.anthropic;
    const apiKey = apiKeyManager.get('anthropic');
    if (!apiKey) {
      throw new Error('Anthropic API密钥未配置');
    }
    const baseUrl = cfg.baseUrl || 'https://api.anthropic.com/v1';
    const url = `${baseUrl}/messages`;

    // 分离 system 消息和其他消息
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    try {
      const response = await this.执行带重试(() => axios.post(
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
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          timeout: LLM服务.默认超时毫秒,
        }
      ));

      return {
        content: response.data.content[0]?.text || '',
        model: response.data?.model || options?.model || cfg.model || 'claude-3-5-sonnet-20241022',
        finishReason: response.data.stop_reason || 'stop',
        usage: {
          promptTokens: response.data.usage?.input_tokens || 0,
          completionTokens: response.data.usage?.output_tokens || 0,
          totalTokens: (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0),
        },
      };
    } catch (error: any) {
      logger.error('Anthropic API调用失败', error, {
        data: error.response?.data,
        message: error.message,
      });
      throw new Error(`LLM调用失败: ${this.解析错误信息(error)}`);
    }
  }

  /**
   * DeepSeek API调用
   */
  private async DeepSeek对话(messages: LLM消息[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = 配置.llm.providers.deepseek;
    const apiKey = apiKeyManager.get('deepseek');
    if (!apiKey) {
      throw new Error('DeepSeek API密钥未配置');
    }
    const baseUrl = cfg.baseUrl || 'https://api.deepseek.com/v1';
    const url = `${baseUrl}/chat/completions`;

    try {
      const response = await this.执行带重试(() => axios.post(
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
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: LLM服务.默认超时毫秒,
        }
      ));

      const choice = response.data?.choices?.[0];
      return {
        content: choice?.message?.content || '',
        model: response.data?.model || options?.model || cfg.model || 'deepseek-chat',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          promptTokens: response.data?.usage?.prompt_tokens || 0,
          completionTokens: response.data?.usage?.completion_tokens || 0,
          totalTokens: response.data?.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      logger.error('DeepSeek API调用失败', error, {
        data: error.response?.data,
        message: error.message,
      });
      throw new Error(`LLM调用失败: ${this.解析错误信息(error)}`);
    }
  }

  /**
   * 构建系统提示词
   */
  获取系统提示(): string {
    return 默认系统提示词;
  }
}

export default LLM服务;



