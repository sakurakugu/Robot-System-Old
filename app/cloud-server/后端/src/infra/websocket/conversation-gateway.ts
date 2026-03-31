import type { 对话服务 } from '../../features/大模型交互/chat-service';
import type { ConversationRepository } from '../../features/大模型交互/repository';
import type TTSService from '../../features/大模型交互/tts-service';
import { LLM供应商列表 } from '../../features/大模型管理/types';
import type { Action } from '../../features/机器人交互/types';
import type { 机器人服务 } from '../../features/机器人管理/service';
import type { RobotRecord, 音频路由配置 } from '../../features/机器人管理/types';
import type { RoleRecord } from '../../features/角色管理/types';
import type { ServerMessage, TTSOptions } from '../../shared/types';
import {
  hasVisionTag,
  parseNormalizedTargetPosition,
  RateLimiter,
  removeActionTags,
  removeTargetTags,
  removeVisionTags,
  uuidv7,
} from '../../shared/utils/helpers';
import 配置 from '../config';
import { logger } from '../logger';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

type 用户输入类型 = 'text' | 'audio';

type 音频转写元数据 = {
  asrTime: number;
  durationMs: number;
  sessionId: string;
};

type 待处理输入 = {
  text: string;
  ttsOptions?: TTSOptions;
  inputType: 用户输入类型;
  audioMeta?: 音频转写元数据;
  conversationId: string;
};

type 对话配置 = {
  systemPrompt?: string;
  temperature?: number;
  model?: string;
  maxHistory: number;
};

type 音频流分片 = {
  seq: number;
  base64: string;
  format: 'mp3';
};
type 对话响应 = Awaited<ReturnType<对话服务['处理消息']>>;
type 视觉图片 = { base64: string; format?: string };

export interface WebSocket对话网关依赖 {
  获取机器人记录(robotId: string): Promise<RobotRecord | undefined>;
  获取角色记录(roleId: string): Promise<RoleRecord | undefined>;
  获取对话服务(): 对话服务 | undefined;
  获取机器人服务(): 机器人服务 | undefined;
  ttsService: TTSService;
  获取音频路由配置(robotId: string): Promise<音频路由配置>;
  发送音频消息(robotId: string, route: 音频路由配置, message: ServerMessage): void;
  是否发送最终音频响应(robotId: string, route: 音频路由配置): boolean;
  发送到机器人(robotId: string, message: ServerMessage, channel: Channel): boolean;
  广播消息(robotId: string, message: ServerMessage, channel: Channel): void;
  发送到UI(robotId: string, message: ServerMessage, channel: Channel): void;
  发送错误(robotId: string, code: string, message: string, channel: Channel): void;
  写入动作日志(data: Parameters<ConversationRepository['createActionLog']>[0]): Promise<void>;
  写入对话记录(data: Parameters<ConversationRepository['createConversation']>[0]): Promise<void>;
}

/**
 * 管理文本输入合并、对话编排和 TTS 下发
 */
export class WebSocket对话网关 {
  private inputMergeTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingInputs: Map<string, 待处理输入> = new Map();
  private inputRateLimiter = new RateLimiter(3, 3000);
  private ttsRateLimiter = new RateLimiter(5, 5000);
  private inputMergeWindowMs = 500;

  constructor(private readonly 依赖: WebSocket对话网关依赖) {}

  async handleTextInput(
    robotId: string,
    text: string,
    ttsOptions?: TTSOptions,
    conversationId?: string,
  ): Promise<void> {
    await this.queueUserText(robotId, text, ttsOptions, 'text', undefined, conversationId);
  }

  async handleAudioTranscript(
    robotId: string,
    text: string,
    meta: 音频转写元数据,
  ): Promise<void> {
    this.依赖.发送到UI(robotId, {
      type: 'asr_transcript',
      robotId,
      timestamp: Date.now(),
      data: {
        text,
        sessionId: meta.sessionId,
        durationMs: meta.durationMs,
        asrTime: meta.asrTime,
      },
    }, 'business');

    await this.queueUserText(robotId, text, undefined, 'audio', meta, meta.sessionId);
  }

