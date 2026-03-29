-- up migration

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS roles (
  uuid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  llm_provider TEXT,
  llm_model TEXT,
  temperature REAL DEFAULT 0.7,
  system_prompt TEXT,
  voice TEXT,
  asr_provider TEXT,
  asr_model TEXT,
  intent_strategy TEXT,
  max_history INTEGER DEFAULT 10,
  is_default INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS robots (
  uuid TEXT PRIMARY KEY,
  name TEXT,
  model TEXT,
  version TEXT,
  motion_control_version TEXT,
  server_version TEXT,
  ip TEXT,
  group_name TEXT,
  tags TEXT,
  sn TEXT,
  role_uuid TEXT,
  audio_route_config TEXT,
  status TEXT DEFAULT 'offline',
  last_connected_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_uuid) REFERENCES roles(uuid) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  client_type TEXT NOT NULL DEFAULT 'unknown',
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS feedback_entries (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  client_type TEXT NOT NULL DEFAULT 'unknown',
  device_name TEXT,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'resolved')),
  handled_by TEXT,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  uuid BIGSERIAL PRIMARY KEY,
  robot_id TEXT NOT NULL,
  conversation_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  type TEXT CHECK(type IN ('audio', 'text')),
  user_input TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  actions TEXT,
  processing_time INTEGER,
  metadata TEXT,
  FOREIGN KEY (robot_id) REFERENCES robots(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS action_logs (
  uuid BIGSERIAL PRIMARY KEY,
  robot_id TEXT NOT NULL,
  conversation_id TEXT,
  action_name TEXT NOT NULL,
  parameters TEXT,
  status TEXT CHECK(status IN ('success', 'failed', 'rejected')) DEFAULT 'success',
  result_detail TEXT,
  executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (robot_id) REFERENCES robots(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_versions (
  id BIGSERIAL PRIMARY KEY,
  version_name TEXT NOT NULL,
  version_code INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('stable', 'beta')),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT NOT NULL,
  changelog TEXT,
  is_active INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS robot_package_versions (
  id BIGSERIAL PRIMARY KEY,
  version_code INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('stable', 'beta')),
  changelog TEXT,
  is_active INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  agent_file_name TEXT,
  agent_file_size INTEGER,
  agent_file_hash TEXT,
  server_file_name TEXT,
  server_file_size INTEGER,
  server_file_hash TEXT,
  common_file_name TEXT,
  common_file_size INTEGER,
  common_file_hash TEXT
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS asr_provider TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS asr_model TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_default INTEGER DEFAULT 0;
ALTER TABLE robots ADD COLUMN IF NOT EXISTS audio_route_config TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_id TEXT;
ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS conversation_id TEXT;
ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS result_detail TEXT;
ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS handled_by TEXT;
ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;
ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

UPDATE feedback_entries
SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

UPDATE roles
SET asr_provider = 'aliyun'
WHERE asr_provider IS NULL OR TRIM(asr_provider) = '';

CREATE INDEX IF NOT EXISTS idx_robots_status ON robots(status);
CREATE INDEX IF NOT EXISTS idx_robots_group ON robots(group_name);
CREATE INDEX IF NOT EXISTS idx_conversations_robot_id ON conversations(robot_id);
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX IF NOT EXISTS idx_action_logs_robot_id ON action_logs(robot_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_conversation_id ON action_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_executed_at ON action_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_updated_at ON knowledge_entries(updated_at);
CREATE INDEX IF NOT EXISTS idx_feedback_entries_created_at ON feedback_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_entries_user_id ON feedback_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_entries_status ON feedback_entries(status);
CREATE INDEX IF NOT EXISTS idx_app_versions_channel ON app_versions(channel);
CREATE INDEX IF NOT EXISTS idx_app_versions_active ON app_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_robot_pkg_channel ON robot_package_versions(channel);
CREATE INDEX IF NOT EXISTS idx_robot_pkg_active ON robot_package_versions(is_active);
