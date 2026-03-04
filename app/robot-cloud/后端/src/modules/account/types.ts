export type AccountRole = 'user' | 'admin' | 'super_admin';

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  role: AccountRole;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface SafeUser {
  id: string;
  username: string;
  role: AccountRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export type ClientType = 'web' | 'mobile' | 'unknown';

export interface UserSessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  client_type: ClientType;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface LoginSessionView {
  id: string;
  clientType: ClientType;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface AuthContext {
  mode: 'guest' | 'authenticated';
  user: SafeUser | null;
  sessionId: string | null;
}
