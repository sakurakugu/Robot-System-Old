import express from 'express';
import WebSocketService from '../infra/websocket/service';
import { createApp } from './create-app';
import { createAppContext, type 应用上下文 } from './create-app-context';

export class 应用程序 {
  public 应用: express.Application;
  public WebSocket服务: WebSocketService;
  public 上下文: 应用上下文;

  private constructor(上下文: 应用上下文, 应用: express.Application) {
    this.上下文 = 上下文;
    this.WebSocket服务 = 上下文.WebSocket服务;
    this.应用 = 应用;
  }

  static async create(): Promise<应用程序> {
    const 上下文 = await createAppContext();
    const 应用 = await createApp(上下文);
    return new 应用程序(上下文, 应用);
  }

  async close(): Promise<void> {
    this.WebSocket服务.close();
    await this.上下文.异步数据库.close();
  }
}
