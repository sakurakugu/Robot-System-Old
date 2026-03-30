import { Server } from 'http';
import { WebSocket } from 'ws';
import type { RobotConnection, ServerMessage } from '../../types';
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
import { WebSocket连接生命周期管理器 } from './connection-lifecycle-manager';
import { WebSocket对话网关 } from './conversation-gateway';
import { WebSocket心跳管理器 } from './heartbeat-manager';
import { WebSocket手动命令网关 } from './manual-command-gateway';
import { WebSocket消息路由器 } from './message-router';
import { WebSocket机器人运行网关 } from './robot-runtime-gateway';
import { WebSocketSDK模式网关 } from './sdk-mode-gateway';
import { WebSocket服务端宿主, type WebSocket默认通道路径配置 } from './server-host';
import {
  机器人命令网关,
  type 机器人命令服务接口,
} from './robot-command-gateway';
import { WebSocket连接注册表 } from './connection-registry';
import { WebSocketUI鉴权器 } from './ui-auth';


type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

class WebSocket服务 {
  private 账号服务?: AccountService;
  private 对话服务?: 对话服务;
  private 对话仓库?: ConversationRepository;
  private 角色仓库?: RoleRepository;
  private 机器人仓库?: RobotRepository;
  private 机器人服务?: 机器人服务;
  private 连接注册表: WebSocket连接注册表;
  private 机器人命令网关: 机器人命令网关;
  private UI鉴权器: WebSocketUI鉴权器;
  private 服务端宿主: WebSocket服务端宿主;
  private 心跳管理器: WebSocket心跳管理器;
  private 连接生命周期管理器: WebSocket连接生命周期管理器;
  private 音频路由网关: 音频路由网关;
  private 对话网关: WebSocket对话网关;
  private 手动命令网关: WebSocket手动命令网关;
  private 消息路由器: WebSocket消息路由器;
  private 机器人运行网关: WebSocket机器人运行网关;
  private SDK模式网关: WebSocketSDK模式网关;
  private 音频会话管理器: 音频会话管理器;
  private ttsService: TTSService;
  private 机器人初始化任务: Map<string, Promise<void>> = new Map();

