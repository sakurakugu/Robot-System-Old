import { Server } from 'http';
import type { RobotConnection, ServerMessage } from '../../types';
import 语音识别服务 from '../大模型交互/asr-service';
import TTSService from '../大模型交互/tts-service';
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
import { WebSocket运行依赖容器, type WebSocket运行依赖配置 } from './runtime-dependencies';
import {
  机器人命令网关,
  type 机器人命令服务接口,
} from './robot-command-gateway';
import { WebSocket连接注册表 } from './connection-registry';
import { WebSocketUI鉴权器 } from './ui-auth';

type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

class WebSocket服务 {
  private readonly 运行依赖: WebSocket运行依赖容器;
  private readonly 连接注册表: WebSocket连接注册表;
  private readonly 机器人命令网关: 机器人命令网关;
  private readonly UI鉴权器: WebSocketUI鉴权器;
  private readonly 服务端宿主: WebSocket服务端宿主;
  private readonly 心跳管理器: WebSocket心跳管理器;
  private readonly 连接生命周期管理器: WebSocket连接生命周期管理器;
  private readonly 音频路由网关: 音频路由网关;
  private readonly 对话网关: WebSocket对话网关;
  private readonly 手动命令网关: WebSocket手动命令网关;
  private readonly 消息路由器: WebSocket消息路由器;
  private readonly 机器人运行网关: WebSocket机器人运行网关;
  private readonly SDK模式网关: WebSocketSDK模式网关;
  private readonly 音频会话管理器: 音频会话管理器;
  private readonly ttsService: TTSService;
  private readonly 机器人初始化任务: Map<string, Promise<void>> = new Map();

  constructor() {
    this.ttsService = new TTSService();
    this.运行依赖 = new WebSocket运行依赖容器();
    this.连接注册表 = new WebSocket连接注册表();
    this.心跳管理器 = new WebSocket心跳管理器({
      连接注册表: this.连接注册表,
    });
    this.机器人命令网关 = new 机器人命令网关({
      获取业务连接: this.获取业务连接.bind(this),
      发送消息: (robotId, message) => this.sendToRobot(robotId, message as ServerMessage, 'business'),
    });
    this.UI鉴权器 = new WebSocketUI鉴权器(
      this.运行依赖.获取账号服务.bind(this.运行依赖),
    );
    this.音频路由网关 = new 音频路由网关({
      获取机器人记录: this.运行依赖.获取机器人记录.bind(this.运行依赖),
      解析活跃手机会话: this.连接注册表.解析活跃手机会话.bind(this.连接注册表),
      发送到机器人: this.sendToRobot.bind(this),
      定向发送到UI: this.连接注册表.定向发送到UI.bind(this.连接注册表),
    });
    this.对话网关 = new WebSocket对话网关({
      获取机器人记录: this.运行依赖.获取机器人记录.bind(this.运行依赖),
      获取角色记录: this.运行依赖.获取角色记录.bind(this.运行依赖),
      获取对话服务: this.运行依赖.获取对话服务.bind(this.运行依赖),
      获取机器人服务: this.运行依赖.获取机器人服务.bind(this.运行依赖),
      ttsService: this.ttsService,
      获取音频路由配置: this.音频路由网关.getAudioRouteConfig.bind(this.音频路由网关),
      发送音频消息: this.音频路由网关.sendAudioMessageByRoute.bind(this.音频路由网关),
      是否发送最终音频响应: this.音频路由网关.shouldSendFinalAudioResponse.bind(this.音频路由网关),
      发送到机器人: this.sendToRobot.bind(this),
      广播消息: this.连接注册表.广播到机器人和UI.bind(this.连接注册表),
      发送到UI: this.连接注册表.发送到UI.bind(this.连接注册表),
      发送错误: this.sendError.bind(this),
      写入动作日志: this.运行依赖.写入动作日志.bind(this.运行依赖),
      写入对话记录: this.运行依赖.写入对话记录.bind(this.运行依赖),
    });
    this.手动命令网关 = new WebSocket手动命令网关({
      发送到机器人: this.sendToRobot.bind(this),
      发送错误: this.sendError.bind(this),
      广播消息: this.连接注册表.广播到机器人和UI.bind(this.连接注册表),
      写入动作日志: this.运行依赖.写入动作日志.bind(this.运行依赖),
    });
    this.机器人运行网关 = new WebSocket机器人运行网关({
      获取机器人记录: this.运行依赖.获取机器人记录.bind(this.运行依赖),
      更新机器人记录: this.运行依赖.更新机器人记录.bind(this.运行依赖),
      新增或更新机器人记录: this.运行依赖.新增或更新机器人记录.bind(this.运行依赖),
      获取业务连接: (robotId) => this.连接注册表.获取机器人连接(robotId, 'business'),
      发送到机器人: this.sendToRobot.bind(this),
      发送到UI: this.连接注册表.发送到UI.bind(this.连接注册表),
      发送错误: this.sendError.bind(this),
    });
    this.SDK模式网关 = new WebSocketSDK模式网关({
      发送到机器人: this.sendToRobot.bind(this),
      发送到UI: this.连接注册表.发送到UI.bind(this.连接注册表),
      发送错误: this.sendError.bind(this),
    });
    this.音频会话管理器 = new 音频会话管理器({
      获取机器人记录: this.运行依赖.获取机器人记录.bind(this.运行依赖),
      获取角色记录: this.运行依赖.获取角色记录.bind(this.运行依赖),
      asrService: new 语音识别服务(),
      发送错误: (robotId, code, message) => this.sendError(robotId, code, message, 'business'),
      处理音频转写结果: this.对话网关.handleAudioTranscript.bind(this.对话网关),
    });
    this.消息路由器 = new WebSocket消息路由器({
      等待机器人初始化完成: this.等待机器人初始化完成.bind(this),
      刷新UI会话活跃时间: this.连接注册表.刷新UI会话活跃时间.bind(this.连接注册表),
      更新机器人活跃时间: this.连接注册表.更新机器人活跃时间.bind(this.连接注册表),
      发送错误: this.sendError.bind(this),
      处理文本输入: this.对话网关.handleTextInput.bind(this.对话网关),
      处理TTS输入: this.对话网关.handleTTSInput.bind(this.对话网关),
      处理音频控制: this.手动命令网关.handleAudioControl.bind(this.手动命令网关),
      处理音频开始: this.音频会话管理器.handleAudioStart.bind(this.音频会话管理器),
      处理音频块: this.音频会话管理器.handleAudioChunk.bind(this.音频会话管理器),
      处理音频结束: this.音频会话管理器.handleAudioEnd.bind(this.音频会话管理器),
      处理心跳: this.机器人运行网关.handleHeartbeat.bind(this.机器人运行网关),
      处理状态: this.机器人运行网关.handleStatus.bind(this.机器人运行网关),
      处理机器人注册: this.机器人运行网关.handleRobotRegister.bind(this.机器人运行网关),
      处理动作输入: this.手动命令网关.handleActionInput.bind(this.手动命令网关),
      处理控制输入: this.手动命令网关.handleControlInput.bind(this.手动命令网关),
      处理SDK模式设置: this.SDK模式网关.handleSdkModeSet.bind(this.SDK模式网关),
      处理SDK模式获取: this.SDK模式网关.handleSdkModeGet.bind(this.SDK模式网关),
      处理SDK模式响应: this.SDK模式网关.handleSdkModeResponse.bind(this.SDK模式网关),
    });
    this.连接生命周期管理器 = new WebSocket连接生命周期管理器({
      连接注册表: this.连接注册表,
      记录机器人初始化任务: this.记录机器人初始化任务.bind(this),
      同步机器人在线状态: this.机器人运行网关.同步机器人在线状态.bind(this.机器人运行网关),
      标记机器人离线: this.机器人运行网关.标记机器人离线.bind(this.机器人运行网关),
      处理消息: this.消息路由器.handleMessage.bind(this.消息路由器),
      发送到机器人: this.sendToRobot.bind(this),
      开始心跳检测: this.心跳管理器.setupHeartbeat.bind(this.心跳管理器),
      停止心跳检测: this.心跳管理器.clearHeartbeat.bind(this.心跳管理器),
    });
    this.服务端宿主 = new WebSocket服务端宿主({
      UI鉴权器: this.UI鉴权器,
      处理连接: this.连接生命周期管理器.handleConnection.bind(this.连接生命周期管理器),
    });
  }

