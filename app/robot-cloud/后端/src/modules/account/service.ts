import { v7 as uuidv7 } from 'uuid';
import type DatabaseService from '../../core/database';
import { logger } from '../../core/logger';
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from './password';
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
  constructor(private database: DatabaseService) {}

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

  private createUserSession(userId: string, meta: LoginMeta): { token: string; session: UserSessionRecord } {
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const sessionId = uuidv7();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    this.database.createUserSession({
      id: sessionId,
      user_id: userId,
      token_hash: tokenHash,
      client_type: meta.clientType,
      device_name: meta.deviceName || null,
      ip_address: meta.ipAddress || null,
      user_agent: meta.userAgent || null,
      expires_at: expiresAt,
    });

    const session = this.database.getUserSessionById(sessionId);
    if (!session) {
      throw new Error('创建会话失败');
    }

    return { token, session };
  }

  register(input: RegisterInput, meta: LoginMeta) {
    const username = input.username.trim();
    this.validateCredentials(username, input.password);

    const existing = this.database.getUserByUsername(username);
    if (existing) {
      throw new Error('用户名已存在');
    }

    const isFirstUser = this.database.countUsers() === 0;
    const role: AccountRole = isFirstUser ? 'super_admin' : 'user';
    const userId = uuidv7();
    const passwordHash = hashPassword(input.password);

    this.database.createUser({
      id: userId,
      username,
      password_hash: passwordHash,
      role,
    });

    const createdUser = this.database.getUserById(userId);
    if (!createdUser) {
      throw new Error('创建用户失败');
    }

    const { token, session } = this.createUserSession(userId, meta);
    this.database.touchUserLogin(userId);

    logger.info('用户注册成功', { username, role, userId });

    return {
      token,
      user: this.toSafeUser(createdUser),
      session: this.buildSessionView(session, session.id),
    };
  }

  login(input: LoginInput, meta: LoginMeta) {
    const username = input.username.trim();
    this.validateCredentials(username, input.password);

    const user = this.database.getUserByUsername(username);
    if (!user || !verifyPassword(input.password, user.password_hash)) {
      throw new Error('用户名或密码错误');
    }

    const { token, session } = this.createUserSession(user.id, meta);
    this.database.touchUserLogin(user.id);

    logger.info('用户登录成功', { username: user.username, userId: user.id });

    return {
      token,
      user: this.toSafeUser({ ...user, last_login_at: new Date().toISOString() }),
      session: this.buildSessionView(session, session.id),
    };
  }

  authenticateByToken(token: string): { user: SafeUser; sessionId: string } | null {
    const normalized = token.trim();
    if (!normalized) {
      return null;
    }

    const tokenHash = hashSessionToken(normalized);
    const session = this.database.getUserSessionByTokenHash(tokenHash);
    if (!session) {
      return null;
    }

    const now = new Date();
    if (session.revoked_at || new Date(session.expires_at) <= now) {
      return null;
    }

    const user = this.database.getUserById(session.user_id);
    if (!user) {
      return null;
    }

    this.database.touchUserSession(session.id);
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

  buildUserContext(token: string | null | undefined): AuthContext {
    if (!token) {
      return this.buildGuestContext();
    }

    const auth = this.authenticateByToken(token);
    if (!auth) {
      return this.buildGuestContext();
    }

    return {
      mode: 'authenticated',
      user: auth.user,
      sessionId: auth.sessionId,
    };
  }

  getProfile(userId: string): SafeUser {
    const user = this.database.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    return this.toSafeUser(user);
  }

  listMySessions(userId: string, currentSessionId: string | null): LoginSessionView[] {
    const sessions = this.database.listUserSessions(userId);
    return sessions.map((session) => this.buildSessionView(session, currentSessionId));
  }

  revokeMySession(userId: string, sessionId: string): void {
    const session = this.database.getUserSessionById(sessionId);
    if (!session || session.user_id !== userId) {
      throw new Error('会话不存在');
    }
    this.database.revokeUserSession(sessionId);
  }

  logoutCurrent(sessionId: string | null): void {
    if (!sessionId) {
      return;
    }
    this.database.revokeUserSession(sessionId);
  }

  listUsers(): SafeUser[] {
    return this.database.listUsers().map((user) => this.toSafeUser(user));
  }

  updateUserRole(operatorRole: AccountRole, userId: string, role: AccountRole): SafeUser {
    if (operatorRole !== 'super_admin') {
      throw new Error('仅主管理员可修改用户权限');
    }

    const user = this.database.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.role === 'super_admin' && role !== 'super_admin') {
      const superAdminCount = this.database.countUsersByRole('super_admin');
      if (superAdminCount <= 1) {
        throw new Error('至少保留一个主管理员');
      }
    }

    this.database.updateUserRole(userId, role);
    const updated = this.database.getUserById(userId);
    if (!updated) {
      throw new Error('更新失败');
    }
    return this.toSafeUser(updated);
  }
}
