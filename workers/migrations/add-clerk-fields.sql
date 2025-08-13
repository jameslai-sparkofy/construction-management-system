-- 添加 Clerk 相關欄位到 users 表
-- 如果欄位不存在則添加

-- 添加 clerk_id 欄位
ALTER TABLE users ADD COLUMN clerk_id TEXT;

-- 添加 email 欄位
ALTER TABLE users ADD COLUMN email TEXT;

-- 為 clerk_id 創建索引以加快查詢
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- 為 email 創建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);