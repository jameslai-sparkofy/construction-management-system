-- Users 表：儲存使用者與專案、工班、角色的關係
-- 每個使用者在不同專案可以有不同角色
-- 帳密認證交給 Supabase 處理

DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 使用者基本資訊
  user_id TEXT NOT NULL,        -- 唯一使用者識別碼（可以是 phone 或 Supabase ID）
  name TEXT NOT NULL,            -- 使用者姓名
  phone TEXT NOT NULL,           -- 電話號碼
  
  -- 專案與角色關係
  project_id TEXT,               -- 關聯的專案 ID（NULL = 全域角色）
  team_id TEXT,                  -- 工班 ID（NULL = 非工班成員，如業主或管理員）
  role TEXT NOT NULL,            -- 角色：admin / owner / team_leader / team_member
  
  -- 額外權限設定
  can_view_other_teams BOOLEAN DEFAULT 0,  -- 是否可查看其他工班
  
  -- 資料來源追蹤
  source_type TEXT,              -- 來源：crm_contact（業主）/ crm_worker（工人）/ system（系統建立）
  source_id TEXT,                -- CRM 中的原始 ID
  
  -- 狀態與時間戳記
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,               -- 建立者
  
  -- 確保同一個使用者在同一專案的同一工班只有一個角色
  UNIQUE(user_id, project_id, team_id)
);

-- 索引優化查詢效能
CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_project_id ON users(project_id);
CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_phone ON users(phone);

-- 範例資料說明：
-- 1. 管理員（全域角色）
-- INSERT INTO users (user_id, name, phone, project_id, team_id, role) 
-- VALUES ('admin_001', '系統管理員', '0900000001', NULL, NULL, 'admin');

-- 2. 業主（特定專案）
-- INSERT INTO users (user_id, name, phone, project_id, team_id, role) 
-- VALUES ('owner_001', '張總經理', '0910000001', 'proj_123', NULL, 'owner');

-- 3. 工班負責人（特定專案的特定工班）
-- INSERT INTO users (user_id, name, phone, project_id, team_id, role) 
-- VALUES ('leader_001', '王工頭', '0920000001', 'proj_123', 'team_a', 'team_leader');

-- 4. 工班成員（特定專案的特定工班）
-- INSERT INTO users (user_id, name, phone, project_id, team_id, role) 
-- VALUES ('member_001', '陳師傅', '0930000001', 'proj_123', 'team_a', 'team_member');