  constructor() {
    this.ttsService = new TTSService();
    this.连接注册表 = new WebSocket连接注册表();
    this.机器人命令网关 = new 机器人命令网关({
      获取业务连接: (robotId) => this.获取业务连接(robotId),
      发送消息: (robotId, message) => this.sendToRobot(robotId, message as any, 'business'),
    });
    this.UI鉴权器 = new WebSocketUI鉴权器(() => this.账号服务);
    this.服务端宿主 = new WebSocket服务端宿主({
      UI鉴权器: this.UI鉴权器,
      处理连接: (ws, req, channel) => this.handleConnection(ws, req, channel),
    });
    this.心跳管理器 = new WebSocket心跳管理器({
      连接注册表: this.连接注册表,
    });
    this.音频路由网关 = new 音频路由网关({
      获取机器人记录: (robotId) => this.获取机器人记录(robotId),
      解析活跃手机会话: (robotId, phoneDeviceId) => this.连接注册表.解析活跃手机会话(robotId, phoneDeviceId),
      发送到机器人: (robotId, message, channel) => this.sendToRobot(robotId, message, channel),
      定向发送到UI: (robotId, phoneSessionId, message, channel) => this.连接注册表.定向发送到UI(robotId, phoneSessionId, message, channel),
    });
    this.对话网关 = new WebSocket对话网关({
      获取机器人记录: (robotId) => this.获取机器人记录(robotId),
      获取角色记录: (roleId) => this.获取角色记录(roleId),
      获取对话服务: () => this.对话服务,
      获取机器人服务: () => this.机器人服务,
      ttsService: this.ttsService,
      获取音频路由配置: (robotId) => this.getAudioRouteConfig(robotId),
      发送音频消息: (robotId, route, message) => this.sendAudioMessageByRoute(robotId, route, message),
      是否发送最终音频响应: (robotId, route) => this.shouldSendFinalAudioResponse(robotId, route),
      发送到机器人: (robotId, message, channel) => this.sendToRobot(robotId, message, channel),
      广播消息: (robotId, message, channel) => this.broadcastMessage(robotId, message, channel),
      发送到UI: (robotId, message, channel) => this.sendToUI(robotId, message, channel),
      发送错误: (robotId, code, message, channel) => this.sendError(robotId, code, message, channel),
      写入动作日志: (data) => this.写入动作日志(data),
      写入对话记录: (data) => this.写入对话记录(data),
    });
    this.手动命令网关 = new WebSocket手动命令网关({
      发送到机器人: (robotId, message, channel) => this.sendToRobot(robotId, message, channel),
      发送错误: (robotId, code, message, channel) => this.sendError(robotId, code, message, channel),
      广播消息: (robotId, message, channel) => this.broadcastMessage(robotId, message, channel),
      写入动作日志: (data) => this.写入动作日志(data),
    });
    this.机器人运行网关 = new WebSocket机器人运行网关({
      获取机器人记录: (robotId) => this.获取机器人记录(robotId),
      更新机器人记录: (robotId, data) => this.更新机器人记录(robotId, data),
      新增或更新机器人记录: (data) => this.新增或更新机器人记录(data),
      获取业务连接: (robotId) => this.连接注册表.获取机器人连接(robotId, 'business'),
      发送到机器人: (robotId, message, channel) => this.sendToRobot(robotId, message, channel),
      发送到UI: (robotId, message, channel) => this.sendToUI(robotId, message, channel),
      发送错误: (robotId, code, message, channel) => this.sendError(robotId, code, message, channel),
    });
    this.SDK模式网关 = new WebSocketSDK模式网关({
      发送到机器人: (robotId, message, channel) => this.sendToRobot(robotId, message, channel),
      发送到UI: (robotId, message, channel) => this.sendToUI(robotId, message, channel),
      发送错误: (robotId, code, message, channel) => this.sendError(robotId, code, message, channel),
    });
    this.连接生命周期管理器 = new WebSocket连接生命周期管理器({
      连接注册表: this.连接注册表,
      记录机器人初始化任务: (robotId, task) => this.记录机器人初始化任务(robotId, task),
      同步机器人在线状态: (robotId) => this.同步机器人在线状态(robotId),
      标记机器人离线: (robotId) => this.标记机器人离线(robotId),
      处理消息: (robotId, data, channel, ws, role) => this.handleMessage(robotId, data, channel, ws, role),
      发送到机器人: (robotId, message, channel) => this.sendToRobot(robotId, message, channel),
      开始心跳检测: (robotId, channel) => this.setupHeartbeat(robotId, channel),
      停止心跳检测: (robotId, channel) => this.心跳管理器.clearHeartbeat(robotId, channel),
    });
    this.消息路由器 = new WebSocket消息路由器({
      等待机器人初始化完成: (robotId) => this.等待机器人初始化完成(robotId),
      刷新UI会话活跃时间: (ws) => this.连接注册表.刷新UI会话活跃时间(ws as any),
      更新机器人活跃时间: (robotId, channel) => this.连接注册表.更新机器人活跃时间(robotId, channel),
      发送错误: (robotId, code, message, channel) => this.sendError(robotId, code, message, channel),
      处理文本输入: (robotId, text, ttsOptions, conversationId) => this.handleTextInput(robotId, text, ttsOptions, conversationId),
      处理TTS输入: (robotId, text, ttsOptions, conversationId) => this.handleTTSInput(robotId, text, ttsOptions, conversationId),
      处理音频控制: (robotId, data) => this.handleAudioControl(robotId, data),
      处理音频开始: (robotId, data) => this.handleAudioStart(robotId, data),
      处理音频块: (robotId, data) => this.handleAudioChunk(robotId, data),
      处理音频结束: (robotId, data) => this.handleAudioEnd(robotId, data),
      处理心跳: (robotId) => this.handleHeartbeat(robotId),
      处理状态: (robotId, msg) => this.handleStatus(robotId, msg),
      处理机器人注册: (robotId, data) => this.handleRobotRegister(robotId, data),
      处理动作输入: (robotId, action, parameters) => this.handleActionInput(robotId, action, parameters),
      处理控制输入: (robotId, data) => this.handleControlInput(robotId, data),
      处理SDK模式设置: (robotId, data) => this.handleSdkModeSet(robotId, data),
      处理SDK模式获取: (robotId) => this.handleSdkModeGet(robotId),
      处理SDK模式响应: (robotId, data) => this.handleSdkModeResponse(robotId, data),
    });
    this.音频会话管理器 = new 音频会话管理器({
      获取机器人记录: (robotId) => this.获取机器人记录(robotId),
      获取角色记录: (roleId) => this.获取角色记录(roleId),
      asrService: new 语音识别服务(),
      发送错误: (robotId, code, message) => this.sendError(robotId, code, message, 'business'),
      处理音频转写结果: (robotId, text, meta) => this.对话网关.handleAudioTranscript(robotId, text, meta),
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

  配置依赖(依赖: {
    账号服务?: AccountService;
    机器人服务?: 机器人服务;
    对话服务?: 对话服务;
    对话仓库?: ConversationRepository;
    角色仓库?: RoleRepository;
    机器人仓库?: RobotRepository;
  }): void {
    if (依赖.账号服务) {
      this.账号服务 = 依赖.账号服务;
    }
    if (依赖.机器人服务) {
      this.机器人服务 = 依赖.机器人服务;
    }
    if (依赖.对话服务) {
      this.对话服务 = 依赖.对话服务;
    }
    if (依赖.对话仓库) {
      this.对话仓库 = 依赖.对话仓库;
    }
    if (依赖.角色仓库) {
      this.角色仓库 = 依赖.角色仓库;
    }
    if (依赖.机器人仓库) {
      this.机器人仓库 = 依赖.机器人仓库;
    }
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
    await this.机器人运行网关.同步机器人在线状态(robotId);
  }

  private async 标记机器人离线(robotId: string): Promise<void> {
    await this.机器人运行网关.标记机器人离线(robotId);
  }

  /**
   * 初始化WebSocket服务器
   */
  init(server: Server, options: { path: string; channel: Channel }): void {
    this.服务端宿主.init(server, options);
  }

  初始化默认通道(server: Server, 路径配置: WebSocket默认通道路径配置): void {
    this.服务端宿主.初始化默认通道(server, 路径配置);
  }

  /**
   * 处理新连接
   */
  private handleConnection(ws: WebSocket, req: any, channel: Channel): void {
    this.连接生命周期管理器.handleConnection(ws, req, channel);
  }

  /**
   * 处理客户端消息
   */
  private async handleMessage(robotId: string, data: Buffer, channel: Channel, ws?: WebSocket, role?: string): Promise<void> {
    await this.消息路由器.handleMessage(robotId, data, channel, ws, role);
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
    await this.对话网关.handleTextInput(robotId, text, ttsOptions, conversationId);
  }

  /**
   * 处理音频转写结果
   */
  private async handleAudioTranscript(
    robotId: string,
    text: string,
    meta: { asrTime: number; durationMs: number; sessionId: string }
  ): Promise<void> {
    await this.对话网关.handleAudioTranscript(robotId, text, meta);
  }

  // 直接发送文本 → 对话网关 → TTS服务
  private async handleTTSInput(
    robotId: string,
    text: string,
    ttsOptions?: any,
    conversationId?: string
  ): Promise<void> {
    await this.对话网关.handleTTSInput(robotId, text, ttsOptions, conversationId);
  }

  /**
   * 处理动作输入 ({{action=xxx}})
   */
  private async handleActionInput(robotId: string, action: string, parameters?: Record<string, any>): Promise<void> {
    await this.手动命令网关.handleActionInput(robotId, action, parameters);
  }

  /**
   * 处理控制输入（摇杆/急停）
   */
  private async handleControlInput(robotId: string, data: any): Promise<void> {
    await this.手动命令网关.handleControlInput(robotId, data);
  }

  /**
   * 处理麦克风开关
   */
  private async handleAudioControl(robotId: string, data: any): Promise<void> {
    await this.手动命令网关.handleAudioControl(robotId, data);
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

  /**
   * 处理心跳
   */
  private handleHeartbeat(robotId: string): void {
    this.机器人运行网关.handleHeartbeat(robotId);
  }

  /**
   * 处理状态更新
   */
  private handleStatus(robotId: string, msg: any): void {
    this.机器人运行网关.handleStatus(robotId, msg);
  }

  /**
   * 处理机器人注册
   */
  private async handleRobotRegister(robotId: string, data: any): Promise<void> {
    await this.机器人运行网关.handleRobotRegister(robotId, data);
  }

  /**
   * 处理断开连接
   */
  private handleDisconnection(robotId: string, channel: Channel, ws: WebSocket): void {
    this.连接生命周期管理器.handleDisconnection(robotId, channel, ws);
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
    this.心跳管理器.setupHeartbeat(robotId, channel);
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
    this.心跳管理器.clearAll();
    this.服务端宿主.close();
  }

  获取机器人命令服务(): 机器人命令服务接口 {
    return this.机器人命令网关;
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
   * 处理SDK模式设置（来自UI）
   */
  private async handleSdkModeSet(robotId: string, data: any): Promise<void> {
    await this.SDK模式网关.handleSdkModeSet(robotId, data);
  }

  /**
   * 处理SDK模式获取（来自UI）
   */
  private async handleSdkModeGet(robotId: string): Promise<void> {
    await this.SDK模式网关.handleSdkModeGet(robotId);
  }

  /**
   * 处理SDK模式响应（来自robot-agent，转发到UI）
   */
  private async handleSdkModeResponse(robotId: string, data: any): Promise<void> {
    await this.SDK模式网关.handleSdkModeResponse(robotId, data);
  }
}

export default WebSocket服务;

