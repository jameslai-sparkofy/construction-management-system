# Supabase 專案資訊

## 專案詳情
- **專案名稱**: engineer-management  
- **專案 ID**: pbecqosbkuyypsgwxnmq
- **專案 URL**: https://pbecqosbkuyypsgwxnmq.supabase.co
- **地區**: Northeast Asia (Tokyo)
- **資料庫密碼**: EngineerManage2024!

## Dashboard 連結
- **主控台**: https://supabase.com/dashboard/project/pbecqosbkuyypsgwxnmq
- **API 設定**: https://supabase.com/dashboard/project/pbecqosbkuyypsgwxnmq/settings/api
- **身份驗證**: https://supabase.com/dashboard/project/pbecqosbkuyypsgwxnmq/auth/providers
- **資料庫**: https://supabase.com/dashboard/project/pbecqosbkuyypsgwxnmq/editor

## 獲取 API Keys 步驟

1. 訪問: https://supabase.com/dashboard/project/pbecqosbkuyypsgwxnmq/settings/api
2. 複製以下 Keys:
   - **anon (public)** key - 用於前端
   - **service_role (secret)** key - 用於後端

## 設定手機驗證

1. 進入 Authentication > Providers
2. 啟用 Phone
3. 關閉 Email（如果只要手機登入）

## 測試用戶
可以在 Authentication > Users 手動創建測試用戶

## CLI 連結命令
```bash
cd /mnt/c/claude\ code/工程管理
npx supabase link --project-ref pbecqosbkuyypsgwxnmq --password "EngineerManage2024!"
```

## 初始化資料庫
```sql
-- 創建用戶擴展表
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  phone TEXT UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'member',
  company TEXT DEFAULT 'yes-ceramics',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 啟用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 創建政策
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);
```