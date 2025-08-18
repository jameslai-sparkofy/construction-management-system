-- 資料遷移：從 project_users 提取唯一用戶到 users 表
-- Created: 2025-08-18

-- =====================================================
-- 手機號碼標準化函數的實作
-- =====================================================
-- 由於 SQLite 沒有內建 REGEXP_REPLACE，我們用簡單的邏輯處理

-- =====================================================
-- 步驟 1: 從 project_users 提取唯一用戶
-- =====================================================

-- 插入來自 project_users 的唯一用戶
INSERT OR IGNORE INTO users (
  id,
  phone,
  password_suffix,
  name,
  global_role,
  source_type,
  source_id,
  is_active,
  is_verified,
  user_status,
  created_at
)
SELECT 
  -- 生成唯一 ID
  'user_' || substr(
    lower(hex(randomblob(8))), 1, 16
  ) as id,
  
  -- 標準化手機號碼
  CASE 
    -- +886-xxxxxxxxx 格式處理
    WHEN phone LIKE '+886-%' THEN 
      '0' || substr(replace(phone, '+886-', ''), 1, 9)
    -- +886xxxxxxxxx 格式處理  
    WHEN phone LIKE '+886%' THEN 
      '0' || substr(replace(phone, '+886', ''), 1, 9)
    -- 去除所有非數字字符，保持 09xxxxxxxx 格式
    WHEN phone LIKE '09%' THEN 
      substr(replace(replace(replace(phone, '-', ''), ' ', ''), '+', ''), 1, 10)
    -- 其他格式嘗試標準化
    ELSE 
      substr(replace(replace(replace(phone, '-', ''), ' ', ''), '+', ''), 1, 10)
  END as normalized_phone,
  
  -- 預設密碼為手機號碼後3碼
  CASE 
    -- 從標準化後的手機號碼取後3碼
    WHEN phone LIKE '+886-%' THEN 
      substr('0' || substr(replace(phone, '+886-', ''), 1, 9), -3)
    WHEN phone LIKE '+886%' THEN 
      substr('0' || substr(replace(phone, '+886', ''), 1, 9), -3)
    WHEN phone LIKE '09%' THEN 
      substr(replace(replace(replace(phone, '-', ''), ' ', ''), '+', ''), -3)
    ELSE 
      substr(replace(replace(replace(phone, '-', ''), ' ', ''), '+', ''), -3)
  END as password_suffix,
  
  name,
  
  -- 根據 user_type 設定角色
  CASE 
    WHEN user_type = 'admin' THEN 'admin'
    WHEN user_type = 'owner' THEN 'user'
    WHEN user_type = 'worker' THEN 'user'
    ELSE 'user'
  END as global_role,
  
  -- 設定來源類型
  CASE 
    WHEN source_table = 'employees_simple' THEN 'system'
    WHEN source_table LIKE 'object_%' THEN 'crm_worker'
    ELSE 'manual'
  END as source_type,
  
  -- 來源 ID (如果有的話)
  COALESCE(source_id, user_id) as source_id,
  
  1 as is_active,
  0 as is_verified,  -- 需要首次登入驗證
  'pending' as user_status,
  
  COALESCE(added_at, CURRENT_TIMESTAMP) as created_at

FROM (
  -- 取得唯一的用戶記錄 (按手機號碼去重)
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY 
        -- 用標準化的手機號碼做去重
        CASE 
          WHEN phone LIKE '+886-%' THEN 
            '0' || substr(replace(phone, '+886-', ''), 1, 9)
          WHEN phone LIKE '+886%' THEN 
            '0' || substr(replace(phone, '+886', ''), 1, 9)
          WHEN phone LIKE '09%' THEN 
            substr(replace(replace(replace(phone, '-', ''), ' ', ''), '+', ''), 1, 10)
          ELSE 
            substr(replace(replace(replace(phone, '-', ''), ' ', ''), '+', ''), 1, 10)
        END
      ORDER BY added_at ASC
    ) as rn
  FROM project_users 
  WHERE phone IS NOT NULL 
    AND trim(phone) != ''
    AND phone NOT IN ('0912345678', '0963922033')  -- 排除已存在的管理員
) ranked_users
WHERE rn = 1;  -- 只取每個手機號碼的第一筆記錄

-- =====================================================
-- 步驟 2: 檢查並修復資料
-- =====================================================

-- 更新無效的手機號碼
UPDATE users 
SET phone = '0900000000'
WHERE length(phone) < 10 
   OR phone NOT LIKE '09%';

-- 更新空的密碼
UPDATE users 
SET password_suffix = '000'
WHERE password_suffix IS NULL 
   OR length(password_suffix) < 3;

-- 確保密碼只有數字
UPDATE users 
SET password_suffix = substr(replace(replace(password_suffix, '-', ''), '+', ''), -3)
WHERE password_suffix LIKE '%-%' 
   OR password_suffix LIKE '%+%';

-- =====================================================
-- 步驟 3: 記錄遷移日誌
-- =====================================================
INSERT INTO audit_logs (
  user_id,
  action,
  target_type,
  changes,
  created_at
) VALUES (
  'super_admin_001',
  'migration',
  'users',
  json_object(
    'description', 'Migrated users from project_users table',
    'total_users', (SELECT COUNT(*) FROM users WHERE source_type != 'system'),
    'migration_date', datetime('now')
  ),
  CURRENT_TIMESTAMP
);

-- =====================================================
-- 步驟 4: 檢查結果
-- =====================================================
-- 這些查詢只是為了檢查，不會返回到 API

-- 查看遷移結果統計
SELECT 
  'Migration Summary' as info,
  COUNT(*) as total_users,
  COUNT(CASE WHEN global_role = 'super_admin' THEN 1 END) as super_admins,
  COUNT(CASE WHEN global_role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN global_role = 'user' THEN 1 END) as users,
  COUNT(CASE WHEN source_type = 'system' THEN 1 END) as system_users,
  COUNT(CASE WHEN source_type = 'crm_worker' THEN 1 END) as crm_users,
  COUNT(CASE WHEN source_type = 'manual' THEN 1 END) as manual_users
FROM users;