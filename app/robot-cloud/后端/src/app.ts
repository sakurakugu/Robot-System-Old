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

  constructor() {
    this.上下文 = createAppContext();
    this.数据库 = this.上下文.数据库;
    this.WebSocket服务 = this.上下文.WebSocket服务;
    this.应用 = createApp(this.上下文);
  }
}
