-- Engineering Management Database Schema V2
-- 可擴充的資料庫設計，支援未來新增工種

-- ========================================
-- 系統級定義表 (System Tables)
-- ========================================

-- 1. 工程類型定義表
CREATE TABLE IF NOT EXISTS engineering_types (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- SPC, CABINET, TILE, PAINT等
  name TEXT NOT NULL, -- 石塑地板, 浴櫃, 磁磚, 油漆等
  description TEXT,
  icon TEXT, -- 圖標符號或URL
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 工班定義表
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, -- 工班名稱
  company_name TEXT, -- 公司名稱
  specialties TEXT, -- JSON陣列，專長工種 ["SPC", "CABINET"]
  contact_phone TEXT,
  contact_person TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 欄位定義表
CREATE TABLE IF NOT EXISTS field_definitions (
  id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL, -- object_8W9cb__c等
  field_code TEXT NOT NULL, -- field_3T38o__c等
  field_name TEXT NOT NULL, -- 平面圖, 施工日期等
  field_type TEXT NOT NULL, -- image, text, date, number, boolean, select
  engineering_type_code TEXT, -- 適用的工種，NULL表示通用
  display_order INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(object_type, field_code)
);

-- ========================================
-- 用戶與權限表 (User & Permission Tables)
-- ========================================

-- 4. 用戶表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL, -- 手機號碼作為登入帳號
  password_hash TEXT NOT NULL, -- 密碼hash
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'worker', -- admin, manager, leader, worker
  team_id TEXT, -- 所屬工班
  is_active INTEGER DEFAULT 1,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- ========================================
-- 專案相關表 (Project Tables)
-- ========================================

-- 5. 專案主表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL, -- 關聯到CRM商機
  name TEXT NOT NULL,
  company_name TEXT,
  company_id TEXT,
  status TEXT DEFAULT 'active', -- active, pending, completed, archived
  cross_view_enabled INTEGER DEFAULT 0, -- 工班是否可互看進度
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 6. 專案工程類型
CREATE TABLE IF NOT EXISTS project_engineering_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  engineering_type_code TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 1,
  site_count INTEGER DEFAULT 0, -- 案場數量
  team_count INTEGER DEFAULT 0, -- 工班數量
  completed_count INTEGER DEFAULT 0, -- 已完成數量
  progress_percentage REAL DEFAULT 0, -- 進度百分比
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (engineering_type_code) REFERENCES engineering_types(code),
  UNIQUE(project_id, engineering_type_code)
);

-- 7. 專案工班分配
CREATE TABLE IF NOT EXISTS project_team_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  engineering_type_code TEXT NOT NULL,
  leader_user_id TEXT,
  leader_name TEXT,
  leader_phone TEXT,
  assigned_sites TEXT, -- JSON陣列，分配的案場ID列表
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (engineering_type_code) REFERENCES engineering_types(code),
  FOREIGN KEY (leader_user_id) REFERENCES users(id),
  UNIQUE(project_id, team_id, engineering_type_code)
);

-- 8. 專案業主
CREATE TABLE IF NOT EXISTS project_owners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  contact_id TEXT, -- CRM聯絡人ID
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  is_primary INTEGER DEFAULT 0, -- 是否主要聯絡人
  permissions TEXT, -- JSON，特定權限設定
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 9. 專案權限
CREATE TABLE IF NOT EXISTS project_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission_type TEXT NOT NULL, -- view, edit, manage
  scope TEXT DEFAULT 'all', -- all, specific_engineering, specific_sites
  scope_details TEXT, -- JSON，具體範圍詳情
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(project_id, user_id, permission_type)
);

-- 10. 專案欄位權限
CREATE TABLE IF NOT EXISTS project_field_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  field_code TEXT NOT NULL,
  can_worker_edit INTEGER DEFAULT 0,
  can_owner_edit INTEGER DEFAULT 0,
  can_admin_edit INTEGER DEFAULT 1,
  custom_rules TEXT, -- JSON，自定義規則
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, field_code)
);

-- ========================================
-- 活動與統計表 (Activity & Statistics Tables)
-- ========================================

-- 11. 專案活動日誌
CREATE TABLE IF NOT EXISTS project_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT,
  action_type TEXT NOT NULL, -- create, update, delete, complete, assign, permission_change
  target_type TEXT, -- site, team, permission, field
  target_id TEXT,
  changes TEXT, -- JSON，變更內容
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 12. 專案統計快取
CREATE TABLE IF NOT EXISTS project_statistics_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  stats_type TEXT NOT NULL, -- overall, by_engineering, by_team, by_date
  stats_data TEXT NOT NULL, -- JSON，統計數據
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, stats_type)
);

-- 13. 登入記錄
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

