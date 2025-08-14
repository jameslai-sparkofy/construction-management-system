-- ====================================
-- 初始化測試資料
-- 請在執行 minimal-auth-schema.sql 之後執行
-- ====================================

-- 1. 建立測試用的管理員映射
-- 假設已經有一個 admin@test.com 的 Supabase 用戶
-- 密碼: admin123
DO $$
DECLARE
    v_admin_id UUID;
BEGIN
    -- 檢查是否有 admin 用戶
    SELECT id INTO v_admin_id 
    FROM auth.users 
    WHERE email = 'admin@test.com' 
    LIMIT 1;
    
    IF v_admin_id IS NOT NULL THEN
        -- 建立映射
        INSERT INTO auth_mapping (
            auth_user_id,
            d1_user_id,
            d1_user_phone
        ) VALUES (
            v_admin_id,
            'admin_001',  -- D1 中的 admin ID
            '0900000001'  -- 管理員電話
        ) ON CONFLICT (auth_user_id) DO UPDATE
        SET last_synced_at = NOW();
        
        RAISE NOTICE '管理員映射已建立';
    ELSE
        RAISE NOTICE '請先建立 admin@test.com 用戶';
    END IF;
END $$;

-- 2. 清理過期 sessions (可選)
DELETE FROM auth_sessions WHERE expires_at < NOW();

-- 3. 檢查表格狀態
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM user_profiles
UNION ALL
SELECT 'auth_mapping', COUNT(*) FROM auth_mapping
UNION ALL
SELECT 'auth_sessions', COUNT(*) FROM auth_sessions;

-- 4. 顯示 RLS 狀態
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '✅ RLS 已啟用'
        ELSE '❌ RLS 未啟用'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'auth_mapping', 'auth_sessions');

-- 5. 顯示現有政策
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual IS NOT NULL as has_using,
    with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_profiles', 'auth_mapping', 'auth_sessions')
ORDER BY tablename, policyname;

-- ====================================
-- 輔助查詢
-- ====================================

-- 查看所有 Supabase 用戶和他們的映射
CREATE OR REPLACE VIEW user_auth_status AS
SELECT 
    u.id as auth_id,
    u.email,
    u.raw_user_meta_data->>'phone' as phone,
    u.raw_user_meta_data->>'full_name' as name,
    u.raw_user_meta_data->>'role' as role,
    u.created_at as user_created,
    am.d1_user_id,
    am.d1_user_phone,
    am.last_synced_at,
    CASE 
        WHEN am.auth_user_id IS NOT NULL THEN '✅ 已映射'
        ELSE '❌ 未映射'
    END as mapping_status
FROM auth.users u
LEFT JOIN auth_mapping am ON u.id = am.auth_user_id
ORDER BY u.created_at DESC;

-- 使用範例：
-- SELECT * FROM user_auth_status;

-- ====================================
-- 測試用函數
-- ====================================

-- 快速建立測試業主
CREATE OR REPLACE FUNCTION create_test_owner(
    p_phone TEXT,
    p_name TEXT,
    p_email TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_password TEXT;
BEGIN
    -- 密碼為電話末3碼
    v_password := RIGHT(p_phone, 3);
    
    -- 建立 Supabase 用戶
    -- 注意：這個函數通常需要 service_role 權限
    -- 實際應用中應該透過 API 呼叫
    
    -- 建立 user_profile
    INSERT INTO user_profiles (
        auth_user_id,
        phone,
        name
    ) VALUES (
        gen_random_uuid(), -- 臨時 ID，實際應該是 auth.users 的 ID
        p_phone,
        p_name
    ) RETURNING auth_user_id INTO v_user_id;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- 診斷查詢
-- ====================================

-- 1. 檢查孤立的映射（沒有對應的 Supabase 用戶）
SELECT 
    am.*,
    '⚠️ 孤立映射' as status
FROM auth_mapping am
LEFT JOIN auth.users u ON am.auth_user_id = u.id
WHERE u.id IS NULL;

-- 2. 檢查沒有映射的 Supabase 用戶
SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'phone' as phone,
    '⚠️ 缺少 D1 映射' as status
FROM auth.users u
LEFT JOIN auth_mapping am ON u.id = am.auth_user_id
WHERE am.auth_user_id IS NULL;

-- 3. 顯示系統狀態摘要
SELECT 
    'Supabase 用戶總數' as metric,
    COUNT(*) as value
FROM auth.users
UNION ALL
SELECT 
    '已映射用戶數',
    COUNT(*)
FROM auth_mapping
UNION ALL
SELECT 
    '活躍 Sessions',
    COUNT(*)
FROM auth_sessions
WHERE expires_at > NOW();

-- ====================================
-- 注意事項
-- ====================================
-- 1. 這個腳本僅用於開發和測試
-- 2. 生產環境中，用戶建立應該透過前端 API
-- 3. 定期清理過期的 sessions
-- 4. 監控孤立的映射記錄