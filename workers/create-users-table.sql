-- 建立用戶認證系統的資料表
-- Created: 2025-08-18

-- =====================================================
-- 1. 用戶主表 (登入認證用)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_suffix TEXT,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  
  -- 角色層級
  global_role TEXT DEFAULT 'user',  -- super_admin/admin/user
  
  -- 狀態管理
  is_active INTEGER DEFAULT 1,
  is_verified INTEGER DEFAULT 0,  -- 手機驗證狀態
  user_status TEXT DEFAULT 'pending',  -- pending/active/suspended/deleted
  
  -- 登入追蹤
  session_token TEXT,
  last_login DATETIME,
  login_count INTEGER DEFAULT 0,
  failed_login_count INTEGER DEFAULT 0,
  locked_until DATETIME,
  
  -- 偏好設定
  preferences TEXT,  -- JSON: 語言、通知設定等
  
  -- 來源資訊
  source_type TEXT,  -- crm_worker/crm_contact/system/manual
  source_id TEXT,    -- CRM 中的原始 ID
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. 審計日誌表
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,  -- login/logout/update/delete/create
  target_type TEXT,      -- user/project/settings/auth
  target_id TEXT,
  changes TEXT,          -- JSON: 變更內容
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =====================================================
-- 3. 用戶權限快取表 (可選，用於效能優化)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_permissions_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  project_id TEXT,
  permissions TEXT,  -- JSON: 權限清單
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, project_id)
);

-- =====================================================
-- 4. Session 管理表
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  is_active INTEGER DEFAULT 1,
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =====================================================
-- 索引優化
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_global_role ON users(global_role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(user_status);
CREATE INDEX IF NOT EXISTS idx_users_source ON users(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- =====================================================
-- 觸發器：自動更新 updated_at
-- =====================================================
CREATE TRIGGER IF NOT EXISTS trigger_users_updated_at
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- =====================================================
-- 插入 Super Admin 帳號
-- =====================================================
INSERT OR IGNORE INTO users (
  id, 
  phone, 
  password_suffix, 
  name, 
  email, 
  global_role, 
  is_active, 
  is_verified,
  user_status,
  login_count,
  source_type
) VALUES (
  'super_admin_001',
  '0912345678',
  '678',
  'Super Admin',
  'admin@example.com',
  'super_admin',
  1,
  1,
  'active',
  0,
  'system'
);

-- =====================================================
-- 插入詹姆士管理員帳號
-- =====================================================
INSERT OR IGNORE INTO users (
  id, 
  phone, 
  password_suffix, 
  name, 
  email, 
  global_role, 
  is_active, 
  is_verified,
  user_status,
  login_count,
  source_type
) VALUES (
  'admin_james_001',
  '0963922033',
  '033',
  '詹姆士',
  'james@example.com',
  'super_admin',
  1,
  1,
  'active',
  0,
  'system'
);