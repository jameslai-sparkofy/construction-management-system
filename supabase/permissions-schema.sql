-- ====================================
-- 權限系統資料表結構
-- ====================================

-- 1. 角色定義表
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, -- admin, foreman, worker, owner
    display_name TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}', -- 角色權限配置
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 用戶角色關聯表（全域角色）
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- 3. 專案權限表（專案級別權限）
CREATE TABLE IF NOT EXISTS project_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- foreman, worker, owner
    permissions JSONB DEFAULT '{}', -- 專案特定權限
    -- 權限詳細設定
    can_view BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_manage_members BOOLEAN DEFAULT false,
    can_view_other_teams BOOLEAN DEFAULT false, -- 是否可以看其他工班進度
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- 權限過期時間（可選）
    UNIQUE(project_id, user_id)
);

-- 4. 工班管理表
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    foreman_id UUID REFERENCES auth.users(id), -- 工班負責人
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 工班成員表
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'worker', -- worker, foreman
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- 6. 權限日誌表（審計用）
CREATE TABLE IF NOT EXISTS permission_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL, -- grant, revoke, modify
    target_user_id UUID REFERENCES auth.users(id),
    project_id UUID REFERENCES projects(id),
    role TEXT,
    permissions JSONB,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT
);

-- ====================================
-- 初始化角色資料
-- ====================================

INSERT INTO roles (name, display_name, description, permissions) VALUES
('admin', '管理員', '系統管理員，擁有所有權限', 
    '{"all": true}'::jsonb),
('foreman', '工班負責人', '負責管理工班成員，編輯案場資料', 
    '{"view_projects": true, "edit_sites": true, "manage_team": true, "upload_photos": true}'::jsonb),
('worker', '工班成員', '執行施工，上傳照片', 
    '{"view_projects": true, "edit_sites": true, "upload_photos": true}'::jsonb),
('owner', '業主', '專案業主，檢視進度', 
    '{"view_projects": true, "view_reports": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ====================================
-- RLS 政策
-- ====================================

-- 啟用 RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_logs ENABLE ROW LEVEL SECURITY;

-- 角色表政策
CREATE POLICY "Everyone can view roles" ON roles
    FOR SELECT USING (true);

-- 用戶角色政策
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ));

CREATE POLICY "Admins can manage user roles" ON user_roles
    FOR ALL USING (EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ));

-- 專案權限政策
CREATE POLICY "Users can view their project permissions" ON project_permissions
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    );

CREATE POLICY "Project managers can grant permissions" ON project_permissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_permissions pp
            WHERE pp.project_id = project_id 
            AND pp.user_id = auth.uid() 
            AND (pp.can_manage_members = true OR pp.role = 'foreman')
        ) OR EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    );

-- 工班管理政策
CREATE POLICY "Team members can view their teams" ON teams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = id AND tm.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM project_permissions pp
            WHERE pp.project_id = project_id AND pp.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    );

-- ====================================
-- 輔助函數
-- ====================================

-- 檢查用戶是否有特定權限
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_project_id UUID,
    p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    -- 檢查是否為管理員
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = p_user_id AND r.name = 'admin'
    ) INTO v_has_permission;
    
    IF v_has_permission THEN
        RETURN TRUE;
    END IF;
    
    -- 檢查專案權限
    SELECT 
        CASE p_permission
            WHEN 'view' THEN can_view
            WHEN 'edit' THEN can_edit
            WHEN 'delete' THEN can_delete
            WHEN 'manage_members' THEN can_manage_members
            WHEN 'view_other_teams' THEN can_view_other_teams
            ELSE FALSE
        END
    INTO v_has_permission
    FROM project_permissions
    WHERE project_id = p_project_id 
    AND user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN COALESCE(v_has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 取得用戶在專案中的角色
CREATE OR REPLACE FUNCTION get_user_project_role(
    p_user_id UUID,
    p_project_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- 檢查是否為管理員
    IF EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = p_user_id AND r.name = 'admin'
    ) THEN
        RETURN 'admin';
    END IF;
    
    -- 取得專案角色
    SELECT role INTO v_role
    FROM project_permissions
    WHERE project_id = p_project_id 
    AND user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 取得用戶可以存取的專案列表
CREATE OR REPLACE FUNCTION get_user_projects(p_user_id UUID)
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    role TEXT,
    can_edit BOOLEAN,
    can_manage_members BOOLEAN
) AS $$
BEGIN
    -- 如果是管理員，返回所有專案
    IF EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = p_user_id AND r.name = 'admin'
    ) THEN
        RETURN QUERY
        SELECT 
            p.id,
            p.project_name,
            'admin'::TEXT as role,
            TRUE as can_edit,
            TRUE as can_manage_members
        FROM projects p;
    ELSE
        -- 返回有權限的專案
        RETURN QUERY
        SELECT 
            p.id,
            p.project_name,
            pp.role,
            pp.can_edit,
            pp.can_manage_members
        FROM projects p
        JOIN project_permissions pp ON p.id = pp.project_id
        WHERE pp.user_id = p_user_id
        AND (pp.expires_at IS NULL OR pp.expires_at > NOW());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- 索引優化
-- ====================================

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_project_permissions_project_id ON project_permissions(project_id);
CREATE INDEX idx_project_permissions_user_id ON project_permissions(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_permission_logs_target_user ON permission_logs(target_user_id);
CREATE INDEX idx_permission_logs_project ON permission_logs(project_id);