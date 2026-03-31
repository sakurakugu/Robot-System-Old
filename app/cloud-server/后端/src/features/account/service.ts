import { v7 as uuidv7 } from 'uuid';
import { logger } from '../../infra/logger';
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from './password';
import type { AccountRepository } from './repository';
import type {
  AccountRole,
  AuthContext,
  ClientType,
  LoginSessionView,
  SafeUser,
  UserRecord,
  UserSessionRecord,
} from './types';

const SESSION_EXPIRE_DAYS = 30;

type PostgresError = Error & {
  code?: string;
};

type RegisterInput = {
  username: string;
  password: string;
};

type LoginInput = RegisterInput;

type LoginMeta = {
  clientType: ClientType;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
};

export class AccountService {
  constructor(private repository: AccountRepository) {}

  private toSafeUser(user: UserRecord): SafeUser {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    };
  }

  private validateCredentials(username: string, password: string): void {
    if (!username || username.trim().length < 3) {
      throw new Error('用户名至少 3 位');
    }
    if (!password || password.length < 6) {
      throw new Error('密码至少 6 位');
    }
  }

  private buildSessionView(session: UserSessionRecord, currentSessionId: string | null): LoginSessionView {
    return {
      id: session.id,
      clientType: session.client_type,
      deviceName: session.device_name || '未知设备',
      ipAddress: session.ip_address || '-',
      userAgent: session.user_agent || '-',
      createdAt: session.created_at,
      lastSeenAt: session.last_seen_at,
      expiresAt: session.expires_at,
      current: !!currentSessionId && currentSessionId === session.id,
    };
  }

  private async createUserSession(
    repository: AccountRepository,
    userId: string,
    meta: LoginMeta,
  ): Promise<{ token: string; session: UserSessionRecord }> {
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const sessionId = uuidv7();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await repository.createUserSession({
      id: sessionId,
      user_id: userId,
      token_hash: tokenHash,
      client_type: meta.clientType,
      device_name: meta.deviceName || null,
      ip_address: meta.ipAddress || null,
      user_agent: meta.userAgent || null,
      expires_at: expiresAt,
    });

    const session = await repository.getUserSessionById(sessionId);
    if (!session) {
      throw new Error('创建会话失败');
    }

    return { token, session };
  }

  async register(input: RegisterInput, meta: LoginMeta) {
    const username = input.username.trim();
    this.validateCredentials(username, input.password);

    try {
      return await this.repository.withTransaction(async (repository) => {
        await repository.lockUsersTable();

        const existing = await repository.getUserByUsername(username);
        if (existing) {
          throw new Error('用户名已存在');
        }

        const isFirstUser = (await repository.countUsers()) === 0;
        const role: AccountRole = isFirstUser ? 'super_admin' : 'user';
        const userId = uuidv7();
        const passwordHash = hashPassword(input.password);

        await repository.createUser({
          id: userId,
          username,
          password_hash: passwordHash,
          role,
        });

        const createdUser = await repository.getUserById(userId);
        if (!createdUser) {
          throw new Error('创建用户失败');
        }

        const { token, session } = await this.createUserSession(repository, userId, meta);
        await repository.touchUserLogin(userId);

        logger.info('用户注册成功', { username, role, userId });

        return {
          token,
          user: this.toSafeUser(createdUser),
          session: this.buildSessionView(session, session.id),
        };
      });
    } catch (error) {
      if ((error as PostgresError).code === '23505') {
        throw new Error('用户名已存在');
      }
      throw error;
    }
  }

  async login(input: LoginInput, meta: LoginMeta) {
    const username = input.username.trim();
    this.validateCredentials(username, input.password);

    const user = await this.repository.getUserByUsername(username);
    if (!user || !verifyPassword(input.password, user.password_hash)) {
      throw new Error('用户名或密码错误');
    }

    const { token, session } = await this.createUserSession(this.repository, user.id, meta);
    await this.repository.touchUserLogin(user.id);

    logger.info('用户登录成功', { username: user.username, userId: user.id });

    return {
      token,
      user: this.toSafeUser({ ...user, last_login_at: new Date().toISOString() }),
      session: this.buildSessionView(session, session.id),
    };
  }

  async authenticateByToken(token: string): Promise<{ user: SafeUser; sessionId: string } | null> {
    const normalized = token.trim();
    if (!normalized) {
      return null;
    }

    const tokenHash = hashSessionToken(normalized);
    const session = await this.repository.getUserSessionByTokenHash(tokenHash);
    if (!session) {
      return null;
    }

    const now = new Date();
    if (session.revoked_at || new Date(session.expires_at) <= now) {
      return null;
    }

    const user = await this.repository.getUserById(session.user_id);
    if (!user) {
      return null;
    }

    await this.repository.touchUserSession(session.id);
    return {
      user: this.toSafeUser(user),
      sessionId: session.id,
    };
  }

  buildGuestContext(): AuthContext {
    return {
      mode: 'guest',
      user: null,
      sessionId: null,
    };
  }

  async buildUserContext(token: string | null | undefined): Promise<AuthContext> {
    if (!token) {
      return this.buildGuestContext();
    }

    const auth = await this.authenticateByToken(token);
    if (!auth) {
      return this.buildGuestContext();
    }

    return {
      mode: 'authenticated',
      user: auth.user,
      sessionId: auth.sessionId,
    };
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    return this.toSafeUser(user);
  }

  async listMySessions(userId: string, currentSessionId: string | null): Promise<LoginSessionView[]> {
    const sessions = await this.repository.listUserSessions(userId);
    return sessions.map((session) => this.buildSessionView(session, currentSessionId));
  }

  async revokeMySession(userId: string, sessionId: string): Promise<void> {
    const session = await this.repository.getUserSessionById(sessionId);
    if (!session || session.user_id !== userId) {
      throw new Error('会话不存在');
    }
    await this.repository.revokeUserSession(sessionId);
  }

  async logoutCurrent(sessionId: string | null): Promise<void> {
    if (!sessionId) {
      return;
    }
    await this.repository.revokeUserSession(sessionId);
  }

  async listUsers(): Promise<SafeUser[]> {
    return (await this.repository.listUsers()).map((user) => this.toSafeUser(user));
  }

  async updateUserRole(operatorRole: AccountRole, userId: string, role: AccountRole): Promise<SafeUser> {
    if (operatorRole !== 'super_admin') {
      throw new Error('仅主管理员可修改用户权限');
    }

    return this.repository.withTransaction(async (repository) => {
      await repository.lockUsersTable();

      const user = await repository.getUserById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      if (user.role === 'super_admin' && role !== 'super_admin') {
        const superAdminCount = await repository.countUsersByRole('super_admin');
        if (superAdminCount <= 1) {
          throw new Error('至少保留一个主管理员');
        }
      }

      await repository.updateUserRole(userId, role);
      const updated = await repository.getUserById(userId);
      if (!updated) {
        throw new Error('更新失败');
      }
      return this.toSafeUser(updated);
    });
  }
}
