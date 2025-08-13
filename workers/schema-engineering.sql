-- Engineering Management Database Schema
-- 這是專案自己的資料庫，獨立於 CRM 資料庫

-- 1. 專案表 (Project)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL, -- 關聯到 fx-crm-database 的 newopportunityobj
  name TEXT NOT NULL,
  spc_engineering TEXT, -- JSON 儲存 SPC 工程設定
  cabinet_engineering TEXT, -- JSON 儲存浴櫃工程設定
  maintenance TEXT, -- JSON 儲存維修單設定
  progress_management TEXT, -- JSON 儲存進度管理公告設定
  permissions TEXT, -- JSON 儲存權限設定
  cached_stats TEXT, -- JSON 儲存計算後的統計資料 (building_count, unit_count, completion_rate)
  stats_updated_at DATETIME, -- 統計資料最後更新時間
  status TEXT DEFAULT 'active', -- active/completed/pending
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 使用者表 (USER)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL, -- 手機號碼作為登入 ID
  password_suffix TEXT NOT NULL, -- 手機末3碼作為密碼
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'member', -- admin/owner/leader/member
  user_projects TEXT, -- JSON 陣列儲存使用者可存取的專案
  session_token TEXT,
  last_login DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 專案權限表 (關聯表)
CREATE TABLE IF NOT EXISTS project_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- admin/owner/leader/member
  engineering_type TEXT, -- SPC/CABINET/ALL
  can_edit INTEGER DEFAULT 0,
  can_view_others INTEGER DEFAULT 0, -- 是否可以看到其他工班進度
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(project_id, user_id, engineering_type)
);

-- 4. 施工進度表 (本地快取)
CREATE TABLE IF NOT EXISTS construction_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  site_id TEXT NOT NULL, -- 關聯到 fx-crm-database 的 object_8w9cb__c
  engineering_type TEXT NOT NULL, -- SPC/CABINET
  status TEXT DEFAULT 'pending', -- pending/in_progress/completed
  before_photo_url TEXT,
  after_photo_url TEXT,
  floor_plan_url TEXT,
  construction_area REAL,
  construction_date DATE,
  worker_id TEXT,
  worker_name TEXT,
  notes TEXT,
  external_display_name TEXT, -- 外部顯示名稱
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (worker_id) REFERENCES users(id)
);

-- 5. 登入記錄表
CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  phone TEXT,
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. 專案活動記錄表
CREATE TABLE IF NOT EXISTS project_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT,
  activity_type TEXT, -- create/update/delete/complete
  target_type TEXT, -- site/permission/photo
  target_id TEXT,
  description TEXT,
  metadata TEXT, -- JSON 儲存額外資料
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 建立索引優化查詢效能
CREATE INDEX IF NOT EXISTS idx_projects_opportunity ON projects(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_permissions_project ON project_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON project_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_project ON construction_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_site ON construction_progress(site_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON project_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON project_activities(created_at);

-- 觸發器：自動更新 updated_at
CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
AFTER UPDATE ON projects
BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
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