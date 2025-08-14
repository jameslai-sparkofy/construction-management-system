# Supabase 設定指南

## 1. 認證設定

### Email 認證設定
1. 登入 Supabase Dashboard: https://app.supabase.com
2. 選擇你的專案 (pbecqosbkuyypsgwxnmq)
3. 進入 **Authentication → Providers**
4. 確認 **Email** 已啟用
5. 設定以下選項：
   - ✅ Enable Email provider
   - ✅ Enable Email Confirmations (可選)
   - ✅ Enable Email Magic Links (可選)

### 認證設定
進入 **Authentication → Settings**：
- **Site URL**: `https://construction-management-frontend-dev.pages.dev`
- **Redirect URLs** 加入：
  - `https://construction-management-frontend-dev.pages.dev/*`
  - `https://construction-management-frontend.pages.dev/*`
  - `http://localhost:3000/*` (開發用)

## 2. 資料庫設定

### 執行初始化 SQL
1. 進入 **SQL Editor**
2. 貼上 `setup.sql` 的內容
3. 點擊 **Run** 執行

### 驗證資料表
進入 **Table Editor** 確認以下資料表已建立：
- `user_profiles` - 用戶資料
- `projects` - 專案資料
- `project_grids` - 工地格子
- `project_photos` - 照片記錄
- `activity_logs` - 活動記錄

## 3. Storage 設定

### 建立儲存桶
1. 進入 **Storage**
2. 建立新的 bucket：`project-photos`
3. 設定為 **Public** (公開存取)
4. 設定 CORS：
```json
[
  {
    "origin": ["*"],
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "headers": ["*"],
    "maxAge": 3600
  }
]
```

## 4. 建立測試帳號

### 方法 1: 使用 Dashboard
1. 進入 **Authentication → Users**
2. 點擊 **Invite User**
3. 輸入：
   - Email: `test@example.com`
   - Password: `test123456`
4. 點擊 **Send Invitation**

### 方法 2: 使用 SQL
```sql
-- 在 SQL Editor 執行
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    uuid_generate_v4(),
    'authenticated',
    'authenticated',
    'test@example.com',
    crypt('test123456', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "測試用戶", "company": "元心建材"}'
);
```

## 5. API Keys

### 取得 Keys
進入 **Settings → API**：

- **URL**: `https://pbecqosbkuyypsgwxnmq.supabase.co`
- **Anon Key** (公開): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Service Role Key** (私密): 保存在安全的地方，用於後端

## 6. Edge Functions (選用)

如果需要自訂後端邏輯：

### 建立 Edge Function
```bash
supabase functions new project-sync
```

### 部署
```bash
supabase functions deploy project-sync
```

## 7. 監控與日誌

### 查看認證日誌
- **Authentication → Logs** - 查看登入記錄
- **Logs → Edge Functions** - 查看函數執行記錄
- **Logs → Database** - 查看資料庫查詢記錄

## 8. 安全設定

### RLS (Row Level Security)
確認所有資料表都已啟用 RLS：
```sql
-- 檢查 RLS 狀態
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 環境變數
在 Cloudflare Workers 設定：
```bash
# 使用 wrangler secret
wrangler secret put SUPABASE_URL
# 輸入: https://pbecqosbkuyypsgwxnmq.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# 輸入: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

wrangler secret put SUPABASE_SERVICE_KEY
# 輸入: [Service Role Key]
```

## 測試檢查清單

- [ ] Email 登入功能正常
- [ ] 新用戶註冊功能正常
- [ ] 用戶資料自動建立
- [ ] 專案 CRUD 操作正常
- [ ] 照片上傳功能正常
- [ ] RLS 權限正確運作

## 故障排除

### 常見問題

1. **登入失敗 "Invalid login credentials"**
   - 確認 Email 已啟用
   - 確認密碼至少 6 個字元
   - 檢查用戶是否存在

2. **CORS 錯誤**
   - 確認 Redirect URLs 設定正確
   - 檢查 Storage CORS 設定

3. **資料無法寫入**
   - 確認 RLS 政策正確
   - 檢查用戶是否已認證

## 支援資源

- [Supabase 文檔](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- 專案 Dashboard: https://app.supabase.com/project/pbecqosbkuyypsgwxnmq