  配置依赖(依赖: WebSocket运行依赖配置): void {
    this.运行依赖.配置依赖(依赖);
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

  private sendError(robotId: string, code: string, message: string, channel: Channel = 'business'): void {
    this.连接注册表.广播到机器人和UI(robotId, {
      type: 'error',
      robotId,
      timestamp: Date.now(),
      data: {
        code,
        message,
      },
    }, channel);
  }

  private 获取业务连接(robotId: string): RobotConnection {
    const connection = this.连接注册表.获取机器人连接(robotId, 'business');
    if (!connection) {
      throw new Error('机器人未连接');
    }
    return connection;
  }

  init(server: Server, options: { path: string; channel: Channel }): void {
    this.服务端宿主.init(server, options);
  }

  初始化默认通道(server: Server, 路径配置: WebSocket默认通道路径配置): void {
    this.服务端宿主.初始化默认通道(server, 路径配置);
  }

  getConnections(): Map<string, Map<Channel, RobotConnection>> {
    return this.连接注册表.获取连接映射();
  }

  getOnlineCount(): number {
    return this.连接注册表.获取在线机器人数量();
  }

  close(): void {
    this.心跳管理器.clearAll();
    this.服务端宿主.close();
  }

  获取机器人命令服务(): 机器人命令服务接口 {
    return this.机器人命令网关;
  }

  sendToRobot(robotId: string, message: ServerMessage, channel: Channel = 'business'): boolean {
    return this.连接注册表.发送到机器人(robotId, message, channel);
  }

  broadcast(message: ServerMessage, channel: Channel = 'business'): void {
    this.连接注册表.广播到全部UI(message, channel);
  }
}

export default WebSocket服务;
