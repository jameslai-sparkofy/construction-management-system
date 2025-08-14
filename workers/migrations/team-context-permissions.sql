-- ====================================
-- 基於工班上下文的權限系統
-- 案場 → 工班 → 用戶角色
-- ====================================

-- 1. 統一用戶表（保持不變）
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    user_type TEXT NOT NULL, -- admin/owner/worker
    source_id TEXT, -- CRM ID reference
    password_suffix TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 專案表
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    opportunity_id TEXT,
    opportunity_name TEXT,
    project_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 工班表
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL, -- 泥作工班、水電工班等
    type TEXT, -- masonry, plumbing, electrical, etc
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 4. 工班成員表（用戶在工班中的角色）
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL, -- leader/member
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(team_id, user_id) -- 一個人在一個工班只能有一個角色
);

-- 5. 案場表（從 CRM 同步）
CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    site_code TEXT, -- 案場編號
    building TEXT, -- 棟別
    floor TEXT, -- 樓層
    unit TEXT, -- 戶別
    area REAL, -- 坪數
    team_id TEXT, -- 分配給哪個工班（shift_time__c in CRM）
    status TEXT, -- pending/in_progress/completed
    completed_date DATE,
    completed_by_user_id TEXT, -- 完成的師傅
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (completed_by_user_id) REFERENCES users(id)
);

-- 6. 創建視圖：用戶在特定案場的權限（基於工班上下文）
CREATE VIEW IF NOT EXISTS user_site_permissions AS
SELECT 
    s.id as site_id,
    s.project_id,
    s.team_id,
    t.name as team_name,
    u.id as user_id,
    u.name as user_name,
    u.phone as user_phone,
    u.user_type,
    tm.role as team_role,
    -- 權限基於在該工班的角色
    CASE 
        WHEN u.user_type = 'admin' THEN 1  -- Admin 可看所有
        WHEN u.user_type = 'owner' THEN 1  -- 業主可看所有
        WHEN tm.role = 'leader' THEN 1     -- 工班長可看自己工班
        WHEN tm.role = 'member' THEN 1     -- 成員可看自己工班
        ELSE 0
    END as can_view,
    CASE 
        WHEN u.user_type = 'admin' THEN 1
        WHEN tm.role = 'leader' THEN 1     -- 工班長可編輯
        WHEN tm.role = 'member' THEN 1     -- 成員可編輯
        ELSE 0
    END as can_edit,
    CASE 
        WHEN u.user_type = 'admin' THEN 1
        WHEN tm.role = 'leader' THEN 1     -- 只有工班長可管理成員
        ELSE 0
    END as can_manage_members,
    CASE 
        WHEN u.user_type = 'admin' THEN 1
        WHEN u.user_type = 'owner' THEN 1  -- 業主可看其他工班
        ELSE 0                              -- 工班成員不能看其他工班
    END as can_view_other_teams
FROM sites s
INNER JOIN teams t ON s.team_id = t.id
LEFT JOIN team_members tm ON t.id = tm.team_id
LEFT JOIN users u ON tm.user_id = u.id

UNION ALL

-- Admin 和 Owner 即使不在工班也有權限
SELECT 
    s.id as site_id,
    s.project_id,
    s.team_id,
    t.name as team_name,
    u.id as user_id,
    u.name as user_name,
    u.phone as user_phone,
    u.user_type,
    NULL as team_role,
    1 as can_view,           -- 可查看
    CASE 
        WHEN u.user_type = 'admin' THEN 1
        ELSE 0
    END as can_edit,
    CASE 
        WHEN u.user_type = 'admin' THEN 1
        ELSE 0
    END as can_manage_members,
    1 as can_view_other_teams
FROM sites s
INNER JOIN teams t ON s.team_id = t.id
CROSS JOIN users u
WHERE u.user_type IN ('admin', 'owner');

-- 7. 插入測試資料
-- 測試專案
INSERT OR REPLACE INTO projects (id, name, project_code) VALUES
('proj_001', '台北建案', 'TPE-2025-001');

-- 測試工班
INSERT OR REPLACE INTO teams (id, project_id, name, type) VALUES
('team_A', 'proj_001', '泥作工班A', 'masonry'),
('team_B', 'proj_001', '水電工班B', 'plumbing');

-- 測試用戶
INSERT OR REPLACE INTO users (id, phone, name, user_type, password_suffix) VALUES
('admin_001', '0900000001', '系統管理員', 'admin', '001'),
('owner_001', '0987654321', '王業主', 'owner', '321'),
('worker_001', '0912345678', '張師傅', 'worker', '678'),
('worker_002', '0955555555', '李師傅', 'worker', '555'),
('worker_003', '0911111111', '陳師傅', 'worker', '111');

-- 張師傅：A工班長 + B工班成員
INSERT OR REPLACE INTO team_members (id, team_id, user_id, role) VALUES
('tm_001', 'team_A', 'worker_001', 'leader'),  -- 張師傅是A工班長
('tm_002', 'team_B', 'worker_001', 'member');  -- 張師傅是B工班成員

-- 李師傅：B工班長
INSERT OR REPLACE INTO team_members (id, team_id, user_id, role) VALUES
('tm_003', 'team_B', 'worker_002', 'leader');

-- 陳師傅：A工班成員
INSERT OR REPLACE INTO team_members (id, team_id, user_id, role) VALUES
('tm_004', 'team_A', 'worker_003', 'member');

-- 測試案場
INSERT OR REPLACE INTO sites (id, project_id, site_code, building, floor, unit, area, team_id, status) VALUES
('site_001', 'proj_001', 'A-1F-01', 'A棟', '1F', '01', 25.5, 'team_A', 'pending'),  -- 分配給A工班
('site_002', 'proj_001', 'A-1F-02', 'A棟', '1F', '02', 30.0, 'team_A', 'pending'),  -- 分配給A工班
('site_003', 'proj_001', 'B-2F-01', 'B棟', '2F', '01', 28.0, 'team_B', 'pending'),  -- 分配給B工班
('site_004', 'proj_001', 'B-2F-02', 'B棟', '2F', '02', 32.0, 'team_B', 'pending');  -- 分配給B工班

-- 8. 查詢範例：張師傅在不同案場的權限
-- 在 A工班的案場（site_001, site_002）：張師傅是工班長，有完整權限
-- 在 B工班的案場（site_003, site_004）：張師傅是成員，只有基本權限

SELECT 
    site_id,
    team_name,
    team_role,
    can_view,
    can_edit,
    can_manage_members,
    can_view_other_teams
FROM user_site_permissions 
WHERE user_id = 'worker_001'
ORDER BY site_id;

-- 結果應該是：
-- site_001 | 泥作工班A | leader | 1 | 1 | 1 | 0  （A工班案場，他是工班長）
-- site_002 | 泥作工班A | leader | 1 | 1 | 1 | 0  （A工班案場，他是工班長）
-- site_003 | 水電工班B | member | 1 | 1 | 0 | 0  （B工班案場，他是成員）
-- site_004 | 水電工班B | member | 1 | 1 | 0 | 0  （B工班案場，他是成員）