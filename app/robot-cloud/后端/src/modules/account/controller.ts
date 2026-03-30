import type { Request, Response } from 'express';
import type { AccountService } from './service';
import type { AccountRole, ClientType } from './types';

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

  register = async (req: Request, res: Response) => {
    try {
      const data = await this.accountService.register(req.body || {}, {
        clientType: resolveClientType(req),
        deviceName: resolveDeviceName(req),
        ipAddress: req.ip,
        userAgent: resolveUserAgent(req),
      });
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const data = await this.accountService.login(req.body || {}, {
        clientType: resolveClientType(req),
        deviceName: resolveDeviceName(req),
        ipAddress: req.ip,
        userAgent: resolveUserAgent(req),
      });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  guest = async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        mode: 'guest',
        message: '已进入游客模式',
      },
    });
  };

  me = async (req: Request, res: Response) => {
    if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const user = await this.accountService.getProfile(req.authContext.user.id);
    res.json({ success: true, data: user });
  };

  listSessions = async (req: Request, res: Response) => {
    if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const sessions = await this.accountService.listMySessions(req.authContext.user.id, req.authContext.sessionId);
    res.json({ success: true, data: sessions });
  };

  revokeSession = async (req: Request, res: Response) => {
    if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    try {
      await this.accountService.revokeMySession(req.authContext.user.id, resolveParam(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  };

  logout = async (req: Request, res: Response) => {
    await this.accountService.logoutCurrent(req.authContext?.sessionId || null);
    res.json({ success: true });
  };

  listUsers = async (req: Request, res: Response) => {
    if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    res.json({ success: true, data: await this.accountService.listUsers() });
  };

  updateRole = async (req: Request, res: Response) => {
    if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    try {
      const role = String(req.body?.role || '') as AccountRole;
      if (!['user', 'admin', 'super_admin'].includes(role)) {
        return res.status(400).json({ success: false, error: '角色无效' });
      }
      const data = await this.accountService.updateUserRole(
        req.authContext.user.role,
        resolveParam(req.params.id),
        role
      );
      res.json({ success: true, data });
    } catch (error: any) {
      const status = error.message.includes('不存在') ? 404 : 403;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  // 允许前端通过 token 预检
  resolveContext = async (req: Request, res: Response) => {
    const token = resolveToken(req);
    const context = await this.accountService.buildUserContext(token);
    res.json({ success: true, data: context });
  };
}
