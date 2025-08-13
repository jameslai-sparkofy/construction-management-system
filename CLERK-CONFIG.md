# Clerk 配置檢查清單

## 🔑 API Keys 更新位置

### 1. Backend (Worker)
檔案：`/workers/wrangler.toml`
```toml
[vars]
CLERK_PUBLISHABLE_KEY = "你的_PUBLISHABLE_KEY"
CLERK_SECRET_KEY = "你的_SECRET_KEY"
```

### 2. Frontend
檔案：`/frontend/login-clerk.html`
```html
<script
    data-clerk-publishable-key="你的_PUBLISHABLE_KEY"
    ...
></script>
```

在 JavaScript 中：
```javascript
const CLERK_PUBLISHABLE_KEY = '你的_PUBLISHABLE_KEY';
```

## ✅ Clerk Dashboard 設定檢查清單

### 基本設定
- [ ] 應用程式已創建
- [ ] 應用程式名稱設定為「Construction Management」

### 域名設定
- [ ] 已添加 `construction-management-frontend.pages.dev`
- [ ] 已添加 `manage.yes-ceramics.com` (如果有)
- [ ] 已添加 `localhost:8787` (本地開發)

### 認證方式
- [ ] 手機號碼登入已啟用
- [ ] 預設國碼設為 +886
- [ ] SMS 驗證已啟用
- [ ] 允許新用戶註冊

### SMS 設定（重要）
- [ ] 已選擇 SMS 提供商 (Twilio/Vonage/AWS SNS)
- [ ] 已填入 API 憑證
- [ ] 已測試發送簡訊

### 外觀設定
- [ ] 主題顏色設為 #667eea
- [ ] 語言設為繁體中文
- [ ] 字體設定完成

### API Keys
- [ ] 已複製 Publishable Key
- [ ] 已複製 Secret Key
- [ ] 已更新 wrangler.toml
- [ ] 已更新 login-clerk.html

## 🧪 測試步驟

1. **本地測試**
   ```bash
   cd workers
   npx wrangler dev
   ```
   訪問：http://localhost:8787

2. **線上測試**
   訪問：https://construction-management-frontend.pages.dev/login-clerk.html

3. **測試流程**
   - 輸入手機號碼
   - 收到簡訊驗證碼
   - 輸入驗證碼
   - 成功登入

## ⚠️ 常見問題

### 1. 收不到簡訊
- 檢查 SMS 提供商設定
- 確認手機號碼格式正確
- 查看 Clerk Dashboard 的 Logs

### 2. 域名錯誤
錯誤訊息：「This domain is not allowed」
- 確認域名已添加到 Clerk Dashboard
- 檢查是否包含 https://
- 等待幾分鐘讓設定生效

### 3. API Key 錯誤
錯誤訊息：「Invalid API key」
- 確認使用正確環境的 key (test vs live)
- 檢查是否有多餘空格
- 重新部署 Worker

## 📞 支援資源

- Clerk 文檔：https://clerk.com/docs
- Clerk Discord：https://discord.com/invite/b5rXHjAg7A
- Clerk 支援：support@clerk.com

## 🎯 下一步

1. 完成所有設定
2. 測試登入流程
3. 監控使用情況 (Dashboard → Analytics)
4. 設定 Webhook (選用，用於同步用戶資料)