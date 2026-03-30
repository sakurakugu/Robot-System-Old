import express from 'express';
import DatabaseService from './core/database';
import { createApp } from './bootstrap/create-app';
import { createAppContext, type 应用上下文 } from './bootstrap/create-app-context';
import WebSocketService from './modules/websocket/service';

export class 应用程序 {
  public 应用: express.Application;
  public 数据库: DatabaseService;
  public WebSocket服务: WebSocketService;
  public 上下文: 应用上下文;

  private constructor(上下文: 应用上下文, 应用: express.Application) {
    this.上下文 = 上下文;
    this.数据库 = 上下文.数据库;
    this.WebSocket服务 = 上下文.WebSocket服务;
    this.应用 = 应用;
  }

  static async create(): Promise<应用程序> {
    const 上下文 = createAppContext();
    const 应用 = await createApp(上下文);
    return new 应用程序(上下文, 应用);
  }

  async close(): Promise<void> {
    await this.上下文.异步数据库.close();
    this.数据库.close();
  }
}