  async handleTTSInput(
    robotId: string,
    text: string,
    ttsOptions?: TTSOptions,
    conversationId?: string,
  ): Promise<void> {
    try {
      if (!this.ttsRateLimiter.check(robotId)) {
        logger.warn('TTS请求过于频繁', { robotId });
        this.依赖.发送错误(robotId, 'RATE_LIMITED', '请求过于频繁，请稍后再试', 'business');
        return;
      }

      const sanitizedText = this.sanitizeTtsText(text);
      if (!sanitizedText) {
        logger.info('TTS跳过：清理后文本为空', { robotId });
        return;
      }

      const streamSessionId = conversationId || uuidv7();
      await this.发送TTS音频(robotId, sanitizedText, ttsOptions, {
        流式会话ID: streamSessionId,
        最终响应会话ID: streamSessionId,
        非流式会话ID: conversationId,
      });
    } catch (error) {
      logger.error('TTS生成失败', this.转成错误对象(error), { robotId });
      this.依赖.发送错误(robotId, 'TTS_ERROR', this.提取错误消息(error, 'TTS失败'), 'business');
    }
  }

  private async processUserText(
    robotId: string,
    text: string,
    ttsOptions: TTSOptions | undefined,
    inputType: 用户输入类型,
    audioMeta?: 音频转写元数据,
    conversationId?: string,
  ): Promise<void> {
    const startTime = Date.now();
    const traceId = conversationId || uuidv7();

    try {
      logger.info('收到文本输入', { robotId, text, inputType });

      const robot = await this.依赖.获取机器人记录(robotId);
      if (!robot) {
        throw new Error('机器人不存在');
      }

      if (!robot.role_uuid) {
        const errorMsg = '该机器人未配置角色，无法进行对话。请在管理界面为机器人分配一个角色。';
        logger.warn('机器人未配置角色', { robotId });
        this.依赖.发送到UI(robotId, {
          type: 'error',
          robotId,
          timestamp: Date.now(),
          conversationId: traceId,
          data: {
            message: errorMsg,
            code: 'NO_ROLE_CONFIGURED',
          },
        }, 'business');
        return;
      }

      const 对话服务实例 = this.依赖.获取对话服务();
      if (!对话服务实例) {
        throw new Error('对话服务 未初始化');
      }

      const 对话配置 = await this.构建对话配置(robot);
      const response = await 对话服务实例.处理消息(robotId, text, {
        history: [],
        maxHistory: 对话配置.maxHistory,
        systemPrompt: 对话配置.systemPrompt,
        model: 对话配置.model,
        temperature: 对话配置.temperature,
      });

      const needsVision = hasVisionTag(response.text);
      const { finalResponse, visionImage } = await this.处理视觉识别(
        robotId,
        text,
        traceId,
        needsVision,
        response,
        对话配置.maxHistory,
      );

      const processingTime = Date.now() - startTime;
      const ttsText = this.sanitizeTtsText(finalResponse.text);
      const ttsDone = Boolean(ttsText);
      const targetPosition = parseNormalizedTargetPosition(finalResponse.text);

      this.依赖.广播消息(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        conversationId: traceId,
        data: {
          text: finalResponse.text,
          ttsDone,
          noTTS: ttsDone ? undefined : true,
          actions: finalResponse.actions.map((action) => action.name),
          vision: needsVision,
          visionImage,
          targetPosition,
        },
      }, 'business');

      try {
        if (ttsText) {
          await this.发送TTS音频(robotId, ttsText, ttsOptions, {
            流式会话ID: traceId,
            最终响应会话ID: traceId,
            非流式会话ID: traceId,
          });
        } else {
          logger.info('TTS跳过：回复文本为空或仅包含表情', { robotId });
        }
      } catch (error) {
        logger.error('TTS生成失败', this.转成错误对象(error), { robotId });
      }

      const normalizedActions = this.规范动作(finalResponse.actions);

      for (const action of normalizedActions) {
        this.依赖.发送到机器人(robotId, {
          type: 'action_command',
          robotId,
          timestamp: Date.now(),
          conversationId: traceId,
          data: {
            action: action.name,
            parameters: action.parameters,
            safetyChecked: true,
          },
        }, 'business');

        await this.依赖.写入动作日志({
          robot_id: robotId,
          conversation_id: traceId,
          action_name: action.name,
          parameters: action.parameters,
          status: 'success',
          result_detail: {
            source: 'llm',
            safetyChecked: true,
          },
        });
      }

      await this.依赖.写入对话记录({
        robot_id: robotId,
        conversation_id: traceId,
        type: inputType,
        user_input: text,
        ai_response: finalResponse.text,
        actions: normalizedActions,
        processing_time: processingTime,
        metadata: {
          ...finalResponse.metadata,
          conversationId: traceId,
          inputType,
          asrTime: audioMeta?.asrTime,
          audioDurationMs: audioMeta?.durationMs,
          audioSessionId: audioMeta?.sessionId,
          visionImage,
          targetPosition,
        },
      });

      logger.记录对话({
        robotId,
        input: text,
        output: finalResponse.text,
        processingTime,
        actions: finalResponse.actions,
      });
    } catch (error) {
      logger.error('处理文本输入失败', this.转成错误对象(error), { robotId });
      this.依赖.发送错误(robotId, 'PROCESSING_ERROR', this.提取错误消息(error, '处理文本输入失败'), 'business');
    }
  }

  private async 构建对话配置(robot: RobotRecord): Promise<对话配置> {
    let systemPrompt: string | undefined;
    let temperature: number | undefined;
    let model: string | undefined;
    let maxHistory = 10;

    const provider = 配置.llm.provider;
    const allowedModels =
      LLM供应商列表.find((item) => item.value === provider)?.models.map((item) => item.value) || [];
    if (robot.model && allowedModels.includes(robot.model)) {
      model = robot.model;
    }

    if (robot.role_uuid) {
      const role = await this.依赖.获取角色记录(robot.role_uuid);
      if (role) {
        if (typeof role.max_history === 'number') {
          maxHistory = role.max_history || 10;
        }
        if (role.system_prompt) {
          systemPrompt = role.system_prompt;
        }
        if (typeof role.temperature === 'number') {
          temperature = role.temperature;
        }
        if (role.llm_model) {
          model = role.llm_model;
        }
      }
    }

    return {
      systemPrompt,
      temperature,
      model,
      maxHistory,
    };
  }

  private async 处理视觉识别(
    robotId: string,
    text: string,
    traceId: string,
    needsVision: boolean,
    response: 对话响应,
    maxHistory: number,
  ): Promise<{
    finalResponse: 对话响应;
    visionImage?: 视觉图片;
  }> {
    if (!needsVision) {
      return { finalResponse: response };
    }

    logger.info('检测到视觉识别需求，开始拍照', { robotId });

    try {
      const 机器人服务实例 = this.依赖.获取机器人服务();
      if (!机器人服务实例) {
        throw new Error('机器人服务 未初始化');
      }

      this.依赖.发送到UI(robotId, {
        type: 'vision_status',
        robotId,
        timestamp: Date.now(),
        conversationId: traceId,
        data: {
          status: 'capturing',
          message: '正在拍照...',
        },
      }, 'business');

      const photoResult = await 机器人服务实例.拍照(robotId);
      const visionImage = {
        base64: photoResult.image,
        format: photoResult.format || 'jpeg',
      };

      logger.info('拍照成功，开始视觉分析', { robotId });
      this.依赖.发送到UI(robotId, {
        type: 'vision_status',
        robotId,
        timestamp: Date.now(),
        conversationId: traceId,
        data: {
          status: 'analyzing',
          message: '正在分析图片...',
        },
      }, 'business');

      const 对话服务实例 = this.依赖.获取对话服务();
      if (!对话服务实例) {
        throw new Error('对话服务 未初始化');
      }

      const visionResponse = await 对话服务实例.处理视觉消息(
        robotId,
        text,
        photoResult.image,
        maxHistory,
      );

      logger.info('视觉分析完成', { robotId });
      return {
        finalResponse: visionResponse,
        visionImage,
      };
    } catch (error) {
      const 错误消息 = this.提取错误消息(error, '视觉识别失败');
      logger.error('视觉识别失败', this.转成错误对象(error), { robotId });
      this.依赖.发送到UI(robotId, {
        type: 'vision_status',
        robotId,
        timestamp: Date.now(),
        conversationId: traceId,
        data: {
          status: 'error',
          message: `视觉识别失败: ${错误消息}`,
        },
      }, 'business');

      return {
        finalResponse: {
          ...response,
          text: removeVisionTags(response.text) + `\n\n（抱歉，我现在看不到周围环境：${错误消息}）`,
        },
      };
    }
  }

  private 规范动作(actions: Action[]): Action[] {
    return actions.map((action) => {
      if (action.name !== 'approach_target') {
        return action;
      }

      const parameters = action.parameters || {};
      const hasTargetBox = ['cx', 'cy', 'w', 'h'].every((key) => parameters[key] !== undefined);
      if (!hasTargetBox) {
        return action;
      }

      return {
        ...action,
        name: 'vision_approach_target',
        parameters: {
          ...parameters,
          max_track_seconds: parameters.max_track_seconds ?? 18,
          max_lost_frames: parameters.max_lost_frames ?? 4,
          min_score: parameters.min_score ?? 0.18,
          search_margin: parameters.search_margin ?? 1.8,
          template_update_rate: parameters.template_update_rate ?? 0.2,
        },
      };
    });
  }

  private async 发送TTS音频(
    robotId: string,
    text: string,
    ttsOptions: TTSOptions | undefined,
    选项: {
      流式会话ID: string;
      最终响应会话ID?: string;
      非流式会话ID?: string;
    },
  ): Promise<void> {
    const audioRoute = await this.依赖.获取音频路由配置(robotId);
    const streamEnabled = ttsOptions?.stream !== false;

    if (streamEnabled) {
      this.依赖.发送音频消息(robotId, audioRoute, {
        type: 'audio_stream_start',
        robotId,
        timestamp: Date.now(),
        conversationId: 选项.流式会话ID,
        data: {
          sessionId: 选项.流式会话ID,
          format: 'mp3',
        },
      });

      const audio = await this.依赖.ttsService.synthesizeStream(text, ttsOptions, (chunk: 音频流分片) => {
        this.依赖.发送音频消息(robotId, audioRoute, {
          type: 'audio_stream_chunk',
          robotId,
          timestamp: Date.now(),
          conversationId: 选项.流式会话ID,
          data: {
            sessionId: 选项.流式会话ID,
            seq: chunk.seq,
            buffer: chunk.base64,
          },
        });
      });

      this.依赖.发送音频消息(robotId, audioRoute, {
        type: 'audio_stream_end',
        robotId,
        timestamp: Date.now(),
        conversationId: 选项.流式会话ID,
        data: {
          sessionId: 选项.流式会话ID,
          duration: audio.duration,
        },
      });

      if (this.依赖.是否发送最终音频响应(robotId, audioRoute)) {
        this.依赖.发送音频消息(robotId, audioRoute, {
          type: 'audio_response',
          robotId,
          timestamp: Date.now(),
          conversationId: 选项.最终响应会话ID,
          data: audio,
        });
      }
      return;
    }

    const audio = await this.依赖.ttsService.synthesize(text, ttsOptions);
    this.依赖.发送音频消息(robotId, audioRoute, {
      type: 'audio_response',
      robotId,
      timestamp: Date.now(),
      conversationId: 选项.非流式会话ID,
      data: audio,
    });
  }

  private sanitizeTtsText(text: string): string {
    if (!text) {
      return '';
    }

    const emojiRegex = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
    let result = removeActionTags(text).replace(emojiRegex, '');
    result = result.replace(/[（(][^）)]*(?:注意|提示|警告|说明)[^）)]*[）)]/g, '');
    result = result.replace(/\{\{\s*meaning\s*=\s*false\s*\}\}/g, '');
    result = removeVisionTags(result);
    result = removeTargetTags(result);
    return result.trim();
  }

  private async queueUserText(
    robotId: string,
    text: string,
    ttsOptions: TTSOptions | undefined,
    inputType: 用户输入类型,
    audioMeta?: 音频转写元数据,
    conversationId?: string,
  ): Promise<void> {
    const cleaned = String(text || '').trim();
    if (!cleaned) {
      return;
    }

    const existing = this.pendingInputs.get(robotId);
    if (existing) {
      existing.text = `${existing.text} ${cleaned}`.trim();
      if (ttsOptions !== undefined) {
        existing.ttsOptions = ttsOptions;
      }
      existing.inputType = existing.inputType === 'audio' || inputType === 'audio' ? 'audio' : 'text';
      if (inputType === 'audio' && audioMeta) {
        existing.audioMeta = audioMeta;
      }
      this.pendingInputs.set(robotId, existing);
    } else {
      this.pendingInputs.set(robotId, {
        text: cleaned,
        ttsOptions,
        inputType,
        audioMeta,
        conversationId: conversationId || uuidv7(),
      });
    }

    const timer = this.inputMergeTimers.get(robotId);
    if (timer) {
      clearTimeout(timer);
    }

    this.inputMergeTimers.set(robotId, setTimeout(() => {
      void this.flushUserText(robotId);
    }, this.inputMergeWindowMs));
  }

  private async flushUserText(robotId: string): Promise<void> {
    const pending = this.pendingInputs.get(robotId);
    if (!pending) {
      return;
    }

    this.pendingInputs.delete(robotId);

    const timer = this.inputMergeTimers.get(robotId);
    if (timer) {
      clearTimeout(timer);
      this.inputMergeTimers.delete(robotId);
    }

    if (!this.inputRateLimiter.check(robotId)) {
      logger.warn('输入过于频繁', { robotId });
      this.依赖.发送错误(robotId, 'RATE_LIMITED', '请求过于频繁，请稍后再试', 'business');
      return;
    }

    await this.processUserText(
      robotId,
      pending.text,
      pending.ttsOptions,
      pending.inputType,
      pending.audioMeta,
      pending.conversationId,
    );
  }

  private 转成错误对象(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private 提取错误消息(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
