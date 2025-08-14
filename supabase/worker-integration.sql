-- ====================================
-- 工地師傅整合資料表
-- ====================================

-- 工地師傅主表 (對應 D1 的 object_50HJ8__c)
CREATE TABLE IF NOT EXISTS construction_workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT UNIQUE NOT NULL, -- 電話號碼作為唯一識別
    name TEXT NOT NULL,
    email TEXT,
    
    -- Supabase 用戶關聯
    user_id UUID REFERENCES auth.users(id),
    
    -- 基本資料
    id_number TEXT, -- 身分證字號
    address TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    
    -- 工作資訊
    skill_type TEXT, -- 技能類型 (木工、水電、油漆等)
    experience_years INTEGER,
    daily_wage DECIMAL(10,2),
    
    -- 狀態
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 從 D1 同步的資料
    d1_record_id TEXT, -- D1 資料庫的記錄 ID
    d1_sync_at TIMESTAMP WITH TIME ZONE -- 最後同步時間
);

-- 工班與工地師傅關聯表
CREATE TABLE IF NOT EXISTS team_workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES construction_workers(id) ON DELETE CASCADE,
    
    -- 角色
    role TEXT DEFAULT 'worker', -- worker, foreman
    
    -- 加入資訊
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by UUID REFERENCES auth.users(id),
    
    -- 狀態
    is_active BOOLEAN DEFAULT true,
    left_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(team_id, worker_id)
);

-- 工地師傅專案歷史記錄
CREATE TABLE IF NOT EXISTS worker_project_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID REFERENCES construction_workers(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    
    -- 工作記錄
    start_date DATE,
    end_date DATE,
    total_days INTEGER,
    total_area DECIMAL(10,2), -- 總施工面積
    
    -- 評價
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================
-- 輔助函數
-- ====================================

-- 根據電話號碼查找或建立工地師傅
CREATE OR REPLACE FUNCTION find_or_create_worker(
    p_phone TEXT,
    p_name TEXT,
    p_email TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_worker_id UUID;
    v_user_id UUID;
BEGIN
    -- 查找現有工地師傅
    SELECT id, user_id INTO v_worker_id, v_user_id
    FROM construction_workers
    WHERE phone = p_phone;
    
    IF v_worker_id IS NOT NULL THEN
        -- 更新資料
        UPDATE construction_workers
        SET 
            name = COALESCE(p_name, name),
            email = COALESCE(p_email, email),
            updated_at = NOW()
        WHERE id = v_worker_id;
        
        RETURN v_worker_id;
    END IF;
    
    -- 建立新的工地師傅
    INSERT INTO construction_workers (phone, name, email)
    VALUES (p_phone, p_name, p_email)
    RETURNING id INTO v_worker_id;
    
    RETURN v_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 將工地師傅加入工班
CREATE OR REPLACE FUNCTION add_worker_to_team(
    p_worker_phone TEXT,
    p_worker_name TEXT,
    p_team_id UUID,
    p_role TEXT DEFAULT 'worker',
    p_added_by UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_worker_id UUID;
BEGIN
    -- 查找或建立工地師傅
    v_worker_id := find_or_create_worker(p_worker_phone, p_worker_name);
    
    -- 加入工班
    INSERT INTO team_workers (team_id, worker_id, role, added_by)
    VALUES (p_team_id, v_worker_id, p_role, p_added_by)
    ON CONFLICT (team_id, worker_id) 
    DO UPDATE SET 
        role = p_role,
        is_active = true,
        left_at = NULL;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 同步工地師傅與 Supabase 用戶
CREATE OR REPLACE FUNCTION sync_worker_with_user(
    p_worker_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE construction_workers
    SET 
        user_id = p_user_id,
        updated_at = NOW()
    WHERE id = p_worker_id;
    
    -- 同步用戶資料
    UPDATE user_profiles
    SET 
        phone = (SELECT phone FROM construction_workers WHERE id = p_worker_id)
    WHERE id = p_user_id;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 取得工地師傅的所有工班
CREATE OR REPLACE FUNCTION get_worker_teams(p_worker_phone TEXT)
RETURNS TABLE (
    team_id UUID,
    team_name TEXT,
    project_id UUID,
    project_name TEXT,
    role TEXT,
    joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as team_id,
        t.name as team_name,
        p.id as project_id,
        p.project_name,
        tw.role,
        tw.joined_at
    FROM construction_workers cw
    JOIN team_workers tw ON cw.id = tw.worker_id
    JOIN teams t ON tw.team_id = t.id
    JOIN projects p ON t.project_id = p.id
    WHERE cw.phone = p_worker_phone
    AND tw.is_active = true
    ORDER BY tw.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- 觸發器
-- ====================================

-- 當建立 Supabase 用戶時，自動建立工地師傅記錄
CREATE OR REPLACE FUNCTION handle_new_user_worker()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果用戶有電話號碼，檢查是否已有工地師傅記錄
    IF NEW.raw_user_meta_data->>'phone' IS NOT NULL THEN
        -- 嘗試關聯現有工地師傅
        UPDATE construction_workers
        SET user_id = NEW.id
        WHERE phone = NEW.raw_user_meta_data->>'phone'
        AND user_id IS NULL;
        
        -- 如果沒有現有記錄，建立新的
        IF NOT FOUND THEN
            INSERT INTO construction_workers (
                phone,
                name,
                email,
                user_id
            ) VALUES (
                NEW.raw_user_meta_data->>'phone',
                COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
                NEW.email,
                NEW.id
            ) ON CONFLICT (phone) DO UPDATE
            SET user_id = NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 建立觸發器
DROP TRIGGER IF EXISTS on_auth_user_created_worker ON auth.users;
CREATE TRIGGER on_auth_user_created_worker
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_worker();

-- ====================================
-- RLS 政策
-- ====================================

ALTER TABLE construction_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_project_history ENABLE ROW LEVEL SECURITY;

-- 工地師傅政策
CREATE POLICY "Workers can view their own data" ON construction_workers
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'foreman')
        )
    );

CREATE POLICY "Foreman can manage workers" ON construction_workers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'foreman')
        )
    );

-- 工班成員政策
CREATE POLICY "Team members can view their teams" ON team_workers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM construction_workers cw
            WHERE cw.id = worker_id AND cw.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_id AND t.foreman_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        )
    );

-- ====================================
-- 索引優化
-- ====================================

CREATE INDEX idx_construction_workers_phone ON construction_workers(phone);
CREATE INDEX idx_construction_workers_user_id ON construction_workers(user_id);
CREATE INDEX idx_team_workers_team_id ON team_workers(team_id);
CREATE INDEX idx_team_workers_worker_id ON team_workers(worker_id);
CREATE INDEX idx_worker_project_history_worker ON worker_project_history(worker_id);
CREATE INDEX idx_worker_project_history_project ON worker_project_history(project_id);