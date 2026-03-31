import type { Request } from 'express';
import {
  处理控制器,
  返回数据,
} from '../../shared/http/controller';
import {
  Http错误工厂,
  type Http错误映射规则,
} from '../../shared/http/errors';
import type { AccountService } from './service';
import type { AccountRole, ClientType } from './types';

const 账号权限错误映射: Http错误映射规则[] = [
  { 匹配: '不存在', 状态码: 404 },
  { 匹配: [/权限/, /禁止/, /无权/], 状态码: 403 },
];

function resolveClientType(req: Request): ClientType {
  const value = String(req.headers['x-client-type'] || '').toLowerCase();
  if (value === 'web' || value === 'mobile') {
    return value;
  }
  return 'unknown';
}

function resolveDeviceName(req: Request): string {
  const value = String(req.headers['x-device-name'] || '').trim();
  return value || 'Unknown Device';
}

function resolveUserAgent(req: Request): string {
  const header = req.headers['user-agent'];
  if (Array.isArray(header)) {
    return header[0] || '';
  }
  return header || '';
}

function resolveToken(req: Request): string | null {
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function resolveParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

export class AccountController {
  constructor(private accountService: AccountService) {}

  private 获取当前用户(req: Request) {
    if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
      throw Http错误工厂.未授权('未登录');
    }
    return req.authContext.user;
  }

  register = 处理控制器(async (req: Request) => 返回数据(
    await this.accountService.register(req.body || {}, {
      clientType: resolveClientType(req),
      deviceName: resolveDeviceName(req),
      ipAddress: req.ip,
      userAgent: resolveUserAgent(req),
    }),
    { 状态码: 201 },
  ), {
    默认错误状态码: 400,
  });

  login = 处理控制器(async (req: Request) => 返回数据(
    await this.accountService.login(req.body || {}, {
      clientType: resolveClientType(req),
      deviceName: resolveDeviceName(req),
      ipAddress: req.ip,
      userAgent: resolveUserAgent(req),
    }),
  ), {
    默认错误状态码: 400,
  });

  guest = 处理控制器(async () => 返回数据({
    mode: 'guest',
    message: '已进入游客模式',
  }));

  me = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    return 返回数据(await this.accountService.getProfile(user.id));
  });

  listSessions = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    const sessions = await this.accountService.listMySessions(user.id, req.authContext?.sessionId ?? null);
    return 返回数据(sessions);
  });

  revokeSession = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    await this.accountService.revokeMySession(user.id, resolveParam(req.params.id));
  }, {
    错误映射: [{ 匹配: '不存在', 状态码: 404 }],
  });

  logout = 处理控制器(async (req: Request) => {
    await this.accountService.logoutCurrent(req.authContext?.sessionId || null);
  });

  listUsers = 处理控制器(async (req: Request) => {
    this.获取当前用户(req);
    return 返回数据(await this.accountService.listUsers());
  });

  updateRole = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    const role = String(req.body?.role || '') as AccountRole;
    if (!['user', 'admin', 'super_admin'].includes(role)) {
      throw Http错误工厂.参数错误('角色无效');
    }
    const data = await this.accountService.updateUserRole(
      user.role,
      resolveParam(req.params.id),
      role
    );
    return 返回数据(data);
  }, {
    默认错误状态码: 403,
    错误映射: 账号权限错误映射,
  });

  // 允许前端通过 token 预检
  resolveContext = 处理控制器(async (req: Request) => {
    const token = resolveToken(req);
    const context = await this.accountService.buildUserContext(token);
    return 返回数据(context);
  });
}
