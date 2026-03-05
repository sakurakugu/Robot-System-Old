import { Server } from 'http';
import OpusScript from 'opusscript';
import { WebSocket, WebSocketServer } from 'ws';
import 配置 from '../../config';
import type DatabaseService from '../../core/database';
import { logger } from '../../core/logger';
import { hasVisionTag, isValidRobotId, RateLimiter, removeActionTags, removeVisionTags, uuidv7 } from '../../core/utils/helpers';
import { LLM供应商列表 } from '../../modules/大模型管理/types';
import type { ClientMessage, RobotConnection, ServerMessage } from '../../types';
import { AliyunStreamingASR } from '../大模型交互/aliyun-streaming-asr';
import 语音识别服务 from '../大模型交互/asr-service';
import 对话服务 from '../大模型交互/chat-service';
import TTSService from '../大模型交互/tts-service';
import { VideoStreamManager } from '../机器人交互/video-service';
import type { 机器人服务 } from '../机器人管理/service';


type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

type AudioSession = {
  robotId: string;
  sessionId: string;
  format: 'opus';
  sampleRate: number;
  channels: number;
  frameDurationMs: number;
  chunks: Buffer[];
  startedAt: number;
  lastChunkAt: number;
  // 流式 ASR 相关
  streamingASR?: AliyunStreamingASR;
  opusDecoder?: any;
  asrOptions?: any;
  // PCM 缓冲区（用于累积多帧再发送）
  pcmBuffer?: Buffer[];
  pcmBufferSize?: number;
};

class WebSocket服务 {
  private wssMap: Map<Channel, WebSocketServer> = new Map();
  private pathToChannelMap: Map<string, Channel> = new Map();
  private upgradeHandlerInstalled = false;
  // 机器人客户端连接（按通道）
  private robotConnections: Map<string, Map<Channel, RobotConnection>> = new Map();
  // UI 控制端连接（按通道，可多）
  private uiConnections: Map<string, Map<Channel, Set<WebSocket>>> = new Map();
  private database: DatabaseService;
  private 对话服务?: 对话服务;
  private 机器人服务?: 机器人服务;
  private ttsService: TTSService;
  private videoStreamManager: VideoStreamManager;
  private asrService: 语音识别服务;
  private audioSessions: Map<string, AudioSession> = new Map();
  private inputMergeTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingInputs: Map<
    string,
    {
      text: string;
      ttsOptions?: any;
      inputType: 'text' | 'audio';
      audioMeta?: { asrTime: number; durationMs: number; sessionId: string };
      conversationId: string;
    }
  > = new Map();
  private inputRateLimiter = new RateLimiter(3, 3000);
  private ttsRateLimiter = new RateLimiter(5, 5000);
  private inputMergeWindowMs = 500;

  constructor(database: DatabaseService) {
    this.database = database;
    this.ttsService = new TTSService();
    this.videoStreamManager = new VideoStreamManager();
    this.asrService = new 语音识别服务();
  }

  /**
   * 设置 机器人服务 引用（用于拍照等功能）
   */
  set机器人服务(机器人服务: 机器人服务): void {
    this.机器人服务 = 机器人服务;
  }

  set对话服务(对话服务: 对话服务): void {
    this.对话服务 = 对话服务;
  }

