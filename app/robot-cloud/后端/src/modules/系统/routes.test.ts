import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { createSystemRoutes } from './routes';

describe('系统路由', () => {
  function 创建应用(protectedRead?: RequestHandler) {
    const 依赖 = {
      获取机器人总数: jest.fn(async () => 2),
      获取在线机器人数量: jest.fn(() => 1),
    };

    const app = express();
    app.use(createSystemRoutes(依赖, { protectedRead }));
    return app;
  }

  it('health 接口应返回 healthy', async () => {
    const app = 创建应用();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
    expect(typeof response.body.data.timestamp).toBe('string');
  });

  it('status 接口应返回在线与总机器人数量', async () => {
    const app = 创建应用();

    const response = await request(app).get('/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.onlineRobots).toBe(1);
    expect(response.body.data.totalRobots).toBe(2);
  });

  it('带保护中间件时应先经过鉴权', async () => {
    const protectedRead: RequestHandler = (req, res, next) => {
      if (req.headers.authorization === 'Bearer ok') {
        next();
        return;
      }
      res.status(401).json({ success: false, error: '未授权' });
    };

    const app = 创建应用(protectedRead);

    const unauthorized = await request(app).get('/status');
    const authorized = await request(app)
      .get('/status')
      .set('Authorization', 'Bearer ok');

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(authorized.body.data.totalRobots).toBe(2);
  });
});
