-- ====================================
-- 測試資料設置腳本
-- ====================================

-- 1. 創建測試角色（如果不存在）
INSERT INTO roles (name, description) VALUES 
    ('admin', '系統管理員'),
    ('foreman', '工班負責人'),
    ('worker', '工班成員'),
    ('owner', '業主')
ON CONFLICT (name) DO NOTHING;

-- 2. 創建測試用戶（使用 Supabase Auth）
-- 注意：這些需要通過 Supabase Dashboard 或 API 創建
-- 管理員: admin@test.com / admin123
-- 工班負責人1: foreman1@test.com / foreman123
-- 工班負責人2: foreman2@test.com / foreman123
-- 工班成員1: worker1@test.com / worker123
-- 業主: owner@test.com / owner123

-- 3. 創建測試專案
INSERT INTO projects (id, project_name, project_code, status, start_date) VALUES
    ('test-project-001', '台北101大樓改裝工程', 'TPE101-2024', 'active', '2024-01-01'),
    ('test-project-002', '新竹科學園區辦公室', 'HSP-2024-001', 'active', '2024-02-01')
ON CONFLICT (id) DO UPDATE SET
    project_name = EXCLUDED.project_name,
    status = EXCLUDED.status;

-- 4. 創建測試工班
INSERT INTO teams (id, name, project_id, foreman_id, created_at) VALUES
    (gen_random_uuid(), '泥作工班', 'test-project-001', 
     (SELECT id FROM auth.users WHERE email = 'foreman1@test.com' LIMIT 1), NOW()),
    (gen_random_uuid(), '木工工班', 'test-project-001', 
     (SELECT id FROM auth.users WHERE email = 'foreman2@test.com' LIMIT 1), NOW()),
    (gen_random_uuid(), '水電工班', 'test-project-001', 
     NULL, NOW())
ON CONFLICT DO NOTHING;

-- 5. 創建測試工地師傅
INSERT INTO construction_workers (phone, name, email) VALUES
    ('0912345678', '張師傅', 'worker1@test.com'),
    ('0923456789', '李師傅', 'worker2@test.com'),
    ('0934567890', '王師傅', 'worker3@test.com'),
    ('0945678901', '陳師傅', 'worker4@test.com'),
    ('0956789012', '林師傅', 'worker5@test.com')
ON CONFLICT (phone) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;

-- 6. 將工地師傅加入工班
DO $$
DECLARE
    team1_id UUID;
    team2_id UUID;
    worker1_id UUID;
    worker2_id UUID;
    worker3_id UUID;
BEGIN
    -- 獲取工班ID
    SELECT id INTO team1_id FROM teams WHERE name = '泥作工班' AND project_id = 'test-project-001' LIMIT 1;
    SELECT id INTO team2_id FROM teams WHERE name = '木工工班' AND project_id = 'test-project-001' LIMIT 1;
    
    -- 獲取工地師傅ID
    SELECT id INTO worker1_id FROM construction_workers WHERE phone = '0912345678' LIMIT 1;
    SELECT id INTO worker2_id FROM construction_workers WHERE phone = '0923456789' LIMIT 1;
    SELECT id INTO worker3_id FROM construction_workers WHERE phone = '0934567890' LIMIT 1;
    
    -- 加入工班
    IF team1_id IS NOT NULL AND worker1_id IS NOT NULL THEN
        INSERT INTO team_workers (team_id, worker_id, role, is_active) VALUES
            (team1_id, worker1_id, 'worker', true),
            (team1_id, worker2_id, 'worker', true)
        ON CONFLICT (team_id, worker_id) DO UPDATE SET is_active = true;
    END IF;
    
    IF team2_id IS NOT NULL AND worker3_id IS NOT NULL THEN
        INSERT INTO team_workers (team_id, worker_id, role, is_active) VALUES
            (team2_id, worker3_id, 'worker', true)
        ON CONFLICT (team_id, worker_id) DO UPDATE SET is_active = true;
    END IF;
END $$;

-- 7. 設置用戶角色（需要先創建用戶）
-- 這些需要在用戶創建後執行
DO $$
DECLARE
    admin_user_id UUID;
    foreman1_id UUID;
    foreman2_id UUID;
    admin_role_id UUID;
    foreman_role_id UUID;
