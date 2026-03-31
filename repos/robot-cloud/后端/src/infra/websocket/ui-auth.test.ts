import { WebSocketUI鉴权器 } from './ui-auth';

describe('WebSocketUI鉴权器', () => {
  it('应优先从 Authorization 头解析 token', () => {
    const 鉴权器 = new WebSocketUI鉴权器(() => undefined);

    const token = 鉴权器.解析Token({
      url: '/api/v1/web/business?token=query-token',
      headers: {
        host: 'localhost',
        authorization: 'Bearer header-token',
      },
    });

    expect(token).toBe('header-token');
  });

  it('应支持从查询参数解析 token', () => {
    const 鉴权器 = new WebSocketUI鉴权器(() => undefined);

    const token = 鉴权器.解析Token({
      url: '/api/v1/web/business?token=query-token',
      headers: {
        host: 'localhost',
      },
    });

    expect(token).toBe('query-token');
  });

  it('Web 与 Phone 路径应要求鉴权', () => {
    const 鉴权器 = new WebSocketUI鉴权器(() => undefined);

    expect(鉴权器.需要校验连接('/api/v1/web/business')).toBe(true);
    expect(鉴权器.需要校验连接('/api/v1/phone/business')).toBe(true);
    expect(鉴权器.需要校验连接('/api/v1/robot/business')).toBe(false);
  });

  it('应通过账号服务判断连接是否已认证', async () => {
    const buildUserContext = jest.fn()
      .mockResolvedValueOnce({ mode: 'authenticated' })
      .mockResolvedValueOnce({ mode: 'guest' });
    const 鉴权器 = new WebSocketUI鉴权器(() => ({
      buildUserContext,
    }));

    await expect(鉴权器.已认证({
      url: '/api/v1/web/business?token=ok-token',
      headers: { host: 'localhost' },
    })).resolves.toBe(true);

    await expect(鉴权器.已认证({
      url: '/api/v1/web/business?token=bad-token',
      headers: { host: 'localhost' },
    })).resolves.toBe(false);

    expect(buildUserContext).toHaveBeenNthCalledWith(1, 'ok-token');
    expect(buildUserContext).toHaveBeenNthCalledWith(2, 'bad-token');
  });
});
