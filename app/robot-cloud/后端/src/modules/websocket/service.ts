import { Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import 配置 from '../../config';
import { logger } from '../../core/logger';
import { hasVisionTag, isValidRobotId, parseNormalizedTargetPosition, RateLimiter, removeActionTags, removeTargetTags, removeVisionTags, uuidv7 } from '../../core/utils/helpers';
import { LLM供应商列表 } from '../../modules/大模型管理/types';
import type { ClientMessage, RobotConnection, ServerMessage } from '../../types';
import type { AccountService } from '../account/service';
import 语音识别服务 from '../大模型交互/asr-service';
import 对话服务 from '../大模型交互/chat-service';
import type { ConversationRepository } from '../大模型交互/repository';
import TTSService from '../大模型交互/tts-service';
import type { RoleRepository } from '../角色管理/repository';
import type { RoleRecord } from '../角色管理/types';
import type { RobotRepository } from '../机器人管理/repository';
import type { 机器人服务 } from '../机器人管理/service';
import type { RobotRecord, 音频路由配置 } from '../机器人管理/types';
import { 音频路由网关 } from './audio-route-gateway';
import { 音频会话管理器 } from './audio-session-manager';
import {
  机器人命令网关,
  type 机器人命令通用结果,
  type 机器人安装包推送结果,
  type 机器人SDK模式结果,
  type 机器人日志标记结果,
  type 机器人拍照结果,
  type 机器人音量结果,
} from './robot-command-gateway';
import { WebSocket连接注册表 } from './connection-registry';
import { WebSocketUI鉴权器 } from './ui-auth';


type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

class WebSocket服务 {
  private wssMap: Map<Channel, WebSocketServer> = new Map();
  private pathToChannelMap: Map<string, Channel> = new Map();
  private upgradeHandlerInstalled = false;
  private 账号服务?: AccountService;
  private 对话服务?: 对话服务;
  private 对话仓库?: ConversationRepository;
  private 角色仓库?: RoleRepository;
  private 机器人仓库?: RobotRepository;
  private 机器人服务?: 机器人服务;
  private 连接注册表: WebSocket连接注册表;
  private 机器人命令网关: 机器人命令网关;
  private UI鉴权器: WebSocketUI鉴权器;
  private 音频路由网关: 音频路由网关;
  private 音频会话管理器: 音频会话管理器;
  private ttsService: TTSService;
  private 机器人初始化任务: Map<string, Promise<void>> = new Map();
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

  constructor() {
    this.ttsService = new TTSService();
    this.连接注册表 = new WebSocket连接注册表();
    this.机器人命令网关 = new 机器人命令网关({
      获取业务连接: (robotId) => this.获取业务连接(robotId),
      发送消息: (robotId, message) => this.sendToRobot(robotId, message as any, 'business'),
    });
    this.UI鉴权器 = new WebSocketUI鉴权器(() => this.账号服务);
    this.音频路由网关 = new 音频路由网关({
      获取机器人记录: (robotId) => this.获取机器人记录(robotId),
      解析活跃手机会话: (robotId, phoneDeviceId) => this.连接注册表.解析活跃手机会话(robotId, phoneDeviceId),
      发送到机器人: (robotId, message, channel) => this.sendToRobot(robotId, message, channel),
      定向发送到UI: (robotId, phoneSessionId, message, channel) => this.连接注册表.定向发送到UI(robotId, phoneSessionId, message, channel),
    });
    this.音频会话管理器 = new 音频会话管理器({
      获取机器人记录: (robotId) => this.获取机器人记录(robotId),
      获取角色记录: (roleId) => this.获取角色记录(roleId),
      asrService: new 语音识别服务(),
      发送错误: (robotId, code, message) => this.sendError(robotId, code, message, 'business'),
      处理音频转写结果: (robotId, text, meta) => this.handleAudioTranscript(robotId, text, meta),
    });
  }

  /**
   * 设置 机器人服务 引用（用于拍照等功能）
   */
  set机器人服务(机器人服务: 机器人服务): void {
    this.机器人服务 = 机器人服务;
  }

  set账号服务(账号服务: AccountService): void {
    this.账号服务 = 账号服务;
  }

  set对话服务(对话服务: 对话服务): void {
    this.对话服务 = 对话服务;
  }

  set对话仓库(对话仓库: ConversationRepository): void {
    this.对话仓库 = 对话仓库;
  }

  set角色仓库(角色仓库: RoleRepository): void {
    this.角色仓库 = 角色仓库;
  }

  set机器人仓库(机器人仓库: RobotRepository): void {
    this.机器人仓库 = 机器人仓库;
  }

  private 获取必需机器人仓库(): RobotRepository {
    if (!this.机器人仓库) {
      throw new Error('机器人仓库未初始化');
    }
    return this.机器人仓库;
  }

  private 获取机器人记录(robotId: string): Promise<RobotRecord | undefined> {
    return this.获取必需机器人仓库().getRobot(robotId);
  }

  private async 更新机器人记录(robotId: string, data: Partial<RobotRecord>): Promise<void> {
    await this.获取必需机器人仓库().updateRobot(robotId, data);
  }

  private async 新增或更新机器人记录(data: Partial<RobotRecord> & { uuid: string }): Promise<void> {
    await this.获取必需机器人仓库().upsertRobot(data);
  }

  private 获取必需角色仓库(): RoleRepository {
    if (!this.角色仓库) {
      throw new Error('角色仓库未初始化');
    }
    return this.角色仓库;
  }

  private 获取角色记录(roleId: string): Promise<RoleRecord | undefined> {
    return this.获取必需角色仓库().getRole(roleId);
  }

  private 获取必需对话仓库(): ConversationRepository {
    if (!this.对话仓库) {
      throw new Error('对话仓库未初始化');
    }
    return this.对话仓库;
  }

  private async 写入动作日志(data: Parameters<ConversationRepository['createActionLog']>[0]): Promise<void> {
    await this.获取必需对话仓库().createActionLog(data);
  }

  private async 写入对话记录(data: Parameters<ConversationRepository['createConversation']>[0]): Promise<void> {
    await this.获取必需对话仓库().createConversation(data);
  }

  private 记录机器人初始化任务(robotId: string, task: Promise<void>): void {
    const wrappedTask = task.finally(() => {
      if (this.机器人初始化任务.get(robotId) === wrappedTask) {
        this.机器人初始化任务.delete(robotId);
      }
    });
    this.机器人初始化任务.set(robotId, wrappedTask);
  }

  private async 等待机器人初始化完成(robotId: string): Promise<void> {
    await this.机器人初始化任务.get(robotId);
  }

  private async 同步机器人在线状态(robotId: string): Promise<void> {
    try {
      const existing = await this.获取机器人记录(robotId);
      if (existing) {
        await this.更新机器人记录(robotId, { status: 'online' });
      } else {
        await this.新增或更新机器人记录({
          uuid: robotId,
          status: 'online',
        });
      }
    } catch (error) {
      logger.error(
        '同步机器人在线状态失败',
        error instanceof Error ? error : new Error(String(error)),
        { robotId },
      );
    }
  }

  private async 标记机器人离线(robotId: string): Promise<void> {
    try {
      await this.更新机器人记录(robotId, { status: 'offline' });
    } catch (error) {
      logger.error(
        '更新机器人离线状态失败',
        error instanceof Error ? error : new Error(String(error)),
        { robotId },
      );
    }
  }

  private async 处理Upgrade请求(request: any, socket: Duplex, head: Buffer): Promise<void> {
    try {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
      const targetChannel = this.pathToChannelMap.get(pathname);

      if (!targetChannel) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      if (this.UI鉴权器.需要校验连接(pathname) && !(await this.UI鉴权器.已认证(request))) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const targetWss = this.wssMap.get(targetChannel);
      if (!targetWss) {
        socket.destroy();
        return;
      }

      targetWss.handleUpgrade(request, socket, head, (ws) => {
        targetWss.emit('connection', ws, request);
      });
    } catch (error) {
      logger.error('处理 WebSocket upgrade 失败', error as Error);
      try {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      } catch {
        // 忽略写回失败
      }
      socket.destroy();
    }
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
        void this.处理Upgrade请求(request, socket, head);
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
    const phoneSessionId = url.searchParams.get('phoneSessionId') || phoneId || undefined;
    const rawPhoneDeviceId = url.searchParams.get('phoneDeviceId') || undefined;
    const phoneDeviceId = rawPhoneDeviceId?.trim() || undefined;
    const isPhoneSession = !!(phoneId && role === 'ui');
    if (isPhoneSession) {
      robotId = phoneId!;
    } else if (!robotId || !isValidRobotId(robotId)) {
      robotId = uuidv7();
      logger.info('生成新的机器狗ID', { robotId });
    }

    // UI 连接：不占用机器人连接槽位，加入 UI 订阅集合
    if (role === 'ui') {
      const uiCount = this.连接注册表.注册UI连接(robotId, channel, ws, {
        phoneSessionId,
        phoneDeviceId,
      });
      logger.info('UI连接建立', {
        robotId,
        channel,
        uiCount,
        phoneSessionId,
        phoneDeviceId,
      });
    } else {
      // 机器人连接：唯一，先关闭旧连接
      const existingConnection = this.连接注册表.获取机器人连接(robotId, channel);
      if (existingConnection && existingConnection.websocket !== ws) {
        logger.info('关闭旧的机器人连接', { robotId, channel });
        try {
          existingConnection.websocket.close(1000, '新连接已建立');
        } catch {
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
      this.连接注册表.替换机器人连接(robotId, channel, connection);
    }

    // 仅机器人连接才需要更新数据库状态；UI 会话不写入机器人在线状态
    if (role !== 'ui' && !isPhoneSession) {
      this.记录机器人初始化任务(robotId, this.同步机器人在线状态(robotId));
    }

    if (isPhoneSession) {
      logger.info('手机端独立连接建立', {
        phoneId: robotId,
        channel,
        ip: req.socket.remoteAddress,
        role: role || 'ui',
      });
    } else if (role !== 'ui') {
      logger.info('机器人连接建立', {
        robotId,
        channel,
        ip: req.socket.remoteAddress,
        role: role || 'robot',
      });
    }

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
      this.handleMessage(robotId, data, channel, ws, role);
    });

    // 设置关闭处理器
    ws.on('close', () => {
      if (role === 'ui') {
        this.连接注册表.移除UI连接(robotId, channel, ws);
        logger.info('UI连接关闭', { robotId, channel });
      } else {
        this.handleDisconnection(robotId, channel, ws);
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
  private async handleMessage(robotId: string, data: Buffer, channel: Channel, ws?: WebSocket, role?: string): Promise<void> {
    try {
      if (role !== 'ui') {
        await this.等待机器人初始化完成(robotId);
      }
      if (role === 'ui' && ws) {
        this.连接注册表.刷新UI会话活跃时间(ws);
      }
      const message: ClientMessage = JSON.parse(data.toString());

      if (!this.isAllowedMessageType(channel, (message as any).type)) {
        logger.warn('消息通道不匹配', { robotId, channel, type: (message as any).type });
        this.sendError(robotId, 'CHANNEL_MISMATCH', '消息通道不匹配', channel);
        return;
      }

      // 更新最后活跃时间
      this.连接注册表.更新机器人活跃时间(robotId, channel);

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
          break;

        case 'video_unsubscribe':
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
        'package_download_response',
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
      const robot = await this.获取机器人记录(robotId);
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
          const role = await this.获取角色记录(robot.role_uuid);
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

      if (!this.对话服务) {
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
      let visionImage: { base64: string; format?: string } | undefined;

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
          visionImage = {
            base64: photoResult.image,
            format: photoResult.format || 'jpeg',
          };

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
      const targetPosition = parseNormalizedTargetPosition(finalResponse.text);

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
          actions: finalResponse.actions.map(action => action.name),
          vision: needsVision,
          visionImage,
          targetPosition,
        },
      }, 'business');

      try {
        if (ttsText) {
          const audioRoute = await this.getAudioRouteConfig(robotId);
          const streamEnabled = ttsOptions?.stream !== false;
          if (streamEnabled) {
            const sessionId = traceId;
            this.sendAudioMessageByRoute(robotId, audioRoute, {
              type: 'audio_stream_start',
              robotId,
              timestamp: Date.now(),
              conversationId: traceId,
              data: {
                sessionId,
                format: 'mp3',
              },
            });
            const audio = await this.ttsService.synthesizeStream(ttsText, ttsOptions, (chunk: { seq: number; base64: string; format: 'mp3' }) => {
              this.sendAudioMessageByRoute(robotId, audioRoute, {
                type: 'audio_stream_chunk',
                robotId,
                timestamp: Date.now(),
                conversationId: traceId,
                data: {
                  sessionId,
                  seq: chunk.seq,
                  buffer: chunk.base64,
                },
              });
            });
            this.sendAudioMessageByRoute(robotId, audioRoute, {
              type: 'audio_stream_end',
              robotId,
              timestamp: Date.now(),
              conversationId: traceId,
              data: {
                sessionId,
                duration: audio.duration,
              },
            });
            if (this.shouldSendFinalAudioResponse(robotId, audioRoute)) {
              this.sendAudioMessageByRoute(robotId, audioRoute, {
                type: 'audio_response',
                robotId,
                timestamp: Date.now(),
                conversationId: traceId,
                data: audio,
              });
            }
          } else {
            const audio = await this.ttsService.synthesize(ttsText, ttsOptions);
            this.sendAudioMessageByRoute(robotId, audioRoute, {
              type: 'audio_response',
              robotId,
              timestamp: Date.now(),
              conversationId: traceId,
              data: audio,
            });
          }
        } else {
          logger.info('TTS跳过：回复文本为空或仅包含表情', { robotId });
        }
      } catch (e: any) {
        logger.error('TTS生成失败', e, { robotId });
      }

      const normalizedActions = finalResponse.actions.map(action => {
        if (action.name !== 'approach_target') {
          return action;
        }
        const parameters = action.parameters || {};
        const hasTargetBox =
          ['cx', 'cy', 'w', 'h'].every((key) => parameters[key] !== undefined);
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

      // 发送动作指令
      for (const action of normalizedActions) {
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
        await this.写入动作日志({
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

      // 记录对话
      await this.写入对话记录({
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

      const audioRoute = await this.getAudioRouteConfig(robotId);
      const streamEnabled = ttsOptions?.stream !== false;
      const sessionId = conversationId || uuidv7();
      if (streamEnabled) {
        this.sendAudioMessageByRoute(robotId, audioRoute, {
          type: 'audio_stream_start',
          robotId,
          timestamp: Date.now(),
          conversationId: sessionId,
          data: {
            sessionId,
            format: 'mp3',
          },
        });
        const audio = await this.ttsService.synthesizeStream(sanitizedText, ttsOptions, (chunk: { seq: number; base64: string; format: 'mp3' }) => {
          this.sendAudioMessageByRoute(robotId, audioRoute, {
            type: 'audio_stream_chunk',
            robotId,
            timestamp: Date.now(),
            conversationId: sessionId,
            data: {
              sessionId,
              seq: chunk.seq,
              buffer: chunk.base64,
            },
          });
        });
        this.sendAudioMessageByRoute(robotId, audioRoute, {
          type: 'audio_stream_end',
          robotId,
          timestamp: Date.now(),
          conversationId: sessionId,
          data: {
            sessionId,
            duration: audio.duration,
          },
        });
        if (this.shouldSendFinalAudioResponse(robotId, audioRoute)) {
          this.sendAudioMessageByRoute(robotId, audioRoute, {
            type: 'audio_response',
            robotId,
            timestamp: Date.now(),
            conversationId: sessionId,
            data: audio,
          });
        }
      } else {
        const audio = await this.ttsService.synthesize(sanitizedText, ttsOptions);
        this.sendAudioMessageByRoute(robotId, audioRoute, {
          type: 'audio_response',
          robotId,
          timestamp: Date.now(),
          conversationId,
          data: audio,
        });
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
      const traceId = uuidv7();
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
        conversationId: traceId,
        data: {
          action,
          parameters: parameters || {},
          safetyChecked: true,
        },
      }, 'business');

      // 记录动作
      await this.写入动作日志({
        robot_id: robotId,
        conversation_id: traceId,
        action_name: action,
        parameters: parameters || {},
        status: 'success',
        result_detail: {
          source: 'manual_action_input',
          safetyChecked: true,
        },
      });

      // 通知UI已发送（添加 noTTS 标记，不生成TTS音频）
      this.broadcastMessage(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        conversationId: traceId,
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
        joystick: data?.joystick,
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
    await this.音频会话管理器.handleAudioStart(robotId, audioData);
  }

  /**
   * 处理音频数据块
   */
  private async handleAudioChunk(robotId: string, audioData: any): Promise<void> {
    await this.音频会话管理器.handleAudioChunk(robotId, audioData);
  }

  /**
   * 处理音频结束
   */
  private async handleAudioEnd(robotId: string, audioData: any): Promise<void> {
    await this.音频会话管理器.handleAudioEnd(robotId, audioData);
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
    result = removeTargetTags(result);

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
      const robot = await this.获取机器人记录(robotId);

      await this.新增或更新机器人记录({
        uuid: robotId,
        name: name || robot?.name || null,
        model: model || robot?.model || null,
        version: agentVersion || robot?.version || null,
        motion_control_version: motionControlVersion || robot?.motion_control_version || null,
        server_version: robotServerVersion || robot?.server_version || null,
        status: 'online',
        last_connected_at: new Date().toISOString(),
      });

      // 更新连接元数据
      const connection = this.连接注册表.获取机器人连接(robotId, 'business');
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
   * 处理断开连接
   */
  private handleDisconnection(robotId: string, channel: Channel, ws: WebSocket): void {
    const 结果 = this.连接注册表.移除机器人连接(robotId, channel, ws);
    if (!结果.已移除) {
      return;
    }

    if (结果.已完全断开) {
      void this.标记机器人离线(robotId);
      logger.info('机器人连接断开', { robotId, channel });
    }
  }

  /**
   * 获取机器人音频路由配置
   */
  private async getAudioRouteConfig(robotId: string): Promise<音频路由配置> {
    return this.音频路由网关.getAudioRouteConfig(robotId);
  }

  /**
   * 按路由策略发送 audio_download 消息
   */
  private sendAudioMessageByRoute(robotId: string, route: 音频路由配置, message: ServerMessage): void {
    this.音频路由网关.sendAudioMessageByRoute(robotId, route, message);
  }

  private shouldSendFinalAudioResponse(robotId: string, route: 音频路由配置): boolean {
    return this.音频路由网关.shouldSendFinalAudioResponse(robotId, route);
  }

  /**
   * 广播消息到机器人和对应的所有UI
   */
  private broadcastMessage(robotId: string, message: ServerMessage, channel: Channel = 'business'): void {
    this.连接注册表.广播到机器人和UI(robotId, message, channel);
  }

  /**
   * 发送消息到UI客户端（不包括机器人）
   */
  private sendToUI(robotId: string, message: ServerMessage, channel: Channel = 'business'): void {
    this.连接注册表.发送到UI(robotId, message, channel);
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
      const connection = this.连接注册表.获取机器人连接(robotId, channel);
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
    return this.连接注册表.获取连接映射();
  }

  /**
   * 获取在线机器人数量
   */
  getOnlineCount(): number {
    return this.连接注册表.获取在线机器人数量();
  }

  /**
   * 关闭WebSocket服务器
   */
  close(): void {
    for (const wss of this.wssMap.values()) {
      wss.close();
    }
    logger.info('WebSocket服务已关闭');
  }

  /**
   * 对外暴露：发送消息到机器人客户端
   */
  sendToRobot(robotId: string, message: ServerMessage, channel: Channel = 'business'): boolean {
    return this.连接注册表.发送到机器人(robotId, message, channel);
  }

  /**
   * 对外暴露：广播消息到所有 UI 客户端
   */
  broadcast(message: ServerMessage, channel: Channel = 'business'): void {
    this.连接注册表.广播到全部UI(message, channel);
  }

  private 获取业务连接(robotId: string): RobotConnection {
    const connection = this.连接注册表.获取机器人连接(robotId, 'business');
    if (!connection) {
      throw new Error('机器人未连接');
    }
    return connection;
  }

  /**
   * 请求机器人拍照（用于API调用）
   */
  请求机器人拍照(robotId: string): Promise<机器人拍照结果> {
    return this.机器人命令网关.请求机器人拍照(robotId);
  }

  /**
   * 请求获取机器人音量（用于API调用）
   */
  请求获取机器人音量(robotId: string): Promise<机器人音量结果> {
    return this.机器人命令网关.请求获取机器人音量(robotId);
  }

  /**
   * 请求设置机器人音量（用于API调用）
   */
  请求设置机器人音量(robotId: string, volume: number): Promise<机器人命令通用结果> {
    return this.机器人命令网关.请求设置机器人音量(robotId, volume);
  }

  /**
   * 请求设置机器人静音（用于API调用）
   */
  请求设置机器人静音(robotId: string, mute: boolean): Promise<机器人命令通用结果> {
    return this.机器人命令网关.请求设置机器人静音(robotId, mute);
  }

  /**
   * 请求获取机器人配置（用于API调用）
   */
  请求获取机器人配置(robotId: string): Promise<机器人命令通用结果> {
    return this.机器人命令网关.请求获取机器人配置(robotId);
  }

  /**
   * 请求更新机器人配置（用于API调用）
   */
  请求更新机器人配置(robotId: string, config: unknown): Promise<机器人命令通用结果> {
    return this.机器人命令网关.请求更新机器人配置(robotId, config);
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
  请求设置SDK模式(robotId: string, sdkMode: boolean): Promise<机器人SDK模式结果> {
    return this.机器人命令网关.请求设置SDK模式(robotId, sdkMode);
  }

  /**
   * 请求获取SDK模式（用于API调用）
   */
  请求获取SDK模式(robotId: string): Promise<机器人SDK模式结果> {
    return this.机器人命令网关.请求获取SDK模式(robotId);
  }

  /**
   * 请求写入日志标记（用于API调用）
   */
  请求日志标记(robotId: string, message: string = ''): Promise<机器人日志标记结果> {
    return this.机器人命令网关.请求日志标记(robotId, message);
  }

  /**
   * 请求机器人通过 HTTP 下载安装包（用于API调用）
   */
  请求推送安装包(
    robotId: string,
    downloadPaths: { agent?: string; server?: string; common?: string },
    hashes: { agent?: string; server?: string; common?: string },
  ): Promise<机器人安装包推送结果> {
    return this.机器人命令网关.请求推送安装包(robotId, downloadPaths, hashes);
  }
}

export default WebSocket服务;

