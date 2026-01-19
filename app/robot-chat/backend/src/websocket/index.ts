import { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import DatabaseService from '../database';
import ConversationEngine from '../services/conversation-engine';
import { ClientMessage, RobotConnection, ServerMessage } from '../types';
import { isValidRobotId, uuidv7 } from '../utils/helpers';
import LoggerService from '../utils/logger';

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, RobotConnection> = new Map();
  private logger: LoggerService;
  private conversationEngine: ConversationEngine;
  private database: DatabaseService;

  constructor(logger: LoggerService, database: DatabaseService) {
    this.logger = logger;
    this.database = database;
    this.conversationEngine = new ConversationEngine();
  }

  /**
   * 初始化WebSocket服务器
   */
  init(server: Server, path: string): void {
    this.wss = new WebSocketServer({
      server,
      path,
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    this.logger.info('WebSocket服务已启动', { path });
  }

  /**
   * 处理新连接
   */
  private handleConnection(ws: WebSocket, req: any): void {
    // 从查询参数获取robotId，如果没有则生成新的
    const url = new URL(req.url!, `http://${req.headers.host}`);
    let robotId = url.searchParams.get('robotId');

    if (!robotId || !isValidRobotId(robotId)) {
      robotId = uuidv7();
      this.logger.info('生成新的机器狗ID', { robotId });
    }

    // 创建连接记录
    const connection: RobotConnection = {
      robotId,
      websocket: ws,
      connectedAt: new Date(),
      lastActiveAt: new Date(),
      metadata: {},
    };

    this.connections.set(robotId, connection);

    // 注册机器狗到数据库
    this.database.registerRobot({
      uuid: robotId,
      status: 'online',
      last_connected: new Date(),
    });

    this.logger.logWebSocket({
      robotId,
      event: 'connected',
      details: { ip: req.socket.remoteAddress },
    });

    // 发送连接确认消息
    this.sendMessage(robotId, {
      type: 'text_response',
      robotId,
      timestamp: Date.now(),
      data: {
        text: `连接成功！你的机器狗ID是: ${robotId}`,
      },
    });

    // 设置消息处理器
    ws.on('message', (data: Buffer) => {
      this.handleMessage(robotId, data);
    });

    // 设置关闭处理器
    ws.on('close', () => {
      this.handleDisconnection(robotId);
    });

    // 设置错误处理器
    ws.on('error', (error) => {
      this.logger.error('WebSocket错误', error, { robotId });
    });

    // 设置心跳检测
    this.setupHeartbeat(robotId);
  }

  /**
   * 处理客户端消息
   */
  private async handleMessage(robotId: string, data: Buffer): Promise<void> {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      // 更新最后活跃时间
      const connection = this.connections.get(robotId);
      if (connection) {
        connection.lastActiveAt = new Date();
      }

      switch (message.type) {
        case 'text_input':
          await this.handleTextInput(robotId, message.data.text);
          break;

        case 'audio_chunk':
          await this.handleAudioChunk(robotId, message.data);
          break;

        case 'heartbeat':
          this.handleHeartbeat(robotId);
          break;

        case 'status':
          this.handleStatus(robotId, message.data);
          break;
        // 客户端注册
        case 'client_register':
          await this.handleClientRegister(robotId, message.data);
          break;

        default:
          this.logger.warn('未知的消息类型', { robotId, type: (message as any).type });
      }
    } catch (error: any) {
      this.logger.error('处理消息失败', error, { robotId });
      this.sendError(robotId, 'MESSAGE_PARSE_ERROR', '消息解析失败');
    }
  }

  /**
   * 处理文本输入
   */
  private async handleTextInput(robotId: string, text: string): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info('收到文本输入', { robotId, text });

      // 使用对话引擎处理
      let systemPrompt: string | undefined = undefined;
      let temperature: number | undefined = undefined;
      let model: string | undefined = undefined;
      const robot = this.database.getRobot(robotId);
      if (robot) {
        model = robot.model || undefined;
        try {
          const meta = robot.metadata ? JSON.parse(robot.metadata) : {};
          systemPrompt = meta.ai_system_prompt || undefined;
          temperature = typeof meta.ai_temperature === 'number' ? meta.ai_temperature : undefined;
        } catch {}
      }
      const response = await this.conversationEngine.processMessage(robotId, text, {
        history: [],
        maxHistory: 10,
        systemPrompt,
        model,
        temperature
      });

      const processingTime = Date.now() - startTime;

      // 发送文本回复
      this.sendMessage(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        data: {
          text: response.text,
        },
      });

      // 发送动作指令
      for (const action of response.actions) {
        this.sendMessage(robotId, {
          type: 'action_command',
          robotId,
          timestamp: Date.now(),
          data: {
            action: action.name,
            parameters: action.parameters,
            safetyChecked: true,
          },
        });

        // 记录动作
        this.database.logAction(robotId, action.name, action.parameters, 'success');
      }

      // 记录对话
      this.database.insertConversation({
        robot_id: robotId,
        timestamp: new Date(),
        type: 'text',
        user_input: text,
        ai_response: response.text,
        actions: JSON.stringify(response.actions),
        processing_time: processingTime,
        metadata: JSON.stringify(response.metadata),
      });

      this.logger.logConversation({
        robotId,
        input: text,
        output: response.text,
        processingTime,
        actions: response.actions,
      });
    } catch (error: any) {
      this.logger.error('处理文本输入失败', error, { robotId });
      this.sendError(robotId, 'PROCESSING_ERROR', error.message);
    }
  }

  /**
   * 处理音频数据块（暂时简化处理）
   */
  private async handleAudioChunk(robotId: string, audioData: any): Promise<void> {
    // TODO: 实现音频处理（ASR -> 对话引擎 -> TTS）
    this.logger.debug('收到音频数据', {
      robotId,
      format: audioData.format,
      sampleRate: audioData.sampleRate,
    });

    // 暂时返回提示消息
    this.sendMessage(robotId, {
      type: 'text_response',
      robotId,
      timestamp: Date.now(),
      data: {
        text: '音频处理功能开发中...',
      },
    });
  }

  /**
   * 处理心跳
   */
  private handleHeartbeat(robotId: string): void {
    this.logger.debug('收到心跳', { robotId });
    // 心跳响应已经通过更新lastActiveAt实现
  }

  /**
   * 处理状态更新
   */
  private handleStatus(robotId: string, status: any): void {
    this.logger.debug('收到状态更新', { robotId, status });
    
    // 更新机器狗状态到数据库
    const robot = this.database.getRobot(robotId);
    if (robot) {
      try {
        const metadata = robot.metadata ? JSON.parse(robot.metadata) : {};
        metadata.lastStatus = status;
        metadata.lastStatusTime = new Date().toISOString();
        
        this.database.registerRobot({
          uuid: robotId,
          metadata: metadata,
        });
      } catch (error) {
        this.logger.error('保存状态失败', error as Error, { robotId });
      }
    }
  }

  /**
   * 处理客户端注册
   */
  private async handleClientRegister(robotId: string, data: any): Promise<void> {
    this.logger.info('收到客户端注册', { robotId, data });
    
    try {
      const { name, model, version, metadata } = data;
      
      // 更新机器狗信息
      const robot = this.database.getRobot(robotId);
      const existingMetadata = robot?.metadata ? JSON.parse(robot.metadata) : {};
      
      this.database.registerRobot({
        uuid: robotId,
        name: name || robot?.name,
        model: model || robot?.model,
        status: 'online',
        last_connected: new Date(),
        metadata: {
          ...existingMetadata,
          ...metadata,
          clientVersion: version,
          registeredAt: new Date().toISOString(),
        },
      });
      
      // 更新连接元数据
      const connection = this.connections.get(robotId);
      if (connection) {
        connection.metadata = {
          name: name || connection.metadata.name,
          model: model || connection.metadata.model,
          version: version || connection.metadata.version,
        };
      }
      
      this.logger.info('客户端注册成功', { robotId, name, model });
      
      // 发送注册确认
      this.sendMessage(robotId, {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        data: {
          text: `客户端注册成功！欢迎 ${name || '机器狗'}`,
        },
      });
    } catch (error: any) {
      this.logger.error('处理客户端注册失败', error, { robotId });
      this.sendError(robotId, 'REGISTER_ERROR', error.message);
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnection(robotId: string): void {
    this.connections.delete(robotId);
    this.database.updateRobotStatus(robotId, 'offline');
    this.logger.logWebSocket({
      robotId,
      event: 'disconnected',
    });
  }

  /**
   * 发送消息给客户端
   */
  private sendMessage(robotId: string, message: ServerMessage): void {
    const connection = this.connections.get(robotId);
    if (!connection) {
      this.logger.warn('连接不存在', { robotId });
      return;
    }

    try {
      connection.websocket.send(JSON.stringify(message));
    } catch (error: any) {
      this.logger.error('发送消息失败', error, { robotId });
    }
  }

  /**
   * 发送错误消息
   */
  private sendError(robotId: string, code: string, message: string): void {
    this.sendMessage(robotId, {
      type: 'error',
      robotId,
      timestamp: Date.now(),
      data: {
        code,
        message,
      },
    });
  }

  /**
   * 设置心跳检测
   */
  private setupHeartbeat(robotId: string): void {
    const interval = setInterval(() => {
      const connection = this.connections.get(robotId);
      if (!connection) {
        clearInterval(interval);
        return;
      }

      // 检查是否超时（5分钟无活动）
      const now = Date.now();
      const lastActive = connection.lastActiveAt.getTime();
      if (now - lastActive > 5 * 60 * 1000) {
        this.logger.warn('连接超时，自动断开', { robotId });
        connection.websocket.close();
        clearInterval(interval);
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 获取所有连接
   */
  getConnections(): Map<string, RobotConnection> {
    return this.connections;
  }

  /**
   * 获取在线机器狗数量
   */
  getOnlineCount(): number {
    return this.connections.size;
  }

  /**
   * 关闭WebSocket服务器
   */
  close(): void {
    if (this.wss) {
      this.wss.close();
      this.logger.info('WebSocket服务已关闭');
    }
  }
}

export default WebSocketService;