  /**
   * 初始化WebSocket服务器
   */
  init(server: Server, options: { path: string; channel: Channel }): void {
    const { path, channel } = options;
    const wss = new WebSocketServer({
      noServer: true,
    });

    wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req, channel);
    });

    this.wssMap.set(channel, wss);
    this.pathToChannelMap.set(path, channel);

    // 只在第一次调用时安装 upgrade 处理器
    if (!this.upgradeHandlerInstalled) {
      this.upgradeHandlerInstalled = true;
      server.on('upgrade', (request, socket, head) => {
        const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
        const targetChannel = this.pathToChannelMap.get(pathname);

        if (targetChannel) {
          const targetWss = this.wssMap.get(targetChannel);
          if (targetWss) {
            targetWss.handleUpgrade(request, socket, head, (ws) => {
              targetWss.emit('connection', ws, request);
            });
          } else {
            socket.destroy();
          }
        } else {
          // 路径不匹配，拒绝连接
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
        }
      });
    }

    logger.info('WebSocket服务已启动', { path, channel });
  }

  /**
   * 处理新连接
   */
  private handleConnection(ws: WebSocket, req: any, channel: Channel): void {
    // 从查询参数获取 robotId 与角色
    const url = new URL(req.url!, `http://${req.headers.host}`);
    let robotId = url.searchParams.get('robotId');
    let role = (url.searchParams.get('role') || '').toLowerCase();

    // 优先从路径推断角色
    if (url.pathname.includes('/api/v1/robot')) {
      role = 'robot';
    } else if (url.pathname.includes('/api/v1/web') || url.pathname.includes('/api/v1/phone')) {
      role = 'ui';
    }

    // 手机端独立连接：phoneId 是手机侧会话 ID，与机器人无关
    // 存在 phoneId 时，以它作为连接 key，跳过机器人数据库读写
    const phoneId = url.searchParams.get('phoneId');
    const isPhoneSession = !!(phoneId && role === 'ui');
    if (isPhoneSession) {
      robotId = phoneId!;
    } else if (!robotId || !isValidRobotId(robotId)) {
      robotId = uuidv7();
      logger.info('生成新的机器狗ID', { robotId });
    }

    // UI 连接：不占用机器人连接槽位，加入 UI 订阅集合
    if (role === 'ui') {
      if (!this.uiConnections.has(robotId)) {
        this.uiConnections.set(robotId, new Map());
      }
      const byChannel = this.uiConnections.get(robotId)!;
      if (!byChannel.has(channel)) {
        byChannel.set(channel, new Set());
      }
      byChannel.get(channel)!.add(ws);
      logger.info('UI连接建立', {
        robotId,
        channel,
        uiCount: byChannel.get(channel)!.size,
      });
    } else {
      // 机器人连接：唯一，先关闭旧连接
      const existingConnections = this.robotConnections.get(robotId);
      const existingConnection = existingConnections?.get(channel);
      if (existingConnection && existingConnection.websocket !== ws) {
        logger.info('关闭旧的机器人连接', { robotId, channel });
        try {
          existingConnection.websocket.close(1000, '新连接已建立');
        } catch (error) {
          // 忽略关闭错误
        }
      }

      const connection: RobotConnection = {
        robotId,
        websocket: ws,
        connectedAt: new Date(),
        lastActiveAt: new Date(),
        metadata: {},
        channel,
      };
      if (!this.robotConnections.has(robotId)) {
        this.robotConnections.set(robotId, new Map());
      }
      this.robotConnections.get(robotId)!.set(channel, connection);
    }

    // 仅机器人连接才需要更新数据库状态；手机端独立会话（phoneId）不写入机器人表
    if (!isPhoneSession) {
      const existing = this.database.getRobot(robotId);
      if (existing) {
        this.database.updateRobot(robotId, { status: 'online' });
      } else {
        this.database.upsertRobot({
          uuid: robotId,
          status: 'online',
        });
      }
    }

    logger.info(isPhoneSession ? '手机端独立连接建立' : '机器人连接建立', {
      [isPhoneSession ? 'phoneId' : 'robotId']: robotId,
      channel,
      ip: req.socket.remoteAddress,
      role: role || 'robot',
    });

    // 仅对机器人客户端的 business 通道发送连接确认消息
    // 其他通道（control, audio_upload, audio_download）不发送消息
    if (role !== 'ui' && channel === 'business') {
      this.sendToRobot(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        data: {
          text: `连接成功！你的机器狗ID是: ${robotId}`,
        },
      }, channel);
    }

    // 设置消息处理器
    ws.on('message', (data: Buffer) => {
      this.handleMessage(robotId, data, channel);
    });

    // 设置关闭处理器
    ws.on('close', () => {
      if (role === 'ui') {
        const byChannel = this.uiConnections.get(robotId);
        if (byChannel) {
          const set = byChannel.get(channel);
          if (set) {
            set.delete(ws);
            if (set.size === 0) {
              byChannel.delete(channel);
            }
          }
          if (byChannel.size === 0) {
            this.uiConnections.delete(robotId);
          }
        }
        logger.info('UI连接关闭', { robotId, channel });
      } else {
        this.handleDisconnection(robotId, channel);
      }
    });

    // 设置错误处理器
    ws.on('error', (error) => {
      logger.error('WebSocket错误', error, { robotId });
    });

    // 设置心跳检测
    this.setupHeartbeat(robotId, channel);
  }

  /**
   * 处理客户端消息
   */
  private async handleMessage(robotId: string, data: Buffer, channel: Channel): Promise<void> {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      if (!this.isAllowedMessageType(channel, (message as any).type)) {
        logger.warn('消息通道不匹配', { robotId, channel, type: (message as any).type });
        this.sendError(robotId, 'CHANNEL_MISMATCH', '消息通道不匹配', channel);
        return;
      }

      // 更新最后活跃时间
      const rconn = this.robotConnections.get(robotId)?.get(channel);
      if (rconn) {
        rconn.lastActiveAt = new Date();
      }

      switch (message.type) {
        case 'text_input':
          await this.handleTextInput(
            robotId,
            message.data.text,
            (message as any).data?.ttsOptions,
            (message as any).data?.conversationId || (message as any).conversationId
          );
          break;
        case 'tts_input':
          await this.handleTTSInput(
            robotId,
            (message as any).data?.text,
            (message as any).data?.ttsOptions,
            (message as any).data?.conversationId || (message as any).conversationId
          );
          break;

        case 'audio_control':
          await this.handleAudioControl(robotId, (message as any).data);
          break;

        case 'audio_start':
          await this.handleAudioStart(robotId, (message as any).data);
          break;

        case 'audio_chunk':
          await this.handleAudioChunk(robotId, message.data);
          break;

        case 'audio_end':
          await this.handleAudioEnd(robotId, (message as any).data);
          break;

        case 'heartbeat':
          this.handleHeartbeat(robotId);
          break;

        case 'status': {
          this.handleStatus(robotId, message);
          break;
        }
        // 机器人注册
        case 'robot_register':
          await this.handleRobotRegister(robotId, message.data);
          break;

        case 'video_subscribe':
          await this.handleVideoSubscribe(robotId);
          break;

        case 'video_unsubscribe':
          await this.handleVideoUnsubscribe(robotId);
          break;

        case 'action_input':
          await this.handleActionInput(robotId, (message as any).data?.action, (message as any).data?.parameters);
          break;

        case 'control_input':
          await this.handleControlInput(robotId, (message as any).data);
          break;

        case 'sdk_mode_set':
          await this.handleSdkModeSet(robotId, (message as any).data);
          break;

        case 'sdk_mode_get':
          await this.handleSdkModeGet(robotId);
          break;

        // SDK模式响应（来自robot-agent，需要转发到UI）
        case 'sdk_mode_response':
          await this.handleSdkModeResponse(robotId, (message as any).data);
          break;

        default:
          logger.warn('未知的消息类型', { robotId, type: (message as any).type });
      }
    } catch (error: any) {
      logger.error('处理消息失败', error, { robotId });
      this.sendError(robotId, 'MESSAGE_PARSE_ERROR', '消息解析失败', channel);
    }
  }

  private isAllowedMessageType(channel: Channel, type: string): boolean {
    const map: Record<Channel, Set<string>> = {
      control: new Set([]),
      business: new Set([
        'text_input',
        'tts_input',
        'action_input',
        'audio_control',
        'robot_register',
        'video_subscribe',
        'video_unsubscribe',
        'heartbeat',
        'status',
        'control_input',
        'camera_response',
        'sdk_mode_set',
        'sdk_mode_get',
        'sdk_mode_response',
        'volume_response',
        'config_response',
        'log_mark_response',
      ]),
      audio_upload: new Set(['audio_start', 'audio_chunk', 'audio_end', 'heartbeat']),
      audio_download: new Set(['heartbeat']),
    };
    return map[channel]?.has(type) ?? false;
  }

  /**
   * 处理文本输入
   */
  private async handleTextInput(
    robotId: string,
    text: string,
    ttsOptions?: any,
    conversationId?: string
  ): Promise<void> {
    await this.queueUserText(robotId, text, ttsOptions, 'text', undefined, conversationId);
  }

  /**
   * 处理音频转写结果
   */
  private async handleAudioTranscript(
    robotId: string,
    text: string,
    meta: { asrTime: number; durationMs: number; sessionId: string }
  ): Promise<void> {
    this.sendToUI(robotId, {
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

  /**
   * 统一处理文本（来源: text/audio）
   */
  // 用户语音 → ASR转文字 → AI模型处理 → 生成回复 → processUserText 函数 → sanitizeTtsText 过滤 → TTS服务
  private async processUserText(
    robotId: string,
    text: string,
    ttsOptions: any,
    inputType: 'text' | 'audio',
    audioMeta?: { asrTime: number; durationMs: number; sessionId: string },
    conversationId?: string
  ): Promise<void> {
    const startTime = Date.now();
    const traceId = conversationId || uuidv7();

    try {
      logger.info('收到文本输入', { robotId, text, inputType });

      // 检查机器人是否存在
      const robot = this.database.getRobot(robotId);
      if (!robot) {
        throw new Error('机器人不存在');
      }

      // 检查机器人是否配置了角色
      if (!robot.role_uuid) {
        const errorMsg = '该机器人未配置角色，无法进行对话。请在管理界面为机器人分配一个角色。';
        logger.warn('机器人未配置角色', { robotId });

        // 发送错误消息到UI
        this.sendToUI(robotId, {
          type: 'error',
          robotId,
          timestamp: Date.now(),
          conversationId: traceId,
          data: {
            message: errorMsg,
            code: 'NO_ROLE_CONFIGURED'
          },
        }, 'business');

        return;
      }

      // 使用对话服务处理
      let systemPrompt: string | undefined = undefined;
      let temperature: number | undefined = undefined;
      let model: string | undefined = undefined;
      let maxHistory: number = 10;

      if (robot) {
        // 仅当机器人模型是有效的LLM模型时才传递，否则使用系统配置的默认模型
        const provider = 配置.llm.provider;
        const allowedModels =
          LLM供应商列表.find(p => p.value === (provider as any))?.models.map(m => m.value) || [];
        if (robot.model && allowedModels.includes(robot.model)) {
          model = robot.model;
        } else {
          model = undefined;
        }
        // 新数据库结构中不再使用 metadata，AI 配置从 role 获取
        if (robot.role_uuid) {
          const role = this.database.getRole(robot.role_uuid);
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
      }

      if(!this.对话服务) {
        throw new Error('对话服务 未初始化');
      }

      // 第一步：调用LLM判断是否需要视觉识别
      const response = await this.对话服务.处理消息(robotId, text, {
        history: [],
        maxHistory,
        systemPrompt,
        model,
        temperature
      });

      // 检查回复中是否包含 {{vision=true}} 标记
      const needsVision = hasVisionTag(response.text);

      let finalResponse = response;

      if (needsVision) {
        logger.info('检测到视觉识别需求，开始拍照', { robotId });

        try {
          // 检查是否有 机器人服务
          if (!this.机器人服务) {
            throw new Error('机器人服务 未初始化');
          }

          // 发送状态消息到UI
          this.sendToUI(robotId, {
            type: 'vision_status',
            robotId,
            timestamp: Date.now(),
            conversationId: traceId,
            data: {
              status: 'capturing',
              message: '正在拍照...',
            },
          }, 'business');

          // 调用拍照功能
          const photoResult = await this.机器人服务.拍照(robotId);

          logger.info('拍照成功，开始视觉分析', { robotId });

          // 发送状态消息
          this.sendToUI(robotId, {
            type: 'vision_status',
            robotId,
            timestamp: Date.now(),
            conversationId: traceId,
            data: {
              status: 'analyzing',
              message: '正在分析图片...',
            },
          }, 'business');

          // 移除视觉标记，得到纯净的LLM回复（暂且先注释掉）
          // const cleanedText = removeVisionTags(response.text);

          // 使用用户原始问题和图片调用视觉模型
          const visionResponse = await this.对话服务.处理视觉消息(
            robotId,
            text, // 用户的原始问题
            photoResult.image,
            maxHistory,
          );

          finalResponse = visionResponse;

          logger.info('视觉分析完成', { robotId });
        } catch (error: any) {
          logger.error('视觉识别失败', error, { robotId });

          // 发送错误状态
          this.sendToUI(robotId, {
            type: 'vision_status',
            robotId,
            timestamp: Date.now(),
            conversationId: traceId,
            data: {
              status: 'error',
              message: `视觉识别失败: ${error.message}`,
            },
          }, 'business');

          // 使用原始回复，但移除视觉标记
          finalResponse = {
            ...response,
            text: removeVisionTags(response.text) + `\n\n（抱歉，我现在看不到周围环境：${error.message}）`,
          };
        }
      }

      const processingTime = Date.now() - startTime;
      const ttsText = this.sanitizeTtsText(finalResponse.text);
      const ttsDone = Boolean(ttsText);

      // 发送文本回复（广播到机器人和所有UI）
      this.broadcastMessage(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        conversationId: traceId,
        data: {
          text: finalResponse.text,
          ttsDone,
          noTTS: ttsDone ? undefined : true,
          vision: needsVision,
        },
      }, 'business');

      try {
        if (ttsText) {
          const streamEnabled = ttsOptions?.stream !== false;
          if (streamEnabled) {
            const sessionId = traceId;
            this.broadcastMessage(robotId, {
              type: 'audio_stream_start',
              robotId,
              timestamp: Date.now(),
              conversationId: traceId,
              data: {
                sessionId,
                format: 'mp3',
              },
            }, 'audio_download');
            const audio = await this.ttsService.synthesizeStream(ttsText, ttsOptions, (chunk: { seq: number; base64: string; format: 'mp3' }) => {
              this.broadcastMessage(robotId, {
                type: 'audio_stream_chunk',
                robotId,
                timestamp: Date.now(),
                conversationId: traceId,
                data: {
                  sessionId,
                  seq: chunk.seq,
                  buffer: chunk.base64,
                },
              }, 'audio_download');
            });
            this.broadcastMessage(robotId, {
              type: 'audio_stream_end',
              robotId,
              timestamp: Date.now(),
              conversationId: traceId,
              data: {
                sessionId,
                duration: audio.duration,
              },
            }, 'audio_download');
            this.broadcastMessage(robotId, {
              type: 'audio_response',
              robotId,
              timestamp: Date.now(),
              conversationId: traceId,
              data: audio,
            }, 'audio_download');
          } else {
            const audio = await this.ttsService.synthesize(ttsText, ttsOptions);
            this.broadcastMessage(robotId, {
              type: 'audio_response',
              robotId,
              timestamp: Date.now(),
              conversationId: traceId,
              data: audio,
            }, 'audio_download');
          }
        } else {
          logger.info('TTS跳过：回复文本为空或仅包含表情', { robotId });
        }
      } catch (e: any) {
        logger.error('TTS生成失败', e, { robotId });
      }

      // 发送动作指令
      for (const action of response.actions) {
        this.sendToRobot(robotId, {
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

        // 记录动作
        this.database.insertActionLog(robotId, action.name, action.parameters, 'success');
      }

      // 记录对话
      this.database.insertConversation({
        robot_id: robotId,
        type: inputType,
        user_input: text,
        ai_response: response.text,
        actions: response.actions,
        processing_time: processingTime,
        metadata: {
          ...response.metadata,
          conversationId: traceId,
          inputType,
          asrTime: audioMeta?.asrTime,
          audioDurationMs: audioMeta?.durationMs,
          audioSessionId: audioMeta?.sessionId,
        },
      });

      logger.记录对话({
        robotId,
        input: text,
        output: response.text,
        processingTime,
        actions: response.actions,
      });
    } catch (error: any) {
      logger.error('处理文本输入失败', error, { robotId });
      this.sendError(robotId, 'PROCESSING_ERROR', error.message, 'business');
    }
  }

  // 直接发送文本 → handleTTSInput 函数 → sanitizeTtsText 过滤 → TTS服务
  private async handleTTSInput(
    robotId: string,
    text: string,
    ttsOptions?: any,
    conversationId?: string
  ): Promise<void> {
    try {
      if (!this.ttsRateLimiter.check(robotId)) {
        logger.warn('TTS请求过于频繁', { robotId });
        this.sendError(robotId, 'RATE_LIMITED', '请求过于频繁，请稍后再试', 'business');
        return;
      }

      // 对TTS文本进行清理，移除不应该被朗读的标记
      const sanitizedText = this.sanitizeTtsText(text);
      if (!sanitizedText) {
        logger.info('TTS跳过：清理后文本为空', { robotId });
        return;
      }

      const streamEnabled = ttsOptions?.stream !== false;
      const sessionId = conversationId || uuidv7();
      if (streamEnabled) {
        this.broadcastMessage(robotId, {
          type: 'audio_stream_start',
          robotId,
          timestamp: Date.now(),
          conversationId: sessionId,
          data: {
            sessionId,
            format: 'mp3',
          },
        }, 'audio_download');
        const audio = await this.ttsService.synthesizeStream(sanitizedText, ttsOptions, (chunk: { seq: number; base64: string; format: 'mp3' }) => {
          this.broadcastMessage(robotId, {
            type: 'audio_stream_chunk',
            robotId,
            timestamp: Date.now(),
            conversationId: sessionId,
            data: {
              sessionId,
              seq: chunk.seq,
              buffer: chunk.base64,
            },
          }, 'audio_download');
        });
        this.broadcastMessage(robotId, {
          type: 'audio_stream_end',
          robotId,
          timestamp: Date.now(),
          conversationId: sessionId,
          data: {
            sessionId,
            duration: audio.duration,
          },
        }, 'audio_download');
        this.broadcastMessage(robotId, {
          type: 'audio_response',
          robotId,
          timestamp: Date.now(),
          conversationId: sessionId,
          data: audio,
        }, 'audio_download');
      } else {
        const audio = await this.ttsService.synthesize(sanitizedText, ttsOptions);
        this.broadcastMessage(robotId, {
          type: 'audio_response',
          robotId,
          timestamp: Date.now(),
          conversationId,
          data: audio,
        }, 'audio_download');
      }
    } catch (e: any) {
      logger.error('TTS生成失败', e, { robotId });
      this.sendError(robotId, 'TTS_ERROR', e?.message || 'TTS失败', 'business');
    }
  }

  /**
   * 处理动作输入 ({{action=xxx}})
   */
  private async handleActionInput(robotId: string, action: string, parameters?: Record<string, any>): Promise<void> {
    try {
      logger.info('收到动作输入', { robotId, action, parameters });

      // 验证动作名称
      if (!action || typeof action !== 'string') {
        this.sendError(robotId, 'INVALID_ACTION', '动作名称无效', 'business');
        return;
      }

      // 直接发送动作指令到机器狗
      this.sendToRobot(robotId, {
        type: 'action_command',
        robotId,
        timestamp: Date.now(),
        data: {
          action,
          parameters: parameters || {},
          safetyChecked: true,
        },
      }, 'business');

      // 记录动作
      this.database.insertActionLog(robotId, action, parameters || {}, 'success');

      // 通知UI已发送（添加 noTTS 标记，不生成TTS音频）
      this.broadcastMessage(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        data: {
          text: `动作已发送: ${action}`,
          noTTS: true,  // 标记不需要生成TTS
        },
      }, 'business');

      logger.info('动作指令已发送，不生成TTS', { robotId, action });
    } catch (error: any) {
      logger.error('处理动作输入失败', error, { robotId, action });
      this.sendError(robotId, 'ACTION_ERROR', error.message || '动作处理失败', 'business');
    }
  }

  /**
   * 处理控制输入（摇杆/急停）
   */
  private async handleControlInput(robotId: string, data: any): Promise<void> {
    try {
      const command = data?.command;
      if (!command || typeof command !== 'string') {
        this.sendError(robotId, 'INVALID_CONTROL', '控制指令无效', 'business');
        return;
      }

      if (!['joystick', 'joystick_stop', 'estop'].includes(command)) {
        this.sendError(robotId, 'INVALID_CONTROL', '控制指令无效', 'business');
        return;
      }

      const payload = {
        command: command as 'joystick' | 'joystick_stop' | 'estop',
        channel: data?.channel,
        mode: data?.mode,
        x: data?.x,
        y: data?.y,
        speed: data?.speed,
      };

      const sent = this.sendToRobot(robotId, {
        type: 'control_command',
        robotId,
        timestamp: Date.now(),
        data: payload,
      }, 'business');

      if (!sent) {
        this.sendError(robotId, 'ROBOT_OFFLINE', '机器人未连接', 'business');
      }
    } catch (error: any) {
      logger.error('处理控制输入失败', error, { robotId });
      this.sendError(robotId, 'CONTROL_ERROR', error.message || '控制处理失败', 'business');
    }
  }

  /**
   * 处理麦克风开关
   */
  private async handleAudioControl(robotId: string, data: any): Promise<void> {
    try {
      const enabled = Boolean(data?.enabled);
      const sent = this.sendToRobot(robotId, {
        type: 'audio_control',
        robotId,
        timestamp: Date.now(),
        data: { enabled, source: 'ui' },
      }, 'business');
      if (!sent) {
        this.sendError(robotId, 'ROBOT_OFFLINE', '机器人未连接', 'business');
      }
    } catch (error: any) {
      logger.error('处理音频控制失败', error, { robotId });
      this.sendError(robotId, 'AUDIO_CONTROL_ERROR', error.message || '音频控制失败', 'business');
    }
  }

  /**
   * 处理音频开始
   */
  private async handleAudioStart(robotId: string, audioData: any): Promise<void> {
    const sessionId = String(audioData?.sessionId || '');
    if (!sessionId) {
      logger.warn('音频开始缺少sessionId', { robotId });
      return;
    }
    const sampleRate = Number(audioData?.sampleRate || 16000);
    const channels = Number(audioData?.channels || 1);
    const frameDurationMs = Number(audioData?.frameDurationMs || 20);

    // 获取机器人的角色配置，确定是否使用流式 ASR
    const robot = this.database.getRobot(robotId);
    let asrOptions: any = {};
    let useStreamingASR = false;

    if (robot?.role_uuid) {
      const role = this.database.getRole(robot.role_uuid);
      if (role?.asr_provider) {
        asrOptions.provider = role.asr_provider;
        if (role.asr_model) {
          asrOptions.model = role.asr_model;
        }
        // 只有阿里云 ASR 支持流式处理
        useStreamingASR = role.asr_provider === 'aliyun';
      }
    } else if (配置.asr.provider === 'aliyun') {
      asrOptions.provider = 'aliyun';
      useStreamingASR = true;
    }

    const session: AudioSession = {
      robotId,
      sessionId,
      format: 'opus',
      sampleRate,
      channels,
      frameDurationMs,
      chunks: [],
      startedAt: Date.now(),
      lastChunkAt: Date.now(),
      asrOptions,
    };

    // 如果使用流式 ASR，立即启动连接
    if (useStreamingASR) {
      try {
        logger.info('启动流式 ASR 服务', { robotId, sessionId, asrOptions });

        // 创建流式 ASR 实例
        const streamingASR = new AliyunStreamingASR({
          model: asrOptions.model,
          sampleRate,
          format: 'pcm',
        });

        // 启动连接（异步，但不阻塞）
        streamingASR.start().catch((error) => {
          logger.error('流式 ASR 启动失败', error, { robotId, sessionId });
          this.sendError(robotId, 'ASR_START_ERROR', error.message || '流式 ASR 启动失败', 'business');
        });

        session.streamingASR = streamingASR;

        // 创建 Opus 解码器用于实时解码
        const sr = sampleRate === 16000 || sampleRate === 48000 ? sampleRate : 16000;
        const ch = channels === 2 ? 2 : 1;
        try {
          session.opusDecoder = new (OpusScript as any)(
            sr,
            ch,
            (OpusScript as any).Application.VOIP
          );
          // 初始化 PCM 缓冲区
          session.pcmBuffer = [];
          session.pcmBufferSize = 0;
          logger.debug('Opus 解码器初始化成功', { robotId, sessionId, sampleRate: sr, channels: ch });
        } catch (error) {
          logger.error('Opus 解码器初始化失败', error instanceof Error ? error : new Error(String(error)), {
            robotId,
            sessionId,
            sampleRate: sr,
            channels: ch,
          });
        }
      } catch (error: any) {
        logger.error('流式 ASR 初始化失败', error, { robotId, sessionId });
      }
    }

    this.audioSessions.set(sessionId, session);
    logger.debug('音频会话开始', {
      robotId,
      sessionId,
      sampleRate,
      channels,
      frameDurationMs,
      useStreamingASR,
    });
  }

  /**
   * 处理音频数据块
   */
  private async handleAudioChunk(robotId: string, audioData: any): Promise<void> {
    const sessionId = String(audioData?.sessionId || '');
    const buffer = audioData?.buffer;
    if (!buffer) {
      logger.debug('音频块数据为空', { robotId, sessionId });
      return;
    }
    let session = sessionId ? this.audioSessions.get(sessionId) : undefined;
    if (!session) {
      const fallbackSessionId = sessionId || `${robotId}-${Date.now()}`;
      session = {
        robotId,
        sessionId: fallbackSessionId,
        format: 'opus',
        sampleRate: Number(audioData?.sampleRate || 16000),
        channels: Number(audioData?.channels || 1),
        frameDurationMs: Number(audioData?.frameDurationMs || 20),
        chunks: [],
        startedAt: Date.now(),
        lastChunkAt: Date.now(),
      };
      this.audioSessions.set(fallbackSessionId, session);
    }

    try {
      const chunk = Buffer.from(buffer, 'base64');
      if (chunk.length > 0) {
        logger.debug('接收音频块', {
          robotId,
          sessionId,
          chunkLength: chunk.length,
          base64Length: buffer.length,
          totalChunks: session.chunks.length + 1,
          hasStreamingASR: !!session.streamingASR,
        });

        // 保存原始音频块（用于降级处理）
        session.chunks.push(chunk);
        session.lastChunkAt = Date.now();

        // 如果启用了流式 ASR，立即解码并累积
        if (session.streamingASR && session.opusDecoder) {
          try {
            const sr = session.sampleRate === 16000 || session.sampleRate === 48000 ? session.sampleRate : 16000;
            const allowed = new Set([2.5, 5, 10, 20, 40, 60]);
            const fd = allowed.has(session.frameDurationMs) ? session.frameDurationMs : 20;
            const frameSize = Math.floor((sr * fd) / 1000);

            // 解码 Opus 为 PCM（Int16Array）
            const pcmData = session.opusDecoder.decode(chunk, frameSize);
            if (pcmData && pcmData.length > 0) {
              // 正确转换 Int16Array 为 Buffer
              const pcmBuffer = Buffer.from(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);

              // 累积到缓冲区
              session.pcmBuffer = session.pcmBuffer || [];
              session.pcmBuffer.push(pcmBuffer);
              session.pcmBufferSize = (session.pcmBufferSize || 0) + pcmBuffer.length;

              // 当累积到约 100ms（3200 字节）时，批量发送
              const targetSize = Math.floor((sr * 2 * 100) / 1000); // 100ms 的字节数
              if (session.pcmBufferSize >= targetSize) {
                const mergedBuffer = Buffer.concat(session.pcmBuffer as any);
                session.streamingASR.pushAudio(mergedBuffer);
                session.pcmBuffer = [];
                session.pcmBufferSize = 0;

                logger.debug('批量推送 PCM 到流式 ASR', {
                  robotId,
                  sessionId,
                  pcmSize: mergedBuffer.length,
                  framesCount: session.pcmBuffer.length,
                });
              }

              logger.debug('音频块已解码', {
                robotId,
                sessionId,
                opusSize: chunk.length,
                pcmSize: pcmBuffer.length,
                asrStatus: session.streamingASR.getStatus(),
              });
            }
          } catch (error) {
            logger.warn('实时解码音频块失败', {
              robotId,
              sessionId,
              chunkLength: chunk.length,
              error: String(error),
            });
            // 解码失败不影响整体流程，会在 handleAudioEnd 时使用降级方案
          }
        }
      } else {
        logger.debug('音频块长度为0', { robotId, sessionId });
      }
    } catch (e) {
      logger.warn('音频块解码失败', { robotId, sessionId, error: String(e), bufferType: typeof buffer });
    }
  }

  /**
   * 处理音频结束
   */
  private async handleAudioEnd(robotId: string, audioData: any): Promise<void> {
    const sessionId = String(audioData?.sessionId || '');
    if (!sessionId) {
      logger.warn('音频结束缺少sessionId', { robotId });
      return;
    }
    const session = this.audioSessions.get(sessionId);
    if (!session) {
      logger.warn('音频会话不存在', { robotId, sessionId });
      return;
    }
    this.audioSessions.delete(sessionId);

    if (!session.chunks || session.chunks.length === 0) {
      logger.warn('音频会话无有效数据', { robotId, sessionId });
      return;
    }

    // 检查是否所有 chunks 都是空的
    const validChunks = session.chunks.filter(chunk => chunk && chunk.length > 0);
    if (validChunks.length === 0) {
      logger.warn('音频会话所有数据块都为空', { robotId, sessionId, totalChunks: session.chunks.length });
      return;
    }

    const durationMs = session.frameDurationMs * session.chunks.length;
    const asrStart = Date.now();

    try {
      let text = '';

      // 优先使用流式 ASR 结果
      if (session.streamingASR) {
        try {
          // 发送缓冲区中剩余的 PCM 数据
          if (session.pcmBuffer && session.pcmBuffer.length > 0) {
            const mergedBuffer = Buffer.concat(session.pcmBuffer as any);
            session.streamingASR.pushAudio(mergedBuffer);
            logger.debug('发送剩余 PCM 数据', {
              robotId,
              sessionId,
              pcmSize: mergedBuffer.length,
            });
            session.pcmBuffer = [];
            session.pcmBufferSize = 0;
          }

          text = await session.streamingASR.finish();

          logger.info('流式 ASR 识别完成', {
            robotId,
            sessionId,
            text,
            chunks: session.chunks.length,
            durationMs,
          });
        } catch (error: any) {
          logger.error('流式 ASR 识别失败，降级到批量处理', error, { robotId, sessionId });
          // 流式 ASR 失败，降级到原来的批量处理方式
          text = '';
        }
      }

      // 如果流式 ASR 没有结果（未启用或失败），使用原来的批量处理方式
      if (!text.trim()) {
        logger.info('使用批量 ASR 处理', { robotId, sessionId });
        const wavBuffer = this.decodeOpusChunksToWav(session);

        // 使用配置好的 ASR 选项
        const asrOptions = session.asrOptions || {};

        text = (await this.asrService.转录Wav(wavBuffer, asrOptions)) || '';
      }

      const asrTime = Date.now() - asrStart;

      if (!text.trim()) {
        logger.info('ASR结果为空', { robotId, sessionId });
        return;
      }

      await this.handleAudioTranscript(robotId, text.trim(), {
        asrTime,
        durationMs,
        sessionId,
      });
    } catch (error: any) {
      const message = error?.message || '语音识别失败';
      if (String(message).includes('Opus解码失败')) {
        logger.warn('Opus解码失败', {
          robotId,
          sessionId,
          chunks: session.chunks.length,
          sampleRate: session.sampleRate,
          channels: session.channels,
          frameDurationMs: session.frameDurationMs
        });
        return;
      }
      logger.error('音频处理失败', error, { robotId, sessionId });
      this.sendError(robotId, 'ASR_ERROR', message, 'business');
    } finally {
      // 清理资源
      if (session.opusDecoder) {
        try {
          session.opusDecoder.delete?.();
        } catch (error) {
          // 忽略清理错误
        }
      }
    }
  }

  private decodeOpusChunksToWav(session: AudioSession): Buffer {
    const sr = session.sampleRate === 16000 || session.sampleRate === 48000 ? session.sampleRate : 16000;
    const ch = session.channels === 2 ? 2 : 1;
    const allowed = new Set([2.5, 5, 10, 20, 40, 60]);
    const fd = allowed.has(session.frameDurationMs) ? session.frameDurationMs : 20;
    const frameSize = Math.floor((sr * fd) / 1000);

    let decoder: any;
    try {
      decoder = new (OpusScript as any)(
        sr,
        ch,
        (OpusScript as any).Application.VOIP
      );
    } catch (error) {
      logger.error('Opus解码器初始化失败', error instanceof Error ? error : new Error(String(error)), {
        sampleRate: sr,
        channels: ch,
        sessionId: session.sessionId
      });
      throw new Error('Opus解码失败');
    }

    try {
      const pcmBuffers: Uint8Array[] = [];
      const toUint8Array = (value: any): Uint8Array => {
        if (value instanceof Uint8Array) return value;
        if (value?.buffer) return new Uint8Array(value.buffer);
        return new Uint8Array(value);
      };

      let successCount = 0;
      let failCount = 0;
      for (let i = 0; i < session.chunks.length; i++) {
        const chunk = session.chunks[i];
        if (!chunk || chunk.length === 0) {
          logger.debug('跳过空音频块', { sessionId: session.sessionId, index: i });
          continue;
        }
        try {
          // 记录音频块的详细信息
          logger.debug('尝试解码音频块', {
            sessionId: session.sessionId,
            index: i,
            chunkLength: chunk.length,
            expectedFrameSize: frameSize,
            // 前16字节的十六进制，用于诊断
            hexPreview: chunk.slice(0, Math.min(16, chunk.length)).toString('hex')
          });

          const decoded = decoder.decode(chunk, frameSize);
          if (decoded && decoded.length > 0) {
            pcmBuffers.push(toUint8Array(decoded));
            successCount++;
            logger.debug('音频块解码成功', {
              sessionId: session.sessionId,
              index: i,
              decodedLength: decoded.length
            });
          }
        } catch (error) {
          failCount++;
          logger.warn('音频块解码失败', {
            sessionId: session.sessionId,
            index: i,
            chunkLength: chunk.length,
            expectedFrameSize: frameSize,
            error: String(error),
            errorStack: error instanceof Error ? error.stack : undefined
          });
        }
      }

      if (pcmBuffers.length === 0) {
        logger.warn('Opus解码失败：所有音频块解码失败', {
          sessionId: session.sessionId,
          totalChunks: session.chunks.length,
          failCount,
          sampleRate: sr,
          channels: ch,
          frameDurationMs: fd,
          frameSize
        });
        throw new Error('Opus解码失败');
      }

      if (failCount > 0) {
        logger.debug('部分音频块解码失败', {
          sessionId: session.sessionId,
          successCount,
          failCount,
          totalChunks: session.chunks.length
        });
      }

      const pcmData = Buffer.concat(pcmBuffers);
      return this.buildWavBuffer(pcmData, sr, ch);
    } finally {
      if (decoder) {
        try {
          decoder.delete();
        } catch (e) {
          logger.error('Opus解码器释放失败', e instanceof Error ? e : new Error(String(e)));
        }
      }
    }
  }

  private buildWavBuffer(pcmData: Buffer, sampleRate: number, channels: number): Buffer {
    const bitsPerSample = 16;
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    buffer.set(pcmData, 44);

    return buffer;
  }

  private sanitizeTtsText(text: string): string {
    if (!text) return '';

    // 移除表情符号
    const emojiRegex = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
    let result = removeActionTags(text).replace(emojiRegex, '');
    result = result.replace(/[（(][^）)]*(?:注意|提示|警告|说明)[^）)]*[）)]/g, '');

    // 移除特殊标记如 {{meaning=false}}，这些标记用于控制AI行为但不应被朗读
    result = result.replace(/\{\{\s*meaning\s*=\s*false\s*\}\}/g, '');

    // 移除视觉标记 {{vision=true}}
    result = removeVisionTags(result);

    return result.trim();
  }

  private async queueUserText(
    robotId: string,
    text: string,
    ttsOptions: any,
    inputType: 'text' | 'audio',
    audioMeta?: { asrTime: number; durationMs: number; sessionId: string },
    conversationId?: string
  ): Promise<void> {
    const cleaned = String(text || '').trim();
    if (!cleaned) return;
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
    this.inputMergeTimers.set(
      robotId,
      setTimeout(() => {
        void this.flushUserText(robotId);
      }, this.inputMergeWindowMs)
    );
  }

  private async flushUserText(robotId: string): Promise<void> {
    const pending = this.pendingInputs.get(robotId);
    if (!pending) return;
    this.pendingInputs.delete(robotId);
    const timer = this.inputMergeTimers.get(robotId);
    if (timer) {
      clearTimeout(timer);
      this.inputMergeTimers.delete(robotId);
    }
    if (!this.inputRateLimiter.check(robotId)) {
      logger.warn('输入过于频繁', { robotId });
      this.sendError(robotId, 'RATE_LIMITED', '请求过于频繁，请稍后再试', 'business');
      return;
    }
    await this.processUserText(
      robotId,
      pending.text,
      pending.ttsOptions,
      pending.inputType,
      pending.audioMeta,
      pending.conversationId
    );
  }

  /**
   * 处理心跳
   */
  private handleHeartbeat(robotId: string): void {
    logger.debug('收到心跳', { robotId });
    // 心跳响应已经通过更新lastActiveAt实现
  }

  /**
   * 处理状态更新
   */
  private handleStatus(robotId: string, msg: any): void {
    const payload = {
      robotId: msg?.robotId ?? robotId,
      seq: msg?.seq,
      timestamp: msg?.timestamp,
      data: msg?.data ?? msg,
    };
    logger.debug('收到状态更新', { robotId, payload });

    // 由于新数据库结构不再使用 metadata 存储状态，这里仅广播到 UI
    // TODO: 如果需要持久化状态，可以添加专门的状态表

    // 广播电量状态到UI
    try {
      const levelRaw = (payload.data && (payload.data.battery ?? payload.data.level)) as any;
      const levelNum = typeof levelRaw === 'number' ? levelRaw : parseFloat(levelRaw);
      if (!Number.isNaN(levelNum)) {
        this.sendToUI(payload.robotId || robotId, {
          type: 'battery_status',
          robotId: payload.robotId || robotId,
          timestamp: Date.now(),
          data: {
            level: Math.round(levelNum),
          },
        }, 'control');
      }
    } catch (err: any) {
      logger.error('广播电量状态失败', err, { robotId });
    }

    // 同步广播完整状态到UI（便于前端冗余处理）
    try {
      this.sendToUI(payload.robotId || robotId, {
        type: 'status_update',
        robotId: payload.robotId || robotId,
        timestamp: Date.now(),
        data: payload.data || {},
      }, 'control');
    } catch (err: any) {
      logger.error('广播状态更新失败', err, { robotId });
    }
  }

  /**
   * 处理机器人注册
   */
  private async handleRobotRegister(robotId: string, data: any): Promise<void> {
    logger.info('收到机器人注册', { robotId, data });

    try {
      const { name, model, version } = data;
      const metadata = data?.metadata && typeof data.metadata === 'object' ? data.metadata : {};
      const agentVersion = typeof version === 'string' && version ? version : metadata.agent_version;
      const motionControlVersion = typeof metadata.motion_control_version === 'string' ? metadata.motion_control_version : undefined;
      const robotServerVersion = typeof metadata.robot_server_version === 'string' ? metadata.robot_server_version : undefined;

      // 更新机器人信息
      const robot = this.database.getRobot(robotId);

      this.database.updateRobot(robotId, {
        name: name || robot?.name || null,
        model: model || robot?.model || null,
        version: agentVersion || robot?.version || null,
        motion_control_version: motionControlVersion || robot?.motion_control_version || null,
        server_version: robotServerVersion || robot?.server_version || null,
        status: 'online',
        last_connected_at: new Date().toISOString(),
      });

      // 更新连接元数据
      const connection = this.robotConnections.get(robotId)?.get('business');
      if (connection) {
        connection.metadata = {
          name: name || connection.metadata.name,
          model: model || connection.metadata.model,
          version: agentVersion || connection.metadata.version,
          motion_control_version: motionControlVersion || connection.metadata.motion_control_version,
          robot_server_version: robotServerVersion || connection.metadata.robot_server_version,
        };
      }

      logger.info('客户端注册成功', {
        robotId,
        name,
        model,
        agentVersion,
        motionControlVersion,
        robotServerVersion,
      });

      // 发送注册确认 - 仅发送到 business 通道，不要广播到其他通道
      this.sendToRobot(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        data: {
          text: `客户端注册成功！欢迎 ${name || '机器狗'}`,
        },
      }, 'business');

      // 单独通知 UI
      // this.sendToUI(robotId, {
      //   type: 'text_response',
      //   robotId,
      //   timestamp: Date.now(),
      //   data: {
      //     text: `客户端注册成功！欢迎 ${name || '机器狗'}`,
      //   },
      // }, 'business');
    } catch (error: any) {
      logger.error('处理客户端注册失败', error, { robotId });
      this.sendError(robotId, 'REGISTER_ERROR', error.message, 'business');
    }
  }

  /**
   * 处理视频流订阅
   */
  private async handleVideoSubscribe(robotId: string): Promise<void> {
    try {
      // 从数据库获取机器人IP
      const robot = this.database.getRobot(robotId);
      if (!robot || !robot.ip) {
        this.sendError(robotId, 'NO_ROBOT_IP', '机器人IP未配置');
        return;
      }

      const rtspUrl = `rtsp://${robot.ip}:8554/test`;
      const videoService = this.videoStreamManager.subscribe(robotId, rtspUrl, robotId);

      // 监听视频帧并转发给UI客户端
      videoService.on('frame', (frameBuffer: Buffer) => {
        const base64Frame = frameBuffer.toString('base64');
        this.sendToUI(robotId, {
          type: 'video_frame',
          robotId,
          timestamp: Date.now(),
          data: {
            frame: base64Frame,
          },
        }, 'business');
      });

      logger.info('视频流订阅成功', { robotId, rtspUrl });
    } catch (error: any) {
      logger.error('视频流订阅失败', error, { robotId });
      this.sendError(robotId, 'VIDEO_SUBSCRIBE_ERROR', '视频流订阅失败', 'business');
    }
  }

  /**
   * 处理视频流取消订阅
   */
  private async handleVideoUnsubscribe(robotId: string): Promise<void> {
    try {
      this.videoStreamManager.unsubscribe(robotId, robotId);
      logger.info('视频流取消订阅', { robotId });
    } catch (error: any) {
      logger.error('视频流取消订阅失败', error, { robotId });
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnection(robotId: string, channel: Channel): void {
    const connections = this.robotConnections.get(robotId);
    if (connections) {
      connections.delete(channel);
      if (connections.size === 0) {
        this.robotConnections.delete(robotId);
        this.database.updateRobot(robotId, { status: 'offline' });
        logger.info('机器人连接断开', { robotId, channel });
      }
    }
  }

  /**
   * 广播消息到机器人和对应的所有UI
   */
  private broadcastMessage(robotId: string, message: ServerMessage, channel: Channel = 'business'): void {
    // 机器人客户端
    this.sendToRobot(robotId, message, channel);
    // 所有UI订阅者
    const uis = this.uiConnections.get(robotId);
    const byChannel = uis?.get(channel);
    if (byChannel && byChannel.size > 0) {
      for (const uiWs of byChannel.values()) {
        try {
          uiWs.send(JSON.stringify(message));
        } catch (error: any) {
          logger.error('发送消息到UI失败', error, { robotId });
        }
      }
    }
  }

  /**
   * 发送消息到UI客户端（不包括机器人）
   */
  private sendToUI(robotId: string, message: ServerMessage, channel: Channel = 'business'): void {
    const uis = this.uiConnections.get(robotId);
    const byChannel = uis?.get(channel);
    if (byChannel && byChannel.size > 0) {
      for (const uiWs of byChannel.values()) {
        try {
          uiWs.send(JSON.stringify(message));
        } catch (error: any) {
          logger.error('发送消息到UI失败', error, { robotId });
        }
      }
    }
  }

  /**
   * 发送错误消息
   */
  private sendError(robotId: string, code: string, message: string, channel: Channel = 'business'): void {
    this.broadcastMessage(robotId, {
      type: 'error',
      robotId,
      timestamp: Date.now(),
      data: {
        code,
        message,
      },
    }, channel);
  }

  /**
   * 设置心跳检测
   */
  private setupHeartbeat(robotId: string, channel: Channel): void {
    const interval = setInterval(() => {
      const connection = this.robotConnections.get(robotId)?.get(channel);
      if (!connection) {
        clearInterval(interval);
        return;
      }

      // 检查是否超时（5分钟无活动）
      const now = Date.now();
      const lastActive = connection.lastActiveAt.getTime();
      if (now - lastActive > 5 * 60 * 1000) {
        logger.warn('连接超时，自动断开', { robotId });
        connection.websocket.close();
        clearInterval(interval);
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 获取机器人连接
   */
  getConnections(): Map<string, Map<Channel, RobotConnection>> {
    return this.robotConnections;
  }

  /**
   * 获取在线机器人数量
   */
  getOnlineCount(): number {
    let count = 0;
    for (const connections of this.robotConnections.values()) {
      if (connections.size > 0) {
        count += 1;
      }
    }
    return count;
  }

  /**
   * 关闭WebSocket服务器
   */
  close(): void {
    this.videoStreamManager.shutdown();
    for (const wss of this.wssMap.values()) {
      wss.close();
    }
    logger.info('WebSocket服务已关闭');
  }

  /**
   * 对外暴露：发送消息到机器人客户端
   */
  sendToRobot(robotId: string, message: ServerMessage, channel: Channel = 'business'): boolean {
    const connection = this.robotConnections.get(robotId)?.get(channel);
    if (!connection) {
      logger.warn('机器人未连接，无法发送', { robotId, channel });
      return false;
    }
    try {
      connection.websocket.send(JSON.stringify(message));
      return true;
    } catch (error: any) {
      logger.error('发送到机器人失败', error, { robotId });
      return false;
    }
  }

  /**
   * 对外暴露：广播消息到所有 UI 客户端
   */
  broadcast(message: ServerMessage, channel: Channel = 'business'): void {
    for (const [robotId, channelMap] of this.uiConnections) {
      const uiSet = channelMap.get(channel);
      if (uiSet && uiSet.size > 0) {
        for (const uiWs of uiSet) {
          try {
            uiWs.send(JSON.stringify(message));
          } catch (error: any) {
            logger.error('广播消息到UI失败', error, { robotId });
          }
        }
      }
    }
  }

  /**
   * 请求机器人拍照（用于API调用）
   */
  async 请求机器人拍照(robotId: string): Promise<{ success: boolean; image?: string; format?: string; error?: string }> {
    // 检查机器人是否在线
    const connection = this.robotConnections.get(robotId)?.get('business');
    if (!connection) {
      throw new Error('机器人未连接');
    }

    const requestId = uuidv7();

    // 发送拍照命令
    const success = this.sendToRobot(robotId, {
      type: 'camera_capture',
      robotId,
      timestamp: Date.now(),
      data: { requestId },
    }, 'business');

    if (!success) {
      throw new Error('发送拍照命令失败');
    }

    // 等待响应（最多30秒）
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('拍照请求超时'));
      }, 30000);

      // 临时监听响应
      const checkResponse = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'camera_response' && message.data?.requestId === requestId) {
            clearTimeout(timeout);
            connection.websocket.off('message', checkResponse);
            resolve(message.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      connection.websocket.on('message', checkResponse);
    });
  }

  /**
   * 请求获取机器人音量（用于API调用）
   */
  async 请求获取机器人音量(robotId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const connection = this.robotConnections.get(robotId)?.get('business');
    if (!connection) {
      throw new Error('机器人未连接');
    }

    const requestId = uuidv7();

    const success = this.sendToRobot(robotId, {
      type: 'volume_get',
      robotId,
      timestamp: Date.now(),
      data: { requestId },
    }, 'business');

    if (!success) {
      throw new Error('发送获取音量命令失败');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('获取音量请求超时'));
      }, 30000);

      const checkResponse = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'volume_response' && message.data?.requestId === requestId) {
            clearTimeout(timeout);
            connection.websocket.off('message', checkResponse);
            resolve(message.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      connection.websocket.on('message', checkResponse);
    });
  }

  /**
   * 请求设置机器人音量（用于API调用）
   */
  async 请求设置机器人音量(robotId: string, volume: number): Promise<{ success: boolean; data?: any; error?: string }> {
    const connection = this.robotConnections.get(robotId)?.get('business');
    if (!connection) {
      throw new Error('机器人未连接');
    }

    const requestId = uuidv7();

    const success = this.sendToRobot(robotId, {
      type: 'volume_set',
      robotId,
      timestamp: Date.now(),
      data: { requestId, volume },
    }, 'business');

    if (!success) {
      throw new Error('发送设置音量命令失败');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('设置音量请求超时'));
      }, 30000);

      const checkResponse = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'volume_response' && message.data?.requestId === requestId) {
            clearTimeout(timeout);
            connection.websocket.off('message', checkResponse);
            resolve(message.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      connection.websocket.on('message', checkResponse);
    });
  }

  /**
   * 请求设置机器人静音（用于API调用）
   */
  async 请求设置机器人静音(robotId: string, mute: boolean): Promise<{ success: boolean; data?: any; error?: string }> {
    const connection = this.robotConnections.get(robotId)?.get('business');
    if (!connection) {
      throw new Error('机器人未连接');
    }

    const requestId = uuidv7();

    const success = this.sendToRobot(robotId, {
      type: 'volume_mute',
      robotId,
      timestamp: Date.now(),
      data: { requestId, mute },
    }, 'business');

    if (!success) {
      throw new Error('发送设置静音命令失败');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('设置静音请求超时'));
      }, 30000);

      const checkResponse = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'volume_response' && message.data?.requestId === requestId) {
            clearTimeout(timeout);
            connection.websocket.off('message', checkResponse);
            resolve(message.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      connection.websocket.on('message', checkResponse);
    });
  }

  /**
   * 请求获取机器人配置（用于API调用）
   */
  async 请求获取机器人配置(robotId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const connection = this.robotConnections.get(robotId)?.get('business');
    if (!connection) {
      throw new Error('机器人未连接');
    }

    const requestId = uuidv7();

    const success = this.sendToRobot(robotId, {
      type: 'config_get',
      robotId,
      timestamp: Date.now(),
      data: { requestId },
    }, 'business');

    if (!success) {
      throw new Error('发送获取配置命令失败');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('获取配置请求超时'));
      }, 30000);

      const checkResponse = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'config_response' && message.data?.requestId === requestId) {
            clearTimeout(timeout);
            connection.websocket.off('message', checkResponse);
            resolve(message.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      connection.websocket.on('message', checkResponse);
    });
  }

  /**
   * 请求更新机器人配置（用于API调用）
   */
  async 请求更新机器人配置(robotId: string, config: any): Promise<{ success: boolean; data?: any; error?: string }> {
    const connection = this.robotConnections.get(robotId)?.get('business');
    if (!connection) {
      throw new Error('机器人未连接');
    }

    const requestId = uuidv7();

    const success = this.sendToRobot(robotId, {
      type: 'config_update',
      robotId,
      timestamp: Date.now(),
      data: { requestId, config },
    }, 'business');

    if (!success) {
      throw new Error('发送更新配置命令失败');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('更新配置请求超时'));
      }, 30000);

      const checkResponse = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'config_response' && message.data?.requestId === requestId) {
            clearTimeout(timeout);
            connection.websocket.off('message', checkResponse);
            resolve(message.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      connection.websocket.on('message', checkResponse);
    });
  }

  /**
   * 处理SDK模式设置（来自UI）
   */
  private async handleSdkModeSet(robotId: string, data: any): Promise<void> {
    try {
      const sdkMode = data?.sdkMode;
      logger.info('收到SDK模式设置请求', { robotId, sdkMode });

      // 转发给机器人客户端
      const requestId = uuidv7();
      const success = this.sendToRobot(robotId, {
        type: 'sdk_mode_set',
        robotId,
        timestamp: Date.now(),
        data: { requestId, sdkMode },
      }, 'business');

      if (!success) {
        this.sendError(robotId, 'ROBOT_OFFLINE', '机器人未连接', 'business');
      }
    } catch (error: any) {
      logger.error('处理SDK模式设置失败', error, { robotId });
      this.sendError(robotId, 'SDK_MODE_ERROR', error.message || 'SDK模式设置失败', 'business');
    }
  }

  /**
   * 处理SDK模式获取（来自UI）
   */
  private async handleSdkModeGet(robotId: string): Promise<void> {
    try {
      logger.info('收到SDK模式获取请求', { robotId });

      // 转发给机器人客户端
      const requestId = uuidv7();
      const success = this.sendToRobot(robotId, {
        type: 'sdk_mode_get',
        robotId,
        timestamp: Date.now(),
        data: { requestId },
      }, 'business');

      if (!success) {
        this.sendError(robotId, 'ROBOT_OFFLINE', '机器人未连接', 'business');
      }
    } catch (error: any) {
      logger.error('处理SDK模式获取失败', error, { robotId });
      this.sendError(robotId, 'SDK_MODE_ERROR', error.message || 'SDK模式获取失败', 'business');
    }
  }

  /**
   * 处理SDK模式响应（来自robot-agent，转发到UI）
   */
  private async handleSdkModeResponse(robotId: string, data: any): Promise<void> {
    try {
      logger.info('收到SDK模式响应，转发到UI', { robotId, data });

      // 广播到所有UI客户端
      this.sendToUI(robotId, {
        type: 'sdk_mode_response',
        robotId,
        timestamp: Date.now(),
        data,
      }, 'business');
    } catch (error: any) {
      logger.error('处理SDK模式响应失败', error, { robotId });
    }
  }

  /**
   * 请求设置SDK模式（用于API调用）
   */
  async 请求设置SDK模式(robotId: string, sdkMode: boolean): Promise<{ success: boolean; sdkMode?: boolean; error?: string }> {
    const connection = this.robotConnections.get(robotId)?.get('business');
    if (!connection) {
      throw new Error('机器人未连接');
    }

    const requestId = uuidv7();

    const success = this.sendToRobot(robotId, {
      type: 'sdk_mode_set',
      robotId,
      timestamp: Date.now(),
      data: { requestId, sdkMode },
    }, 'business');

    if (!success) {
      throw new Error('发送设置SDK模式命令失败');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('设置SDK模式请求超时'));
      }, 30000);

      const checkResponse = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'sdk_mode_response' && message.data?.requestId === requestId) {
            clearTimeout(timeout);
            connection.websocket.off('message', checkResponse);
            resolve(message.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      connection.websocket.on('message', checkResponse);
    });
  }

  /**
   * 请求获取SDK模式（用于API调用）
   */
  async 请求获取SDK模式(robotId: string): Promise<{ success: boolean; sdkMode?: boolean; error?: string }> {
    const connection = this.robotConnections.get(robotId)?.get('business');
    if (!connection) {
      throw new Error('机器人未连接');
    }

    const requestId = uuidv7();

    const success = this.sendToRobot(robotId, {
      type: 'sdk_mode_get',
      robotId,
      timestamp: Date.now(),
      data: { requestId },
    }, 'business');

    if (!success) {
      throw new Error('发送获取SDK模式命令失败');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('获取SDK模式请求超时'));
      }, 30000);

      const checkResponse = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'sdk_mode_response' && message.data?.requestId === requestId) {
            clearTimeout(timeout);
            connection.websocket.off('message', checkResponse);
            resolve(message.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      connection.websocket.on('message', checkResponse);
    });
  }

  /**
   * 请求写入日志标记（用于API调用）
   */
  async 请求日志标记(robotId: string, message: string = ''): Promise<{ success: boolean; marker?: string; error?: string }> {
    const connection = this.robotConnections.get(robotId)?.get('business');
    if (!connection) {
      throw new Error('机器人未连接');
    }

    const requestId = uuidv7();

    const success = this.sendToRobot(robotId, {
      type: 'log_mark',
      robotId,
      timestamp: Date.now(),
      data: { requestId, message },
    }, 'business');

    if (!success) {
      throw new Error('发送日志标记命令失败');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('日志标记请求超时'));
      }, 10000);

      const checkResponse = (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'log_mark_response' && msg.data?.requestId === requestId) {
            clearTimeout(timeout);
            connection.websocket.off('message', checkResponse);
            resolve(msg.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      connection.websocket.on('message', checkResponse);
    });
  }
}

export default WebSocket服务;

