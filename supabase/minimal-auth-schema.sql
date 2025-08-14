-- ====================================
-- Supabase 最小化認證架構
-- 僅用於認證，不儲存業務資料
-- ====================================

-- 1. 用戶基本資料表（最小化）
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(auth_user_id)
);

-- 2. 認證映射表（關聯到 D1 資料庫）
CREATE TABLE IF NOT EXISTS auth_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    d1_user_id TEXT NOT NULL, -- 對應 D1 engineering-management.users.id
    d1_user_phone TEXT NOT NULL, -- 對應 D1 的電話（用於同步）
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(auth_user_id),
    UNIQUE(d1_user_id)
);

-- 3. 臨時 Session 表（可選，如果需要跨系統 session）
CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================
-- 觸發器和函數
-- ====================================

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 當新用戶註冊時，自動建立 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (auth_user_id, phone, name)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'full_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ====================================
-- RLS 政策（最小權限）
-- ====================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

-- 用戶只能查看自己的 profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth_user_id = auth.uid());

-- 用戶只能更新自己的 profile
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth_user_id = auth.uid());

-- 只有系統可以管理映射表（通過 service role）
CREATE POLICY "Only service role can manage auth_mapping" ON auth_mapping
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Session 管理
CREATE POLICY "Users can view own sessions" ON auth_sessions
    FOR SELECT USING (auth_user_id = auth.uid());

-- ====================================
-- 輔助函數
-- ====================================

-- 根據電話號碼查找或建立用戶映射
CREATE OR REPLACE FUNCTION create_auth_mapping(
    p_phone TEXT,
    p_name TEXT,
    p_d1_user_id TEXT
) RETURNS UUID AS $$
DECLARE
    v_auth_user_id UUID;
BEGIN
    -- 檢查是否已有 Supabase 用戶
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE raw_user_meta_data->>'phone' = p_phone
    LIMIT 1;
    
    -- 如果沒有映射，建立映射
    IF v_auth_user_id IS NOT NULL THEN
        INSERT INTO auth_mapping (auth_user_id, d1_user_id, d1_user_phone)
        VALUES (v_auth_user_id, p_d1_user_id, p_phone)
        ON CONFLICT (auth_user_id) DO UPDATE
        SET d1_user_id = EXCLUDED.d1_user_id,
            last_synced_at = NOW();
    END IF;
    
    RETURN v_auth_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理過期的 session
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM auth_sessions
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- 索引優化
-- ====================================

CREATE INDEX idx_user_profiles_phone ON user_profiles(phone);
CREATE INDEX idx_auth_mapping_d1_user_id ON auth_mapping(d1_user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- ====================================
-- 注意事項
-- ====================================
-- 1. 這個架構只儲存認證必要的資料
-- 2. 所有業務資料（專案、權限等）都在 D1
-- 3. auth_mapping 表用於關聯 Supabase 用戶和 D1 用戶
-- 4. 不要在這裡儲存任何業務邏輯或權限資料