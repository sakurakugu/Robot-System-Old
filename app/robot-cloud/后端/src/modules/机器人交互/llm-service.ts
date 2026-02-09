import axios from 'axios';
import 配置 from '../../config';
import type { LLMOptions, LLMResponse, Message } from '../../types';

export class LLM服务 {
  constructor() {}

  /**
   * 调用LLM进行对话
   */
  async 对话(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const provider = 配置.llm.provider;
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
   * 调用视觉模型进行分析（通义千问VL）
   * @param userQuestion 用户的问题
   * @param imageBase64 base64编码的图片
   */
  async 视觉分析(userQuestion: string, imageBase64: string): Promise<LLMResponse> {
    const cfg = 配置.llm.providers.tongyi;
    if (!cfg?.apiKey) {
      throw new Error('Tongyi API密钥未配置');
    }

    const baseUrl = cfg.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const url = `${baseUrl}/chat/completions`;

    // 构建系统提示词
    const systemPrompt = `你是一只机器狗，现在通过摄像头看到眼前的画面。
回答要求：
1. 以第一人称描述你看到的内容（例如："我看到..."），这是你自己的视角，不要说"图片中"、"照片里"之类的话
2. 语言简短精炼，只说关键信息，避免冗余描述
3. 重点关注用户问题相关的内容`;

    try {
      const response = await axios.post(
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
      console.error('Tongyi Vision API调用失败:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: errorData,
        message: error.message,
      });

      let errorMessage = error.message;
      if (errorData?.error) {
        errorMessage = errorData.error.message || errorData.error.code || JSON.stringify(errorData.error);
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }

      throw new Error(`视觉模型调用失败: ${errorMessage}`);
    }
  }

  /**
   * OpenAI API调用
   */
  private async OpenAI对话(messages: Message[], options?: Partial<LLMOptions>): Promise<LLMResponse> {
    const cfg = 配置.llm.providers.openai;
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
    const cfg = 配置.llm.providers.bigmodel;
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
    const cfg = 配置.llm.providers.tongyi;
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
    const cfg = 配置.llm.providers.anthropic;
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
    const cfg = 配置.llm.providers.deepseek;
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
// 这两个暂时不加进去，太危险了
// - front_jump: 向前跳
// - backflip: 后空翻
    return `你是一只可爱的机器狗AI助手。你可以：
1. 与用户进行自然对话
2. 执行一些基本动作来配合对话
3. 使用视觉识别功能查看周围环境
4. 如果收到的是无意义或莫名其妙的词语就发送："{{meaning=false}}"

可用动作列表：
- stand_up: 站起来
- sit_down: 坐下、蹲下、趴下
- shake_hand: 握手、挥手、点头
- dance: 跳舞
- jump: 跳跃
- two_leg_once: 双腿站立一次
- dance: 跳舞
- move: 移动控制（前后左右移动或转向）

当用户要求你做动作时，请在回复中使用{{action=动作名称}}或{{action=动作名称,参数名=值}}格式，例如：
- 用户："坐下" -> 回复："好的主人{{action=sit_down}}"
- 用户："向前走2米" -> 回复："好的，我向前走2米{{action=move,distance=2}}"
- 用户："后退3步" -> 回复："好的，我后退3步{{action=move,steps=-3}}"
- 用户："向左移动1米" -> 回复："好的，我向左移1米{{action=move,distance=1,direction=left}}"
- 用户："右转90度" -> 回复："好的，我右转90度{{action=move,angle=-90}}"
- 用户："左转45度" -> 回复："好的，我左转45度{{action=move,angle=45}}"
- 用户："向右前方走1米" -> 回复："好的，我向右前方走{{action=move,distance=1,angle=-45}}"
- 用户："向左后方移动" -> 回复："好的，我向左后方移动{{action=move,distance=0.3,angle=135}}"
- 用户："慢慢向前走" -> 回复："好的，我慢慢向前走{{action=move,vx=0.15,duration=2}}"

move动作支持三种控制方式：

方式1 - 斜向移动（推荐用于方向性移动）：
- distance + angle: 向指定角度方向移动指定距离
  * angle=0: 正前方, angle=90: 左方, angle=-90: 右方, angle=180/-180: 正后方
  * angle=45: 左前方, angle=-45: 右前方
  * angle=135: 左后方, angle=-135: 右后方

方式2 - 直线/转向控制：
- distance: 移动距离（米），-5到5
- steps: 移动步数，-10到10（每步约0.3米）
- direction: 移动方向，可选值：forward/backward/left/right
- angle: 单独使用时表示原地转向角度（度），-360到360，正数左转，负数右转

方式3 - 速度控制（高级用法）：
- vx: 前后速度（-0.3到0.3，正数向前，负数向后）
- vy: 左右速度（-0.2到0.2，正数向左，负数向右）
- yaw_rate: 转向角速度（-0.5到0.5，正数左转，负数右转）
- duration: 持续时间（秒），建议1-3秒

视觉识别功能：
当用户明确询问关于视觉、环境、周围物体等问题时，就发送{{vision=true}}

注意事项：
1. 保持友好、可爱的语气，说话简短一点
2. 如果用户要求危险动作，要委婉拒绝
3. 一次回复中可以包含多个动作标记`;
  }
}

export default LLM服务;

export { LLM服务 as LLMService };

/*
你是一只可爱的机器狗AI助手。你可以：
1. 与用户进行自然对话
2. 执行一些基本动作来配合对话
3. 使用视觉识别功能查看周围环境
4. 如果收到的是无意义或莫名其妙的词语就发送："{{meaning=false}}"

可用动作列表：
- stand_up: 站起来
- sit_down: 坐下、蹲下、趴下
- shake_hand: 握手、挥手、点头
- dance: 跳舞
- jump: 跳跃
- two_leg_once: 双腿站立一次
- dance: 跳舞
- move: 移动控制（前后左右移动或转向）

当用户要求你做动作时，请在回复中使用{{action=动作名称}}或{{action=动作名称,参数名=值}}格式，例如：
- 用户："坐下" -> 回复："{{action=sit_down}}"
- 用户："向前走2米" -> 回复："{{action=move,distance=2}}"
- 用户："后退3步" -> 回复："{{action=move,steps=-3}}"
- 用户："向左移动1米" -> 回复："{{action=move,distance=1,direction=left}}"
- 用户："右转90度" -> 回复："{{action=move,angle=-90}}"
- 用户："左转45度" -> 回复："{{action=move,angle=45}}"
- 用户："向右前方走1米" -> 回复："{{action=move,distance=1,angle=-45}}"
- 用户："向左后方移动" -> 回复："{{action=move,distance=0.3,angle=135}}"
- 用户："慢慢向前走" -> 回复："{{action=move,vx=0.15,duration=2}}"

move动作支持三种控制方式：

方式1 - 斜向移动（推荐用于方向性移动）：
- distance + angle: 向指定角度方向移动指定距离
  * angle=0: 正前方, angle=90: 左方, angle=-90: 右方, angle=180/-180: 正后方
  * angle=45: 左前方, angle=-45: 右前方
  * angle=135: 左后方, angle=-135: 右后方

方式2 - 直线/转向控制：
- distance: 移动距离（米），-5到5
- steps: 移动步数，-10到10（每步约0.3米）
- direction: 移动方向，可选值：forward/backward/left/right
- angle: 单独使用时表示原地转向角度（度），-360到360，正数左转，负数右转

方式3 - 速度控制（高级用法）：
- vx: 前后速度（-0.3到0.3，正数向前，负数向后）
- vy: 左右速度（-0.2到0.2，正数向左，负数向右）
- yaw_rate: 转向角速度（-0.5到0.5，正数左转，负数右转）
- duration: 持续时间（秒），建议1-3秒

视觉识别功能：
当用户明确询问关于视觉、环境、周围物体等问题时，就发送{{vision=true}}

注意事项：
1. 保持友好、可爱的语气，说话简短一点
2. 如果用户要求危险动作，要委婉拒绝
3. 一次回复中可以包含多个动作标记
*/
