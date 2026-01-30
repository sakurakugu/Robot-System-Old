import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';

interface Client {
  ws: WebSocket;
  id: string;
  projectUuid?: string;
}

// WebSocket 服务类
export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.初始化();
  }

  private 初始化() {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateId();
      const client: Client = { ws, id: clientId };
      this.clients.set(clientId, client);

      console.log(`客户端已连接: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('消息解析失败:', error);
        }
      });

      ws.on('close', () => {
        console.log(`客户端已断开连接: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket 错误，客户端 ${clientId}:`, error);
      });

      // 发送欢迎消息
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`来自客户端 ${clientId} 的消息:`, message);

    switch (message.type) {
      case 'join_project':
        client.projectUuid = message.projectUuid;
        this.sendToClient(clientId, {
          type: 'joined_project',
          projectUuid: message.projectUuid,
        });
        break;

      case 'leave_project':
        client.projectUuid = undefined;
        this.sendToClient(clientId, {
          type: 'left_project',
        });
        break;

      case 'robot_status':
        // 广播机器人状态到同一项目的所有客户端
        this.broadcastToProject(client.projectUuid, {
          type: 'robot_status_update',
          data: message.data,
        }, clientId);
        break;

      case 'action_execute':
        // 广播动作执行到同一项目的所有客户端
        this.broadcastToProject(client.projectUuid, {
          type: 'action_executed',
          data: message.data,
        }, clientId);
        break;

      default:
        console.log(`未知的消息类型: ${message.type}`);
    }
  }

  private sendToClient(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  private broadcastToProject(projectUuid: string | undefined, data: any, excludeClientId?: string) {
    if (!projectUuid) return;

    this.clients.forEach((client, clientId) => {
      if (client.projectUuid === projectUuid && clientId !== excludeClientId) {
        this.sendToClient(clientId, data);
      }
    });
  }

  public broadcast(data: any) {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, data);
    });
  }

  public broadcastRobotLog(log: string) {
    this.broadcast({
      type: 'robot_log',
      data: { log, timestamp: new Date().toISOString() },
    });
  }

  // 广播机器人状态更新
  public broadcastRobotStatus(projectUuid: string, robotUuid: string, status: string) {
    this.broadcastToProject(projectUuid, {
      type: 'robot_status_update',
      data: { robotUuid, status, timestamp: new Date().toISOString() },
    });
  }

  // 广播执行进度
  public broadcastExecutionProgress(projectUuid: string, executionId: string, progress: number, message: string) {
    this.broadcastToProject(projectUuid, {
      type: 'execution_progress',
      data: { executionId, progress, message, timestamp: new Date().toISOString() },
    });
  }

  // 广播执行输出
  public broadcastExecutionOutput(projectUuid: string, executionId: string, output: string) {
    this.broadcastToProject(projectUuid, {
      type: 'execution_output',
      data: { executionId, output, timestamp: new Date().toISOString() },
    });
  }

  // 广播执行错误
  public broadcastExecutionError(projectUuid: string, executionId: string, error: string) {
    this.broadcastToProject(projectUuid, {
      type: 'execution_error',
      data: { executionId, error, timestamp: new Date().toISOString() },
    });
  }

  // 广播执行完成
  public broadcastExecutionComplete(projectUuid: string, executionId: string, code: number) {
    this.broadcastToProject(projectUuid, {
      type: 'execution_complete',
      data: { executionId, code, timestamp: new Date().toISOString() },
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
