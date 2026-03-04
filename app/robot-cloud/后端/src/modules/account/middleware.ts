import type { NextFunction, Request, Response } from 'express';
import type { AccountService } from './service';
import type { AccountRole } from './types';

function resolveToken(req: Request): string | null {
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function withAuthContext(accountService: AccountService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = resolveToken(req);
    req.authContext = accountService.buildUserContext(token);
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
    return res.status(401).json({ success: false, error: '请先登录' });
  }
  next();
}

export function requireRole(...roles: AccountRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }

    if (!roles.includes(req.authContext.user.role)) {
      return res.status(403).json({ success: false, error: '权限不足' });
    }

    next();
  };
}
