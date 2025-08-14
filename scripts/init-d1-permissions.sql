-- ====================================
-- 初始化 D1 工程管理資料庫測試資料
-- 在 Cloudflare D1 執行
-- ====================================

-- 1. 建立測試專案
INSERT OR REPLACE INTO projects (
    id,
    name,
    opportunity_id,
    opportunity_name,
    project_code,
    created_at,
    updated_at
) VALUES (
    'test-project-001',
    '測試專案 - 台北建案',
    'opp_001',
    '台北建案商機',
    'PRJ-2025-001',
    datetime('now'),
    datetime('now')
);

-- 2. 建立用戶權限記錄
-- 管理員權限（所有權限）
INSERT OR REPLACE INTO project_permissions (
    id,
    project_id,
    user_id,
    name,
    phone,
    email,
    role,
    can_view,
    can_edit,
    can_manage_members,
    can_view_other_teams,
    created_at,
    updated_at
) VALUES (
    'perm_admin_001',
    'test-project-001',
    'admin_001',
    '系統管理員',
    '0900000001',
    '0900000001@construction.local',
    'admin',
    1, -- can_view
    1, -- can_edit
    1, -- can_manage_members
    1, -- can_view_other_teams
    datetime('now'),
    datetime('now')
);

-- 工班負責人權限
INSERT OR REPLACE INTO project_permissions (
    id,
    project_id,
    user_id,
    name,
    phone,
    email,
    role,
    can_view,
    can_edit,
    can_manage_members,
    can_view_other_teams,
    created_at,
    updated_at
) VALUES (
    'perm_foreman_001',
    'test-project-001',
    'foreman_001',
    '張工班長',
    '0912345678',
    '0912345678@construction.local',
    'foreman',
    1, -- can_view
    1, -- can_edit
    1, -- can_manage_members
    0, -- can_view_other_teams
    datetime('now'),
    datetime('now')
);

-- 業主權限（只能查看）
INSERT OR REPLACE INTO project_permissions (
    id,
    project_id,
    user_id,
    name,
    phone,
    email,
    role,
    can_view,
    can_edit,
    can_manage_members,
    can_view_other_teams,
    created_at,
    updated_at
) VALUES (
    'perm_owner_001',
    'test-project-001',
    'owner_001',
    '王業主',
    '0987654321',
    '0987654321@construction.local',
    'owner',
    1, -- can_view
    0, -- can_edit
    0, -- can_manage_members
    1, -- can_view_other_teams
    datetime('now'),
    datetime('now')
);

-- 工班成員權限
INSERT OR REPLACE INTO project_permissions (
    id,
    project_id,
    user_id,
    name,
    phone,
    email,
    role,
    can_view,
    can_edit,
    can_manage_members,
    can_view_other_teams,
    created_at,
    updated_at
) VALUES (
    'perm_worker_001',
    'test-project-001',
    'worker_001',
    '李師傅',
    '0955555555',
    '0955555555@construction.local',
    'worker',
    1, -- can_view
    1, -- can_edit
    0, -- can_manage_members
    0, -- can_view_other_teams
    datetime('now'),
    datetime('now')
);

-- 3. 建立測試工班
INSERT OR REPLACE INTO teams (
    id,
    project_id,
    name,
    leader_name,
    leader_phone,
    type,
    created_at,
    updated_at
) VALUES 
(
    'team_001',
    'test-project-001',
    '泥作工班',
    '張工班長',
    '0912345678',
    'masonry',
    datetime('now'),
    datetime('now')
),
(
    'team_002',
    'test-project-001',
    '水電工班',
    '李師傅',
    '0955555555',
    'plumbing',
    datetime('now'),
    datetime('now')
);

-- 4. 建立工班成員
INSERT OR REPLACE INTO team_members (
    id,
    team_id,
    name,
    phone,
    role,
    created_at
) VALUES 
(
    'member_001',
    'team_001',
    '張工班長',
    '0912345678',
    'leader',
    datetime('now')
),
(
    'member_002',
    'team_001',
    '陳師傅',
    '0911111111',
    'member',
    datetime('now')
),
(
    'member_003',
    'team_002',
    '李師傅',
    '0955555555',
    'leader',
    datetime('now')
),
(
    'member_004',
    'team_002',
    '林師傅',
    '0922222222',
    'member',
    datetime('now')
);

-- 5. 建立測試進度記錄
INSERT OR REPLACE INTO progress_reports (
    id,
    project_id,
    team_id,
    date,
    description,
    status,
    created_by,
    created_at
) VALUES 
(
    'progress_001',
    'test-project-001',
    'team_001',
    date('now'),
    '完成一樓地坪整平',
    'completed',
    'foreman_001',
    datetime('now')
),
(
    'progress_002',
    'test-project-001',
    'team_002',
    date('now'),
    '配管工程進行中',
    'in_progress',
    'worker_001',
    datetime('now')
);

-- 6. 驗證資料
SELECT 'Projects' as table_name, COUNT(*) as count FROM projects
UNION ALL
SELECT 'Permissions', COUNT(*) FROM project_permissions
UNION ALL
SELECT 'Teams', COUNT(*) FROM teams
UNION ALL
SELECT 'Team Members', COUNT(*) FROM team_members
UNION ALL
SELECT 'Progress Reports', COUNT(*) FROM progress_reports;

-- 7. 顯示權限設定
SELECT 
    pp.user_id,
    pp.name,
    pp.phone,
    pp.role,
    CASE pp.can_view WHEN 1 THEN '✅' ELSE '❌' END as 'View',
    CASE pp.can_edit WHEN 1 THEN '✅' ELSE '❌' END as 'Edit',
    CASE pp.can_manage_members WHEN 1 THEN '✅' ELSE '❌' END as 'Manage',
    CASE pp.can_view_other_teams WHEN 1 THEN '✅' ELSE '❌' END as 'View Others'
FROM project_permissions pp
WHERE pp.project_id = 'test-project-001'
ORDER BY 
    CASE pp.role 
        WHEN 'admin' THEN 1
        WHEN 'owner' THEN 2
        WHEN 'foreman' THEN 3
        WHEN 'worker' THEN 4
        ELSE 5
    END;