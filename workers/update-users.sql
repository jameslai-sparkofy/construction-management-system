-- 更新測試帳號名稱
UPDATE users 
SET name = '測試帳號' 
WHERE phone = '0912345678';

-- 新增管理員帳號 - 詹姆士
INSERT OR REPLACE INTO users (
    id, 
    phone, 
    password_suffix, 
    name, 
    global_role, 
    source_type,
    created_at
) VALUES (
    'admin_james',
    '0963922033',
    '033',
    '詹姆士',
    'admin',
    'system',
    CURRENT_TIMESTAMP
);

-- 查詢所有管理員用戶
SELECT id, name, phone, global_role, source_type 
FROM users 
WHERE global_role = 'admin' 
   OR phone IN ('0912345678', '0963922033')
ORDER BY created_at DESC;