-- ====================================
-- 專案用戶管理系統
-- 整合來自三個來源的用戶
-- ====================================

-- 1. 移除舊的 teams 和 team_members 表（如果存在）
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP VIEW IF EXISTS user_site_permissions;

-- 2. 創建專案用戶表（統一管理所有類型用戶）
CREATE TABLE IF NOT EXISTS project_users (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,              -- 來源系統的ID
    user_type TEXT NOT NULL,            -- admin/owner/worker
    user_role TEXT,                     -- leader/member (僅對worker有效)
    source_table TEXT NOT NULL,         -- employees_simple/object_50hj8__c/newopportunitycontactsobj
    source_record TEXT,                 -- JSON: 原始記錄資料
    phone TEXT,
    name TEXT,
    password_suffix TEXT,               -- 密碼後綴（通常是電話末3碼）
    email TEXT,
    is_active INTEGER DEFAULT 1,
    permissions TEXT,                   -- JSON: 特定權限設定
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,                    -- 誰添加的這個用戶
    UNIQUE(project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 3. 創建索引
CREATE INDEX IF NOT EXISTS idx_project_users_project ON project_users(project_id);
CREATE INDEX IF NOT EXISTS idx_project_users_type ON project_users(user_type);
CREATE INDEX IF NOT EXISTS idx_project_users_role ON project_users(user_role);
CREATE INDEX IF NOT EXISTS idx_project_users_phone ON project_users(phone);
CREATE INDEX IF NOT EXISTS idx_project_users_active ON project_users(is_active);

-- 4. 創建工班分配視圖（基於案場的動態工班關係）
CREATE VIEW IF NOT EXISTS user_team_assignments AS
SELECT 
    pu.project_id,
    pu.user_id,
    pu.name as user_name,
    pu.phone as user_phone,
    pu.user_type,
    pu.user_role,
    s.shift_time__c as team_id,           -- 工班ID/名稱
    s.field_1P96q__c as opportunity_id,   -- 商機ID
    COUNT(DISTINCT s._id) as assigned_sites_count,
    -- 權限判斷
    CASE 
        WHEN pu.user_type = 'admin' THEN 1
        WHEN pu.user_type = 'owner' THEN 1
        WHEN pu.user_type = 'worker' THEN 1  -- worker可以查看自己工班的所有案場
        ELSE 0
    END as can_view,
    CASE 
        WHEN pu.user_type = 'admin' THEN 1
        WHEN pu.user_type = 'worker' THEN 1  -- worker可以編輯自己工班的案場
        ELSE 0
    END as can_edit,
    CASE 
        WHEN pu.user_type = 'admin' THEN 1
        WHEN pu.user_role = 'leader' THEN 1  -- 只有leader可以管理成員
        ELSE 0
    END as can_manage_members
FROM project_users pu
LEFT JOIN object_8w9cb__c s ON (
    -- Worker 透過 field_u1wpv__c (工班師父) 欄位關聯
    (pu.user_type = 'worker' AND s.field_u1wpv__c = pu.user_id)
    -- 或者透過 shift_time__c 關聯（如果有明確的工班ID）
    OR (pu.user_type = 'worker' AND s.shift_time__c IN (
        SELECT DISTINCT shift_time__c 
        FROM object_8w9cb__c 
        WHERE field_u1wpv__c = pu.user_id
    ))
)
WHERE s.is_deleted = 0
GROUP BY pu.project_id, pu.user_id, s.shift_time__c;

-- 5. 創建用戶權限視圖（簡化權限檢查）
CREATE VIEW IF NOT EXISTS user_permissions AS
SELECT 
    pu.project_id,
    pu.user_id,
    pu.name,
    pu.user_type,
    pu.user_role,
    -- 全局權限
    CASE 
        WHEN pu.user_type = 'admin' THEN 1
        WHEN pu.user_type = 'owner' THEN 1
        ELSE 0
    END as can_view_all,
    CASE 
        WHEN pu.user_type = 'admin' THEN 1
        ELSE 0
    END as can_edit_all,
    CASE 
        WHEN pu.user_type = 'admin' THEN 1
        WHEN pu.user_role = 'leader' THEN 1
        ELSE 0
    END as can_add_members,
    CASE 
        WHEN pu.user_type = 'admin' THEN 1
        WHEN pu.user_role = 'leader' THEN 1
        ELSE 0
    END as can_add_leaders,
    -- 工班相關權限
    CASE 
        WHEN pu.user_type = 'worker' THEN 1
        ELSE 0
    END as is_team_member,
    pu.permissions as custom_permissions
FROM project_users pu
WHERE pu.is_active = 1;

-- 6. 創建來源用戶表（模擬 CRM 的三個來源表）
-- 這些表應該從 CRM 同步，這裡只是示例結構

-- 員工表（管理員來源）
CREATE TABLE IF NOT EXISTS employees_simple (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    department TEXT,
    position TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 工地師父表（工人來源）- 已存在 object_50hj8__c

-- 商機聯絡人表（業主來源）
CREATE TABLE IF NOT EXISTS newopportunitycontactsobj (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    contact_role TEXT,  -- 決策者/影響者/使用者等
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. 插入測試資料
-- 測試專案
INSERT OR REPLACE INTO projects (id, opportunity_id, name, status) VALUES
('proj_001', 'opp_001', '台北建案', 'active');

-- 測試員工（管理員）
INSERT OR REPLACE INTO employees_simple (id, name, phone, email, department) VALUES
('emp_001', '系統管理員', '0900000001', 'admin@example.com', 'IT部門'),
('emp_002', '專案經理', '0900000002', 'pm@example.com', '工程部');

-- 測試工地師父（工人）
INSERT OR REPLACE INTO object_50hj8__c (_id, name) VALUES
('worker_001', '張師傅'),
('worker_002', '李師傅'),
('worker_003', '陳師傅'),
('worker_004', '王師傅');

-- 測試商機聯絡人（業主）
INSERT OR REPLACE INTO newopportunitycontactsobj (id, opportunity_id, contact_name, contact_phone, contact_role) VALUES
('owner_001', 'opp_001', '王業主', '0987654321', '決策者'),
('owner_002', 'opp_001', '林業主', '0987654322', '影響者');

-- 將用戶加入專案
INSERT OR REPLACE INTO project_users (
    id, project_id, user_id, user_type, user_role, source_table, 
    phone, name, password_suffix, created_by
) VALUES
-- 管理員
('pu_001', 'proj_001', 'emp_001', 'admin', NULL, 'employees_simple', 
 '0900000001', '系統管理員', '001', 'system'),
 
-- 業主
('pu_002', 'proj_001', 'owner_001', 'owner', NULL, 'newopportunitycontactsobj',
 '0987654321', '王業主', '321', 'emp_001'),
 
-- 工人（領班）
('pu_003', 'proj_001', 'worker_001', 'worker', 'leader', 'object_50hj8__c',
 '0912345678', '張師傅', '678', 'emp_001'),
 
-- 工人（成員）
('pu_004', 'proj_001', 'worker_002', 'worker', 'member', 'object_50hj8__c',
 '0955555555', '李師傅', '555', 'worker_001'),  -- 由張師傅（領班）加入

('pu_005', 'proj_001', 'worker_003', 'worker', 'member', 'object_50hj8__c',
 '0911111111', '陳師傅', '111', 'worker_001');  -- 由張師傅（領班）加入

-- 8. 測試案場資料（分配工班）
UPDATE object_8w9cb__c 
SET shift_time__c = 'team_A', field_u1wpv__c = 'worker_001'
WHERE _id IN ('site_001', 'site_002');

UPDATE object_8w9cb__c 
SET shift_time__c = 'team_B', field_u1wpv__c = 'worker_002'
WHERE _id IN ('site_003', 'site_004');

-- 9. 查詢範例

-- 查看專案中的所有用戶及其權限
SELECT 
    name,
    user_type,
    user_role,
    can_view_all,
    can_add_members,
    can_add_leaders
FROM user_permissions
WHERE project_id = 'proj_001';

-- 查看工人的工班分配情況
SELECT 
    user_name,
    user_role,
    team_id,
    assigned_sites_count,
    can_manage_members
FROM user_team_assignments
WHERE project_id = 'proj_001' AND user_type = 'worker';