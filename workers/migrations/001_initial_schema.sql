-- Migration: 001_initial_schema
-- Description: Initial database schema for engineering management
-- Date: 2025-01-08

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_suffix TEXT NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'member',
  department TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  login_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  spc_engineering TEXT,
  cabinet_engineering TEXT,
  maintenance TEXT,
  progress_management TEXT,
  permissions TEXT,
  status TEXT DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 3. Project permissions table
CREATE TABLE IF NOT EXISTS project_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  engineering_type TEXT DEFAULT 'ALL',
  can_edit BOOLEAN DEFAULT FALSE,
  can_view_others BOOLEAN DEFAULT FALSE,
  can_export BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  assigned_by TEXT,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id, engineering_type),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- 4. Construction progress table
CREATE TABLE IF NOT EXISTS construction_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  site_type TEXT NOT NULL,
  construction_date DATE,
  completion_status BOOLEAN DEFAULT FALSE,
  worker_name TEXT,
  work_area REAL,
  photos TEXT,
  notes TEXT,
  quality_check_status TEXT,
  quality_check_by TEXT,
  quality_check_date DATE,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 5. Login logs table
CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  phone TEXT,
  login_status TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  location TEXT,
  error_message TEXT,
  session_token TEXT,
  login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. Project activities table
CREATE TABLE IF NOT EXISTS project_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  activity_description TEXT,
  target_type TEXT,
  target_id TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 7. File uploads table
CREATE TABLE IF NOT EXISTS file_uploads (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  site_id TEXT,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  r2_key TEXT NOT NULL,
  r2_url TEXT,
  thumbnail_key TEXT,
  thumbnail_url TEXT,
  uploaded_by TEXT NOT NULL,
  upload_status TEXT DEFAULT 'pending',
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- 8. System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  type TEXT DEFAULT 'string',
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_projects_opportunity ON projects(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

CREATE INDEX IF NOT EXISTS idx_permissions_project ON project_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON project_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_role ON project_permissions(role);

CREATE INDEX IF NOT EXISTS idx_progress_project ON construction_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_site ON construction_progress(site_id);
CREATE INDEX IF NOT EXISTS idx_progress_date ON construction_progress(construction_date);

CREATE INDEX IF NOT EXISTS idx_logs_user ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_phone ON login_logs(phone);
CREATE INDEX IF NOT EXISTS idx_logs_time ON login_logs(login_at);

CREATE INDEX IF NOT EXISTS idx_activities_project ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON project_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON project_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_time ON project_activities(created_at);

CREATE INDEX IF NOT EXISTS idx_uploads_project ON file_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_uploads_site ON file_uploads(site_id);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON file_uploads(uploaded_by);

-- Insert default data
INSERT OR IGNORE INTO system_settings (key, value, type, description, is_public) VALUES
('app_version', '1.0.0', 'string', '應用程式版本', true),
('maintenance_mode', 'false', 'boolean', '維護模式', true),
('max_file_size_mb', '10', 'number', '最大檔案大小(MB)', false),
('session_duration_hours', '24', 'number', 'Session有效時間(小時)', false),
('rate_limit_per_minute', '60', 'number', '每分鐘請求限制', false);

-- Insert default admin user (password: 678)
INSERT OR IGNORE INTO users (id, phone, password_suffix, name, role, email, is_active) VALUES
('admin-default', '0912345678', '678', '系統管理員', 'admin', 'admin@example.com', true);