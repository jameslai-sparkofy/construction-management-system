-- 創建測試用戶
INSERT INTO users (
  id, 
  phone, 
  name, 
  email, 
  password_suffix, 
  global_role, 
  user_status, 
  is_active,
  created_at,
  updated_at
) VALUES (
  'test-user-001',
  '0912345678',
  '測試用戶',
  'test@example.com',
  '123',
  'admin',
  'active',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);