-- ========================================
-- 索引優化 (Indexes)
-- ========================================

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_project_engineering_types_project ON project_engineering_types(project_id);
CREATE INDEX idx_project_team_assignments_project ON project_team_assignments(project_id);
CREATE INDEX idx_project_team_assignments_team ON project_team_assignments(team_id);
CREATE INDEX idx_project_permissions_user ON project_permissions(user_id);
CREATE INDEX idx_project_activity_logs_project ON project_activity_logs(project_id);
CREATE INDEX idx_project_activity_logs_created ON project_activity_logs(created_at);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_team ON users(team_id);

-- ========================================
-- 初始數據 (Initial Data)
-- ========================================

-- 插入預設工程類型
INSERT OR IGNORE INTO engineering_types (id, code, name, description, icon, display_order) VALUES
  ('et_001', 'SPC', 'SPC 石塑地板', '石塑複合地板工程', '🏗️', 1),
  ('et_002', 'CABINET', '浴櫃工程', '浴室櫃體安裝工程', '🚿', 2),
  ('et_003', 'TILE', '磁磚工程', '磁磚鋪設工程', '🏢', 3),
  ('et_004', 'PAINT', '油漆工程', '室內外油漆工程', '🎨', 4),
  ('et_005', 'ELECTRIC', '水電工程', '水電管線配置', '⚡', 5);

-- 插入預設工班（範例）
INSERT OR IGNORE INTO teams (id, name, company_name, specialties, contact_phone) VALUES
  ('team_001', '王大誠工班', '王大誠工班', '["SPC"]', '0912345678'),
  ('team_002', '塔塔家建材有限公司', '塔塔家建材有限公司', '["SPC", "CABINET"]', '0923456789'),
  ('team_003', '築愛家有限公司', '築愛家有限公司', '["SPC"]', '0934567890'),
  ('team_004', '莊聰源師傅/菲米裝潢工程行', '菲米裝潢工程行', '["SPC", "CABINET"]', '0945678901');

-- 插入預設欄位定義（SPC相關）
INSERT OR IGNORE INTO field_definitions (id, object_type, field_code, field_name, field_type, engineering_type_code, display_order) VALUES
  ('fd_001', 'object_8W9cb__c', 'field_3T38o__c', '平面圖', 'image', 'SPC', 1),
  ('fd_002', 'object_8W9cb__c', 'field_u1wpv__c', '工班師父', 'text', 'SPC', 2),
  ('fd_003', 'object_8W9cb__c', 'field_sF6fn__c', '施工前備註', 'text', 'SPC', 3),
  ('fd_004', 'object_8W9cb__c', 'field_23pFq__c', '施工日期', 'date', 'SPC', 4),
  ('fd_005', 'object_8W9cb__c', 'field_V3d91__c', '施工前照片', 'image', 'SPC', 5),
  ('fd_006', 'object_8W9cb__c', 'field_B2gh1__c', '舖設坪數', 'number', 'SPC', 6),
  ('fd_007', 'object_8W9cb__c', 'field_f0mz3__c', '保固日期', 'date', 'SPC', 7),
  ('fd_008', 'object_8W9cb__c', 'field_sijGR__c', '維修備註1', 'text', 'SPC', 8),
  ('fd_009', 'object_8W9cb__c', 'field_1zk34__c', '缺失影片', 'file', 'SPC', 9),
  ('fd_010', 'object_8W9cb__c', 'field_V32Xl__c', '工班備註', 'text', 'SPC', 10),
  ('fd_011', 'object_8W9cb__c', 'construction_completed__c', '施工完成', 'boolean', 'SPC', 11),
  ('fd_012', 'object_8W9cb__c', 'field_3Fqof__c', '完工照片', 'image', 'SPC', 12),
  ('fd_013', 'object_8W9cb__c', 'field_n37jC__c', '驗收備註', 'text', 'SPC', 13),
  ('fd_014', 'object_8W9cb__c', 'field_23Z5i__c', '標籤', 'select', 'SPC', 14),
  ('fd_015', 'object_8W9cb__c', 'field_g18hX__c', '工地備註', 'text', 'SPC', 15),
  ('fd_016', 'object_8W9cb__c', 'field_tXAko__c', '工地坪數', 'number', 'SPC', 16),
  ('fd_017', 'object_8W9cb__c', 'field_z9H6O__c', '階段', 'select', 'SPC', 17),
  ('fd_018', 'object_8W9cb__c', 'field_W2i6j__c', '施工前缺失', 'image', 'SPC', 18);

-- 插入預設管理員用戶
INSERT OR IGNORE INTO users (id, phone, password_hash, name, role, is_active) VALUES
  ('admin_001', '0900000000', '$2a$10$YourHashedPasswordHere', '系統管理員', 'admin', 1);