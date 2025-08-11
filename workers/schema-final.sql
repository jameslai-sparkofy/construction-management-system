-- Final Engineering Management Database Schema
-- 統一權限管理設計
-- Created: 2025-08-11

-- =====================================================
-- 1. 專案表 (混合式儲存)
-- =====================================================
DROP TABLE IF EXISTS projects;
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  
  -- JSON 欄位儲存設定
  spc_engineering TEXT,      -- JSON: SPC 工程設定
  cabinet_engineering TEXT,  -- JSON: 浴櫃工程設定
  permissions TEXT,          -- JSON: 權限設定 (owners, fieldPermissions, crossViewEnabled)
  
  -- 基本欄位
  status TEXT DEFAULT 'active',  -- active/completed/pending
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. 統一成員管理表 (工班成員 + 業主)
-- =====================================================
DROP TABLE IF EXISTS project_members;
CREATE TABLE project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  member_type TEXT NOT NULL,  -- 'team' (工班) 或 'owner' (業主)
  team_id TEXT,               -- 工班ID (業主為 NULL)
  role TEXT DEFAULT 'member', -- leader/member/viewer
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_id, team_id)
);

-- =====================================================
-- 3. 工班管理表
-- =====================================================
DROP TABLE IF EXISTS project_team_assignments;
CREATE TABLE project_team_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT,
  leader_user_id TEXT,
  leader_name TEXT,
  leader_phone TEXT,
  
  -- 狀態管理
  status TEXT DEFAULT 'active',  -- active/pending_setup/inactive/inactive_with_pending_work
  deactivated_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, team_id)
);

-- =====================================================
-- 4. 使用者表 (不綁定固定工班)
-- =====================================================
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_suffix TEXT,
  name TEXT,
  email TEXT,
  
  -- 角色相關
  global_role TEXT DEFAULT 'worker',  -- admin/owner/worker
  source_type TEXT,  -- crm_worker/crm_contact/system
  source_id TEXT,    -- CRM 中的原始 ID
  
  -- 登入相關
  session_token TEXT,
  last_login DATETIME,
  is_active INTEGER DEFAULT 1,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. 工班主檔
-- =====================================================
DROP TABLE IF EXISTS teams;
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. 施工進度表
-- =====================================================
DROP TABLE IF EXISTS construction_progress;
CREATE TABLE construction_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  site_id TEXT NOT NULL,       -- CRM 的案場 ID
  team_id TEXT,                -- 實際施工的工班
  
  -- 施工資訊
  status TEXT DEFAULT 'pending',  -- pending/in_progress/completed
  worker_name TEXT,
  construction_date DATE,
  construction_area REAL,
  
  -- 照片 (R2 URL)
  before_photo_url TEXT,
  after_photo_url TEXT,
  floor_plan_url TEXT,
  
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- =====================================================
-- 7. 活動日誌
-- =====================================================
DROP TABLE IF EXISTS project_activity_logs;
CREATE TABLE project_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT,
  action_type TEXT,     -- create/update/delete/sync
  target_type TEXT,     -- project/team/site/progress
  target_id TEXT,
  changes TEXT,         -- JSON: 變更內容
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- =====================================================
-- 索引優化
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_projects_opportunity ON projects(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_team ON project_members(team_id);
CREATE INDEX IF NOT EXISTS idx_members_type ON project_members(member_type);
CREATE INDEX IF NOT EXISTS idx_assignments_project ON project_team_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON project_team_assignments(status);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(global_role);
CREATE INDEX IF NOT EXISTS idx_progress_project ON construction_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_site ON construction_progress(site_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON project_activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON project_activity_logs(created_at);

-- =====================================================
-- 觸發器：自動更新 updated_at
-- =====================================================
CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
AFTER UPDATE ON projects
BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_members_timestamp 
AFTER UPDATE ON project_members
BEGIN
  UPDATE project_members SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_assignments_timestamp 
AFTER UPDATE ON project_team_assignments
BEGIN
  UPDATE project_team_assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_progress_timestamp 
AFTER UPDATE ON construction_progress
BEGIN
  UPDATE construction_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;