BEGIN
    -- 獲取用戶ID
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1;
    SELECT id INTO foreman1_id FROM auth.users WHERE email = 'foreman1@test.com' LIMIT 1;
    SELECT id INTO foreman2_id FROM auth.users WHERE email = 'foreman2@test.com' LIMIT 1;
    
    -- 獲取角色ID
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin' LIMIT 1;
    SELECT id INTO foreman_role_id FROM roles WHERE name = 'foreman' LIMIT 1;
    
    -- 分配角色
    IF admin_user_id IS NOT NULL AND admin_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id) VALUES
            (admin_user_id, admin_role_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
    IF foreman1_id IS NOT NULL AND foreman_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id) VALUES
            (foreman1_id, foreman_role_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
    IF foreman2_id IS NOT NULL AND foreman_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id) VALUES
            (foreman2_id, foreman_role_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 8. 設置專案權限
DO $$
DECLARE
    admin_user_id UUID;
    foreman1_id UUID;
    foreman2_id UUID;
    owner_id UUID;
BEGIN
    -- 獲取用戶ID
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1;
    SELECT id INTO foreman1_id FROM auth.users WHERE email = 'foreman1@test.com' LIMIT 1;
    SELECT id INTO foreman2_id FROM auth.users WHERE email = 'foreman2@test.com' LIMIT 1;
    SELECT id INTO owner_id FROM auth.users WHERE email = 'owner@test.com' LIMIT 1;
    
    -- 設置權限
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO project_permissions (project_id, user_id, role, can_view, can_edit, can_manage_members, can_view_other_teams) VALUES
            ('test-project-001', admin_user_id, 'admin', true, true, true, true),
            ('test-project-002', admin_user_id, 'admin', true, true, true, true)
        ON CONFLICT (project_id, user_id) DO UPDATE SET
            role = EXCLUDED.role,
            can_view = EXCLUDED.can_view,
            can_edit = EXCLUDED.can_edit,
            can_manage_members = EXCLUDED.can_manage_members,
            can_view_other_teams = EXCLUDED.can_view_other_teams;
    END IF;
    
    IF foreman1_id IS NOT NULL THEN
        INSERT INTO project_permissions (project_id, user_id, role, can_view, can_edit, can_manage_members, can_view_other_teams) VALUES
            ('test-project-001', foreman1_id, 'foreman', true, true, true, false)
        ON CONFLICT (project_id, user_id) DO UPDATE SET
            role = EXCLUDED.role,
            can_view = EXCLUDED.can_view,
            can_edit = EXCLUDED.can_edit,
            can_manage_members = EXCLUDED.can_manage_members,
            can_view_other_teams = EXCLUDED.can_view_other_teams;
    END IF;
    
    IF foreman2_id IS NOT NULL THEN
        INSERT INTO project_permissions (project_id, user_id, role, can_view, can_edit, can_manage_members, can_view_other_teams) VALUES
            ('test-project-001', foreman2_id, 'foreman', true, true, true, false)
        ON CONFLICT (project_id, user_id) DO UPDATE SET
            role = EXCLUDED.role,
            can_view = EXCLUDED.can_view,
            can_edit = EXCLUDED.can_edit,
            can_manage_members = EXCLUDED.can_manage_members,
            can_view_other_teams = EXCLUDED.can_view_other_teams;
    END IF;
    
    IF owner_id IS NOT NULL THEN
        INSERT INTO project_permissions (project_id, user_id, role, can_view, can_edit, can_manage_members, can_view_other_teams) VALUES
            ('test-project-001', owner_id, 'owner', true, false, false, true)
        ON CONFLICT (project_id, user_id) DO UPDATE SET
            role = EXCLUDED.role,
            can_view = EXCLUDED.can_view,
            can_edit = EXCLUDED.can_edit,
            can_manage_members = EXCLUDED.can_manage_members,
            can_view_other_teams = EXCLUDED.can_view_other_teams;
    END IF;
END $$;

-- 查詢測試資料
SELECT 'Projects:' as info;
SELECT id, project_name, status FROM projects;

SELECT 'Teams:' as info;
SELECT t.name, t.project_id, u.email as foreman_email 
FROM teams t 
LEFT JOIN auth.users u ON t.foreman_id = u.id;

SELECT 'Workers:' as info;
SELECT phone, name, email FROM construction_workers;

SELECT 'Permissions:' as info;
SELECT pp.project_id, u.email, pp.role, pp.can_manage_members 
FROM project_permissions pp
JOIN auth.users u ON pp.user_id = u.id;