import type { IncomingMessage } from 'http';
import 配置 from '../../config';
import type { AccountService } from '../../features/account/service';

type 可鉴权账号服务 = Pick<AccountService, 'buildUserContext'>;

export type WebSocket升级请求 = Pick<IncomingMessage, 'url' | 'headers'>;

/**
 * WebSocket UI 连接鉴权器
 * 负责解析 token，并判断 Web/Phone 连接是否已完成鉴权
 */
export class WebSocketUI鉴权器 {
  constructor(
    private readonly 获取账号服务: () => 可鉴权账号服务 | undefined,
  ) {}

  解析Token(req: WebSocket升级请求): string | null {
    const authHeader = String(req.headers.authorization || '');
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = String(url.searchParams.get('token') || '').trim();
    return token || null;
  }

  需要校验连接(pathname: string): boolean {
    return pathname.startsWith(配置.ws.webPath) || pathname.startsWith(配置.ws.phonePath);
  }

  async 已认证(req: WebSocket升级请求): Promise<boolean> {
    const 账号服务 = this.获取账号服务();
    if (!账号服务) {
      return false;
    }

    const token = this.解析Token(req);
    return (await 账号服务.buildUserContext(token)).mode === 'authenticated';
  }
}
