-- ====================================
-- 初始化測試用戶資料
-- 請在 Supabase SQL Editor 執行
-- ====================================

-- 1. 建立測試用戶（需要使用 Supabase Dashboard 或 API）
-- 注意：以下是說明，實際需要透過 Supabase Auth API 建立

/*
測試用戶列表：
1. 管理員
   - Email: 0900000001@construction.local  
   - Password: 001
   - Phone: 0900000001
   - Role: admin

2. 工班負責人
   - Email: 0912345678@construction.local
   - Password: 678
   - Phone: 0912345678
   - Role: foreman

3. 業主
   - Email: 0987654321@construction.local
   - Password: 321
   - Phone: 0987654321
   - Role: owner

4. 工班成員
   - Email: 0955555555@construction.local
   - Password: 555
   - Phone: 0955555555
   - Role: worker
*/

-- 2. 建立用戶檔案（在建立 Auth 用戶後執行）
-- 假設已經有對應的 auth.users 記錄

-- 管理員
INSERT INTO user_profiles (auth_user_id, phone, name, created_at)
SELECT 
    id,
    '0900000001',
    '系統管理員',
    NOW()
FROM auth.users 
WHERE email = '0900000001@construction.local'
ON CONFLICT (auth_user_id) DO UPDATE
SET 
    phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    updated_at = NOW();

-- 工班負責人
INSERT INTO user_profiles (auth_user_id, phone, name, created_at)
SELECT 
    id,
    '0912345678',
    '張工班長',
    NOW()
FROM auth.users 
WHERE email = '0912345678@construction.local'
ON CONFLICT (auth_user_id) DO UPDATE
SET 
    phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    updated_at = NOW();

-- 業主
INSERT INTO user_profiles (auth_user_id, phone, name, created_at)
SELECT 
    id,
    '0987654321',
    '王業主',
    NOW()
FROM auth.users 
WHERE email = '0987654321@construction.local'
ON CONFLICT (auth_user_id) DO UPDATE
SET 
    phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    updated_at = NOW();

-- 工班成員
INSERT INTO user_profiles (auth_user_id, phone, name, created_at)
SELECT 
    id,
    '0955555555',
    '李師傅',
    NOW()
FROM auth.users 
WHERE email = '0955555555@construction.local'
ON CONFLICT (auth_user_id) DO UPDATE
SET 
    phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    updated_at = NOW();

-- 3. 建立認證映射
-- 管理員映射
INSERT INTO auth_mapping (auth_user_id, d1_user_id, d1_user_phone, last_synced_at)
SELECT 
    id,
    'admin_001',
    '0900000001',
    NOW()
FROM auth.users 
WHERE email = '0900000001@construction.local'
ON CONFLICT (auth_user_id) DO UPDATE
SET 
    d1_user_phone = EXCLUDED.d1_user_phone,
    last_synced_at = NOW();

-- 工班負責人映射
INSERT INTO auth_mapping (auth_user_id, d1_user_id, d1_user_phone, last_synced_at)
SELECT 
    id,
    'foreman_001',
    '0912345678',
    NOW()
FROM auth.users 
WHERE email = '0912345678@construction.local'
ON CONFLICT (auth_user_id) DO UPDATE
SET 
    d1_user_phone = EXCLUDED.d1_user_phone,
    last_synced_at = NOW();

-- 業主映射
INSERT INTO auth_mapping (auth_user_id, d1_user_id, d1_user_phone, last_synced_at)
SELECT 
    id,
    'owner_001',
    '0987654321',
    NOW()
FROM auth.users 
WHERE email = '0987654321@construction.local'
ON CONFLICT (auth_user_id) DO UPDATE
SET 
    d1_user_phone = EXCLUDED.d1_user_phone,
    last_synced_at = NOW();

-- 工班成員映射
INSERT INTO auth_mapping (auth_user_id, d1_user_id, d1_user_phone, last_synced_at)
SELECT 
    id,
    'worker_001',
    '0955555555',
    NOW()
FROM auth.users 
WHERE email = '0955555555@construction.local'
ON CONFLICT (auth_user_id) DO UPDATE
SET 
    d1_user_phone = EXCLUDED.d1_user_phone,
    last_synced_at = NOW();

-- 4. 檢查結果
SELECT 
    'User Profiles' as table_name,
    COUNT(*) as count
FROM user_profiles
UNION ALL
SELECT 
    'Auth Mappings',
    COUNT(*)
FROM auth_mapping;

-- 5. 顯示所有用戶和映射狀態
SELECT 
    u.email,
    up.phone,
    up.name,
    am.d1_user_id,
    CASE 
        WHEN am.auth_user_id IS NOT NULL THEN '✅ 已映射'
        ELSE '❌ 未映射'
    END as mapping_status
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.auth_user_id
LEFT JOIN auth_mapping am ON u.id = am.auth_user_id
WHERE u.email LIKE '%@construction.local'
ORDER BY u.created_at DESC;