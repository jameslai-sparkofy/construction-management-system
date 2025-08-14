-- ====================================
-- 統一用戶管理系統
-- 支援多重角色但權限自動合併
-- ====================================

-- 1. 統一用戶表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    user_type TEXT NOT NULL, -- admin/owner/worker
    source_id TEXT, -- CRM ID reference (object_50HJ8__c for workers, etc)
    password_suffix TEXT, -- 密碼後綴（電話末3碼）
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 用戶專案角色表（支援一個用戶在專案中有多個角色）
CREATE TABLE IF NOT EXISTS user_project_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    role TEXT NOT NULL, -- admin/owner/foreman/worker
    team_id TEXT, -- 所屬工班（如果是工班相關角色）
    team_name TEXT, -- 工班名稱
    team_role TEXT, -- leader/member（在工班中的角色）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    UNIQUE(user_id, project_id, role, team_id) -- 避免重複角色
);

-- 3. 創建索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_user_roles_user ON user_project_roles(user_id);
CREATE INDEX idx_user_roles_project ON user_project_roles(project_id);
CREATE INDEX idx_user_roles_composite ON user_project_roles(user_id, project_id);

-- 4. 插入測試用戶
-- 管理員
INSERT OR REPLACE INTO users (id, phone, name, user_type, password_suffix) VALUES
('admin_001', '0900000001', '系統管理員', 'admin', '001'),
('admin_002', '0900000002', '副管理員', 'admin', '002');

-- 業主
INSERT OR REPLACE INTO users (id, phone, name, user_type, source_id, password_suffix) VALUES
('owner_001', '0987654321', '王業主', 'owner', 'contact_001', '321'),
('owner_002', '0987654322', '李業主', 'owner', 'contact_002', '322');

-- 工人（包含工班長）
INSERT OR REPLACE INTO users (id, phone, name, user_type, source_id, password_suffix) VALUES
('worker_001', '0912345678', '張師傅', 'worker', 'worker_crm_001', '678'),
('worker_002', '0955555555', '李師傅', 'worker', 'worker_crm_002', '555'),
('worker_003', '0911111111', '陳師傅', 'worker', 'worker_crm_003', '111'),
('worker_004', '0922222222', '林師傅', 'worker', 'worker_crm_004', '222');

-- 5. 設定測試專案角色
-- 專案 test-project-001 的角色分配

-- 管理員（擁有所有權限）
INSERT OR REPLACE INTO user_project_roles (id, user_id, project_id, role) VALUES
('role_001', 'admin_001', 'test-project-001', 'admin');

-- 業主（可查看所有工班）
INSERT OR REPLACE INTO user_project_roles (id, user_id, project_id, role) VALUES
('role_002', 'owner_001', 'test-project-001', 'owner');

-- 張師傅：泥作工班長 + 水電工班成員（多重角色範例）
INSERT OR REPLACE INTO user_project_roles (id, user_id, project_id, role, team_id, team_name, team_role) VALUES
('role_003', 'worker_001', 'test-project-001', 'foreman', 'team_001', '泥作工班', 'leader'),
('role_004', 'worker_001', 'test-project-001', 'worker', 'team_002', '水電工班', 'member');

-- 李師傅：水電工班長
INSERT OR REPLACE INTO user_project_roles (id, user_id, project_id, role, team_id, team_name, team_role) VALUES
('role_005', 'worker_002', 'test-project-001', 'foreman', 'team_002', '水電工班', 'leader');

-- 陳師傅：泥作工班成員
INSERT OR REPLACE INTO user_project_roles (id, user_id, project_id, role, team_id, team_name, team_role) VALUES
('role_006', 'worker_003', 'test-project-001', 'worker', 'team_001', '泥作工班', 'member');

-- 林師傅：水電工班成員
INSERT OR REPLACE INTO user_project_roles (id, user_id, project_id, role, team_id, team_name, team_role) VALUES
('role_007', 'worker_004', 'test-project-001', 'worker', 'team_002', '水電工班', 'member');

-- 6. 創建視圖：合併用戶的多重角色權限
CREATE VIEW IF NOT EXISTS user_combined_permissions AS
SELECT 
    u.id as user_id,
    u.phone,
    u.name,
    u.user_type,
    upr.project_id,
    -- 角色聯集（取最高權限）
    MAX(CASE 
        WHEN upr.role = 'admin' THEN 4
        WHEN upr.role = 'owner' THEN 3
        WHEN upr.role = 'foreman' THEN 2
        WHEN upr.role = 'worker' THEN 1
        ELSE 0
    END) as highest_role_level,
    -- 權限聯集（任一角色有權限就有）
    MAX(CASE 
        WHEN upr.role IN ('admin') THEN 1 
        ELSE 0 
    END) as is_admin,
    MAX(CASE 
        WHEN upr.role IN ('admin', 'owner', 'foreman', 'worker') THEN 1 
        ELSE 0 
    END) as can_view,
    MAX(CASE 
        WHEN upr.role IN ('admin', 'foreman', 'worker') THEN 1 
        ELSE 0 
    END) as can_edit,
    MAX(CASE 
        WHEN upr.role IN ('admin', 'foreman') THEN 1 
        ELSE 0 
    END) as can_manage_members,
    MAX(CASE 
        WHEN upr.role IN ('admin', 'owner') THEN 1 
        ELSE 0 
    END) as can_view_other_teams,
    -- 所有角色和工班列表
    GROUP_CONCAT(DISTINCT upr.role) as all_roles,
    GROUP_CONCAT(DISTINCT upr.team_name) as all_teams
FROM users u
LEFT JOIN user_project_roles upr ON u.id = upr.user_id
GROUP BY u.id, u.phone, u.name, u.user_type, upr.project_id;

-- 7. 查詢範例：獲取用戶在專案中的合併權限
-- 例如張師傅在 test-project-001 中既是泥作工班長又是水電工班成員
-- 他將獲得工班長級別的權限（can_manage_members = 1）
SELECT * FROM user_combined_permissions 
WHERE user_id = 'worker_001' AND project_id = 'test-project-001';