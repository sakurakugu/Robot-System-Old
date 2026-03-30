import express from 'express';
import request from 'supertest';
import type { AccountService } from './service';
import { requireAuth, requireRole, withAuthContext } from './middleware';
import type { AuthContext } from './types';

describe('账号中间件', () => {
  function 创建应用(buildUserContext: (token: string | null | undefined) => AuthContext) {
    const accountService = {
      buildUserContext: jest.fn(buildUserContext),
    } as unknown as AccountService;

    const app = express();
    app.use(withAuthContext(accountService));

    app.get('/protected', requireAuth, (req, res) => {
      res.json({
        success: true,
        userId: req.authContext?.user?.id || null,
      });
    });

    app.get('/admin', requireRole('admin'), (_req, res) => {
      res.json({ success: true });
    });

    return { app, accountService };
  }

  it('未携带 token 时应返回 401', async () => {
    const { app, accountService } = 创建应用(() => ({
      mode: 'guest',
      user: null,
      sessionId: null,
    }));

    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect((accountService.buildUserContext as jest.Mock).mock.calls[0][0]).toBeNull();
  });

  it('携带有效 token 时应通过 requireAuth', async () => {
    const { app, accountService } = 创建应用((token) => ({
      mode: 'authenticated',
      user: {
        id: 'user-1',
        username: 'tester',
        role: 'user',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastLoginAt: null,
      },
      sessionId: token ? 'session-1' : null,
    }));

    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer token-123');

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe('user-1');
    expect((accountService.buildUserContext as jest.Mock).mock.calls[0][0]).toBe('token-123');
  });

  it('角色不足时应返回 403', async () => {
    const { app } = 创建应用(() => ({
      mode: 'authenticated',
      user: {
        id: 'user-1',
        username: 'tester',
        role: 'user',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastLoginAt: null,
      },
      sessionId: 'session-1',
    }));

    const response = await request(app)
      .get('/admin')
      .set('Authorization', 'Bearer token-123');

    expect(response.status).toBe(403);
  });

  it('管理员角色应通过 requireRole', async () => {
    const { app } = 创建应用(() => ({
      mode: 'authenticated',
      user: {
        id: 'admin-1',
        username: 'admin',
        role: 'admin',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastLoginAt: null,
      },
      sessionId: 'session-1',
    }));

    const response = await request(app)
      .get('/admin')
      .set('Authorization', 'Bearer token-123');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
