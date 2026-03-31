import type { NextFunction, Request, Response } from 'express';
import { 发送Http错误 } from '../../core/http/controller';
import { Http错误工厂 } from '../../core/http/errors';
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
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = resolveToken(req);
      req.authContext = await accountService.buildUserContext(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
    发送Http错误(res, Http错误工厂.未授权('请先登录'));
    return;
  }
  next();
}

export function requireRole(...roles: AccountRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
      发送Http错误(res, Http错误工厂.未授权('请先登录'));
      return;
    }

    if (!roles.includes(req.authContext.user.role)) {
      发送Http错误(res, Http错误工厂.禁止访问('权限不足'));
      return;
    }

    next();
  };
}
